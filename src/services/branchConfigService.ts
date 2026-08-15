import type { BranchOperationalConfig } from '../types/pos';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

const defaultBaseUrl = () => typeof window === 'undefined' ? '' : window.location.origin;

export function defaultBranchOperationalConfig(branchId: string): BranchOperationalConfig {
  return {
    branchId,
    selfOrderEnabled: true,
    selfOrderBaseUrl: defaultBaseUrl(),
  };
}

export async function getCloudBranchOperationalConfig(branchId: string): Promise<BranchOperationalConfig> {
  const fallback = defaultBranchOperationalConfig(branchId);
  if (!isSupabaseConfigured()) return fallback;

  let { data, error } = await getSupabase()
    .from('branch_operational_config')
    .select('branch_id,tenant_id,self_order_enabled,self_order_base_url,profile_overrides')
    .eq('branch_id', branchId)
    .maybeSingle();

  // Backwards-compatible while the migration is being deployed.
  if (error?.code === '42P01' || error?.code === 'PGRST205') return fallback;
  if (error) throw new Error(error.message);
  if (!data) return fallback;

  return {
    branchId: data.branch_id,
    tenantId: data.tenant_id,
    selfOrderEnabled: true,
    selfOrderBaseUrl: data.self_order_base_url || fallback.selfOrderBaseUrl,
    // URL QR tetap diturunkan dari kode cabang. Public catalog di server
    // memvalidasi slug dari database, tetapi UI tidak perlu meminta kolom baru
    // ini sehingga instalasi yang sedang migrasi tidak menghasilkan HTTP 400.
    publicOrderSlug: undefined,
    profileOverrides: (data.profile_overrides || {}) as BranchOperationalConfig['profileOverrides'],
  };
}

export async function saveCloudBranchOperationalConfig(
  config: BranchOperationalConfig,
): Promise<BranchOperationalConfig> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesi telah berakhir');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();
  if (profileError || !profile?.tenant_id) throw new Error('Tenant akun tidak ditemukan');

  const { isSelfOrderEnabled: _legacyGlobalSelfOrder, ...profileOverrides } = (config.profileOverrides || {}) as Record<string, unknown>;
  const payload = {
    // Legacy schema column is pinned ON. Operational access is controlled only
    // by restaurant_tables.self_order_enabled.
    self_order_enabled: true,
    self_order_base_url: config.selfOrderBaseUrl.trim() || null,
    profile_overrides: profileOverrides,
  };
  const { data, error } = await supabase
    .from('branch_operational_config')
    .update(payload)
    .eq('branch_id', config.branchId)
    .eq('tenant_id', profile.tenant_id)
    .select('branch_id,tenant_id,self_order_enabled,self_order_base_url,profile_overrides')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Konfigurasi cabang tidak ditemukan atau akun tidak memiliki akses untuk mengubahnya');

  return {
    branchId: data.branch_id,
    tenantId: data.tenant_id,
    selfOrderEnabled: true,
    selfOrderBaseUrl: data.self_order_base_url || defaultBaseUrl(),
    publicOrderSlug: config.publicOrderSlug,
    profileOverrides: (data.profile_overrides || {}) as BranchOperationalConfig['profileOverrides'],
  };
}
