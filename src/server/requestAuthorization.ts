import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server routes previously verified the same bearer token, profile, and branch
 * membership for every read request. That is correct but expensive: a single
 * order refresh produced three additional Supabase API calls before the actual
 * read. Keep the authorization boundary on the server, while sharing a very
 * short-lived verified result between read requests from the same terminal.
 *
 * Mutations always pass `cacheTtlMs: 0`, so their authorization is read fresh.
 * The cache stores a SHA-256 fingerprint only — never a bearer token.
 */
export const READ_AUTHORIZATION_CACHE_TTL_MS = 60_000;

export interface BranchActor {
  userId: string;
  tenantId: string;
  displayName: string;
  role: string;
}

export interface TenantActor {
  userId: string;
  tenantId: string;
  displayName: string;
  memberships: Array<{ branch_id: string; role: string; is_active: boolean }>;
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const MAX_CACHE_ENTRIES = 1_024;
const verifiedSessionCache = new Map<string, CacheEntry<{ userId: string }>>();
const tenantActorCache = new Map<string, CacheEntry<TenantActor>>();
const verifiedSessionInFlight = new Map<string, Promise<{ userId: string } | null>>();
const tenantActorInFlight = new Map<string, Promise<TenantActor | null>>();

const fingerprint = (accessToken: string) => createHash('sha256').update(accessToken).digest('hex');

const readCache = <T>(cache: Map<string, CacheEntry<T>>, key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt > Date.now()) return entry.value;
  cache.delete(key);
  return null;
};

const writeCache = <T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) => {
  if (ttlMs <= 0) return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [candidate, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(candidate);
    }
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

async function resolveVerifiedUserId(
  admin: SupabaseClient,
  accessToken: string,
  cacheTtlMs: number,
): Promise<{ userId: string; tokenKey: string } | null> {
  if (!accessToken) return null;
  const tokenKey = fingerprint(accessToken);
  if (cacheTtlMs > 0) {
    const cached = readCache(verifiedSessionCache, tokenKey);
    if (cached) return { ...cached, tokenKey };
    const pending = verifiedSessionInFlight.get(tokenKey);
    if (pending) {
      const value = await pending;
      return value ? { ...value, tokenKey } : null;
    }
  }

  const request = async () => {
    const { data, error } = await admin.auth.getUser(accessToken);
    if (error || !data.user) return null;
    const value = { userId: data.user.id };
    writeCache(verifiedSessionCache, tokenKey, value, cacheTtlMs);
    return value;
  };
  const pending = request();
  if (cacheTtlMs > 0) {
    verifiedSessionInFlight.set(tokenKey, pending);
  }
  const value = await (cacheTtlMs > 0
    ? pending.finally(() => {
      if (verifiedSessionInFlight.get(tokenKey) === pending) verifiedSessionInFlight.delete(tokenKey);
    })
    : pending);
  if (!value) return null;
  return { ...value, tokenKey };
}

export async function resolveBranchActor(
  admin: SupabaseClient,
  accessToken: string,
  branchId: string,
  cacheTtlMs = READ_AUTHORIZATION_CACHE_TTL_MS,
): Promise<BranchActor | null> {
  const tenantActor = await resolveTenantActor(admin, accessToken, cacheTtlMs);
  if (!tenantActor) return null;
  const membership = tenantActor.memberships.find((item) => item.branch_id === branchId && item.is_active);
  if (!membership) return null;
  return {
    userId: tenantActor.userId,
    tenantId: tenantActor.tenantId,
    displayName: tenantActor.displayName,
    role: membership.role || 'KASIR',
  };
}

export async function resolveTenantActor(
  admin: SupabaseClient,
  accessToken: string,
  cacheTtlMs = READ_AUTHORIZATION_CACHE_TTL_MS,
): Promise<TenantActor | null> {
  const session = await resolveVerifiedUserId(admin, accessToken, cacheTtlMs);
  if (!session) return null;

  if (cacheTtlMs > 0) {
    const cached = readCache(tenantActorCache, session.tokenKey);
    if (cached) return cached;
    const pending = tenantActorInFlight.get(session.tokenKey);
    if (pending) return pending;
  }

  const request = async () => {
    const [profileResult, membershipsResult] = await Promise.all([
      admin.from('user_profiles').select('tenant_id,display_name,is_active').eq('user_id', session.userId).maybeSingle(),
      admin.from('branch_members').select('branch_id,role,is_active').eq('user_id', session.userId).eq('is_active', true),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (membershipsResult.error) throw membershipsResult.error;
    if (!profileResult.data?.is_active || !profileResult.data.tenant_id) return null;

    const actor: TenantActor = {
      userId: session.userId,
      tenantId: profileResult.data.tenant_id,
      displayName: profileResult.data.display_name || 'Staff',
      memberships: (membershipsResult.data || []) as TenantActor['memberships'],
    };
    writeCache(tenantActorCache, session.tokenKey, actor, cacheTtlMs);
    return actor;
  };
  const pending = request();
  if (cacheTtlMs > 0) {
    tenantActorInFlight.set(session.tokenKey, pending);
    return pending.finally(() => {
      if (tenantActorInFlight.get(session.tokenKey) === pending) tenantActorInFlight.delete(session.tokenKey);
    });
  }
  return pending;
}

/** Remove locally cached permissions after a staff or membership mutation. */
export function invalidateAuthorizationForUser(userId: string) {
  for (const [key, entry] of tenantActorCache) {
    if (entry.value.userId === userId) tenantActorCache.delete(key);
  }
}
