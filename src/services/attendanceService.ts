import type { AttendanceRecord } from '../types/pos';
import { getSupabase } from '../lib/supabase';

export class AttendanceSessionError extends Error {
  constructor(message = 'Sesi absensi telah berakhir. Masukkan PIN kembali.') {
    super(message);
    this.name = 'AttendanceSessionError';
  }
}

async function getAccessToken() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;

  // PIN cloud membuat sesi Auth penuh. Jika access token kedaluwarsa tetapi
  // refresh token masih ada, pulihkan satu kali sebelum memaksa login ulang.
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (!error && refreshed.session?.access_token) return refreshed.session.access_token;
  throw new AttendanceSessionError();
}

export async function listCloudAttendance(branchId: string, userId?: string): Promise<AttendanceRecord[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({ branchId });
  if (userId) params.set('userId', userId);
  const response = await fetch(`/api/attendance?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) throw new AttendanceSessionError();
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
  if (response.status === 401) throw new AttendanceSessionError();
  if (!response.ok) throw new Error(payload.error || 'Absensi gagal disimpan');
  return { ...record, ...payload };
}
