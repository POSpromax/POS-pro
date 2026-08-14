/**
 * Global session guard untuk handling 401/403 errors secara konsisten.
 * Semua service yang call Supabase API harus menggunakan helper ini.
 */

import { getSupabase } from './supabase';

export class SessionExpiredError extends Error {
  constructor(message = 'Sesi telah berakhir. Silakan login kembali.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Akses ditolak. Anda tidak memiliki izin untuk operasi ini.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

let lastRefreshAttempt = 0;
const REFRESH_COOLDOWN_MS = 5000; // Jangan spam refresh jika gagal

/**
 * Get access token dengan auto-refresh jika expired.
 * Throw SessionExpiredError jika refresh gagal.
 */
export async function getAccessToken(): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();

  if (data.session?.access_token) {
    return data.session.access_token;
  }

  // Token expired atau tidak ada. Coba refresh sekali.
  const now = Date.now();
  if (now - lastRefreshAttempt < REFRESH_COOLDOWN_MS) {
    throw new SessionExpiredError('Refresh token sedang dalam proses. Tunggu sebentar.');
  }

  lastRefreshAttempt = now;
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

  if (refreshError || !refreshed.session?.access_token) {
    throw new SessionExpiredError();
  }

  return refreshed.session.access_token;
}

/**
 * Handle HTTP response errors secara konsisten.
 * Throw error yang sesuai berdasarkan status code.
 */
export function handleHttpError(response: Response, defaultMessage: string): never {
  if (response.status === 401) {
    throw new SessionExpiredError();
  }
  if (response.status === 403) {
    throw new UnauthorizedError();
  }
  throw new Error(defaultMessage);
}

/**
 * Wrapper untuk fetch API calls dengan auto session handling.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Token mungkin baru saja expired. Coba refresh dan retry sekali.
    const refreshedToken = await getAccessToken();
    headers.set('Authorization', `Bearer ${refreshedToken}`);
    const retried = await fetch(url, { ...options, headers });
    
    if (!retried.ok && retried.status === 401) {
      throw new SessionExpiredError();
    }
    
    return retried;
  }

  return response;
}

/**
 * Subscribe ke session state changes untuk lock terminal jika session expired.
 */
export function watchSessionExpiry(onExpired: () => void): () => void {
  const supabase = getSupabase();
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
      onExpired();
    }
  });

  return () => subscription.unsubscribe();
}
