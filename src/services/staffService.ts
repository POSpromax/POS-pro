import type { UserAccount } from '../types/pos';
import { getSupabase } from '../lib/supabase';

async function authorizedRequest(method: string, body?: unknown) {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sesi login telah berakhir');
  const response = await fetch('/api/staff', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Operasi staff gagal');
  return payload;
}

export async function listCloudStaff(): Promise<UserAccount[]> {
  const payload = await authorizedRequest('GET');
  return (payload.staff || []).map((staff: UserAccount & { permissions?: Record<string, boolean> }) => ({
    ...staff,
    pin: '',
  }));
}

export async function createCloudStaff(staff: UserAccount): Promise<string> {
  const payload = await authorizedRequest('POST', staff);
  return payload.id;
}

export async function updateCloudStaff(staff: UserAccount): Promise<void> {
  await authorizedRequest('PATCH', staff);
}

/**
 * Memperbarui HANYA matriks izin staf. Dipakai saat menyimpan Hak Akses agar
 * tidak mengirim seluruh data staf (yang membuat server menulis ulang profil,
 * meng-hash ulang PIN, dan membangun ulang jadwal untuk tiap staf).
 */
export async function updateCloudStaffPermissions(
  userId: string,
  permissions: Record<string, boolean>,
): Promise<void> {
  await authorizedRequest('PATCH', { id: userId, permissions, permissionsOnly: true });
}

export async function deactivateCloudStaff(id: string): Promise<void> {
  await authorizedRequest('DELETE', { id });
}
