import {createClient, type Session, type SupabaseClient} from '@supabase/supabase-js';
import {runtimeEnv} from './runtimeEnv';

let singleton: SupabaseClient | null = null;
let realtimeAuthBridgeInitialized = false;

const applyRealtimeSession = async (client: SupabaseClient, session: Session | null) => {
  try {
    // Private Broadcast authorization is evaluated with the JWT attached to
    // the Realtime socket. Keep it explicit so switching branches does not
    // depend on an old/stale socket token.
    await client.realtime.setAuth(session?.access_token ?? null);
  } catch (error) {
    console.warn('[Realtime] auth sync deferred', error);
  }
};

const attachRealtimeAuthBridge = (client: SupabaseClient) => {
  if (realtimeAuthBridgeInitialized) return;
  realtimeAuthBridgeInitialized = true;

  void client.auth.getSession()
    .then(({data}) => applyRealtimeSession(client, data.session))
    .catch(() => undefined);

  client.auth.onAuthStateChange((_event, session) => {
    void applyRealtimeSession(client, session);
  });
};

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

    attachRealtimeAuthBridge(singleton);
  }

  return singleton;
};

export const ensureRealtimeAuth = async (): Promise<void> => {
  if (!singleton) getSupabase();
  if (!singleton) return;
  const {data} = await singleton.auth.getSession();
  await applyRealtimeSession(singleton, data.session);
};

export const isSupabaseConfigured = (): boolean =>
  Boolean(runtimeEnv.supabaseUrl && runtimeEnv.supabasePublishableKey);
