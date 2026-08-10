import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR', 'KITCHEN']);
const MANAGEMENT_ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']);

interface StaffPayload {
  id?: string;
  name?: string;
  role?: string;
  branchIds?: string[];
  pin?: string;
  isActive?: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  workDays?: number[];
  permissions?: Record<string, boolean>;
}

export interface StaffRequestResult {
  status: number;
  data: unknown;
}

const fail = (status: number, error: string): StaffRequestResult => ({ status, data: { error } });

async function authorize(admin: SupabaseClient, accessToken: string) {
  if (!accessToken) return null;
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) return null;

  const userId = authData.user.id;
  const { data: profile } = await admin
    .from('user_profiles')
    .select('tenant_id,display_name,is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (!profile?.is_active) return null;

  const { data: memberships } = await admin
    .from('branch_members')
    .select('branch_id,role,is_active')
    .eq('user_id', userId)
    .eq('is_active', true);

  const managementMemberships = (memberships || []).filter((item) => MANAGEMENT_ROLES.has(item.role));
  if (!managementMemberships.length) return null;
  return {
    userId,
    tenantId: profile.tenant_id as string,
    memberships: managementMemberships as Array<{ branch_id: string; role: string; is_active: boolean }>,
  };
}

async function validateTargetBranches(
  admin: SupabaseClient,
  tenantId: string,
  branchIds: string[],
  allowedBranchIds: Set<string>,
) {
  if (!branchIds.length || branchIds.some((id) => !UUID_PATTERN.test(id) || !allowedBranchIds.has(id))) return false;
  const { data } = await admin.from('branches').select('id').eq('tenant_id', tenantId).in('id', branchIds).eq('is_active', true);
  return (data || []).length === branchIds.length;
}

async function replaceSchedules(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  branchIds: string[],
  payload: StaffPayload,
  actorUserId: string,
) {
  const { error: deleteError } = await admin
    .from('staff_schedules')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .is('effective_date', null);
  if (deleteError) throw deleteError;
  if (!payload.shiftStart || !payload.shiftEnd) return;
  const days = Array.from(new Set(payload.workDays || [1, 2, 3, 4, 5, 6]))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (!days.length) return;
  const spansMidnight = payload.shiftEnd <= payload.shiftStart;
  const rows = branchIds.flatMap((branchId) => days.map((weekday) => ({
    tenant_id: tenantId,
    branch_id: branchId,
    user_id: userId,
    weekday,
    starts_at: payload.shiftStart,
    ends_at: payload.shiftEnd,
    spans_midnight: spansMidnight,
    grace_minutes: 0,
    status: 'ACTIVE',
    created_by: actorUserId,
  })));
  const { error } = await admin.from('staff_schedules').insert(rows);
  if (error) throw error;
}

async function listStaff(admin: SupabaseClient, auth: NonNullable<Awaited<ReturnType<typeof authorize>>>) {
  const allowedBranches = auth.memberships.map((item) => item.branch_id);
  const { data: memberships, error: membershipError } = await admin
    .from('branch_members')
    .select('branch_id,user_id,role,permissions,is_active')
    .in('branch_id', allowedBranches);
  if (membershipError) return fail(500, 'Daftar membership staff tidak dapat dibaca');

  const userIds = Array.from(new Set((memberships || []).map((item) => item.user_id)));
  if (!userIds.length) return { status: 200, data: { staff: [] } };
  const [{ data: profiles, error: profileError }, { data: schedules, error: scheduleError }] = await Promise.all([
    admin.from('user_profiles').select('user_id,display_name,avatar_public_id,is_active').eq('tenant_id', auth.tenantId).in('user_id', userIds),
    admin.from('staff_schedules').select('user_id,branch_id,weekday,starts_at,ends_at,status').in('branch_id', allowedBranches).in('user_id', userIds).is('effective_date', null),
  ]);
  if (profileError || scheduleError) return fail(500, 'Profil atau jadwal staff tidak dapat dibaca');

  const staff = (profiles || []).map((profile) => {
    const memberRows = (memberships || []).filter((item) => item.user_id === profile.user_id);
    const scheduleRows = (schedules || []).filter((item) => item.user_id === profile.user_id && item.status === 'ACTIVE');
    const firstSchedule = scheduleRows[0];
    return {
      id: profile.user_id,
      name: profile.display_name,
      role: memberRows[0]?.role || 'KASIR',
      branchIds: memberRows.filter((item) => item.is_active).map((item) => item.branch_id),
      permissions: memberRows[0]?.permissions || {},
      isActive: profile.is_active && memberRows.some((item) => item.is_active),
      avatar: profile.avatar_public_id || undefined,
      shiftStart: firstSchedule?.starts_at?.slice(0, 5),
      shiftEnd: firstSchedule?.ends_at?.slice(0, 5),
      workDays: Array.from(new Set(scheduleRows.map((item) => item.weekday))).sort(),
    };
  });
  return { status: 200, data: { staff } };
}

