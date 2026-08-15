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

type SelfOrderRole = NonNullable<CondimentGroup['selfOrderRole']>;

type ScopeConfigItem = {
  targetProductIds?: string[];
  targetProductNames?: string[];
  allSelectedLabel?: string;
  selfOrderRole?: SelfOrderRole;
  selfOrderDefaultOptions?: string[];
  selfOrderBaksoOnlyOptions?: string[];
  selfOrderCampurOptions?: string[];
};

type ScopeConfig = Record<string, ScopeConfigItem>;

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function normalizeRole(value: unknown): SelfOrderRole | undefined {
  return value === 'BROTH' || value === 'FILLING' || value === 'NONE' ? value : undefined;
}

function scopeToGroup(scope: ScopeConfigItem | undefined): Partial<CondimentGroup> {
  return {
    targetProductIds: normalizeStringArray(scope?.targetProductIds),
    targetProductNames: normalizeStringArray(scope?.targetProductNames),
    allSelectedLabel: String(scope?.allSelectedLabel || '').trim().toUpperCase() || undefined,
    selfOrderRole: normalizeRole(scope?.selfOrderRole),
    selfOrderDefaultOptions: normalizeStringArray(scope?.selfOrderDefaultOptions),
    selfOrderBaksoOnlyOptions: normalizeStringArray(scope?.selfOrderBaksoOnlyOptions),
    selfOrderCampurOptions: normalizeStringArray(scope?.selfOrderCampurOptions),
  };
}

export async function listCloudCondiments(branchId: string): Promise<CondimentGroup[]> {
  const { supabase, tenantId } = await tenantContext();
  const [{ data: groups, error: groupError }, { data: branchConfig }, { data: config }] = await Promise.all([
    supabase.from('condiment_groups').select('*,condiment_options(*)').eq('branch_id', branchId).order('sort_order'),
    supabase.from('branch_operational_config').select('condiment_scopes').eq('branch_id', branchId).maybeSingle(),
    supabase.from('tenant_config').select('kds_config').eq('tenant_id', tenantId).maybeSingle(),
  ]);
  if (groupError) throw new Error(groupError.message);

  const scopes = (branchConfig?.condiment_scopes as ScopeConfig | null)
    || (((config?.kds_config as { condimentScopes?: ScopeConfig } | null)?.condimentScopes) || {});

  return (groups || []).map((group) => ({
    id: group.id,
    name: group.name,
    mode: group.mode,
    required: group.required,
    isRequired: group.required,
    minSelect: group.min_select,
    maxSelect: group.max_select,
    targetCategories: group.target_categories || [],
    ...scopeToGroup(scopes[group.id]),
    isActive: group.is_active,
    options: (group.condiment_options || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((option: any) => ({
        id: option.id,
        name: option.name,
        price: Number(option.price),
        isAvailable: option.is_available,
      })),
  }));
}

export async function saveCloudCondimentGroup(group: CondimentGroup, branchId: string): Promise<void> {
  const { supabase, tenantId } = await tenantContext();
  // Mode pilihan dan kewajiban adalah dua dimensi yang berbeda:
  // - PAKET = SINGLE (maksimal 1)
  // - ADD_ON = MULTIPLE (bisa lebih dari 1)
  // - required/min_select menentukan wajib atau opsional secara terpisah.
  // Normalisasi ini mencegah data lama seperti `isRequired=false` tetapi
  // `minSelect=1` tetap dianggap wajib oleh server.
  const required = group.isRequired ?? group.required ?? false;
  const single = group.mode === 'PAKET';
  const minSelect = required ? Math.max(1, Number(group.minSelect || 1)) : 0;
  const configuredMax = Number(group.maxSelect || 0);
  const multiMax = Math.max(minSelect || 1, configuredMax || group.options.length || 1);

  const groupPayload = {
    tenant_id: tenantId,
    branch_id: branchId,
    name: group.name.trim(),
    mode: group.mode,
    required,
    min_select: minSelect,
    max_select: single ? 1 : multiMax,
    target_categories: group.targetCategories?.length ? group.targetCategories : group.targetCategory ? [group.targetCategory] : [],
    is_active: group.isActive,
  };

  let groupId = group.id;
  if (UUID_PATTERN.test(group.id)) {
    const { error } = await supabase
      .from('condiment_groups')
      .update(groupPayload)
      .eq('id', group.id)
      .eq('branch_id', branchId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from('condiment_groups').insert(groupPayload).select('id').single();
    if (error || !data) throw new Error(error?.message || 'Grup condiment gagal dibuat');
    groupId = data.id;
  }

  const { error: deleteError } = await supabase.from('condiment_options').delete().eq('group_id', groupId);
  if (deleteError) throw new Error(deleteError.message);

  if (group.options.length) {
    const { error } = await supabase.from('condiment_options').insert(
      group.options.map((option, index) => ({
        group_id: groupId,
        name: option.name,
        price: option.price,
        is_available: option.isAvailable,
        sort_order: index,
      })),
    );
    if (error) throw new Error(error.message);
  }

  const { data: config } = await supabase
    .from('branch_operational_config')
    .select('condiment_scopes')
    .eq('branch_id', branchId)
    .maybeSingle();

  const existingScopes = ((config?.condiment_scopes || {}) as ScopeConfig);
  const scopes: ScopeConfig = {
    ...existingScopes,
    [groupId]: {
      ...(existingScopes[groupId] || {}),
      targetProductIds: group.targetProductIds || [],
      targetProductNames: group.targetProductNames || [],
      allSelectedLabel: String(group.allSelectedLabel || '').trim().toUpperCase(),
      selfOrderRole: group.selfOrderRole || 'NONE',
      selfOrderDefaultOptions: group.selfOrderDefaultOptions || [],
      selfOrderBaksoOnlyOptions: group.selfOrderBaksoOnlyOptions || [],
      selfOrderCampurOptions: group.selfOrderCampurOptions || [],
    },
  };

  const { error: configError } = await supabase.from('branch_operational_config').upsert(
    {
      branch_id: branchId,
      tenant_id: tenantId,
      condiment_scopes: scopes,
    },
    { onConflict: 'branch_id' },
  );
  if (configError) throw new Error(configError.message);
}
