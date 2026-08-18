import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBranchId } from '../utils/branchId';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mapTable = (row: any) => ({
  id: row.id,
  number: row.number,
  capacity: Number(row.capacity || 2),
  status: row.status,
  isSelfOrderEnabled: row.self_order_enabled !== false,
  activeOrderId: row.active_order_id || undefined,
  branchId: row.branch_id,
});

export async function handleTableSessionRequest(
  payload: Record<string, unknown>,
  accessToken: string,
  admin: SupabaseClient,
) {
  if (!accessToken) return { status: 401, data: { error: 'Tidak terautentikasi' } };
  const { data: { user } } = await admin.auth.getUser(accessToken);
  if (!user) return { status: 401, data: { error: 'Sesi tidak valid' } };

  const branchId = normalizeBranchId(String(payload.branchId || ''));
  const tableNumber = String(payload.tableNumber || '').trim().toUpperCase();
  const action = String(payload.action || 'LIST').toUpperCase();
  if (!UUID_PATTERN.test(branchId)) {
    return { status: 400, data: { error: 'ID outlet tidak valid. Muat ulang sesi cabang lalu coba kembali.' } };
  }
  if (!tableNumber && !['LIST', 'SET_ENABLED_ALL', 'RESET_ALL'].includes(action)) {
    return { status: 400, data: { error: `Nomor meja wajib untuk aksi ${action}` } };
  }
  if (tableNumber && !/^[A-Z0-9][A-Z0-9 -]{0,19}$/.test(tableNumber)) {
    return { status: 400, data: { error: 'Nomor meja hanya boleh berisi huruf, angka, spasi, atau tanda hubung' } };
  }

  const { data: member } = await admin.from('branch_members').select('role,is_active').eq('user_id', user.id).eq('branch_id', branchId).maybeSingle();
  // KITCHEN boleh MEMBACA daftar meja (App memuatnya saat KDS dibuka), tetapi
  // tidak boleh mengubah status/konfigurasi meja.
  const READ_ROLES = ['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR', 'KITCHEN'];
  const MUTATE_ROLES = ['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR'];
  if (!member?.is_active || !READ_ROLES.includes(member.role)) {
    return { status: 403, data: { error: 'Akun tidak memiliki izin meja outlet ini' } };
  }
  if (action !== 'LIST' && !MUTATE_ROLES.includes(member.role)) {
    return { status: 403, data: { error: 'Peran ini hanya dapat membaca meja, tidak mengubahnya' } };
  }

  if (action === 'LIST') {
    const { data: rows, error } = await admin.from('restaurant_tables').select('*').eq('branch_id', branchId).order('number');
    if (error) return { status: 500, data: { error: 'Daftar meja outlet gagal dibaca' } };
    return { status: 200, data: { tables: (rows || []).map(mapTable) } };
  }

  if (action === 'CREATE') {
    if (!['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(member.role)) {
      return { status: 403, data: { error: 'Akun tidak memiliki izin membuat meja' } };
    }
    const requestedCapacity = Number(payload.capacity || 2);
    const capacity = Number.isFinite(requestedCapacity) ? Math.max(1, Math.min(50, Math.floor(requestedCapacity))) : 2;
    const { data: created, error } = await admin.from('restaurant_tables').insert({
      branch_id: branchId,
      number: tableNumber,
      capacity,
      status: 'DISABLED',
      self_order_enabled: false,
    }).select('*').single();
    if (error?.code === '23505') return { status: 409, data: { error: `Meja ${tableNumber} sudah ada di outlet ini` } };
    if (error) return { status: 500, data: { error: 'Meja baru gagal disimpan ke cloud' } };
    return { status: 201, data: { table: mapTable(created) } };
  }

  // Aktifkan / nonaktifkan self-order untuk SEMUA meja cabang sekaligus.
  // active_order_id is the bill lock; bulk actions never clear or reopen a table
  // that still owns an active bill, even if its status field is temporarily stale.
  if (action === 'SET_ENABLED_ALL') {
    const enabled = payload.enabled === true;
    if (enabled) {
      const { error: enableError } = await admin.from('restaurant_tables')
        .update({ self_order_enabled: true })
        .eq('branch_id', branchId)
        .is('active_order_id', null);
      if (enableError) return { status: 500, data: { error: 'Status self-order semua meja gagal diaktifkan' } };
      const { error: readyError } = await admin.from('restaurant_tables')
        .update({ status: 'READY' })
        .eq('branch_id', branchId)
        .is('active_order_id', null);
      if (readyError) return { status: 500, data: { error: 'Status operasional meja belum siap. Jalankan migrasi meja terbaru.' } };
    } else {
      const { error: disableError } = await admin.from('restaurant_tables').update({
        self_order_enabled: false, status: 'DISABLED', active_order_id: null,
      }).eq('branch_id', branchId).is('active_order_id', null);
      if (disableError) return { status: 500, data: { error: 'Struktur meja belum lengkap. Jalankan migrasi meja terbaru.' } };
    }
    // Repair any row that owns a bill but carries a stale visual status.
    await admin.from('restaurant_tables').update({ status: 'OCCUPIED' })
      .eq('branch_id', branchId).not('active_order_id', 'is', null);
    const { data: rows, error } = await admin.from('restaurant_tables').select('*').eq('branch_id', branchId).order('number');
    if (error) return { status: 500, data: { error: 'Pengaturan self-order semua meja gagal disimpan' } };
    return { status: 200, data: { tables: (rows || []).map(mapTable) } };
  }

  if (action === 'RESET_ALL') {
    if (!['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(member.role)) {
      return { status: 403, data: { error: 'Akun tidak memiliki izin mereset status meja' } };
    }
    await admin.from('restaurant_tables').update({
      status: 'READY', active_order_id: null,
    }).eq('branch_id', branchId).eq('self_order_enabled', true).is('active_order_id', null);
    await admin.from('restaurant_tables').update({
      status: 'DISABLED', active_order_id: null,
    }).eq('branch_id', branchId).eq('self_order_enabled', false).is('active_order_id', null);
    await admin.from('restaurant_tables').update({ status: 'OCCUPIED' })
      .eq('branch_id', branchId).not('active_order_id', 'is', null);
    const { data: rows, error } = await admin.from('restaurant_tables').select('*').eq('branch_id', branchId).order('number');
    if (error) return { status: 500, data: { error: 'Status meja gagal direkonsiliasi' } };
    return { status: 200, data: { tables: (rows || []).map(mapTable) } };
  }

  const { data: table } = await admin.from('restaurant_tables').select('*').eq('branch_id', branchId).eq('number', tableNumber).maybeSingle();
  if (!table) return { status: 404, data: { error: `Meja ${tableNumber} tidak ditemukan` } };

  // Aktivasi self-order = flag self_order_enabled. active_order_id, bukan
  // warna/status UI semata, menjadi bukti bahwa meja masih memiliki bill aktif.
  if (action === 'SET_ENABLED') {
    const enabled = payload.enabled === true;
    const hasActiveBill = Boolean(table.active_order_id);
    if (!enabled && hasActiveBill) {
      return { status: 409, data: { error: 'Meja masih memiliki bill aktif. Selesaikan pembayaran/order terlebih dahulu.' } };
    }
    const changes = enabled
      ? { self_order_enabled: true, status: hasActiveBill ? 'OCCUPIED' : 'READY' }
      : { self_order_enabled: false, status: 'DISABLED', active_order_id: null };
    const { data: updated, error } = await admin.from('restaurant_tables').update(changes).eq('id', table.id).select('*').single();
    if (error) return { status: 500, data: { error: 'Pengaturan meja gagal disimpan. Pastikan migrasi meja terbaru sudah dijalankan.' } };
    return { status: 200, data: { table: mapTable(updated) } };
  }

  if (action === 'SET_STATUS') {
    const requestedStatus = String(payload.status || '').toUpperCase();
    if (!['READY', 'OCCUPIED', 'RESERVED', 'DISABLED'].includes(requestedStatus)) {
      return { status: 400, data: { error: 'Status meja tidak valid' } };
    }
    if (table.active_order_id && requestedStatus !== 'OCCUPIED' && payload.force !== true) {
      return { status: 409, data: { error: 'Meja masih memiliki bill aktif dan tidak dapat dikosongkan' } };
    }
    // READY is only meaningful for a table whose self-order access is ON.
    // Otherwise a manual clear must remain DISABLED, not create READY + OFF drift.
    const normalizedStatus = requestedStatus === 'READY' && table.self_order_enabled !== true
      ? 'DISABLED'
      : requestedStatus;
    const { data: updated, error } = await admin.from('restaurant_tables').update({
      status: normalizedStatus,
      ...(normalizedStatus === 'OCCUPIED' ? {} : { active_order_id: null }),
    }).eq('id', table.id).select('*').single();
    if (error) return { status: 500, data: { error: 'Status meja gagal disimpan' } };
    return { status: 200, data: { table: mapTable(updated) } };
  }

  return { status: 400, data: { error: 'Aksi meja tidak dikenal' } };
}
