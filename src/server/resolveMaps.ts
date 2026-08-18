import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolveMapsResult { status: number; data: unknown }
const fail = (status: number, error: string): ResolveMapsResult => ({ status, data: { error } });

// Hanya host resmi Google (pencegahan SSRF). Link pendek Google selalu mengalih
// ke properti Google, jadi cukup daftar ini.
const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl', 'goo.gl', 'g.co', 'www.google.com', 'google.com',
  'maps.google.com', 'maps.google.co.id',
]);

const COORD_PATTERNS = [
  /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,                 // pin pada URL place
  /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,                     // pusat peta /@lat,lng
  /[?&](?:q|ll|query|destination|sll)=(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/i,
];

/**
 * Mengikuti redirect link pendek Google Maps lalu mengambil koordinat dari URL
 * final / isi halaman. Butuh sesi login yang valid; hanya menerima host Google.
 */
export async function handleResolveMaps(
  method: string,
  accessToken: string,
  payload: { url?: string },
  admin: SupabaseClient,
): Promise<ResolveMapsResult> {
  if (method !== 'POST') return fail(405, 'Method not allowed');
  if (!accessToken) return fail(401, 'Sesi telah berakhir');
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) return fail(401, 'Sesi telah berakhir');

  const raw = String(payload.url || '').trim();
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return fail(400, 'URL tidak valid'); }
  if (parsed.protocol !== 'https:') return fail(400, 'Hanya URL https yang didukung');
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return fail(400, 'Hanya link Google Maps yang didukung');

  let finalUrl = raw;
  let body = '';
  try {
    const response = await fetch(raw, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PosPro/1.0)', 'Accept-Language': 'id,en' },
    });
    finalUrl = response.url || raw;
    body = (await response.text().catch(() => '')).slice(0, 200_000);
  } catch {
    return fail(502, 'Tidak dapat membuka link Google Maps');
  }

  const haystack = `${finalUrl}\n${body}`;
  for (const re of COORD_PATTERNS) {
    const match = haystack.match(re);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180) {
        return { status: 200, data: { lat, lng, resolvedUrl: finalUrl } };
      }
    }
  }
  return fail(404, 'Koordinat tidak ditemukan pada link. Coba salin koordinat manual dari Google Maps.');
}
