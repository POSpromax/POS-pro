import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

export interface PinLoginRequest {
  branchId?: string;
  pin?: string;
  deviceFingerprintHash?: string;
}

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

export interface PinLoginSuccess {
  tokenHash: string;
  verificationType: 'magiclink';
  user: {
    id: string;
    tenantId: string | null;
    branchId: string;
    name: string | null;
    role: string | null;
    permissions: Record<string, boolean>;
  };
}

export interface PinLoginError {
  error: string;
  lockedUntil?: string | null;
  remainingAttempts?: number;
}

export type PinLoginResult =
  | { status: number; data: PinLoginSuccess }
  | { status: number; data: PinLoginError };

const LEGACY_BRANCH_ID_MAP: Record<string, string> = {
  'br-1': '00000000-0000-4000-a000-000000000010',
  'br-2': '00000000-0000-4000-a000-000000000020',
};

export async function handlePinLogin(
  body: PinLoginRequest,
  admin: SupabaseClient,
): Promise<PinLoginResult> {
  const rawBranchId = body.branchId || '';
  const branchId = LEGACY_BRANCH_ID_MAP[rawBranchId] || rawBranchId;

  if (!branchId || !UUID_PATTERN.test(branchId)) {
    return { status: 400, data: { error: 'Outlet tidak valid' } };
  }
  if (!body.pin || !/^\d{6}$/.test(body.pin)) {
    return { status: 400, data: { error: 'PIN harus 6 digit' } };
  }
  if (!body.deviceFingerprintHash || !SHA256_PATTERN.test(body.deviceFingerprintHash)) {
    return { status: 400, data: { error: 'Identitas perangkat tidak valid' } };
  }

  const { data, error } = await admin.rpc('verify_staff_pin', {
    p_branch_id: branchId,
    p_pin: body.pin,
    p_device_hash: body.deviceFingerprintHash.toLowerCase(),
  });

  if (error) {
    console.error('[verify_staff_pin RPC ERROR]:', error);
    return { status: 500, data: { error: 'Verifikasi tidak dapat diproses' } };
  }

  const verification = (data?.[0] || null) as VerificationRow | null;

  if (!verification?.success || !verification.matched_user_id) {
    return {
      status: verification?.locked_until ? 423 : 401,
      data: {
        error: verification?.locked_until
          ? 'Terminal dikunci sementara'
          : 'PIN tidak valid atau tidak memiliki akses',
        lockedUntil: verification?.locked_until || null,
        remainingAttempts: verification?.remaining_attempts ?? 0,
      },
    };
  }

  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(
    verification.matched_user_id,
  );
  const email = userResult?.user?.email;
  if (userError || !email) {
    return { status: 409, data: { error: 'Akun Auth staf belum lengkap' } };
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return { status: 500, data: { error: 'Sesi staf tidak dapat dibuat' } };
  }

  return {
    status: 200,
    data: {
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
    },
  };
}
