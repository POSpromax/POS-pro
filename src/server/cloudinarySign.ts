const ALLOWED_FOLDERS = new Set(['branding', 'menus', 'avatars', 'attendance', 'leave']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGEMENT_ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']);

export interface CloudinarySignResult {
  status: number;
  data: unknown;
}

const fail = (status: number, error: string): CloudinarySignResult => ({ status, data: { error } });

function parseCloudinaryUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'cloudinary:' || !parsed.username || !parsed.password || !parsed.hostname) {
    throw new Error('CLOUDINARY_URL tidak valid');
  }
  return {
    apiKey: decodeURIComponent(parsed.username),
    apiSecret: decodeURIComponent(parsed.password),
    cloudName: parsed.hostname,
  };
}

function getCloudinaryConfig() {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (cloudinaryUrl) return parseCloudinaryUrl(cloudinaryUrl);

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!apiKey || !apiSecret || !cloudName) throw new Error('Cloudinary belum lengkap');
  return { apiKey, apiSecret, cloudName };
}

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    publishableKey:
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '',
  };
}

async function readSingle<T>(url: string, apiKey: string, authorization: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: { apikey: apiKey, Authorization: authorization, Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as T[];
  return rows[0] || null;
}

async function sha1Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-1', encoded);
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Menandatangani unggahan Cloudinary setelah memastikan penggunanya memang
 * anggota aktif outlet tersebut. Dipakai bersama oleh Express (localhost) dan
 * Vercel Edge, supaya unggah foto berperilaku sama di kedua tempat.
 */
export async function handleCloudinarySign(
  method: string,
  authorization: string,
  payload: { folder?: string; branchId?: string },
): Promise<CloudinarySignResult> {
  if (method !== 'POST') return fail(405, 'Method not allowed');

  const supabase = getSupabaseConfig();
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'pos-pro';
  if (!supabase.url || !supabase.publishableKey) return fail(503, 'Server media belum dikonfigurasi');

  let cloudinary: { apiKey: string; apiSecret: string; cloudName: string };
  try {
    cloudinary = getCloudinaryConfig();
  } catch {
    return fail(503, 'Konfigurasi Cloudinary tidak valid');
  }

  if (!authorization.startsWith('Bearer ')) return fail(401, 'Unauthorized');

  const userResponse = await fetch(`${supabase.url}/auth/v1/user`, {
    headers: { apikey: supabase.publishableKey, Authorization: authorization },
  });
  if (!userResponse.ok) return fail(401, 'Unauthorized');
  const user = (await userResponse.json()) as { id?: string };
  if (!user.id) return fail(401, 'Unauthorized');

  const requestedFolder = payload.folder || '';
  if (!ALLOWED_FOLDERS.has(requestedFolder)) return fail(400, 'Folder tidak diizinkan');
  if (!payload.branchId || !UUID_PATTERN.test(payload.branchId)) return fail(400, 'Outlet tidak valid');

  const profile = await readSingle<{ tenant_id: string; is_active: boolean }>(
    `${supabase.url}/rest/v1/user_profiles?select=tenant_id,is_active&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    supabase.publishableKey,
    authorization,
  );
  const membership = await readSingle<{ role: string; is_active: boolean }>(
    `${supabase.url}/rest/v1/branch_members?select=role,is_active&branch_id=eq.${encodeURIComponent(payload.branchId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    supabase.publishableKey,
    authorization,
  );
  if (!profile?.is_active || !membership?.is_active) return fail(403, 'Akses outlet ditolak');
  if ((requestedFolder === 'branding' || requestedFolder === 'menus') && !MANAGEMENT_ROLES.has(membership.role)) {
    return fail(403, 'Role tidak diizinkan mengunggah media ini');
  }

  const folder = `omnipos/${profile.tenant_id}/${payload.branchId}/${requestedFolder}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const overwrite = 'false';
  const uniqueFilename = 'true';
  const toSign = `folder=${folder}&overwrite=${overwrite}&timestamp=${timestamp}&unique_filename=${uniqueFilename}&upload_preset=${uploadPreset}${cloudinary.apiSecret}`;
  const signature = await sha1Hex(toSign);

  return {
    status: 200,
    data: {
      timestamp,
      signature,
      apiKey: cloudinary.apiKey,
      cloudName: cloudinary.cloudName,
      folder,
      uploadPreset,
      overwrite,
      uniqueFilename,
    },
  };
}
