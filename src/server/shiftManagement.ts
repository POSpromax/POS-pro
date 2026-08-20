import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_STATUSES = ['OPEN', 'HANDOVER'];
// KITCHEN boleh BACA status shift (KDS butuh konteks shift), tetapi tidak boleh
// membuka/menutup shift — mutasi shift dijaga terpisah di bawah.
const ALLOWED_ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR', 'KITCHEN']);
const SHIFT_MUTATION_ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR']);

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
    admin.from('user_profiles').select('tenant_id,display_name,is_active').eq('user_id', userId).maybeSingle(),
    admin.from('branch_members').select('role,is_active').eq('user_id', userId).eq('branch_id', branchId).maybeSingle(),
  ]);

  if (profileError) throw profileError;
  if (membershipError) throw membershipError;
  if (!profile?.is_active || !membership?.is_active) return null;
  const role = membership.role || 'KASIR';
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
  const [paymentResult, cashResult] = await Promise.all([
    admin.from('payments')
      .select('amount,method,orders!inner(status)')
      .eq('branch_id', branchId)
      .eq('shift_id', shiftId)
      .eq('status', 'PAID')
      .neq('orders.status', 'CANCELLED'),
    admin
      .from('expense_income_records')
      .select('record_type,amount')
      .eq('branch_id', branchId)
      .eq('shift_id', shiftId),
  ]);
  if (cashResult.error) throw cashResult.error;

  let sales = (paymentResult.data || []).map((payment: any) => ({
    amount: Number(payment.amount || 0),
    method: payment.method,
  }));
  if (paymentResult.error) {
    // Fallback sampai migrasi paid_shift_id/payment.shift_id diterapkan.
    const { data: orders, error } = await admin.from('orders')
      .select('total_amount,payment_method')
      .eq('branch_id', branchId)
      .eq('shift_id', shiftId)
      .eq('payment_status', 'PAID')
      .neq('status', 'CANCELLED');
    if (error) throw error;
    sales = (orders || []).map((order) => ({ amount: Number(order.total_amount || 0), method: order.payment_method }));
  }

  let grossOmset = 0;
  let cashSales = 0;
  let nonCashSales = 0;
  for (const sale of sales) {
    const amount = sale.amount;
    grossOmset += amount;
    if (sale.method === 'CASH') cashSales += amount;
    else nonCashSales += amount;
  }

  let totalExpense = 0;
  let totalIncome = 0;
  for (const record of cashResult.data || []) {
    const amount = Number(record.amount || 0);
    if (record.record_type === 'EXPENSE') totalExpense += amount;
    else if (record.record_type === 'INCOME') totalIncome += amount;
  }

  return { grossOmset, cashSales, nonCashSales, totalExpense, totalIncome };
}

/**
 * Memetakan BANYAK shift sekaligus dengan jumlah query tetap (4), bukan ~4 query
 * PER shift. Riwayat shift memuat sampai 100 baris; versi lama menjalankan
 * ~400 query dalam satu permintaan — beban DB & egress yang besar.
 */
