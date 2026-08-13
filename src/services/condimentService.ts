import type { CondimentGroup } from '../types/pos';
import { getSupabase } from '../lib/supabase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function tenantContext() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesi telah berakhir');
  const { data, error } = await supabase.from('user_profiles').select('tenant_id').eq('user_id', user.id).single();
  if (error || !data?.tenant_id) throw new Error('Tenant akun tidak ditemukan');
  return { supabase, tenantId: data.tenant_id as string };
}

type ScopeConfig = Record<string, { targetProductIds?: string[]; targetProductNames?: string[] }>;

export async function listCloudCondiments(branchId: string): Promise<CondimentGroup[]> {
  const { supabase, tenantId } = await tenantContext();
  const [{ data: groups, error: groupError }, { data: branchConfig }, { data: config }] = await Promise.all([
    supabase.from('condiment_groups').select('*,condiment_options(*)').eq('branch_id', branchId).order('sort_order'),
    supabase.from('branch_operational_config').select('condiment_scopes').eq('branch_id', branchId).maybeSingle(),
    supabase.from('tenant_config').select('kds_config').eq('tenant_id', tenantId).maybeSingle(),
  ]);
  if (groupError) throw new Error(groupError.message);
  const scopes = (branchConfig?.condiment_scopes as ScopeConfig | null)
    || ((config?.kds_config as { condimentScopes?: ScopeConfig } | null)?.condimentScopes || {});
  return (groups || []).map((group) => ({
    id: group.id,
    name: group.name,
    mode: group.mode,
    required: group.required,
    isRequired: group.required,
    minSelect: group.min_select,
    maxSelect: group.max_select,
    targetCategories: group.target_categories || [],
    targetProductIds: scopes[group.id]?.targetProductIds || [],
    targetProductNames: scopes[group.id]?.targetProductNames || [],
    isActive: group.is_active,
    options: (group.condiment_options || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((option: any) => ({ id: option.id, name: option.name, price: Number(option.price), isAvailable: option.is_available })),
  }));
}

export async function saveCloudCondimentGroup(group: CondimentGroup, branchId: string): Promise<void> {
  const { supabase, tenantId } = await tenantContext();
  const groupPayload = {
    tenant_id: tenantId,
    branch_id: branchId,
    name: group.name.trim(),
    mode: group.mode,
    required: group.isRequired ?? group.required ?? false,
    min_select: group.minSelect ?? 0,
    max_select: Math.max(1, group.maxSelect ?? (group.mode === 'PAKET' ? 1 : group.options.length || 1)),
    target_categories: group.targetCategories?.length ? group.targetCategories : group.targetCategory ? [group.targetCategory] : [],
    is_active: group.isActive,
  };
  let groupId = group.id;
  if (UUID_PATTERN.test(group.id)) {
    const { error } = await supabase.from('condiment_groups').update(groupPayload).eq('id', group.id).eq('branch_id', branchId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from('condiment_groups').insert(groupPayload).select('id').single();
    if (error || !data) throw new Error(error?.message || 'Grup condiment gagal dibuat');
    groupId = data.id;
  }
  const { error: deleteError } = await supabase.from('condiment_options').delete().eq('group_id', groupId);
  if (deleteError) throw new Error(deleteError.message);
  if (group.options.length) {
    const { error } = await supabase.from('condiment_options').insert(group.options.map((option, index) => ({ group_id: groupId, name: option.name, price: option.price, is_available: option.isAvailable, sort_order: index })));
    if (error) throw new Error(error.message);
  }
  const { data: config } = await supabase.from('branch_operational_config').select('condiment_scopes').eq('branch_id', branchId).maybeSingle();
  const scopes = { ...((config?.condiment_scopes || {}) as ScopeConfig), [groupId]: { targetProductIds: group.targetProductIds || [], targetProductNames: group.targetProductNames || [] } };
  const { error: configError } = await supabase.from('branch_operational_config').upsert({ branch_id: branchId, tenant_id: tenantId, condiment_scopes: scopes }, { onConflict: 'branch_id' });
  if (configError) throw new Error(configError.message);
}
