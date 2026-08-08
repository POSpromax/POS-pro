import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {runtimeEnv} from './runtimeEnv';

let singleton: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!runtimeEnv.supabaseUrl || !runtimeEnv.supabasePublishableKey) {
    throw new Error('Supabase belum dikonfigurasi. Lengkapi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  if (!singleton) {
    singleton = createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
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
