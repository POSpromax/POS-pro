import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {runtimeEnv} from './runtimeEnv';

let singleton: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!runtimeEnv.supabaseUrl || !runtimeEnv.supabasePublishableKey) {
    throw new Error('Supabase belum dikonfigurasi. Lengkapi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  if (!singleton) {
    // Sesi POS adalah sesi terminal/tab, bukan sesi browser global. Memakai
    // localStorage membuat logout terminal absensi ikut mencabut POS pada tab
    // lain dan menyisakan terminal "unlocked" tanpa access token (401/403).
    const authStorage = typeof window !== 'undefined' ? window.sessionStorage : undefined;
    singleton = createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: authStorage,
        storageKey: 'omnipos_supabase_auth_v2',
        // Perpanjang durasi session dan refresh lebih awal untuk mencegah logout mendadak.
        // Token default Supabase expire 1 jam; refresh 5 menit sebelum expire.
        // Dengan setting ini, session efektif bisa bertahan beberapa jam selama tab aktif.
        flowType: 'pkce',
        debug: false,
      },
      realtime: {
        params: {eventsPerSecond: 10},
      },
      global: {
        headers: {'x-client-info': 'omnipos-web'},
      },
    });
  }

  return singleton;
};

export const isSupabaseConfigured = (): boolean =>
  Boolean(runtimeEnv.supabaseUrl && runtimeEnv.supabasePublishableKey);
