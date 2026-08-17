import { getSupabase } from '../lib/supabase';

export type DataResetMode = 'TRANSACTIONS' | 'FACTORY';
export type DataResetScope = 'BRANCH' | 'TENANT';

export interface DataResetResult {
  scope: DataResetScope;
  mode: DataResetMode;
  branchCount: number;
  counts: Record<string, number>;
}

/**
 * Owner-only "reset bersih" untuk go-live. Menghapus seluruh data transaksi
 * (mode TRANSACTIONS) atau tambahan master jualan + nol stok (mode FACTORY),
 * untuk satu cabang (scope BRANCH) atau seluruh cabang tenant (scope TENANT).
 * Master inti (akun, cabang, meja, staff, konfigurasi) tidak pernah dihapus.
 * Memerlukan teks konfirmasi: nama cabang (BRANCH) atau "RESET SEMUA CABANG"
 * (TENANT). Lihat RPC reset_pos_data().
 */
export async function resetPosData(params: {
  branchId: string;
  mode: DataResetMode;
  scope: DataResetScope;
  confirmText: string;
}): Promise<DataResetResult> {
  const { data } = await getSupabase().auth.getSession();
  const response = await fetch('/api/data-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: JSON.stringify(params),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || 'Reset data gagal diproses');
  }
  const r = result.result || {};
  return {
    scope: r.scope,
    mode: r.mode,
    branchCount: Number(r.branch_count || 0),
    counts: (r.counts || {}) as Record<string, number>,
  };
}
