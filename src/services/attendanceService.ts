import type { AttendanceRecord } from '../types/pos';

export async function saveCloudAttendance(record: AttendanceRecord): Promise<AttendanceRecord> {
  const { getSupabase } = await import('../lib/supabase');
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi absensi telah berakhir');
  const response = await fetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      branchId: record.branchId,
      type: record.type,
      latitude: record.latitude,
      longitude: record.longitude,
      accuracyMeters: record.accuracyMeters,
      selfiePublicId: record.photoPublicId,
      verificationMethod: record.verificationMethod,
      requestId: record.requestId,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Absensi gagal disimpan');
  return { ...record, ...payload };
}
