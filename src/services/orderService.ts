import type { Order, OrderStatus } from '../types/pos';
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

export const submitCloudOrder = (order: Order): Promise<Order> =>
  request<Order>('/api/orders', { method: 'POST', body: JSON.stringify({ branchId: order.branchId, order }) }, order.source !== 'SELF_ORDER');

export const updateCloudOrderStatus = (branchId: string, orderId: string, status: OrderStatus, shiftId?: string, reason?: string): Promise<void> =>
  request<void>('/api/orders', { method: 'PATCH', body: JSON.stringify({ branchId, orderId, status, shiftId, reason }) });

export const getPublicOrder = (branchId: string, orderId: string): Promise<Order | null> =>
  request<Order | null>(`/api/orders?branchId=${encodeURIComponent(branchId)}&orderId=${encodeURIComponent(orderId)}`, undefined, false);

export type RealtimeConnectionState = 'CONNECTING' | 'HEALTHY' | 'DEGRADED';

export function subscribeCloudOrders(
  branchId: string,
  onChange: () => void,
  onConnectionState?: (state: RealtimeConnectionState) => void,
): () => void {
  if (!isSupabaseConfigured() || !branchId) return () => undefined;

  const supabase = getSupabase();
  let timer = 0;
  let disposed = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  const notify = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 180);
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
