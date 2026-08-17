import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNER_ROLES = new Set(['SUPER_OWNER', 'OWNER']);
// Retention minimum: mencegah purge tak sengaja menghapus transaksi yang
// masih relevan untuk operasional harian/mingguan (rekonsiliasi, komplain).
const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 3650;

export interface PurgeRequestResult { status: number; data: unknown }
const fail = (status: number, error: string): PurgeRequestResult => ({ status, data: { error } });

async function getActor(accessToken: string, branchId: string, admin: SupabaseClient) {
  if (!accessToken) return null;
  const { data: authData } = await admin.auth.getUser(accessToken);
  if (!authData.user) return null;
  const [{ data: profile }, { data: member }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id,display_name,is_active').eq('user_id', authData.user.id).maybeSingle(),
    admin.from('branch_members').select('role,is_active').eq('user_id', authData.user.id).eq('branch_id', branchId).maybeSingle(),
  ]);
  if (!profile?.is_active || !member?.is_active) return null;
  return { id: authData.user.id, tenantId: profile.tenant_id, role: member.role };
}

/**
 * Owner-only, branch-scoped, audited purge of completed/cancelled order
 * history older than a caller-chosen retention cutoff. Master data (menu,
 * recipes, staff, tables, config, stock ledger) is never touched — only
 * orders/order_items/payments/order_events rows within scope are removed,
 * and every execution is logged permanently (with counts + totals) before
 * any row is deleted, via the `purge_completed_orders` RPC.
 */
export async function handleTransactionPurgeRequest(
  method: string,
  payload: any,
  accessToken: string,
  admin: SupabaseClient,
): Promise<PurgeRequestResult> {
  if (method !== 'POST') return fail(405, 'Method not allowed');

  const branchId = String(payload.branchId || '');
  if (!UUID_PATTERN.test(branchId)) return fail(400, 'Outlet tidak valid');

  const actor = await getActor(accessToken, branchId, admin);
  if (!actor) return fail(401, 'Sesi telah berakhir');
  if (!OWNER_ROLES.has(actor.role)) return fail(403, 'Hanya Owner atau Super Owner yang boleh menghapus riwayat transaksi');

  const retentionDays = Math.floor(Number(payload.retentionDays));
  if (!Number.isFinite(retentionDays) || retentionDays < MIN_RETENTION_DAYS || retentionDays > MAX_RETENTION_DAYS) {
    return fail(400, `Periode retensi harus antara ${MIN_RETENTION_DAYS}-${MAX_RETENTION_DAYS} hari`);
  }

  const confirmBranchName = String(payload.confirmBranchName || '').trim();
  if (!confirmBranchName) return fail(400, 'Ketik ulang nama cabang untuk konfirmasi');

  const cutoffAt = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin.rpc('purge_completed_orders', {
    p_branch_id: branchId,
    p_cutoff_at: cutoffAt,
    p_confirm_branch_name: confirmBranchName,
    p_actor_user_id: actor.id,
  });

  if (error) {
    if (/konfirmasi nama cabang tidak cocok/i.test(error.message || '')) {
      return fail(400, 'Nama cabang yang diketik tidak cocok');
    }
    return fail(500, `Purge gagal diproses: ${error.message}`);
  }

  return { status: 200, data };
}
