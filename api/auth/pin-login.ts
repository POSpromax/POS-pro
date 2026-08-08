import {createClient} from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
  });

interface VerificationRow {
  success: boolean;
  matched_user_id: string | null;
  matched_tenant_id: string | null;
  display_name: string | null;
  matched_role: string | null;
  permissions: Record<string, boolean> | null;
  locked_until: string | null;
  remaining_attempts: number;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405);

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serverKey) return json({error: 'Server autentikasi belum dikonfigurasi'}, 503);

    const body = await request.json().catch(() => ({})) as {
      branchId?: string;
      pin?: string;
      deviceFingerprintHash?: string;
    };
    if (!body.branchId || !UUID_PATTERN.test(body.branchId)) return json({error: 'Outlet tidak valid'}, 400);
    if (!body.pin || !/^\d{6}$/.test(body.pin)) return json({error: 'PIN harus 6 digit'}, 400);
    if (!body.deviceFingerprintHash || !SHA256_PATTERN.test(body.deviceFingerprintHash)) {
      return json({error: 'Identitas perangkat tidak valid'}, 400);
    }

    const admin = createClient(supabaseUrl, serverKey, {
      auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    });
    const {data, error} = await admin.rpc('verify_staff_pin', {
      p_branch_id: body.branchId,
      p_pin: body.pin,
      p_device_hash: body.deviceFingerprintHash.toLowerCase(),
    });
    if (error) return json({error: 'Verifikasi tidak dapat diproses'}, 500);
    const verification = (data?.[0] || null) as VerificationRow | null;
    if (!verification?.success || !verification.matched_user_id) {
      return json({
        error: verification?.locked_until ? 'Terminal dikunci sementara' : 'PIN tidak valid atau tidak memiliki akses',
        lockedUntil: verification?.locked_until || null,
        remainingAttempts: verification?.remaining_attempts ?? 0,
      }, verification?.locked_until ? 423 : 401);
    }

    const {data: userResult, error: userError} = await admin.auth.admin.getUserById(verification.matched_user_id);
    const email = userResult.user?.email;
    if (userError || !email) return json({error: 'Akun Auth staf belum lengkap'}, 409);

    const {data: link, error: linkError} = await admin.auth.admin.generateLink({type: 'magiclink', email});
    const tokenHash = link.properties?.hashed_token;
    if (linkError || !tokenHash) return json({error: 'Sesi staf tidak dapat dibuat'}, 500);

    return json({
      tokenHash,
      verificationType: 'magiclink',
      user: {
        id: verification.matched_user_id,
        tenantId: verification.matched_tenant_id,
        branchId: body.branchId,
        name: verification.display_name,
        role: verification.matched_role,
        permissions: verification.permissions || {},
      },
    });
  },
};
