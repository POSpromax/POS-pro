import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGEMENT_ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']);
const LEAVE_TYPES = new Set(['SICK', 'PERMIT', 'ANNUAL', 'UNPAID']);

interface HrPayload {
  branchId?: string;
  action?: 'SUBMIT_LEAVE' | 'REVIEW_LEAVE' | 'SAVE_PAYROLL_PROFILE';
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  attachmentPublicId?: string;
  attachmentUrl?: string;
  requestId?: string;
  status?: 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  userId?: string;
  baseSalary?: number;
  mealAllowance?: number;
  transportAllowance?: number;
  overtimeHourlyRate?: number;
  lateDeductionPerMinute?: number;
}

export interface HrRequestResult { status: number; data: unknown }
const fail = (status: number, error: string): HrRequestResult => ({ status, data: { error } });

export async function handleHrRequest(
  method: string,
  payload: HrPayload,
  accessToken: string,
  admin: SupabaseClient,
): Promise<HrRequestResult> {
  if (!['GET', 'POST', 'PATCH'].includes(method)) return fail(405, 'Method not allowed');
  if (!accessToken) return fail(401, 'Sesi telah berakhir');
  if (!payload.branchId || !UUID_PATTERN.test(payload.branchId)) return fail(400, 'Outlet tidak valid');

  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) return fail(401, 'Sesi telah berakhir');
  const actorId = authData.user.id;
  const [{ data: profile }, { data: membership }, { data: branch }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id,display_name,is_active').eq('user_id', actorId).maybeSingle(),
    admin.from('branch_members').select('role,is_active').eq('user_id', actorId).eq('branch_id', payload.branchId).maybeSingle(),
    admin.from('branches').select('tenant_id,name,is_active').eq('id', payload.branchId).maybeSingle(),
  ]);
  if (!profile?.is_active || !membership?.is_active || !branch?.is_active || profile.tenant_id !== branch.tenant_id) {
    return fail(403, 'Akun tidak memiliki akses ke outlet ini');
  }
  const isManagement = MANAGEMENT_ROLES.has(membership.role);

  if (method === 'GET') {
    let leaveQuery = admin.from('leave_requests').select('*').eq('branch_id', payload.branchId).order('created_at', { ascending: false }).limit(250);
    let payrollQuery = admin.from('payroll_profiles').select('*').eq('branch_id', payload.branchId).order('updated_at', { ascending: false });
    if (!isManagement) {
      leaveQuery = leaveQuery.eq('user_id', actorId);
      payrollQuery = payrollQuery.eq('user_id', actorId);
    }
    const [{ data: leaveRequests, error: leaveError }, { data: payrollProfiles, error: payrollError }] = await Promise.all([
      leaveQuery,
      payrollQuery,
    ]);
    if (leaveError || payrollError) return fail(500, 'Data HR belum siap. Terapkan migrasi HR terbaru di Supabase.');
    const userIds = [...new Set([...(leaveRequests || []).map((row) => row.user_id), ...(payrollProfiles || []).map((row) => row.user_id)])];
    const { data: users } = userIds.length
      ? await admin.from('user_profiles').select('user_id,display_name').in('user_id', userIds)
      : { data: [] };
    const names = new Map((users || []).map((row) => [row.user_id, row.display_name]));
    return {
      status: 200,
      data: {
        canManage: isManagement,
        leaveRequests: (leaveRequests || []).map((row) => ({ ...row, staffName: names.get(row.user_id) || 'Staff' })),
        payrollProfiles: (payrollProfiles || []).map((row) => ({ ...row, staffName: names.get(row.user_id) || 'Staff' })),
      },
    };
  }

  if (method === 'POST' && payload.action === 'SUBMIT_LEAVE') {
    if (!payload.leaveType || !LEAVE_TYPES.has(payload.leaveType)) return fail(400, 'Jenis izin tidak valid');
    if (!payload.startDate || !payload.endDate || payload.endDate < payload.startDate) return fail(400, 'Rentang tanggal tidak valid');
    if (!payload.reason || payload.reason.trim().length < 5) return fail(400, 'Keterangan minimal 5 karakter');
    const { data, error } = await admin.from('leave_requests').insert({
      tenant_id: profile.tenant_id,
      branch_id: payload.branchId,
      user_id: actorId,
      leave_type: payload.leaveType,
      start_date: payload.startDate,
      end_date: payload.endDate,
      reason: payload.reason.trim(),
      attachment_public_id: payload.attachmentPublicId || null,
      attachment_url: payload.attachmentUrl || null,
    }).select('*').single();
    if (error) return fail(500, 'Pengajuan izin tidak dapat disimpan');
    return { status: 201, data: { ...data, staffName: profile.display_name } };
  }

  if (method === 'PATCH' && payload.action === 'REVIEW_LEAVE') {
    if (!isManagement) return fail(403, 'Hanya manajemen yang dapat meninjau izin');
    if (!payload.requestId || !UUID_PATTERN.test(payload.requestId)) return fail(400, 'Pengajuan tidak valid');
    if (!payload.status || !['APPROVED', 'REJECTED'].includes(payload.status)) return fail(400, 'Status tinjauan tidak valid');
    const { data, error } = await admin.from('leave_requests').update({
      status: payload.status,
      reviewer_user_id: actorId,
      reviewed_at: new Date().toISOString(),
      review_note: payload.reviewNote?.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', payload.requestId).eq('branch_id', payload.branchId).eq('status', 'PENDING').select('*').maybeSingle();
    if (error || !data) return fail(409, 'Pengajuan sudah diproses atau tidak ditemukan');
    return { status: 200, data };
  }

  if (method === 'PATCH' && payload.action === 'SAVE_PAYROLL_PROFILE') {
    if (!isManagement) return fail(403, 'Hanya manajemen yang dapat mengatur payroll');
    if (!payload.userId || !UUID_PATTERN.test(payload.userId)) return fail(400, 'Staff tidak valid');
    const amounts = [payload.baseSalary, payload.mealAllowance, payload.transportAllowance, payload.overtimeHourlyRate, payload.lateDeductionPerMinute];
    if (amounts.some((value) => !Number.isFinite(value) || Number(value) < 0)) return fail(400, 'Nilai payroll tidak valid');
    const { data: targetMembership } = await admin.from('branch_members').select('user_id').eq('branch_id', payload.branchId).eq('user_id', payload.userId).eq('is_active', true).maybeSingle();
    if (!targetMembership) return fail(404, 'Staff tidak aktif pada outlet ini');
    const { data, error } = await admin.from('payroll_profiles').upsert({
      tenant_id: profile.tenant_id,
      branch_id: payload.branchId,
      user_id: payload.userId,
      base_salary: Math.round(Number(payload.baseSalary)),
      meal_allowance: Math.round(Number(payload.mealAllowance)),
      transport_allowance: Math.round(Number(payload.transportAllowance)),
      overtime_hourly_rate: Math.round(Number(payload.overtimeHourlyRate)),
      late_deduction_per_minute: Math.round(Number(payload.lateDeductionPerMinute)),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,branch_id,user_id' }).select('*').single();
    if (error) return fail(500, 'Konfigurasi payroll tidak dapat disimpan');
    return { status: 200, data };
  }

  return fail(400, 'Aksi HR tidak valid');
}
