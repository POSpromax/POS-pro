import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_STATUSES = ['OPEN', 'HANDOVER'];
const ALLOWED_ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR']);

export interface ShiftRequestResult {
  status: number;
  data: unknown;
}

const fail = (status: number, error: string): ShiftRequestResult => ({ status, data: { error } });

async function getActor(accessToken: string, branchId: string, admin: SupabaseClient) {
  if (!accessToken) return null;
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) return null;
  const userId = authData.user.id;

  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id,display_name,role,is_active').eq('user_id', userId).maybeSingle(),
    admin.from('branch_members').select('role,is_active').eq('user_id', userId).eq('branch_id', branchId).maybeSingle(),
  ]);

  if (profileError || membershipError || !profile?.is_active || !membership?.is_active) return null;
  const role = membership.role || profile.role || 'KASIR';
  if (!ALLOWED_ROLES.has(role)) return null;
  return {
    userId,
    tenantId: profile.tenant_id,
    name: profile.display_name || 'Kasir',
    role,
  };
}

async function readActiveShift(branchId: string, admin: SupabaseClient) {
  const { data, error } = await admin
    .from('cashier_shifts')
    .select('*')
    .eq('branch_id', branchId)
    .in('status', ACTIVE_STATUSES)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function aggregateShiftMetrics(shiftId: string, branchId: string, admin: SupabaseClient) {
  const [{ data: orders, error: orderError }, { data: cashRecords, error: cashError }] = await Promise.all([
    admin
      .from('orders')
      .select('total_amount,payment_method')
      .eq('branch_id', branchId)
      .eq('shift_id', shiftId)
      .eq('payment_status', 'PAID')
      .neq('status', 'CANCELLED'),
    admin
      .from('expense_income_records')
      .select('record_type,amount')
      .eq('branch_id', branchId)
      .eq('shift_id', shiftId),
  ]);
  if (orderError) throw orderError;
  if (cashError) throw cashError;

  let grossOmset = 0;
  let cashSales = 0;
  let nonCashSales = 0;
  for (const order of orders || []) {
    const amount = Number(order.total_amount || 0);
    grossOmset += amount;
    if (order.payment_method === 'CASH') cashSales += amount;
    else nonCashSales += amount;
  }

  let totalExpense = 0;
  let totalIncome = 0;
  for (const record of cashRecords || []) {
    const amount = Number(record.amount || 0);
    if (record.record_type === 'EXPENSE') totalExpense += amount;
    else if (record.record_type === 'INCOME') totalIncome += amount;
  }

  return { grossOmset, cashSales, nonCashSales, totalExpense, totalIncome };
}

async function mapShift(row: any, admin: SupabaseClient) {
  const [{ data: staffProfile }, metrics] = await Promise.all([
    row.opened_by
      ? admin.from('user_profiles').select('display_name,role').eq('user_id', row.opened_by).maybeSingle()
      : Promise.resolve({ data: null }),
    aggregateShiftMetrics(row.id, row.branch_id, admin),
  ]);

  return {
    id: row.id,
    staffId: row.opened_by || '',
    staffName: staffProfile?.display_name || 'Kasir',
    staffRole: staffProfile?.role || 'KASIR',
    startTime: row.opened_at,
    endTime: row.closed_at || undefined,
    initialCash: Number(row.opening_cash || 0),
    ...metrics,
    status: row.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    notes: row.variance_reason || undefined,
    branchId: row.branch_id,
  };
}

export async function handleShiftRequest(
  method: string,
  payload: any,
  accessToken: string,
  admin: SupabaseClient,
): Promise<ShiftRequestResult> {
  if (method !== 'GET' && method !== 'POST') return fail(405, 'Method not allowed');
  const branchId = String(payload.branchId || payload.branch_id || '');
  if (!UUID_PATTERN.test(branchId)) return fail(400, 'Outlet tidak valid');

  const actor = await getActor(accessToken, branchId, admin);
  if (!actor) return fail(401, 'Sesi telah berakhir. Silakan masuk kembali.');

  const { data: branch, error: branchError } = await admin
    .from('branches')
    .select('tenant_id,is_active')
    .eq('id', branchId)
    .maybeSingle();
  if (branchError) return fail(500, 'Gagal memeriksa outlet');
  if (!branch?.is_active || branch.tenant_id !== actor.tenantId) return fail(403, 'Outlet tidak aktif atau tidak dapat diakses');

  if (method === 'GET') {
    try {
      const active = await readActiveShift(branchId, admin);
      return { status: 200, data: { shift: active ? await mapShift(active, admin) : null } };
    } catch (error) {
      console.error('Error fetching cashier shift:', error);
      return fail(500, 'Gagal membaca data shift dari server');
    }
  }

  const action = String(payload.action || '').toUpperCase();

  if (action === 'OPEN') {
    try {
      const existing = await readActiveShift(branchId, admin);
      if (existing) {
        return { status: 200, data: { shift: await mapShift(existing, admin), alreadyOpen: true } };
      }

      const initialCash = Math.floor(Number(payload.initialCash ?? payload.openingCash ?? 0));
      if (!Number.isFinite(initialCash) || initialCash < 0) return fail(400, 'Modal awal tidak valid');

      const { data: inserted, error: insertError } = await admin
        .from('cashier_shifts')
        .insert({
          tenant_id: branch.tenant_id,
          branch_id: branchId,
          opening_cash: initialCash,
          status: 'OPEN',
          opened_by: actor.userId,
          opened_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (insertError) {
        // Indeks unik per outlet menjadi pagar terakhir bila dua perangkat
        // menekan Buka Shift pada waktu yang hampir bersamaan.
        if (insertError.code === '23505') {
          const concurrentShift = await readActiveShift(branchId, admin);
          if (concurrentShift) {
            return { status: 200, data: { shift: await mapShift(concurrentShift, admin), alreadyOpen: true } };
          }
        }
        throw insertError;
      }

      return { status: 200, data: { shift: await mapShift(inserted, admin), alreadyOpen: false } };
    } catch (error) {
      console.error('Error opening cashier shift:', error);
      return fail(500, 'Gagal membuka shift di server');
    }
  }

  if (action === 'CLOSE') {
    const requestedShiftId = String(payload.shiftId || '');
    if (requestedShiftId && !UUID_PATTERN.test(requestedShiftId)) return fail(400, 'ID shift tidak valid');

    try {
      let target = requestedShiftId
        ? (await admin.from('cashier_shifts').select('*').eq('id', requestedShiftId).eq('branch_id', branchId).maybeSingle())
        : { data: await readActiveShift(branchId, admin), error: null };

      if (target.error) throw target.error;
      if (!target.data) return fail(404, 'Shift tidak ditemukan pada outlet ini');

      if (target.data.status === 'CLOSED') {
        const active = await readActiveShift(branchId, admin);
        if (active && active.id !== target.data.id) {
          return fail(409, 'Shift aktif sudah berubah. Muat ulang status sebelum menutup shift.');
        }
        return {
          status: 200,
          data: { success: true, closedShiftId: target.data.id, closedAt: target.data.closed_at || null },
        };
      }

      const closedAt = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        status: 'CLOSED',
        closed_at: closedAt,
        closed_by: actor.userId,
        // Skema cashier_shifts menyimpan catatan penutupan pada variance_reason.
        variance_reason: String(payload.notes || payload.closingNotes || '').slice(0, 1000),
      };
      if (payload.actualCash !== undefined) updateData.actual_cash = Math.floor(Number(payload.actualCash));
      if (payload.expectedCash !== undefined) updateData.expected_cash = Math.floor(Number(payload.expectedCash));
      if (payload.varianceAmount !== undefined) updateData.variance_amount = Math.floor(Number(payload.varianceAmount));

      const { data: closed, error: updateError } = await admin
        .from('cashier_shifts')
        .update(updateData)
        .eq('id', target.data.id)
        .eq('branch_id', branchId)
        .in('status', ACTIVE_STATUSES)
        .select('id,closed_at')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!closed) return fail(409, 'Status shift telah berubah di perangkat lain. Silakan sinkronkan ulang.');

      return {
        status: 200,
        data: { success: true, closedShiftId: closed.id, closedAt: closed.closed_at || closedAt },
      };
    } catch (error) {
      console.error('Error closing cashier shift:', error);
      return fail(500, 'Gagal menutup shift di server');
    }
  }

  return fail(400, 'Aksi shift tidak dikenal');
}
