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

// Menit-dalam-hari (0..1439) pada zona waktu outlet. Dipakai agar perhitungan
// telat di tampilan report SAMA dengan finalisasi payroll (keduanya sadar-timezone),
// bukan bergantung timezone runtime server.
const localMinuteOfDay = (iso: string, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return Number(map.hour) * 60 + Number(map.minute);
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

    const timeZone = branch.timezone || 'Asia/Jakarta';
    const userIds = [...new Set((events || []).map((event) => event.user_id))];
    const [{ data: profiles }, { data: memberships }, { data: schedules }, { data: hrConfig }] = await Promise.all([
      userIds.length ? admin.from('user_profiles').select('user_id,display_name').in('user_id', userIds) : Promise.resolve({ data: [] }),
      userIds.length ? admin.from('branch_members').select('user_id,role').eq('branch_id', payload.branchId).in('user_id', userIds) : Promise.resolve({ data: [] }),
      admin.from('staff_schedules').select('id,starts_at,grace_minutes,spans_midnight').eq('branch_id', payload.branchId),
      admin.from('branch_hr_config').select('late_penalty_grace_minutes').eq('branch_id', payload.branchId).maybeSingle(),
    ]);
    const names = new Map((profiles || []).map((item) => [item.user_id, item.display_name]));
    const roles = new Map((memberships || []).map((item) => [item.user_id, item.role]));
    const scheduleMap = new Map((schedules || []).map((item) => [item.id, item]));
    // Toleransi telat = maksimum dari kebijakan HR outlet & toleransi jadwal.
    // IDENTIK dengan yang dipakai finalisasi payroll -> angka telat konsisten.
    const policyGrace = Number((hrConfig as any)?.late_penalty_grace_minutes || 0);
    const records = (events || []).map((event) => {
      const schedule = event.schedule_id ? scheduleMap.get(event.schedule_id) : undefined;
      let minutesLate = 0;
      if (event.event_type === 'CLOCK_IN' && schedule?.starts_at) {
        const eventMinutes = localMinuteOfDay(event.occurred_at, timeZone);
        const [hours, minutes] = String(schedule.starts_at).split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        let delta = eventMinutes - startMinutes;
        if (schedule.spans_midnight && delta < -720) delta += 1440;
        const grace = Math.max(policyGrace, Number(schedule.grace_minutes || 0));
        minutesLate = Math.max(0, delta - grace);
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
        status: minutesLate > 0 ? 'LATE' : 'ON_TIME',
      };
    }).filter((record) => record.role !== 'OWNER' && record.role !== 'SUPER_OWNER');
    return { status: 200, data: { records, scope: canViewBranch ? 'BRANCH' : 'SELF' } };
  }

  if (membership.role === 'OWNER' || membership.role === 'SUPER_OWNER') {
    return fail(403, 'Akun Owner mengelola operasional dan tidak menggunakan absensi staff.');
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
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    const radius = Math.max(5, Number(config.gpsRadiusMeters || 50));
    const maxAccuracy = Math.max(5, Number(config.maxGpsAccuracyMeters || 80));
    if (
      ![latitude, longitude, outletLat, outletLon, radius, maxAccuracy].every((value) => Number.isFinite(value))
      || Math.abs(latitude) > 90
      || Math.abs(outletLat) > 90
      || Math.abs(longitude) > 180
      || Math.abs(outletLon) > 180
    ) {
      return fail(400, 'Koordinat GPS tidak lengkap');
    }
    // Akurasi buruk bukan alasan menolak. Lihat catatan di AttendanceView:
    // menolaknya mengunci staf dapur dari absensi. Akurasi hanya dipakai sebagai
    // kelonggaran jarak yang dibatasi maxAccuracy di bawah.
    if (!Number.isFinite(payload.accuracyMeters)) {
      return fail(400, 'Akurasi GPS tidak terbaca. Aktifkan lokasi presisi lalu coba lagi.');
    }
    distance = distanceMeters(outletLat, outletLon, latitude, longitude);
    // Perhitungkan MARGIN ERROR GPS. Sistem menerima pembacaan yang meleset
    // sampai maxAccuracy (mis. 80 m), jadi tidak masuk akal menuntut jarak
    // presisi radius kecil (mis. 20 m): HP yang benar-benar di dalam outlet
    // akan selalu ditolak. Beri kelonggaran sebesar akurasi yang dilaporkan.
    // Kelonggaran DIBATASI maxAccuracy supaya pembacaan sangat buruk tidak bisa
    // dipakai memalsukan kehadiran: akurasi +/-2 km tetap hanya memotong 80 m.
    const accuracy = Math.max(0, Number(payload.accuracyMeters) || 0);
    const slack = Math.min(accuracy, maxAccuracy);
    const effectiveDistance = Math.max(0, distance - slack);
    if (effectiveDistance > radius) {
      return fail(403, `Lokasi berada ${Math.round(distance)} m dari outlet (akurasi ±${Math.round(accuracy)} m, batas ${Math.round(radius)} m). Dekatkan ke area outlet lalu coba lagi.`);
    }
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
