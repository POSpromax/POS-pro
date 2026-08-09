import { getDeviceFingerprintHash } from '../lib/deviceFingerprint';

export interface CloudLoginResult {
  success: boolean;
  user?: {
    id: string;
    tenantId: string | null;
    branchId: string;
    name: string | null;
    role: string | null;
    permissions: Record<string, boolean>;
  };
  error?: string;
  lockedUntil?: string | null;
  remainingAttempts?: number;
}

export async function cloudPinLogin(branchId: string, pin: string): Promise<CloudLoginResult> {
  const deviceFingerprintHash = await getDeviceFingerprintHash();

  const res = await fetch('/api/auth/pin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchId, pin, deviceFingerprintHash }),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      error: data.error || 'Login gagal',
      lockedUntil: data.lockedUntil,
      remainingAttempts: data.remainingAttempts,
    };
  }

  const { getSupabase } = await import('../lib/supabase');
  const supabase = getSupabase();
  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: data.tokenHash,
    type: 'magiclink',
  });

  if (otpError) {
    return { success: false, error: 'Sesi tidak dapat dibuat' };
  }

  return { success: true, user: data.user };
}

export async function cloudSignOut(): Promise<void> {
  const { getSupabase } = await import('../lib/supabase');
  const supabase = getSupabase();
  await supabase.auth.signOut();
}
