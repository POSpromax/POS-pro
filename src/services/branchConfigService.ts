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
    .select('branch_id,tenant_id,self_order_enabled,self_order_base_url,public_order_slug,profile_overrides')
    .eq('branch_id', branchId)
    .maybeSingle();

  // Kompatibel sebelum migrasi public_order_slug diterapkan.
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    const legacy = await getSupabase()
      .from('branch_operational_config')
      .select('branch_id,tenant_id,self_order_enabled,self_order_base_url,profile_overrides')
      .eq('branch_id', branchId)
      .maybeSingle();
    data = legacy.data as typeof data;
    error = legacy.error;
  }

  // Backwards-compatible while the migration is being deployed.
  if (error?.code === '42P01' || error?.code === 'PGRST205') return fallback;
  if (error) throw new Error(error.message);
  if (!data) return fallback;

  return {
    branchId: data.branch_id,
    tenantId: data.tenant_id,
    selfOrderEnabled: data.self_order_enabled !== false,
    selfOrderBaseUrl: data.self_order_base_url || fallback.selfOrderBaseUrl,
    publicOrderSlug: (data as any).public_order_slug || undefined,
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

  const payload = {
    branch_id: config.branchId,
    tenant_id: profile.tenant_id,
    self_order_enabled: config.selfOrderEnabled,
    self_order_base_url: config.selfOrderBaseUrl.trim() || null,
    profile_overrides: config.profileOverrides || {},
  };
  const { data, error } = await supabase
    .from('branch_operational_config')
    .upsert(payload, { onConflict: 'branch_id' })
    .select('branch_id,tenant_id,self_order_enabled,self_order_base_url,profile_overrides')
    .single();
  if (error) throw new Error(error.message);

  return {
    branchId: data.branch_id,
    tenantId: data.tenant_id,
    selfOrderEnabled: data.self_order_enabled !== false,
    selfOrderBaseUrl: data.self_order_base_url || defaultBaseUrl(),
    publicOrderSlug: config.publicOrderSlug,
    profileOverrides: (data.profile_overrides || {}) as BranchOperationalConfig['profileOverrides'],
  };
}
