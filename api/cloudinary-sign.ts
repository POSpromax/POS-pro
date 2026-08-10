export const config = { runtime: 'edge' };

const ALLOWED_FOLDERS = new Set(['branding', 'menus', 'avatars', 'attendance', 'leave']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGEMENT_ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

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
    headers: {
      apikey: apiKey,
      Authorization: authorization,
      Accept: 'application/json',
    },
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

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = getSupabaseConfig();
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'pos-pro';
  if (!supabase.url || !supabase.publishableKey) {
    return json({ error: 'Server media belum dikonfigurasi' }, 503);
  }

  let cloudinary: ReturnType<typeof parseCloudinaryUrl>;
  try {
    cloudinary = getCloudinaryConfig();
  } catch {
    return json({ error: 'Konfigurasi Cloudinary tidak valid' }, 503);
  }

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userResponse = await fetch(`${supabase.url}/auth/v1/user`, {
    headers: { apikey: supabase.publishableKey, Authorization: authorization },
  });
  if (!userResponse.ok) return json({ error: 'Unauthorized' }, 401);
  const user = (await userResponse.json()) as { id?: string; app_metadata?: { tenant_id?: string } };
  if (!user.id) return json({ error: 'Unauthorized' }, 401);

  const payload = (await request.json().catch(() => ({}))) as { folder?: string; branchId?: string };
  const requestedFolder = payload.folder || '';
  if (!ALLOWED_FOLDERS.has(requestedFolder)) return json({ error: 'Folder tidak diizinkan' }, 400);
  if (!payload.branchId || !UUID_PATTERN.test(payload.branchId)) return json({ error: 'Outlet tidak valid' }, 400);

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
  if (!profile?.is_active || !membership?.is_active) return json({ error: 'Akses outlet ditolak' }, 403);
  if ((requestedFolder === 'branding' || requestedFolder === 'menus') && !MANAGEMENT_ROLES.has(membership.role)) {
    return json({ error: 'Role tidak diizinkan mengunggah media ini' }, 403);
  }

  const tenantId = profile.tenant_id;
  const folder = `omnipos/${tenantId}/${payload.branchId}/${requestedFolder}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const overwrite = 'false';
  const uniqueFilename = 'true';
  const toSign = `folder=${folder}&overwrite=${overwrite}&timestamp=${timestamp}&unique_filename=${uniqueFilename}&upload_preset=${uploadPreset}${cloudinary.apiSecret}`;
  const signature = await sha1Hex(toSign);

  return json({
    timestamp,
    signature,
    apiKey: cloudinary.apiKey,
    cloudName: cloudinary.cloudName,
    folder,
    uploadPreset,
    overwrite,
    uniqueFilename,
  });
}