async function mapShiftsBatch(rows: any[], branchId: string, admin: SupabaseClient) {
  if (rows.length === 0) return [];
  const shiftIds = rows.map((row) => row.id);
  const userIds = [...new Set(rows.map((row) => row.opened_by).filter(Boolean))];

  const [profilesRes, membersRes, paymentsRes, expensesRes] = await Promise.all([
    userIds.length
      ? admin.from('user_profiles').select('user_id,display_name').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin.from('branch_members').select('user_id,role').eq('branch_id', branchId).in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    admin.from('payments')
      .select('shift_id,amount,method,orders!inner(status)')
      .eq('branch_id', branchId)
      .in('shift_id', shiftIds)
      .eq('status', 'PAID')
      .neq('orders.status', 'CANCELLED'),
    admin.from('expense_income_records')
      .select('shift_id,record_type,amount')
      .eq('branch_id', branchId)
      .in('shift_id', shiftIds),
  ]);

  const names = new Map((profilesRes.data || []).map((r: any) => [r.user_id, r.display_name]));
  const roles = new Map((membersRes.data || []).map((r: any) => [r.user_id, r.role]));

  // Fallback bila kolom payments.shift_id belum ada (migrasi lama).
  let salesRows: Array<{ shift_id: string; amount: number; method: string }> = [];
  if (paymentsRes.error) {
    const { data: orders } = await admin.from('orders')
      .select('shift_id,total_amount,payment_method')
      .eq('branch_id', branchId)
      .in('shift_id', shiftIds)
      .eq('payment_status', 'PAID')
      .neq('status', 'CANCELLED');
    salesRows = (orders || []).map((o: any) => ({ shift_id: o.shift_id, amount: Number(o.total_amount || 0), method: o.payment_method }));
  } else {
    salesRows = (paymentsRes.data || []).map((p: any) => ({ shift_id: p.shift_id, amount: Number(p.amount || 0), method: p.method }));
  }

  const metrics = new Map<string, { grossOmset: number; cashSales: number; nonCashSales: number; totalExpense: number; totalIncome: number }>();
  const bucket = (id: string) => {
    let m = metrics.get(id);
    if (!m) { m = { grossOmset: 0, cashSales: 0, nonCashSales: 0, totalExpense: 0, totalIncome: 0 }; metrics.set(id, m); }
    return m;
  };
  salesRows.forEach((s) => {
    if (!s.shift_id) return;
    const m = bucket(s.shift_id);
    m.grossOmset += s.amount;
    if (s.method === 'CASH') m.cashSales += s.amount; else m.nonCashSales += s.amount;
  });
  (expensesRes.data || []).forEach((r: any) => {
    if (!r.shift_id) return;
    const m = bucket(r.shift_id);
    const amount = Number(r.amount || 0);
    if (r.record_type === 'EXPENSE') m.totalExpense += amount;
    else if (r.record_type === 'INCOME') m.totalIncome += amount;
  });

  return rows.map((row) => ({
    id: row.id,
    staffId: row.opened_by || '',
    staffName: names.get(row.opened_by) || 'Kasir',
    staffRole: roles.get(row.opened_by) || 'KASIR',
    startTime: row.opened_at,
    endTime: row.closed_at || undefined,
    initialCash: Number(row.opening_cash || 0),
    ...(metrics.get(row.id) || { grossOmset: 0, cashSales: 0, nonCashSales: 0, totalExpense: 0, totalIncome: 0 }),
    status: row.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    notes: row.variance_reason || undefined,
    actualCash: row.actual_cash == null ? undefined : Number(row.actual_cash),
    expectedCash: row.expected_cash == null ? undefined : Number(row.expected_cash),
    varianceAmount: row.variance_amount == null ? undefined : Number(row.variance_amount),
    branchId: row.branch_id,
  }));
}

async function mapShift(row: any, admin: SupabaseClient) {
  const [{ data: staffProfile }, { data: staffMembership }, metrics] = await Promise.all([
    row.opened_by
      ? admin.from('user_profiles').select('display_name').eq('user_id', row.opened_by).maybeSingle()
      : Promise.resolve({ data: null }),
    row.opened_by
      ? admin.from('branch_members').select('role').eq('user_id', row.opened_by).eq('branch_id', row.branch_id).maybeSingle()
      : Promise.resolve({ data: null }),
    aggregateShiftMetrics(row.id, row.branch_id, admin),
  ]);

  return {
    id: row.id,
    staffId: row.opened_by || '',
    staffName: staffProfile?.display_name || 'Kasir',
    staffRole: staffMembership?.role || 'KASIR',
    startTime: row.opened_at,
    endTime: row.closed_at || undefined,
    initialCash: Number(row.opening_cash || 0),
    ...metrics,
    status: row.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    notes: row.variance_reason || undefined,
    actualCash: row.actual_cash == null ? undefined : Number(row.actual_cash),
    expectedCash: row.expected_cash == null ? undefined : Number(row.expected_cash),
    varianceAmount: row.variance_amount == null ? undefined : Number(row.variance_amount),
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

  let actor;
  try {
    actor = await getActor(accessToken, branchId, admin);
  } catch (error) {
    console.error('Error validating shift actor:', error);
    return fail(500, 'Gagal memverifikasi sesi shift');
  }
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
      if (String(payload.history || '').toLowerCase() === 'true') {
        let historyQuery = admin
          .from('cashier_shifts')
          .select('*')
          .eq('branch_id', branchId)
          .eq('status', 'CLOSED')
          .order('closed_at', { ascending: false })
          .limit(100);
        const from = typeof payload.from === 'string' ? payload.from : '';
        const to = typeof payload.to === 'string' ? payload.to : '';
        if (from) historyQuery = historyQuery.gte('opened_at', from);
        if (to) historyQuery = historyQuery.lt('opened_at', to);
        const { data: rows, error } = await historyQuery;
        if (error) throw error;
        // Batch: 4 query total, bukan ~4 query per shift (100 shift = ~400 query).
        return { status: 200, data: { shifts: await mapShiftsBatch(rows || [], branchId, admin) } };
      }
      const active = await readActiveShift(branchId, admin);
      return { status: 200, data: { shift: active ? await mapShift(active, admin) : null } };
    } catch (error) {
      console.error('Error fetching cashier shift:', error);
      return fail(500, 'Gagal membaca data shift dari server');
    }
  }

  // Mutasi shift (buka/tutup/HANDOVER/biaya) tetap khusus kasir & manajemen.
  if (!SHIFT_MUTATION_ROLES.has(actor.role)) return fail(403, 'Peran ini tidak dapat mengubah shift');

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
