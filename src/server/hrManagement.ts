import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERIOD_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const MANAGEMENT_ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']);
const NON_PAYROLL_ROLES = new Set(['SUPER_OWNER', 'OWNER']);
const LEAVE_TYPES = new Set(['SICK', 'PERMIT', 'ANNUAL', 'UNPAID']);

type HrAction =
  | 'SUBMIT_LEAVE'
  | 'REVIEW_LEAVE'
  | 'SAVE_PAYROLL_PROFILE'
  | 'SAVE_HR_CONFIG'
  | 'SAVE_PAYROLL_ADJUSTMENT'
  | 'REQUEST_KASBON'
  | 'REVIEW_KASBON'
  | 'DEDUCT_KASBON'
  | 'FINALIZE_PAYROLL_PERIOD'
  | 'MARK_PAYROLL_PAID'
  | 'LOCK_PAYROLL_PERIOD';

interface LatePenaltyTier { maxMinutes: number; amount: number }

// Potongan telat bertingkat: cari tier pertama yang menampung menit telat;
// bila melebihi semua batas, pakai tier terakhir (tarif maksimum).
const tierPenalty = (lateMinutes: number, tiers: LatePenaltyTier[]): number => {
  if (lateMinutes <= 0 || !tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => a.maxMinutes - b.maxMinutes);
  const hit = sorted.find((t) => lateMinutes <= t.maxMinutes);
  return Math.round(Number((hit || sorted[sorted.length - 1]).amount) || 0);
};
const normalizeTiers = (raw: any): LatePenaltyTier[] => (Array.isArray(raw) ? raw : [])
  .map((t: any) => ({ maxMinutes: Math.round(Number(t?.maxMinutes) || 0), amount: Math.round(Number(t?.amount) || 0) }))
  .filter((t) => t.maxMinutes > 0 && t.amount >= 0)
  .slice(0, 6);

interface HrPayload {
  branchId?: string;
  action?: HrAction;
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
  latePenaltyTiers?: Array<{ maxMinutes?: number; amount?: number }>;
  overtimeMinMinutes?: number;
  workingDays?: number[];
  amount?: number;
  bonus?: number;
  note?: string;
  deductMonth?: string;
  kasbonId?: string;
  period?: string;
  // scope=ALL: rekap KONSOLIDASI seluruh cabang yang dikelola aktor (BACA saja).
  scope?: string;
}

export interface HrRequestResult { status: number; data: unknown }
const fail = (status: number, error: string): HrRequestResult => ({ status, data: { error } });

const safePeriod = (period?: string) => Boolean(period && PERIOD_PATTERN.test(period));

const localParts = (iso: string, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
};

