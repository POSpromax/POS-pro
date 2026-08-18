import { getSupabase } from '../lib/supabase';

/**
 * Meminta server mengikuti redirect link pendek Google Maps (maps.app.goo.gl,
 * dll) lalu mengembalikan koordinatnya. Hanya untuk link Google (divalidasi di
 * server). Mengembalikan { lat, lng }.
 */
export async function resolveMapsShortLink(url: string): Promise<{ lat: number; lng: number }> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi telah berakhir. Masuk kembali lalu coba lagi.');
  const response = await fetch('/api/resolve-maps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Gagal mengambil titik dari link.');
  return { lat: Number(payload.lat), lng: Number(payload.lng) };
}
