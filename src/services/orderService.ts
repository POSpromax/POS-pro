import type { Order, OrderStatus } from '../types/pos';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

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

export const updateCloudOrderStatus = (branchId: string, orderId: string, status: OrderStatus): Promise<void> =>
  request<void>('/api/orders', { method: 'PATCH', body: JSON.stringify({ branchId, orderId, status }) });

export const getPublicOrder = (branchId: string, orderId: string): Promise<Order | null> =>
  request<Order | null>(`/api/orders?branchId=${encodeURIComponent(branchId)}&orderId=${encodeURIComponent(orderId)}`, undefined, false);

export type RealtimeConnectionState = 'CONNECTING' | 'HEALTHY' | 'DEGRADED';

export function subscribeCloudOrders(
  branchId: string,
  onChange: () => void,
  onConnectionState?: (state: RealtimeConnectionState) => void,
): () => void {
  if (!isSupabaseConfigured()) return () => undefined;
  const supabase = getSupabase();
  let timer = 0;
  const notify = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 250);
  };
  const channel = supabase.channel(`branch:${branchId}:orders_realtime`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` }, notify)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, notify)
    .on('broadcast', { event: 'INSERT' }, notify)
    .on('broadcast', { event: 'UPDATE' }, notify)
    .on('broadcast', { event: 'DELETE' }, notify)
    .on('broadcast', { event: 'pos_sync' }, notify)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onConnectionState?.('HEALTHY');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onConnectionState?.('DEGRADED');
      else onConnectionState?.('CONNECTING');
    });
  return () => {
    window.clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
