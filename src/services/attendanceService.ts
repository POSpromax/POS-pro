import type { AttendanceRecord } from '../types/pos';
import { getSupabase } from '../lib/supabase';

async function getAccessToken() {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi absensi telah berakhir');
  return token;
}

export async function listCloudAttendance(branchId: string, userId?: string): Promise<AttendanceRecord[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({ branchId });
  if (userId) params.set('userId', userId);
  const response = await fetch(`/api/attendance?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Riwayat presensi gagal dimuat');
  return payload.records || [];
}

export async function saveCloudAttendance(record: AttendanceRecord): Promise<AttendanceRecord> {
  const token = await getAccessToken();
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
