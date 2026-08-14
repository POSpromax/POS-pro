import type { RestaurantTable } from '../types/pos';
import { getSupabase } from '../lib/supabase';

async function accessToken(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token || '';
}

export type TableSessionAction = 'LIST' | 'CREATE' | 'SET_ENABLED' | 'SET_ENABLED_ALL' | 'SET_STATUS' | 'RESET_ALL';

export interface TableSessionResponse {
  table?: RestaurantTable;
  tables?: RestaurantTable[];
}

export async function updateCloudTableSession(params: {
  action: TableSessionAction;
  branchId: string;
  tableNumber: string;
  capacity?: number;
  enabled?: boolean;
  status?: RestaurantTable['status'];
  force?: boolean;
}): Promise<TableSessionResponse> {
  const token = await accessToken();
  
  // Public self-order URLs should not call this management API
  // They get table data from /api/public-catalog instead
  if (!token) {
    throw new Error('Operasi manajemen meja memerlukan autentikasi');
  }
  
  const response = await fetch('/api/self-order-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Status meja gagal diperbarui');
  return data as TableSessionResponse;
}

export async function listCloudTables(branchId: string): Promise<RestaurantTable[]> {
  const response = await updateCloudTableSession({ action: 'LIST', branchId, tableNumber: '' });
  return (response.tables || []).slice().sort((a, b) => a.number.localeCompare(b.number, 'id', {
    numeric: true,
    sensitivity: 'base',
  }));
}

export async function createCloudTable(branchId: string, tableNumber: string, capacity: number): Promise<RestaurantTable> {
  const response = await updateCloudTableSession({ action: 'CREATE', branchId, tableNumber, capacity });
  if (!response.table) throw new Error('Data meja baru tidak dikembalikan server');
  return response.table;
}

export async function setAllCloudTablesEnabled(branchId: string, enabled: boolean): Promise<RestaurantTable[]> {
  const response = await updateCloudTableSession({ action: 'SET_ENABLED_ALL', branchId, tableNumber: '', enabled });
  return response.tables || [];
}