async function createStaff(
  admin: SupabaseClient,
  auth: NonNullable<Awaited<ReturnType<typeof authorize>>>,
  payload: StaffPayload,
) {
  const name = payload.name?.trim();
  const role = payload.role || '';
  const branchIds = Array.from(new Set(payload.branchIds || []));
  if (!name || !ROLES.has(role)) return fail(400, 'Nama dan role staff tidak valid');
  if (!payload.pin || !/^\d{6}$/.test(payload.pin)) return fail(400, 'PIN harus 6 digit');
  const allowedBranches = new Set(auth.memberships.map((item) => item.branch_id));
  if (!(await validateTargetBranches(admin, auth.tenantId, branchIds, allowedBranches))) return fail(403, 'Penugasan outlet tidak diizinkan');
  const callerRoles = new Set(auth.memberships.map((item) => item.role));
  if (role === 'SUPER_OWNER' && !callerRoles.has('SUPER_OWNER')) return fail(403, 'Role Super Owner hanya dapat dibuat Super Owner');
  if (role === 'OWNER' && !callerRoles.has('SUPER_OWNER') && !callerRoles.has('OWNER')) return fail(403, 'Role Owner hanya dapat dibuat Owner');

  const internalEmail = `staff-${crypto.randomUUID()}@auth.omnipos.local`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email: internalEmail, email_confirm: true });
  if (createError || !created.user) return fail(500, 'Akun Auth staff tidak dapat dibuat');
  const userId = created.user.id;
  try {
    const { error: profileError } = await admin.from('user_profiles').insert({
      user_id: userId,
      tenant_id: auth.tenantId,
      display_name: name,
      is_active: payload.isActive !== false,
    });
    if (profileError) throw profileError;
    const { error: memberError } = await admin.from('branch_members').insert(branchIds.map((branchId) => ({
      branch_id: branchId,
      user_id: userId,
      role,
      permissions: payload.permissions || {},
      is_active: payload.isActive !== false,
    })));
    if (memberError) throw memberError;
    const { error: pinError } = await admin.rpc('set_staff_pin', {
      target_user_id: userId,
      target_tenant_id: auth.tenantId,
      plain_pin: payload.pin,
    });
    if (pinError) throw pinError;
    await replaceSchedules(admin, auth.tenantId, userId, branchIds, payload, auth.userId);
  } catch {
    await admin.auth.admin.deleteUser(userId);
    return fail(500, 'Pembuatan staff gagal dan telah dibatalkan');
  }
  return { status: 201, data: { id: userId } };
}

