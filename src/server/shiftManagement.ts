import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const [{ data: profile }, { data: membership }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id,display_name,role,is_active').eq('user_id', userId).maybeSingle(),
    admin.from('branch_members').select('role,is_active').eq('user_id', userId).eq('branch_id', branchId).maybeSingle(),
  ]);

  if (!profile?.is_active || !membership?.is_active) return null;
  return {
    userId,
    tenantId: profile.tenant_id,
    name: profile.display_name || 'Kasir',
    role: membership.role || profile.role || 'KASIR',
  };
}

async function aggregateShiftOmset(shiftId: string, openedAt: string, branchId: string, admin: SupabaseClient) {
  let grossOmset = 0;
  let cashSales = 0;
  let nonCashSales = 0;

  const { data: orders } = await admin
    .from('orders')
    .select('total_amount, payment_method, payment_status, created_at')
    .eq('branch_id', branchId)
    .eq('payment_status', 'PAID')
    .gte('created_at', openedAt);

  if (orders && orders.length > 0) {
    for (const ord of orders) {
      const amt = Number(ord.total_amount || 0);
      grossOmset += amt;
      if (ord.payment_method === 'CASH') {
        cashSales += amt;
      } else {
        nonCashSales += amt;
      }
    }
  }

  return { grossOmset, cashSales, nonCashSales };
}

