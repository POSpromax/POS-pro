import {createHash} from 'node:crypto';

const ALLOWED_FOLDERS = new Set(['branding', 'menus', 'avatars', 'attendance']);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
  });

const parseCloudinaryUrl = (value: string) => {
  const parsed = new URL(value);
  if (parsed.protocol !== 'cloudinary:' || !parsed.username || !parsed.password || !parsed.hostname) {
    throw new Error('CLOUDINARY_URL tidak valid');
  }
  return {
    apiKey: decodeURIComponent(parsed.username),
    apiSecret: decodeURIComponent(parsed.password),
    cloudName: parsed.hostname,
  };
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405);

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    if (!supabaseUrl || !supabaseKey || !cloudinaryUrl || !uploadPreset) {
      return json({error: 'Server media belum dikonfigurasi'}, 503);
    }

    let cloudinary: ReturnType<typeof parseCloudinaryUrl>;
    try {
      cloudinary = parseCloudinaryUrl(cloudinaryUrl);
    } catch {
      return json({error: 'Konfigurasi Cloudinary tidak valid'}, 503);
    }

    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({error: 'Unauthorized'}, 401);

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {apikey: supabaseKey, Authorization: authorization},
    });
    if (!userResponse.ok) return json({error: 'Unauthorized'}, 401);
    const user = await userResponse.json() as {id?: string; app_metadata?: {tenant_id?: string}};
    if (!user.id) return json({error: 'Unauthorized'}, 401);

    const payload = await request.json().catch(() => ({})) as {folder?: string};
    const requestedFolder = payload.folder || '';
    if (!ALLOWED_FOLDERS.has(requestedFolder)) return json({error: 'Folder tidak diizinkan'}, 400);

    const tenantId = user.app_metadata?.tenant_id || 'unassigned';
    const folder = `omnipos/${tenantId}/${requestedFolder}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `folder=${folder}&timestamp=${timestamp}&upload_preset=${uploadPreset}${cloudinary.apiSecret}`;
    const signature = createHash('sha1').update(toSign).digest('hex');

    return json({
      timestamp,
      signature,
      apiKey: cloudinary.apiKey,
      cloudName: cloudinary.cloudName,
      folder,
      uploadPreset,
    });
  },
};
