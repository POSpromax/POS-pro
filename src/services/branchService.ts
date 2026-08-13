import type { Branch } from '../types/pos';
import { getSupabase } from '../lib/supabase';

async function request<T>(method: 'GET' | 'POST', branch?: Branch): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const attempts = method === 'GET' ? 3 : 1;
  let lastError = 'Layanan cabang tidak tersedia';

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch('/api/branches', {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
        },
        ...(branch ? { body: JSON.stringify(branch) } : {}),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) return result as T;

      lastError = result.error || lastError;
      // Autentikasi/otorisasi dan validasi tidak akan pulih dengan retry.
      if (![429, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 300 : 800));
    }
  }

  throw new Error(lastError);
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
