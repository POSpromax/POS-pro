import { getSupabase } from '../lib/supabase';

const TENANT_CONTEXT_CACHE_TTL_MS = 60_000;

type CachedTenantContext = {
  userId: string;
  tenantId: string;
  expiresAt: number;
};

let cachedTenantContext: CachedTenantContext | null = null;
let pendingTenantLookup: { userId: string; promise: Promise<string> } | null = null;

/**
 * Resolves the tenant attached to the authenticated browser session.
 *
 * getSession() reads the Supabase session already held by this terminal. The
 * profile lookup is coalesced and cached briefly because several independent
 * screen services need the same tenant_id during one render. RLS still guards
 * every data query; this helper is never used by server-side mutation auth.
 */
export async function getCloudTenantContext() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Sesi telah berakhir');

  const now = Date.now();
  if (cachedTenantContext?.userId === userId && cachedTenantContext.expiresAt > now) {
    return { supabase, userId, tenantId: cachedTenantContext.tenantId };
  }

  if (!pendingTenantLookup || pendingTenantLookup.userId !== userId) {
    const promise = supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single()
      .then(({ data, error }) => {
        if (error || !data?.tenant_id) throw new Error('Tenant akun tidak ditemukan');
        const tenantId = String(data.tenant_id);
        cachedTenantContext = { userId, tenantId, expiresAt: Date.now() + TENANT_CONTEXT_CACHE_TTL_MS };
        return tenantId;
      });
    pendingTenantLookup = { userId, promise };
    void promise.finally(() => {
      if (pendingTenantLookup?.promise === promise) pendingTenantLookup = null;
    });
  }

  return { supabase, userId, tenantId: await pendingTenantLookup.promise };
}
