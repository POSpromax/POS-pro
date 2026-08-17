import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNER_ROLES = new Set(['SUPER_OWNER', 'OWNER']);
const MODES = new Set(['TRANSACTIONS', 'FACTORY']);
const SCOPES = new Set(['BRANCH', 'TENANT']);
const TENANT_CONFIRM = 'RESET SEMUA CABANG';

export interface DataResetResult { status: number; data: unknown }
const fail = (status: number, error: string): DataResetResult => ({ status, data: { error } });

async function getActor(accessToken: string, branchId: string, admin: SupabaseClient) {
  if (!accessToken) return null;
  const { data: authData } = await admin.auth.getUser(accessToken);
  if (!authData.user) return null;
  const [{ data: profile }, { data: member }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id,display_name,is_active').eq('user_id', authData.user.id).maybeSingle(),
    admin.from('branch_members').select('role,is_active').eq('user_id', authData.user.id).eq('branch_id', branchId).maybeSingle(),
  ]);
  if (!profile?.is_active || !member?.is_active) return null;
  return { id: authData.user.id, tenantId: profile.tenant_id as string, role: member.role as string };
}

/**
 * Owner-only, audited "clean reset" untuk go-live. Menghapus seluruh data
 * transaksi (mode TRANSACTIONS) atau tambahan master jualan + nol stok
 * (mode FACTORY), untuk satu cabang (scope BRANCH) atau seluruh cabang tenant
 * (scope TENANT). Master inti (akun, cabang, meja, staff, konfigurasi) tidak
 * pernah dihapus. Delegasi ke RPC security-definer `reset_pos_data` yang
 * memvalidasi ulang otorisasi, mencocokkan teks konfirmasi, dan menulis audit.
 */
export async function handleDataResetRequest(
  method: string,
  payload: any,
  accessToken: string,
  admin: SupabaseClient,
): Promise<DataResetResult> {
  if (method !== 'POST') return fail(405, 'Method not allowed');

  const branchId = String(payload.branchId || '');
  if (!UUID_PATTERN.test(branchId)) return fail(400, 'Outlet tidak valid');

  const mode = String(payload.mode || '');
  if (!MODES.has(mode)) return fail(400, 'Mode reset tidak valid');

  const scope = String(payload.scope || 'BRANCH');
  if (!SCOPES.has(scope)) return fail(400, 'Cakupan reset tidak valid');

  const confirmText = String(payload.confirmText || '').trim();
  if (!confirmText) return fail(400, 'Ketik teks konfirmasi terlebih dahulu');

  const actor = await getActor(accessToken, branchId, admin);
  if (!actor) return fail(401, 'Sesi telah berakhir');
  if (!OWNER_ROLES.has(actor.role)) return fail(403, 'Hanya Owner atau Super Owner yang boleh mereset data');

  // Cakupan TENANT wajib memakai frasa konfirmasi khusus agar tidak tertukar
  // dengan reset satu cabang.
  if (scope === 'TENANT' && confirmText.toLowerCase() !== TENANT_CONFIRM.toLowerCase()) {
    return fail(400, `Untuk reset semua cabang, ketik persis: ${TENANT_CONFIRM}`);
  }

  const { data, error } = await admin.rpc('reset_pos_data', {
    p_tenant_id: actor.tenantId,
    p_branch_id: scope === 'TENANT' ? null : branchId,
    p_mode: mode,
    p_confirm_text: confirmText,
    p_actor_user_id: actor.id,
  });

  if (error) {
    // Pesan RPC (mis. konfirmasi tidak cocok) diteruskan apa adanya agar jelas.
    return fail(400, error.message || 'Reset data gagal diproses');
  }

  return { status: 200, data: { success: true, result: data } };
}