const localPeriod = (iso: string, timeZone: string) => {
  const p = localParts(iso, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
};

const localDateKey = (iso: string, timeZone: string) => {
  const p = localParts(iso, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

const periodQueryBounds = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  // Buffer covers common timezone offsets; exact membership is filtered in JS.
  return {
    from: new Date(start.getTime() - 36 * 60 * 60 * 1000).toISOString(),
    to: new Date(end.getTime() + 36 * 60 * 60 * 1000).toISOString(),
  };
};

const mapAdvance = (row: any, name: string) => ({
  id: row.id,
  user_id: row.user_id,
  staffName: name,
  branch_id: row.branch_id,
  amount: Number(row.amount || 0),
  reason: row.note || 'Kasbon',
  status: row.status || 'APPROVED',
  requested_at: row.created_at,
  reviewed_by: row.reviewed_by || undefined,
  reviewed_at: row.reviewed_at || undefined,
  review_note: row.review_note || undefined,
  deduct_month: row.deduct_month || (row.advance_date ? String(row.advance_date).slice(0, 7) : undefined),
  deducted_at: row.deducted_at || undefined,
});


/** Cabang dalam tenant yang sama tempat aktor berperan manajemen aktif. */
async function hrManagedBranchIds(actorId: string, tenantId: string, admin: SupabaseClient): Promise<string[]> {
  const { data: memberships } = await admin
    .from('branch_members').select('branch_id,role,is_active')
    .eq('user_id', actorId).eq('is_active', true);
  const ids = (memberships || []).filter((r: any) => MANAGEMENT_ROLES.has(r.role)).map((r: any) => r.branch_id);
  if (!ids.length) return [];
  const { data: branches } = await admin
    .from('branches').select('id').eq('tenant_id', tenantId).eq('is_active', true).in('id', ids);
  return (branches || []).map((b: any) => b.id);
}
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
    admin.from('branches').select('tenant_id,name,timezone,is_active').eq('id', payload.branchId).maybeSingle(),
  ]);
  if (!profile?.is_active || !membership?.is_active || !branch?.is_active || profile.tenant_id !== branch.tenant_id) {
    return fail(403, 'Akun tidak memiliki akses ke outlet ini');
  }
  const isManagement = MANAGEMENT_ROLES.has(membership.role);
  const timeZone = branch.timezone || 'Asia/Jakarta';

  if (method === 'GET') {
    // KONSOLIDASI (baca saja): manajemen dapat melihat rekap seluruh cabang
    // yang dikelolanya. Aksi tulis payroll tetap terikat satu cabang.
    const consolidated = String(payload.scope || '').toUpperCase() === 'ALL' && isManagement;
    const scopeBranchIds = consolidated
      ? await hrManagedBranchIds(actorId, profile.tenant_id, admin)
      : [payload.branchId as string];
    const branchScope = scopeBranchIds.length ? scopeBranchIds : [payload.branchId as string];

    let leaveQuery = admin.from('leave_requests').select('*').in('branch_id', branchScope).order('created_at', { ascending: false }).limit(250);
    let payrollQuery = admin.from('payroll_profiles').select('*').in('branch_id', branchScope).order('updated_at', { ascending: false });
    let advanceQuery = admin.from('staff_advances').select('*').in('branch_id', branchScope).order('created_at', { ascending: false }).limit(500);
    if (!isManagement) {
      leaveQuery = leaveQuery.eq('user_id', actorId);
      payrollQuery = payrollQuery.eq('user_id', actorId);
      advanceQuery = advanceQuery.eq('user_id', actorId);
    }

    const periodQuery = admin.from('payroll_periods').select('*').in('branch_id', branchScope).order('period', { ascending: false }).limit(24);
    let snapshotQuery = admin.from('payroll_snapshots').select('*').in('branch_id', branchScope).order('period', { ascending: false }).limit(1000);
    if (safePeriod(payload.period)) snapshotQuery = snapshotQuery.eq('period', payload.period!);
    if (!isManagement) snapshotQuery = snapshotQuery.eq('user_id', actorId);

    const [leaveResult, payrollResult, hrConfigResult, advanceResult, periodResult, snapshotResult, adjustmentResult] = await Promise.all([
      leaveQuery,
      payrollQuery,
      admin.from('branch_hr_config').select('leave_reasons,late_penalty_grace_minutes,working_days,late_penalty_tiers,overtime_min_minutes').eq('branch_id', payload.branchId).maybeSingle(),
      advanceQuery,
      periodQuery,
      snapshotQuery,
      admin.from('payroll_adjustments').select('user_id,period,bonus,note').in('branch_id', branchScope),
    ]);
    if (leaveResult.error || payrollResult.error) return fail(500, 'Data HR belum siap. Terapkan migrasi HR terbaru di Supabase.');
    if (advanceResult.error && advanceResult.error.code !== '42P01' && advanceResult.error.code !== '42703') return fail(500, 'Data kasbon tidak dapat dimuat');
    if ((periodResult.error || snapshotResult.error) && !['42P01', '42703'].includes(periodResult.error?.code || snapshotResult.error?.code || '')) {
      return fail(500, 'Data periode payroll tidak dapat dimuat');
    }

    const leaveRequests = leaveResult.data || [];
    const payrollProfiles = payrollResult.data || [];
    const advances = advanceResult.data || [];
    const snapshots = snapshotResult.data || [];
    const userIds = [...new Set([
      ...leaveRequests.map((row: any) => row.user_id),
      ...payrollProfiles.map((row: any) => row.user_id),
      ...advances.map((row: any) => row.user_id),
      ...snapshots.map((row: any) => row.user_id),
    ])];
    const [{ data: users }, { data: payrollMemberships }] = userIds.length
      ? await Promise.all([
          admin.from('user_profiles').select('user_id,display_name').in('user_id', userIds),
          admin.from('branch_members').select('user_id,role').eq('branch_id', payload.branchId).in('user_id', userIds).eq('is_active', true),
        ])
      : [{ data: [] }, { data: [] }];
    const names = new Map((users || []).map((row: any) => [row.user_id, row.display_name]));
    const roles = new Map((payrollMemberships || []).map((row: any) => [row.user_id, row.role]));
    const isOperationalPayrollUser = (userId: string) => !NON_PAYROLL_ROLES.has(roles.get(userId) || '');
    const hrConfig = hrConfigResult.data;

    return {
      status: 200,
      data: {
        canManage: isManagement,
        consolidated,
        leaveRequests: leaveRequests.map((row: any) => ({ ...row, staffName: names.get(row.user_id) || 'Staff' })),
        payrollProfiles: payrollProfiles.filter((row: any) => isOperationalPayrollUser(row.user_id)).map((row: any) => ({ ...row, staffName: names.get(row.user_id) || 'Staff' })),
        kasbonRecords: advances.filter((row: any) => isOperationalPayrollUser(row.user_id)).map((row: any) => mapAdvance(row, names.get(row.user_id) || 'Staff')),
        payrollPeriods: periodResult.data || [],
        payrollSnapshots: snapshots.filter((row: any) => isOperationalPayrollUser(row.user_id)),
        payrollAdjustments: (adjustmentResult.data || []).filter((row: any) => isOperationalPayrollUser(row.user_id)),
        hrConfig: {
          leaveReasons: hrConfig?.leave_reasons || [
            { code: 'SICK', label: 'Sakit', enabled: true, paid: true },
            { code: 'PERMIT', label: 'Izin pribadi', enabled: true, paid: true },
            { code: 'ANNUAL', label: 'Cuti tahunan', enabled: true, paid: true },
            { code: 'UNPAID', label: 'Izin tanpa dibayar', enabled: true, paid: false },
          ],
          latePenaltyGraceMinutes: Number(hrConfig?.late_penalty_grace_minutes || 0),
          latePenaltyTiers: normalizeTiers(hrConfig?.late_penalty_tiers),
          overtimeMinMinutes: Number(hrConfig?.overtime_min_minutes ?? 30),
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

  if (method === 'POST' && payload.action === 'REQUEST_KASBON') {
    const targetUserId = isManagement && payload.userId && UUID_PATTERN.test(payload.userId) ? payload.userId : actorId;
    const amount = Math.round(Number(payload.amount));
    if (!Number.isFinite(amount) || amount <= 0) return fail(400, 'Nominal kasbon tidak valid');
    if (!payload.reason || payload.reason.trim().length < 3) return fail(400, 'Keterangan kasbon minimal 3 karakter');
    const deductMonth = safePeriod(payload.deductMonth) ? payload.deductMonth! : new Date().toISOString().slice(0, 7);
    const [{ data: targetMembership }, { data: payrollProfile }] = await Promise.all([
      admin.from('branch_members').select('user_id').eq('branch_id', payload.branchId).eq('user_id', targetUserId).eq('is_active', true).maybeSingle(),
      admin.from('payroll_profiles').select('base_salary').eq('branch_id', payload.branchId).eq('user_id', targetUserId).maybeSingle(),
    ]);
    if (!targetMembership) return fail(404, 'Staff tidak aktif pada outlet ini');
    if (payrollProfile?.base_salary && amount > Number(payrollProfile.base_salary) * 0.5) {
      return fail(400, 'Nominal kasbon melebihi 50% gaji pokok');
    }
    const { data, error } = await admin.from('staff_advances').insert({
      tenant_id: profile.tenant_id,
      branch_id: payload.branchId,
      user_id: targetUserId,
      amount,
      note: payload.reason.trim(),
      advance_date: new Date().toISOString().slice(0, 10),
      deduct_month: deductMonth,
      status: 'PENDING',
      created_by: actorId,
    }).select('*').single();
    if (error) return fail(500, 'Kasbon tidak dapat disimpan. Terapkan migrasi payroll terbaru.');
    return { status: 201, data };
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

  if (method === 'PATCH' && payload.action === 'REVIEW_KASBON') {
    if (!isManagement) return fail(403, 'Hanya manajemen yang dapat meninjau kasbon');
    if (!payload.kasbonId || !UUID_PATTERN.test(payload.kasbonId)) return fail(400, 'Kasbon tidak valid');
    if (!payload.status || !['APPROVED', 'REJECTED'].includes(payload.status)) return fail(400, 'Status kasbon tidak valid');
    const { data, error } = await admin.from('staff_advances').update({
      status: payload.status,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
      review_note: payload.reviewNote?.trim() || null,
    }).eq('id', payload.kasbonId).eq('branch_id', payload.branchId).eq('status', 'PENDING').select('*').maybeSingle();
    if (error || !data) return fail(409, 'Kasbon sudah diproses atau tidak ditemukan');
    return { status: 200, data };
  }

  if (method === 'PATCH' && payload.action === 'DEDUCT_KASBON') {
    if (!isManagement) return fail(403, 'Hanya manajemen yang dapat menandai potongan kasbon');
    if (!payload.kasbonId || !UUID_PATTERN.test(payload.kasbonId)) return fail(400, 'Kasbon tidak valid');
    const { data, error } = await admin.from('staff_advances').update({
      status: 'PAID',
      deducted_at: new Date().toISOString(),
    }).eq('id', payload.kasbonId).eq('branch_id', payload.branchId).eq('status', 'APPROVED').select('*').maybeSingle();
    if (error || !data) return fail(409, 'Kasbon belum disetujui atau sudah dipotong');
    return { status: 200, data };
  }

  if (method === 'PATCH' && payload.action === 'SAVE_PAYROLL_PROFILE') {
    if (!isManagement) return fail(403, 'Hanya manajemen yang dapat mengatur payroll');
    if (!payload.userId || !UUID_PATTERN.test(payload.userId)) return fail(400, 'Staff tidak valid');
    const amounts = [payload.baseSalary, payload.mealAllowance, payload.transportAllowance, payload.overtimeHourlyRate, payload.lateDeductionPerMinute];
    if (amounts.some((value) => !Number.isFinite(value) || Number(value) < 0)) return fail(400, 'Nilai payroll tidak valid');
    const { data: targetMembership } = await admin.from('branch_members').select('user_id,role').eq('branch_id', payload.branchId).eq('user_id', payload.userId).eq('is_active', true).maybeSingle();
    if (!targetMembership) return fail(404, 'Staff tidak aktif pada outlet ini');
    if (NON_PAYROLL_ROLES.has(targetMembership.role)) return fail(400, 'Akun Owner tidak termasuk payroll staff operasional');
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
    const tiers = normalizeTiers(payload.latePenaltyTiers);
    const overtimeMin = Math.round(Number(payload.overtimeMinMinutes ?? 30));
    if (!Number.isFinite(overtimeMin) || overtimeMin < 0 || overtimeMin > 480) {
      return fail(400, 'Ambang lembur harus antara 0–480 menit');
    }
    const { error } = await admin.from('branch_hr_config').upsert({
      tenant_id: profile.tenant_id,
      branch_id: payload.branchId,
      leave_reasons: normalizedReasons,
      late_penalty_grace_minutes: grace,
      late_penalty_tiers: tiers,
      overtime_min_minutes: overtimeMin,
      working_days: workingDays,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,branch_id' });
    if (error) return fail(500, 'Konfigurasi HR tidak dapat disimpan');
    return { status: 200, data: { success: true } };
  }

  if (method === 'PATCH' && payload.action === 'SAVE_PAYROLL_ADJUSTMENT') {
    if (!isManagement) return fail(403, 'Hanya manajemen yang dapat mengatur bonus');
    if (!payload.userId || !UUID_PATTERN.test(payload.userId)) return fail(400, 'Staff tidak valid');
    if (!safePeriod(payload.period)) return fail(400, 'Periode tidak valid');
    const bonus = Math.max(0, Math.round(Number(payload.bonus) || 0));
    const { error } = await admin.from('payroll_adjustments').upsert({
      tenant_id: profile.tenant_id,
      branch_id: payload.branchId,
      period: payload.period,
      user_id: payload.userId,
      bonus,
      note: payload.note ? String(payload.note).slice(0, 200) : '',
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'branch_id,period,user_id' });
    if (error) return fail(500, 'Bonus tidak dapat disimpan. Terapkan migrasi payroll terbaru.');
    return { status: 200, data: { success: true } };
  }

  if (method === 'PATCH' && payload.action === 'FINALIZE_PAYROLL_PERIOD') {
    if (!isManagement) return fail(403, 'Hanya manajemen yang dapat memfinalisasi payroll');
    if (!safePeriod(payload.period)) return fail(400, 'Periode payroll tidak valid');
    const period = payload.period!;

    const { data: existingPeriod } = await admin.from('payroll_periods')
      .select('id,status')
      .eq('tenant_id', profile.tenant_id)
      .eq('branch_id', payload.branchId)
      .eq('period', period)
      .maybeSingle();
    if (existingPeriod?.status === 'LOCKED' || existingPeriod?.status === 'PAID') {
      return fail(409, 'Payroll yang sudah dibayar/dikunci tidak dapat dihitung ulang');
    }

    const [{ data: payrollProfiles, error: payrollError }, { data: hrConfig }] = await Promise.all([
      admin.from('payroll_profiles').select('*').eq('branch_id', payload.branchId).eq('is_active', true),
      admin.from('branch_hr_config').select('late_penalty_grace_minutes,late_penalty_tiers,overtime_min_minutes').eq('branch_id', payload.branchId).maybeSingle(),
    ]);
    const penaltyTiers = normalizeTiers(hrConfig?.late_penalty_tiers);
    const tiersActive = penaltyTiers.length > 0 && penaltyTiers.some((t) => t.amount > 0);
    const overtimeThreshold = Math.max(0, Number(hrConfig?.overtime_min_minutes ?? 30));
    if (payrollError) return fail(500, 'Profil payroll tidak dapat dimuat');
    if (!payrollProfiles?.length) return fail(400, 'Belum ada profil payroll aktif untuk outlet ini');

    const profileUserIds = payrollProfiles.map((row: any) => row.user_id);
    const { data: payrollMemberships } = profileUserIds.length
      ? await admin.from('branch_members').select('user_id,role').eq('branch_id', payload.branchId).in('user_id', profileUserIds).eq('is_active', true)
      : { data: [] };
    const payrollRoles = new Map((payrollMemberships || []).map((row: any) => [row.user_id, row.role]));
    const payableProfiles = payrollProfiles.filter((row: any) => !NON_PAYROLL_ROLES.has(payrollRoles.get(row.user_id) || ''));
    if (!payableProfiles.length) return fail(400, 'Belum ada staff operasional yang memiliki profil payroll aktif');

    const staffIds = payableProfiles.map((row: any) => row.user_id);
    const bounds = periodQueryBounds(period);
    const [usersResult, attendanceResult, schedulesResult, advancesResult, adjustmentsResult] = await Promise.all([
      admin.from('user_profiles').select('user_id,display_name').in('user_id', staffIds),
      admin.from('attendance_events')
        .select('user_id,event_type,occurred_at,schedule_id')
        .eq('branch_id', payload.branchId)
        .in('user_id', staffIds)
        .in('event_type', ['CLOCK_IN', 'CLOCK_OUT'])
        .gte('occurred_at', bounds.from)
        .lt('occurred_at', bounds.to)
        .order('occurred_at', { ascending: true }),
      admin.from('staff_schedules').select('id,starts_at,ends_at,grace_minutes,spans_midnight').eq('branch_id', payload.branchId),
      admin.from('staff_advances').select('user_id,amount').eq('branch_id', payload.branchId).eq('deduct_month', period).eq('status', 'APPROVED'),
      admin.from('payroll_adjustments').select('user_id,bonus').eq('branch_id', payload.branchId).eq('period', period),
    ]);
    if (attendanceResult.error || schedulesResult.error || advancesResult.error) return fail(500, 'Data pendukung payroll tidak dapat dihitung');

    const names = new Map((usersResult.data || []).map((row: any) => [row.user_id, row.display_name]));
    const schedules = new Map((schedulesResult.data || []).map((row: any) => [row.id, row]));
    const bonusByStaff = new Map<string, number>((adjustmentsResult.data || []).map((row: any) => [row.user_id, Number(row.bonus || 0)]));
    // lateDayMinutes: menit telat PER HARI (untuk penalty bertingkat per kejadian).
    const attendanceByStaff = new Map<string, { dates: Set<string>; lateMinutes: number; overtimeMinutes: number; lateDayMinutes: number[] }>();
    const openClockInByStaff = new Map<string, any>();
    const policyGrace = Number(hrConfig?.late_penalty_grace_minutes || 0);

    const scheduleDurationMinutes = (schedule: any) => {
      if (!schedule?.starts_at || !schedule?.ends_at) return 0;
      const [startHour, startMinute] = String(schedule.starts_at).split(':').map(Number);
      const [endHour, endMinute] = String(schedule.ends_at).split(':').map(Number);
      const start = startHour * 60 + startMinute;
      const end = endHour * 60 + endMinute;
      const duration = end - start + (schedule.spans_midnight || end <= start ? 1440 : 0);
      return duration > 0 && duration <= 24 * 60 ? duration : 0;
    };

    for (const event of attendanceResult.data || []) {
      const stats = attendanceByStaff.get(event.user_id) || { dates: new Set<string>(), lateMinutes: 0, overtimeMinutes: 0, lateDayMinutes: [] as number[] };

      if (event.event_type === 'CLOCK_IN') {
        // Only CLOCK_IN belonging to this local payroll month contributes attendance/late stats.
        if (localPeriod(event.occurred_at, timeZone) === period) {
          stats.dates.add(localDateKey(event.occurred_at, timeZone));
          const schedule = event.schedule_id ? schedules.get(event.schedule_id) : undefined;
          if (schedule?.starts_at) {
            const local = localParts(event.occurred_at, timeZone);
            const eventMinutes = local.hour * 60 + local.minute;
            const [startHour, startMinute] = String(schedule.starts_at).split(':').map(Number);
            const startMinutes = startHour * 60 + startMinute;
            let delta = eventMinutes - startMinutes;
            if (schedule.spans_midnight && delta < -720) delta += 1440;
            const grace = Math.max(policyGrace, Number(schedule.grace_minutes || 0));
            const dayLate = Math.max(0, delta - grace);
            if (dayLate > 0) { stats.lateMinutes += dayLate; stats.lateDayMinutes.push(dayLate); }
          }
          openClockInByStaff.set(event.user_id, event);
        }
      } else if (event.event_type === 'CLOCK_OUT') {
        const clockIn = openClockInByStaff.get(event.user_id);
        if (clockIn) {
          const actualMinutes = Math.round((new Date(event.occurred_at).getTime() - new Date(clockIn.occurred_at).getTime()) / 60000);
          const schedule = clockIn.schedule_id ? schedules.get(clockIn.schedule_id) : undefined;
          const scheduledMinutes = scheduleDurationMinutes(schedule);
          if (actualMinutes > 0 && actualMinutes <= 36 * 60 && scheduledMinutes > 0) {
            const dayOvertime = Math.max(0, actualMinutes - scheduledMinutes);
            // Lembur hanya dihitung bila mencapai ambang (mis. >= 30 menit).
            if (dayOvertime >= overtimeThreshold) stats.overtimeMinutes += dayOvertime;
          }
          openClockInByStaff.delete(event.user_id);
        }
      }
      attendanceByStaff.set(event.user_id, stats);
    }

    const advancesByStaff = new Map<string, number>();
    for (const advance of advancesResult.data || []) {
      advancesByStaff.set(advance.user_id, (advancesByStaff.get(advance.user_id) || 0) + Number(advance.amount || 0));
    }

    const now = new Date().toISOString();
    const { data: periodRow, error: periodError } = await admin.from('payroll_periods').upsert({
      tenant_id: profile.tenant_id,
      branch_id: payload.branchId,
      period,
      status: existingPeriod?.status === 'FINALIZED' ? 'FINALIZED' : 'DRAFT',
      updated_at: now,
    }, { onConflict: 'tenant_id,branch_id,period' }).select('*').single();
    if (periodError || !periodRow) return fail(500, 'Periode payroll tidak dapat dibuat. Terapkan migrasi payroll terbaru.');

    const snapshots = payableProfiles.map((row: any) => {
      const stats = attendanceByStaff.get(row.user_id) || { dates: new Set<string>(), lateMinutes: 0, overtimeMinutes: 0, lateDayMinutes: [] as number[] };
      const base = Number(row.base_salary || 0);
      const meal = Number(row.meal_allowance || 0);
      const transport = Number(row.transport_allowance || 0);
      const overtimeMinutes = Math.max(0, Math.round(stats.overtimeMinutes));
      const overtimePay = Math.round((overtimeMinutes * Number(row.overtime_hourly_rate || 0)) / 60);
      const gross = base + meal + transport + overtimePay;
      // Penalty telat: bertingkat per kejadian bila tier aktif, jika tidak pakai
      // tarif per-menit lama (backward compatible).
      const lateDeduction = tiersActive
        ? stats.lateDayMinutes.reduce((sum, m) => sum + tierPenalty(m, penaltyTiers), 0)
        : Math.round(stats.lateMinutes * Number(row.late_deduction_per_minute || 0));
      const bonus = bonusByStaff.get(row.user_id) || 0;
      const kasbonDeduction = advancesByStaff.get(row.user_id) || 0;
      const totalDeduction = lateDeduction + kasbonDeduction;
      return {
        tenant_id: profile.tenant_id,
        branch_id: payload.branchId,
        payroll_period_id: periodRow.id,
        period,
        user_id: row.user_id,
        staff_name: names.get(row.user_id) || 'Staff',
        base_salary: base,
        meal_allowance: meal,
        transport_allowance: transport,
        overtime_minutes: overtimeMinutes,
        overtime_pay: overtimePay,
        gross_salary: gross,
        attendance_count: stats.dates.size,
        late_minutes: stats.lateMinutes,
        late_deduction: lateDeduction,
        kasbon_deduction: kasbonDeduction,
        manual_adjustment: bonus,
        total_deduction: totalDeduction,
        net_salary: Math.max(0, gross - totalDeduction + bonus),
        calculation_meta: {
          payroll_profile_updated_at: row.updated_at,
          policy_grace_minutes: policyGrace,
          late_penalty_mode: tiersActive ? 'tiered' : 'per_minute',
          overtime_min_minutes: overtimeThreshold,
          bonus,
          overtime_source: 'paired_clock_duration_minus_schedule_duration',
          generated_at: now,
          timezone: timeZone,
        },
        updated_at: now,
      };
    });

    // One UPSERT statement is atomic and preserves the previous snapshot if the statement fails.
    const { data: savedSnapshots, error: snapshotError } = await admin.from('payroll_snapshots')
      .upsert(snapshots, { onConflict: 'payroll_period_id,user_id' })
      .select('*');
    if (snapshotError) return fail(500, 'Snapshot payroll tidak dapat disimpan');

    const currentUserIds = new Set(staffIds);
    const { data: existingSnapshots } = await admin.from('payroll_snapshots')
      .select('id,user_id')
      .eq('payroll_period_id', periodRow.id);
    const staleIds = (existingSnapshots || []).filter((row: any) => !currentUserIds.has(row.user_id)).map((row: any) => row.id);
    if (staleIds.length) {
      const { error: staleDeleteError } = await admin.from('payroll_snapshots').delete().in('id', staleIds);
      if (staleDeleteError) return fail(500, 'Snapshot staff nonaktif tidak dapat dibersihkan');
    }

    const { data: finalizedPeriod, error: finalizeError } = await admin.from('payroll_periods').update({
      status: 'FINALIZED',
      finalized_by: actorId,
      finalized_at: now,
      paid_by: null,
      paid_at: null,
      locked_by: null,
      locked_at: null,
      updated_at: now,
    }).eq('id', periodRow.id).select('*').single();
    if (finalizeError || !finalizedPeriod) return fail(500, 'Status periode payroll tidak dapat difinalisasi');
    return { status: 200, data: { period: finalizedPeriod, snapshots: savedSnapshots || [] } };
  }

  if (method === 'PATCH' && payload.action === 'MARK_PAYROLL_PAID') {
    if (!isManagement) return fail(403, 'Hanya manajemen yang dapat menandai payroll dibayar');
    if (!safePeriod(payload.period)) return fail(400, 'Periode payroll tidak valid');
    const now = new Date().toISOString();
    const { data: periodRow, error } = await admin.from('payroll_periods').update({
      status: 'PAID', paid_by: actorId, paid_at: now, updated_at: now,
    }).eq('branch_id', payload.branchId).eq('period', payload.period).eq('status', 'FINALIZED').select('*').maybeSingle();
    if (error || !periodRow) return fail(409, 'Payroll harus FINALIZED sebelum ditandai dibayar');
    await admin.from('staff_advances').update({ status: 'PAID', deducted_at: now })
      .eq('branch_id', payload.branchId).eq('deduct_month', payload.period).eq('status', 'APPROVED');
    return { status: 200, data: periodRow };
  }

  if (method === 'PATCH' && payload.action === 'LOCK_PAYROLL_PERIOD') {
    if (!isManagement) return fail(403, 'Hanya manajemen yang dapat mengunci payroll');
    if (!safePeriod(payload.period)) return fail(400, 'Periode payroll tidak valid');
    const now = new Date().toISOString();
    const { data: periodRow, error } = await admin.from('payroll_periods').update({
      status: 'LOCKED', locked_by: actorId, locked_at: now, updated_at: now,
    }).eq('branch_id', payload.branchId).eq('period', payload.period).eq('status', 'PAID').select('*').maybeSingle();
    if (error || !periodRow) return fail(409, 'Payroll harus berstatus PAID sebelum dikunci');
    return { status: 200, data: periodRow };
  }

  return fail(400, 'Aksi HR tidak valid');
}
