import type { RestaurantTable } from '../types/pos';
import { getSupabase } from '../lib/supabase';

async function accessToken(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token || '';
}

export type TableSessionAction = 'ACTIVATE' | 'ROTATE' | 'DEACTIVATE' | 'SET_ENABLED' | 'SET_ENABLED_ALL';

export interface TableSessionResponse {
  table?: RestaurantTable;
  tables?: RestaurantTable[];
  token?: string;
  url?: string;
  expiresInHours?: number;
}

export async function updateCloudTableSession(params: {
  action: TableSessionAction;
  branchId: string;
  tableNumber: string;
  baseUrl?: string;
  enabled?: boolean;
  force?: boolean;
}): Promise<TableSessionResponse> {
  const token = await accessToken();
  const response = await fetch('/api/self-order-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Status meja gagal diperbarui');
  return data as TableSessionResponse;
}
