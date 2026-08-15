import { getDeviceFingerprintHash } from '../lib/deviceFingerprint';
import { getSupabase } from '../lib/supabase';

export interface CloudLoginResult {
  success: boolean;
  user?: {
    id: string;
    tenantId: string | null;
    branchId: string;
    name: string | null;
    role: string | null;
    permissions: Record<string, boolean>;
    branchIds?: string[];
  };
  error?: string;
  lockedUntil?: string | null;
  remainingAttempts?: number;
}

export async function cloudPinLogin(branchId: string, pin: string, signal?: AbortSignal): Promise<CloudLoginResult> {
  const deviceFingerprintHash = await getDeviceFingerprintHash();
  if (signal?.aborted) throw new DOMException('Login dibatalkan', 'AbortError');

  const res = await fetch('/api/auth/pin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchId, pin, deviceFingerprintHash }),
    signal,
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

  if (signal?.aborted) throw new DOMException('Login dibatalkan', 'AbortError');

  const supabase = getSupabase();
  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: data.tokenHash,
    type: 'magiclink',
  });

  if (otpError) {
    return { success: false, error: 'Sesi tidak dapat dibuat' };
  }

  // Private Realtime Broadcast memakai JWT pada socket. Sinkronkan token
  // segera setelah PIN login agar outlet kedua/ketiga tidak menunggu reload
  // browser sebelum channel privat mendapat otorisasi yang benar.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.access_token) {
    await supabase.realtime.setAuth(sessionData.session.access_token);
  }

  return { success: true, user: data.user };
}

export async function cloudSignOut(): Promise<void> {
  const supabase = getSupabase();
  // Hanya sesi tab/terminal ini. Scope global mencabut refresh token seluruh
  // perangkat milik staf yang sama dan menjadi akar logout mendadak.
  await supabase.auth.signOut({ scope: 'local' });
}