export async function handleShiftRequest(
  method: string,
  payload: any,
  accessToken: string,
  admin: SupabaseClient,
): Promise<ShiftRequestResult> {
  if (method !== 'GET' && method !== 'POST') return fail(405, 'Method not allowed');
  const branchId = payload.branchId || payload.branch_id;
  if (!branchId || !UUID_PATTERN.test(branchId)) return fail(400, 'Outlet tidak valid');

  if (method === 'GET') {
    // Search for active OPEN or HANDOVER shift for this branch
    const { data: shiftRow, error } = await admin
      .from('cashier_shifts')
      .select('*')
      .eq('branch_id', branchId)
      .in('status', ['OPEN', 'HANDOVER'])
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching cashier_shifts:', error);
      return fail(500, 'Gagal membaca data shift dari server');
    }

    if (!shiftRow) {
      return { status: 200, data: { shift: null } };
    }

    // Get staff profile who opened the shift
    let staffName = payload.staffName || 'Kasir Cloud';
    let staffRole = 'KASIR';
    if (shiftRow.opened_by) {
      const { data: staffProf } = await admin
        .from('user_profiles')
        .select('display_name, role')
        .eq('user_id', shiftRow.opened_by)
        .maybeSingle();
      if (staffProf) {
        staffName = staffProf.display_name || staffName;
        staffRole = staffProf.role || staffRole;
      }
    }

    const metrics = await aggregateShiftOmset(shiftRow.id, shiftRow.opened_at, branchId, admin);

    const activeShift = {
      id: shiftRow.id,
      staffId: shiftRow.opened_by || '',
      staffName,
      staffRole,
      startTime: shiftRow.opened_at,
      initialCash: Number(shiftRow.opening_cash || 0),
      grossOmset: metrics.grossOmset,
      cashSales: metrics.cashSales,
      nonCashSales: metrics.nonCashSales,
      totalExpense: 0,
      totalIncome: 0,
      status: 'OPEN',
      branchId: shiftRow.branch_id,
    };

    return { status: 200, data: { shift: activeShift } };
  }

  // POST: Open or Close Shift
  const action = payload.action || (payload.closingNotes !== undefined || payload.notes !== undefined ? 'CLOSE' : 'OPEN');

  if (action === 'OPEN') {
    // Single Active Shift Rule: Check if an OPEN shift already exists in DB
    const { data: existingShift } = await admin
      .from('cashier_shifts')
      .select('*')
      .eq('branch_id', branchId)
      .in('status', ['OPEN', 'HANDOVER'])
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingShift) {
      // Return existing open shift to prevent duplication / shift stacking
      let staffName = payload.staffName || 'Kasir Cloud';
      let staffRole = payload.staffRole || 'KASIR';
      if (existingShift.opened_by) {
        const { data: staffProf } = await admin
          .from('user_profiles')
          .select('display_name, role')
          .eq('user_id', existingShift.opened_by)
          .maybeSingle();
        if (staffProf) {
          staffName = staffProf.display_name || staffName;
          staffRole = staffProf.role || staffRole;
        }
      }

      const metrics = await aggregateShiftOmset(existingShift.id, existingShift.opened_at, branchId, admin);
      return {
        status: 200,
        data: {
          shift: {
            id: existingShift.id,
            staffId: existingShift.opened_by || '',
            staffName,
            staffRole,
            startTime: existingShift.opened_at,
            initialCash: Number(existingShift.opening_cash || 0),
            grossOmset: metrics.grossOmset,
            cashSales: metrics.cashSales,
            nonCashSales: metrics.nonCashSales,
            totalExpense: 0,
            totalIncome: 0,
            status: 'OPEN',
            branchId: existingShift.branch_id,
          },
          alreadyOpen: true,
        },
      };
    }

    // Get tenant ID from branch
    const { data: branchRow } = await admin
      .from('branches')
      .select('tenant_id')
      .eq('id', branchId)
      .maybeSingle();

    if (!branchRow?.tenant_id) {
      return fail(404, 'Outlet tidak ditemukan di database cloud');
    }

    const actor = await getActor(accessToken, branchId, admin);
    const openedBy = actor?.userId || payload.staffId;
    const staffName = payload.staffName || actor?.name || 'Kasir';
    const staffRole = payload.staffRole || actor?.role || 'KASIR';
    const initialCash = Number(payload.initialCash || payload.openingCash || 0);

    // Create new cashier_shifts record in Supabase DB
    const insertPayload: any = {
      tenant_id: branchRow.tenant_id,
      branch_id: branchId,
      opening_cash: initialCash,
      status: 'OPEN',
      opened_at: new Date().toISOString(),
    };
    if (openedBy && UUID_PATTERN.test(openedBy)) {
      insertPayload.opened_by = openedBy;
    } else if (actor?.userId) {
      insertPayload.opened_by = actor.userId;
    }

    // Fallback: If opened_by is required by FK, find an active user for this branch
    if (!insertPayload.opened_by) {
      const { data: member } = await admin
        .from('branch_members')
        .select('user_id')
        .eq('branch_id', branchId)
        .limit(1)
        .maybeSingle();
      if (member) {
        insertPayload.opened_by = member.user_id;
      } else {
        return fail(400, 'Memerlukan ID petugas yang terverifikasi untuk membuka shift');
      }
    }

    const { data: newShiftRow, error: insertError } = await admin
      .from('cashier_shifts')
      .insert([insertPayload])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting cashier_shifts:', insertError);
      return fail(500, `Gagal membuka shift di server: ${insertError.message}`);
    }

    const newShift = {
      id: newShiftRow.id,
      staffId: newShiftRow.opened_by,
      staffName,
      staffRole,
      startTime: newShiftRow.opened_at,
      initialCash: Number(newShiftRow.opening_cash || 0),
      grossOmset: 0,
      cashSales: 0,
      nonCashSales: 0,
      totalExpense: 0,
      totalIncome: 0,
      status: 'OPEN',
      branchId,
    };

    return { status: 200, data: { shift: newShift } };
  }

  if (action === 'CLOSE') {
    const actor = await getActor(accessToken, branchId, admin);
    const closedBy = actor?.userId;

    // Find active shift to close
    const { data: shiftToClose } = await admin
      .from('cashier_shifts')
      .select('*')
      .eq('branch_id', branchId)
      .in('status', ['OPEN', 'HANDOVER'])
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const targetShiftId = payload.shiftId || shiftToClose?.id;

    if (targetShiftId) {
      const updateData: any = {
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        notes: payload.notes || payload.closingNotes || '',
        variance_reason: payload.notes || payload.closingNotes || '',
      };
      if (payload.actualCash !== undefined) updateData.actual_cash = Number(payload.actualCash);
      if (payload.expectedCash !== undefined) updateData.expected_cash = Number(payload.expectedCash);
      if (payload.varianceAmount !== undefined) updateData.variance_amount = Number(payload.varianceAmount);
      if (closedBy) updateData.closed_by = closedBy;

      await admin.from('cashier_shifts').update(updateData).eq('id', targetShiftId);
    }

    return {
      status: 200,
      data: {
        success: true,
        closedShiftId: targetShiftId || 'closed',
        status: 'CLOSED',
      },
    };
  }

  return fail(400, 'Aksi shift tidak dikenal');
}