async function updateStaff(
  admin: SupabaseClient,
  auth: NonNullable<Awaited<ReturnType<typeof authorize>>>,
  payload: StaffPayload,
) {
  if (!payload.id || !UUID_PATTERN.test(payload.id)) return fail(400, 'ID staff tidak valid');
  const branchIds = Array.from(new Set(payload.branchIds || []));
  const allowedBranches = new Set(auth.memberships.map((item) => item.branch_id));
  if (!(await validateTargetBranches(admin, auth.tenantId, branchIds, allowedBranches))) return fail(403, 'Penugasan outlet tidak diizinkan');
  if (payload.role && !ROLES.has(payload.role)) return fail(400, 'Role tidak valid');
  if (payload.pin && !/^\d{6}$/.test(payload.pin)) return fail(400, 'PIN harus 6 digit');

  const [{ data: targetProfile }, { data: existingMemberships }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id,is_active').eq('user_id', payload.id).maybeSingle(),
    admin.from('branch_members').select('branch_id,role,is_active').eq('user_id', payload.id),
  ]);
  if (targetProfile?.tenant_id !== auth.tenantId) return fail(404, 'Staff tidak ditemukan');
  const callerRoles = new Set(auth.memberships.map((item) => item.role));
  const isOwner = callerRoles.has('SUPER_OWNER') || callerRoles.has('OWNER');
  const existingBranchIds = (existingMemberships || []).map((item) => item.branch_id);
  if (!isOwner && existingBranchIds.some((id) => !allowedBranches.has(id))) {
    return fail(403, 'Staff memiliki penugasan outlet di luar kewenangan Anda');
  }
  const role = payload.role || 'KASIR';
  if (role === 'SUPER_OWNER' && !callerRoles.has('SUPER_OWNER')) return fail(403, 'Role Super Owner hanya dapat diatur Super Owner');
  if (role === 'OWNER' && !isOwner) return fail(403, 'Role Owner hanya dapat diatur Owner');
  if (payload.id === auth.userId && (payload.isActive === false || !isOwner || (role !== 'OWNER' && role !== 'SUPER_OWNER'))) {
    return fail(400, 'Akun aktif tidak dapat menurunkan atau menonaktifkan aksesnya sendiri');
  }
  const isActive = payload.isActive !== false;
  const { error: profileError } = await admin.from('user_profiles').update({
    ...(payload.name?.trim() ? { display_name: payload.name.trim() } : {}),
    is_active: isActive,
  }).eq('user_id', payload.id).eq('tenant_id', auth.tenantId);
  if (profileError) return fail(500, 'Profil staff gagal diperbarui');

  const { error: memberError } = await admin.from('branch_members').upsert(branchIds.map((branchId) => ({
    branch_id: branchId,
    user_id: payload.id,
    role,
    permissions: payload.permissions || {},
    is_active: isActive,
  })), { onConflict: 'branch_id,user_id' });
  if (memberError) return fail(500, 'Membership staff gagal diperbarui');
  const removedBranchIds = existingBranchIds.filter((id) => !branchIds.includes(id));
  if (removedBranchIds.length) {
    const { error: removeMembershipError } = await admin
      .from('branch_members')
      .delete()
      .eq('user_id', payload.id)
      .in('branch_id', removedBranchIds);
    if (removeMembershipError) return fail(500, 'Penugasan outlet lama gagal dilepas');
  }
  if (payload.pin) {
    const { error: pinError } = await admin.rpc('set_staff_pin', {
      target_user_id: payload.id,
      target_tenant_id: auth.tenantId,
      plain_pin: payload.pin,
    });
    if (pinError) return fail(500, 'PIN staff gagal diperbarui');
  }
  try {
    await replaceSchedules(admin, auth.tenantId, payload.id, branchIds, payload, auth.userId);
  } catch {
    return fail(500, 'Jadwal staff gagal diperbarui');
  }
  return { status: 200, data: { id: payload.id } };
}

async function deactivateStaff(
  admin: SupabaseClient,
  auth: NonNullable<Awaited<ReturnType<typeof authorize>>>,
  userId: string,
) {
  if (!UUID_PATTERN.test(userId) || userId === auth.userId) return fail(400, 'Staff tidak dapat dinonaktifkan');
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id').eq('user_id', userId).maybeSingle(),
    admin.from('branch_members').select('branch_id').eq('user_id', userId).eq('is_active', true),
  ]);
  if (profile?.tenant_id !== auth.tenantId) return fail(404, 'Staff tidak ditemukan');
  const callerRoles = new Set(auth.memberships.map((item) => item.role));
  const isOwner = callerRoles.has('SUPER_OWNER') || callerRoles.has('OWNER');
  const allowedBranches = new Set(auth.memberships.map((item) => item.branch_id));
  if (!isOwner && (memberships || []).some((item) => !allowedBranches.has(item.branch_id))) {
    return fail(403, 'Staff memiliki penugasan outlet di luar kewenangan Anda');
  }
  await admin.from('user_profiles').update({ is_active: false }).eq('user_id', userId);
  await admin.from('branch_members').update({ is_active: false }).eq('user_id', userId);
  return { status: 200, data: { id: userId, isActive: false } };
}

export async function handleStaffRequest(
  method: string,
  body: StaffPayload,
  accessToken: string,
  admin: SupabaseClient,
): Promise<StaffRequestResult> {
  const auth = await authorize(admin, accessToken);
  if (!auth) return fail(403, 'Akses manajemen staff ditolak');
  if (method === 'GET') return listStaff(admin, auth);
  if (method === 'POST') return createStaff(admin, auth, body);
  if (method === 'PATCH') return updateStaff(admin, auth, body);
  if (method === 'DELETE') return deactivateStaff(admin, auth, body.id || '');
  return fail(405, 'Method not allowed');
}
