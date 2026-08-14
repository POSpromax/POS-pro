import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGEMENT_ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']);
const LEAVE_TYPES = new Set(['SICK', 'PERMIT', 'ANNUAL', 'UNPAID']);

interface HrPayload {
  branchId?: string;
  action?: 'SUBMIT_LEAVE' | 'REVIEW_LEAVE' | 'SAVE_PAYROLL_PROFILE' | 'SAVE_HR_CONFIG';
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
  leaveReasons?: Array<{ code?: string; label?: string; enabled?: boolean; paid?: boolean }>;
  latePenaltyGraceMinutes?: number;
  workingDays?: number[];
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
    const [{ data: leaveRequests, error: leaveError }, { data: payrollProfiles, error: payrollError }, { data: hrConfig }] = await Promise.all([
      leaveQuery,
      payrollQuery,
      admin.from('branch_hr_config').select('leave_reasons,late_penalty_grace_minutes,working_days').eq('branch_id', payload.branchId).maybeSingle(),
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
        hrConfig: {
          leaveReasons: hrConfig?.leave_reasons || [
            { code: 'SICK', label: 'Sakit', enabled: true, paid: true },
            { code: 'PERMIT', label: 'Izin pribadi', enabled: true, paid: true },
            { code: 'ANNUAL', label: 'Cuti tahunan', enabled: true, paid: true },
            { code: 'UNPAID', label: 'Izin tanpa dibayar', enabled: true, paid: false },
          ],
          latePenaltyGraceMinutes: Number(hrConfig?.late_penalty_grace_minutes || 0),
          workingDays: hrConfig?.working_days || [1, 2, 3, 4, 5, 6],
        },
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

  if (method === 'PATCH' && payload.action === 'SAVE_HR_CONFIG') {
    if (!isManagement) return fail(403, 'Hanya manajemen yang dapat mengatur kebijakan HR');
    const reasons = Array.isArray(payload.leaveReasons) ? payload.leaveReasons : [];
    if (!reasons.length || reasons.length > 4 || reasons.some((reason) => (
      !reason.code || !LEAVE_TYPES.has(reason.code)
      || !reason.label?.trim() || reason.label.trim().length > 40
    ))) return fail(400, 'Konfigurasi alasan izin tidak valid');
    const grace = Math.round(Number(payload.latePenaltyGraceMinutes));
    const workingDays = [...new Set((payload.workingDays || []).map(Number))].sort();
    if (!Number.isFinite(grace) || grace < 0 || grace > 180 || !workingDays.length || workingDays.some((day) => day < 0 || day > 6)) {
      return fail(400, 'Konfigurasi hari kerja atau toleransi telat tidak valid');
    }
    const normalizedReasons = reasons.map((reason) => ({
      code: reason.code,
      label: reason.label!.trim(),
      enabled: reason.enabled !== false,
      paid: reason.paid !== false,
    }));
    const { error } = await admin.from('branch_hr_config').upsert({
      tenant_id: profile.tenant_id,
      branch_id: payload.branchId,
      leave_reasons: normalizedReasons,
      late_penalty_grace_minutes: grace,
      working_days: workingDays,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,branch_id' });
    if (error) return fail(500, 'Konfigurasi HR tidak dapat disimpan');
    return { status: 200, data: { success: true } };
  }

  return fail(400, 'Aksi HR tidak valid');
}
