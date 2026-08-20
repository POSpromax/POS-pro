import type { Order, OrderStatus, PaymentMethod } from '../types/pos';
import { ensureRealtimeAuth, getSupabase, isSupabaseConfigured } from '../lib/supabase';

async function token(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token || '';
}

async function request<T>(url: string, init?: RequestInit, authenticated = true): Promise<T> {
  const accessToken = authenticated ? await token() : '';
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(init?.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Layanan pesanan tidak tersedia');
  return data as T;
}

export const listCloudOrders = (branchId: string): Promise<Order[]> =>
  request<Order[]>(`/api/orders?branchId=${encodeURIComponent(branchId)}`);

// Versi RINGKAS tanpa item — untuk dashboard owner yang hanya butuh agregat
// (omzet, jumlah transaksi). Payload jauh lebih kecil → hemat egress.
export const listCloudOrdersSummary = (branchId: string): Promise<Order[]> =>
  request<Order[]>(`/api/orders?branchId=${encodeURIComponent(branchId)}&summary=1`);

// Sinkron INKREMENTAL: hanya order yang berubah sejak waktu tertentu (ISO).
// Dipakai penyelaras berkala supaya tidak mengunduh ulang seluruh daftar.
export const listCloudOrdersSince = (branchId: string, since: string): Promise<Order[]> =>
  request<Order[]>(`/api/orders?branchId=${encodeURIComponent(branchId)}&since=${encodeURIComponent(since)}`);

// Laporan tidak boleh bergantung pada jendela 150 order operasional. Endpoint
// dibaca per halaman supaya histori periode yang dipilih lengkap tanpa respons
// tunggal berukuran besar.
export async function listCloudOrdersForReport(branchId: string, from: string, to: string, summary = false): Promise<Order[]> {
  const pageSize = 500;
  const rows: Order[] = [];
  const safeFrom = new Date(from);
  const safeTo = new Date(to);
  const normalizedFrom = Number.isNaN(safeFrom.getTime()) || safeFrom.getUTCFullYear() < 1970
    ? new Date('1970-01-01T00:00:00.000Z').toISOString()
    : safeFrom.toISOString();
  const normalizedTo = Number.isNaN(safeTo.getTime()) || safeTo.getUTCFullYear() > 9999
    ? new Date(Date.now() + 86400000).toISOString()
    : safeTo.toISOString();
  for (let page = 0; page < 100; page += 1) {
    const batch = await request<Order[]>(
      `/api/orders?branchId=${encodeURIComponent(branchId)}&from=${encodeURIComponent(normalizedFrom)}&to=${encodeURIComponent(normalizedTo)}&page=${page}&pageSize=${pageSize}${summary ? '&summary=1' : ''}`,
    );
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

// Ambil SATU order (beserta itemnya) — dipakai refetch bertarget saat realtime,
// jauh lebih hemat egress daripada mengunduh ulang seluruh daftar order.
// Mengembalikan null bila order tidak ada (mis. terhapus).
export const getCloudOrder = (branchId: string, orderId: string): Promise<Order | null> =>
  request<Order | null>(`/api/orders?branchId=${encodeURIComponent(branchId)}&orderId=${encodeURIComponent(orderId)}`);

export const submitCloudOrder = (order: Order): Promise<Order> =>
  request<Order>('/api/orders', { method: 'POST', body: JSON.stringify({ branchId: order.branchId, order }) }, order.source !== 'SELF_ORDER');

/**
 * Pay an existing cloud order using immutable snapshot payment.
 * 
 * Contract (P0 — Payment Snapshot Integrity):
 * - Calls finalize_order_payment RPC (not checkout_order)
 * - Order must already be saved in database (existing order)
 * - Validates order existence and branch
 * - Rejects CANCELLED orders
 * - Idempotent if already PAID
 * - Never re-validates condiment/menu against current master
 * - Never mutates order_items, modifiers, or kitchen_status
 * - Deducts inventory once (via deduct_order_inventory)
 * - Updates ONLY payment fields
 * 
 * @param branchId - branch UUID
 * @param orderId - existing order UUID
 * @param paymentMethod - CASH | QRIS | DEBIT | TRANSFER
 * @param paidAmount - amount paid by customer (for CASH validation)
 * @param paidShiftId - shift UUID when payment occurred
 * @returns updated order with payment status PAID
 * @throws Error if order not found, branch invalid, or payment fails
 */
export const payCloudOrder = (
  branchId: string,
  orderId: string,
  paymentMethod: PaymentMethod,
  paidAmount: number,
  paidShiftId: string,
): Promise<Order> =>
  request<Order>('/api/orders', {
    method: 'PATCH',
    body: JSON.stringify({
      branchId,
      orderId,
      paymentMethod,
      paidAmount,
      paidShiftId,
      action: 'PAY', // Distinguish from status updates (COOKING, READY, COMPLETED, CANCELLED)
    }),
  });

export const updateCloudOrderStatus = (branchId: string, orderId: string, status: OrderStatus, shiftId?: string, reason?: string): Promise<void> =>
  request<void>('/api/orders', { method: 'PATCH', body: JSON.stringify({ branchId, orderId, status, shiftId, reason }) });

export const getPublicOrder = (branchId: string, orderId: string): Promise<Order | null> =>
  request<Order | null>(`/api/orders?branchId=${encodeURIComponent(branchId)}&orderId=${encodeURIComponent(orderId)}`, undefined, false);

// Halaman sukses hanya membutuhkan perubahan status. `summary=1` menghindari
// pengunduhan ulang seluruh order_items setiap interval pelanggan.
export const getPublicOrderStatus = (branchId: string, orderId: string): Promise<Order | null> =>
  request<Order | null>(`/api/orders?branchId=${encodeURIComponent(branchId)}&orderId=${encodeURIComponent(orderId)}&summary=1`, undefined, false);

export type RealtimeConnectionState = 'CONNECTING' | 'HEALTHY' | 'DEGRADED';

export function subscribeCloudOrders(
  branchId: string,
  // changedOrderIds: daftar id order yang berubah pada jendela debounce, agar
  // pemanggil bisa refetch bertarget. null = tak dapat diidentifikasi → pemanggil
  // sebaiknya refetch penuh (fallback aman).
  onChange: (changedOrderIds: string[] | null) => void,
  onConnectionState?: (state: RealtimeConnectionState) => void,
): () => void {
  if (!isSupabaseConfigured() || !branchId) return () => undefined;

  const supabase = getSupabase();
  let timer = 0;
  let disposed = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  // Kumpulkan id order yang berubah selama jendela debounce. Bila ada event yang
  // id-nya tak bisa dibaca dari payload broadcast, tandai full agar pemanggil
  // mengambil ulang seluruh daftar (perilaku lama — aman, tanpa regresi).
  let pendingIds = new Set<string>();
  let needFull = false;
  const flush = () => {
    const ids = needFull ? null : [...pendingIds];
    pendingIds = new Set();
    needFull = false;
    onChange(ids);
  };
  const notify = (message?: any) => {
    const p = message?.payload || {};
    // Payload broadcast kini datar: { table, operation, id }. Baca p.id dulu;
    // fallback ke struktur record (kompatibel bila format berubah). Tanpa id ->
    // refetch penuh (aman).
    const record = p.record || p.new || p.old_record || p.old;
    const id = (typeof p.id === 'string' && p.id) ? p.id : record?.id;
    if (typeof id === 'string' && id) pendingIds.add(id);
    else needFull = true;
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, 180);
  };

  onConnectionState?.('CONNECTING');

  void ensureRealtimeAuth()
    .then(() => {
      if (disposed) return;
      channel = supabase
        .channel(`branch:${branchId}:orders`, { config: { private: true } })
        .on('broadcast', { event: 'INSERT' }, notify)
        .on('broadcast', { event: 'UPDATE' }, notify)
        .on('broadcast', { event: 'DELETE' }, notify)
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') onConnectionState?.('HEALTHY');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onConnectionState?.('DEGRADED');
          else onConnectionState?.('CONNECTING');
        });
    })
    .catch(() => {
      if (!disposed) onConnectionState?.('DEGRADED');
    });

  return () => {
    disposed = true;
    window.clearTimeout(timer);
    if (channel) void supabase.removeChannel(channel);
  };
}
