import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AttendancePayload {
  branchId?: string;
  userId?: string;
  from?: string;
  to?: string;
  type?: 'CLOCK_IN' | 'CLOCK_OUT';
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  selfiePublicId?: string;
  verificationMethod?: 'PIN' | 'PIN_GPS' | 'PIN_GPS_SELFIE';
  requestId?: string;
}

export interface AttendanceRequestResult {
  status: number;
  data: unknown;
}

const fail = (status: number, error: string): AttendanceRequestResult => ({ status, data: { error } });

const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export async function handleAttendanceRequest(
  method: string,
  payload: AttendancePayload,
  accessToken: string,
  admin: SupabaseClient,
): Promise<AttendanceRequestResult> {
  if (method !== 'POST' && method !== 'GET') return fail(405, 'Method not allowed');
  if (!accessToken) return fail(401, 'Sesi absensi tidak tersedia');
  if (!payload.branchId || !UUID_PATTERN.test(payload.branchId)) return fail(400, 'Outlet tidak valid');

  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) return fail(401, 'Sesi absensi telah berakhir');
  const userId = authData.user.id;

  const [{ data: profile }, { data: membership }, { data: branch }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id,display_name,is_active').eq('user_id', userId).maybeSingle(),
    admin.from('branch_members').select('role,is_active').eq('user_id', userId).eq('branch_id', payload.branchId).maybeSingle(),
    admin.from('branches').select('tenant_id,name,timezone,is_active').eq('id', payload.branchId).maybeSingle(),
  ]);
  if (!profile?.is_active || !membership?.is_active || !branch?.is_active || profile.tenant_id !== branch.tenant_id) {
    return fail(403, 'Akun tidak memiliki akses absensi di outlet ini');
  }

  if (method === 'GET') {
    const managementRoles = ['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'];
    const canViewBranch = managementRoles.includes(membership.role);
    const targetUserId = canViewBranch && payload.userId && UUID_PATTERN.test(payload.userId)
      ? payload.userId
      : canViewBranch ? undefined : userId;
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let query = admin
      .from('attendance_events')
      .select('id,user_id,event_type,occurred_at,latitude,longitude,accuracy_meters,distance_meters,selfie_public_id,verification_method,schedule_id')
      .eq('tenant_id', profile.tenant_id)
      .eq('branch_id', payload.branchId)
      .gte('occurred_at', payload.from || defaultFrom)
      .lte('occurred_at', payload.to || now.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(500);
    if (targetUserId) query = query.eq('user_id', targetUserId);
    const { data: events, error: eventsError } = await query;
    if (eventsError) return fail(500, 'Riwayat presensi tidak dapat dimuat');

    const userIds = [...new Set((events || []).map((event) => event.user_id))];
    const [{ data: profiles }, { data: memberships }, { data: schedules }] = await Promise.all([
      userIds.length ? admin.from('user_profiles').select('user_id,display_name').in('user_id', userIds) : Promise.resolve({ data: [] }),
      userIds.length ? admin.from('branch_members').select('user_id,role').eq('branch_id', payload.branchId).in('user_id', userIds) : Promise.resolve({ data: [] }),
      admin.from('staff_schedules').select('id,starts_at,grace_minutes').eq('branch_id', payload.branchId),
    ]);
    const names = new Map((profiles || []).map((item) => [item.user_id, item.display_name]));
    const roles = new Map((memberships || []).map((item) => [item.user_id, item.role]));
    const scheduleMap = new Map((schedules || []).map((item) => [item.id, item]));
    const records = (events || []).map((event) => {
      const schedule = event.schedule_id ? scheduleMap.get(event.schedule_id) : undefined;
      let minutesLate = 0;
      if (event.event_type === 'CLOCK_IN' && schedule?.starts_at) {
        const occurred = new Date(event.occurred_at);
        const [hours, minutes] = schedule.starts_at.split(':').map(Number);
        const scheduled = new Date(occurred);
        scheduled.setHours(hours, minutes, 0, 0);
        minutesLate = Math.max(0, Math.floor((occurred.getTime() - scheduled.getTime()) / 60_000));
      }
      return {
        id: event.id,
        staffId: event.user_id,
        staffName: names.get(event.user_id) || 'Staff',
        role: roles.get(event.user_id) || 'KASIR',
        type: event.event_type,
        timestamp: event.occurred_at,
        location: branch.name,
        branchId: payload.branchId,
        branchName: branch.name,
        latitude: event.latitude,
        longitude: event.longitude,
        accuracyMeters: event.accuracy_meters,
        distanceMeters: event.distance_meters,
        photoPublicId: event.selfie_public_id,
        verificationMethod: event.verification_method,
        gpsValidated: event.distance_meters !== null,
        selfieValidated: Boolean(event.selfie_public_id),
        scheduledStart: schedule?.starts_at?.slice(0, 5),
        minutesLate,
        status: minutesLate > Number(schedule?.grace_minutes || 0) ? 'LATE' : 'ON_TIME',
      };
    });
    return { status: 200, data: { records, scope: canViewBranch ? 'BRANCH' : 'SELF' } };
  }

  if (!payload.requestId || !UUID_PATTERN.test(payload.requestId)) return fail(400, 'Request ID tidak valid');
  if (payload.type !== 'CLOCK_IN' && payload.type !== 'CLOCK_OUT') return fail(400, 'Jenis absensi tidak valid');

  const [{ data: tenantConfig }, { data: branchConfig }] = await Promise.all([
    admin
      .from('tenant_config')
      .select('attendance_config')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle(),
    admin
      .from('branch_operational_config')
      .select('profile_overrides')
      .eq('tenant_id', profile.tenant_id)
      .eq('branch_id', payload.branchId)
      .maybeSingle(),
  ]);
  const config = {
    ...((tenantConfig?.attendance_config || {}) as Record<string, unknown>),
    ...((branchConfig?.profile_overrides || {}) as Record<string, unknown>),
  };
  if (config.isAttendanceEnabled === false) return fail(403, 'Fitur absensi sedang dinonaktifkan');

  const requireGps = config.requireGpsActive === true;
  const requireSelfie = config.requireSelfiePhoto === true;
  if (requireSelfie && !payload.selfiePublicId) return fail(400, 'Bukti selfie wajib diunggah');
  let distance: number | null = null;
  if (requireGps) {
    const outletLat = Number(config.gpsLatitude);
    const outletLon = Number(config.gpsLongitude);
    const radius = Number(config.gpsRadiusMeters || 50);
    if (![payload.latitude, payload.longitude, outletLat, outletLon].every((value) => Number.isFinite(value))) {
      return fail(400, 'Koordinat GPS tidak lengkap');
    }
    distance = distanceMeters(outletLat, outletLon, Number(payload.latitude), Number(payload.longitude));
    if (distance > radius) return fail(403, `Lokasi berada ${Math.round(distance)} m dari outlet`);
  }

  const { data: lastEvent } = await admin
    .from('attendance_events')
    .select('event_type,occurred_at')
    .eq('user_id', userId)
    .eq('branch_id', payload.branchId)
    .in('event_type', ['CLOCK_IN', 'CLOCK_OUT'])
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastEvent?.event_type === payload.type) {
    return fail(409, payload.type === 'CLOCK_IN' ? 'Anda sudah clock-in; lakukan clock-out berikutnya' : 'Anda sudah clock-out; lakukan clock-in berikutnya');
  }

  const weekdayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: branch.timezone || 'Asia/Jakarta' }).format(new Date());
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);
  const { data: schedule } = await admin
    .from('staff_schedules')
    .select('id,starts_at,ends_at,grace_minutes')
    .eq('user_id', userId)
    .eq('branch_id', payload.branchId)
    .eq('weekday', weekday)
    .eq('status', 'ACTIVE')
    .is('effective_date', null)
    .limit(1)
    .maybeSingle();

  const { data: inserted, error: insertError } = await admin.from('attendance_events').insert({
    tenant_id: profile.tenant_id,
    branch_id: payload.branchId,
    user_id: userId,
    schedule_id: schedule?.id || null,
    event_type: payload.type,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    accuracy_meters: payload.accuracyMeters ?? null,
    distance_meters: distance,
    selfie_public_id: payload.selfiePublicId || null,
    verification_method: payload.verificationMethod || 'PIN',
    actor_user_id: userId,
    request_id: payload.requestId,
  }).select('id,occurred_at,event_type,distance_meters').single();
  if (insertError) {
    if (insertError.code === '23505') return fail(409, 'Permintaan absensi ini sudah diproses');
    return fail(500, 'Absensi tidak dapat disimpan');
  }

  return {
    status: 201,
    data: {
      id: inserted.id,
      timestamp: inserted.occurred_at,
      type: inserted.event_type,
      distanceMeters: inserted.distance_meters,
      staffId: userId,
      staffName: profile.display_name,
      role: membership.role,
      branchName: branch.name,
      scheduledStart: schedule?.starts_at?.slice(0, 5),
    },
  };
}
