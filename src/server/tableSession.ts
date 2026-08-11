import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSelfOrderUrl, generateQrToken, hashQrToken } from '../utils/qrToken';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mapTable = (row: any) => ({
  id: row.id,
  number: row.number,
  capacity: Number(row.capacity || 2),
  status: row.status,
  isSelfOrderEnabled: row.self_order_enabled !== false,
  activeOrderId: row.active_order_id || undefined,
  qrGeneration: Number(row.qr_generation || 0),
  qrActivatedAt: row.qr_activated_at || undefined,
  qrRevokedAt: row.qr_revoked_at || undefined,
  branchId: row.branch_id,
});

export async function handleTableSessionRequest(
  payload: Record<string, unknown>,
  accessToken: string,
  admin: SupabaseClient,
  secret: string,
  defaultBaseUrl: string,
) {
  if (!accessToken) return { status: 401, data: { error: 'Tidak terautentikasi' } };
  const { data: { user } } = await admin.auth.getUser(accessToken);
  if (!user) return { status: 401, data: { error: 'Sesi tidak valid' } };

  const branchId = String(payload.branchId || '');
  const tableNumber = String(payload.tableNumber || '').trim();
  const action = String(payload.action || 'ACTIVATE').toUpperCase();
  if (!UUID_PATTERN.test(branchId) || !tableNumber) return { status: 400, data: { error: 'Outlet atau nomor meja tidak valid' } };

  const { data: member } = await admin.from('branch_members').select('role,is_active').eq('user_id', user.id).eq('branch_id', branchId).maybeSingle();
  if (!member?.is_active || !['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR'].includes(member.role)) {
    return { status: 403, data: { error: 'Akun tidak memiliki izin mengelola meja outlet ini' } };
  }

  const { data: table } = await admin.from('restaurant_tables').select('*').eq('branch_id', branchId).eq('number', tableNumber).maybeSingle();
  if (!table) return { status: 404, data: { error: `Meja ${tableNumber} tidak ditemukan` } };

  if (action === 'SET_ENABLED') {
    const enabled = payload.enabled === true;
    const changes = enabled
      ? { self_order_enabled: true }
      : { self_order_enabled: false, status: 'DISABLED', qr_token_hash: null, qr_revoked_at: new Date().toISOString(), active_order_id: null };
    const { data: updated, error } = await admin.from('restaurant_tables').update(changes).eq('id', table.id).select('*').single();
    if (error) return { status: 500, data: { error: 'Pengaturan self-order meja gagal disimpan' } };
    return { status: 200, data: { table: mapTable(updated) } };
  }

  if (action === 'DEACTIVATE') {
    if (table.status === 'OCCUPIED' && payload.force !== true) {
      return { status: 409, data: { error: 'Meja masih memiliki bill aktif. Gunakan override terkonfirmasi untuk menonaktifkan.' } };
    }
    const { data: updated, error } = await admin.from('restaurant_tables').update({
      status: 'DISABLED',
      qr_token_hash: null,
      qr_revoked_at: new Date().toISOString(),
      active_order_id: null,
    }).eq('id', table.id).select('*').single();
    if (error) return { status: 500, data: { error: 'Meja gagal dinonaktifkan' } };
    return { status: 200, data: { table: mapTable(updated) } };
  }

  if (!['ACTIVATE', 'ROTATE'].includes(action)) return { status: 400, data: { error: 'Aksi meja tidak dikenal' } };
  if (!table.self_order_enabled) return { status: 403, data: { error: `Self-order Meja ${tableNumber} sedang dimatikan` } };
  if (action === 'ACTIVATE' && table.status === 'OCCUPIED') {
    return { status: 409, data: { error: 'Meja sudah terisi. Gunakan rotasi QR bila perlu mencabut foto QR lama.' } };
  }

  const generation = Number(table.qr_generation || 0) + 1;
  const token = await generateQrToken(branchId, tableNumber, generation, secret);
  const tokenHash = await hashQrToken(token);
  const nextStatus = table.status === 'OCCUPIED' ? 'OCCUPIED' : 'READY';
  const activatedAt = new Date().toISOString();
  const changes: Record<string, unknown> = {
    status: nextStatus,
    qr_generation: generation,
    qr_token_hash: tokenHash,
    qr_activated_at: activatedAt,
    qr_revoked_at: null,
  };
  if (nextStatus === 'READY') changes.active_order_id = null;
  const { data: updated, error } = await admin.from('restaurant_tables').update(changes).eq('id', table.id).select('*').single();
  if (error) return { status: 500, data: { error: 'Sesi QR meja gagal diaktifkan' } };

  const baseUrl = String(payload.baseUrl || defaultBaseUrl);
  return {
    status: 200,
    data: { table: mapTable(updated), token, url: buildSelfOrderUrl(baseUrl, branchId, tableNumber, token), expiresInHours: 12 },
  };
}
