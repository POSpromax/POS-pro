import type { Branch } from '../types/pos';
import { getSupabase } from '../lib/supabase';

async function request<T>(method: 'GET' | 'POST', branch?: Branch): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const response = await fetch('/api/branches', {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    ...(branch ? { body: JSON.stringify(branch) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Layanan cabang tidak tersedia');
  return result as T;
}

const mapBranch = (row: any): Branch => ({
  id: row.id,
  code: row.code,
  name: row.name,
  address: row.address || '',
  phone: row.phone || '',
});

export async function listCloudBranches(): Promise<Branch[]> {
  return (await request<any[]>('GET')).map(mapBranch);
}

export async function createCloudBranch(branch: Branch): Promise<Branch> {
  return mapBranch(await request<any>('POST', branch));
}
