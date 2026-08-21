import type { CondimentGroup, CondimentLegacyQuickPreset, CondimentQuickPreset } from '../types/pos';
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
  quickPresets?: CondimentQuickPreset[];
  disabledQuickPresets?: CondimentLegacyQuickPreset[];
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

function normalizeQuickPresets(value: unknown): CondimentQuickPreset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const name = String(row.name || '').trim().toUpperCase();
    const options = normalizeStringArray(row.options);
    if (!name || !options.length) return [];
    return [{
      id: String(row.id || `preset-${index + 1}`),
      name,
      options,
      kitchenLabel: String(row.kitchenLabel || '').trim().toUpperCase() || undefined,
    }];
  });
}

function normalizeDisabledQuickPresets(value: unknown): CondimentLegacyQuickPreset[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is CondimentLegacyQuickPreset => (
    item === 'BAKSO_ONLY' || item === 'CAMPUR'
  ))));
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
    quickPresets: normalizeQuickPresets(scope?.quickPresets),
    disabledQuickPresets: normalizeDisabledQuickPresets(scope?.disabledQuickPresets),
  };
}

export async function listCloudCondiments(branchId: string): Promise<CondimentGroup[]> {
  const supabase = getSupabase();
  const [{ data: groups, error: groupError }, { data: branchConfig, error: branchConfigError }] = await Promise.all([
    supabase.from('condiment_groups').select('*,condiment_options(*)').eq('branch_id', branchId).order('sort_order'),
    supabase.from('branch_operational_config').select('condiment_scopes').eq('branch_id', branchId).maybeSingle(),
  ]);
  if (groupError) throw new Error(groupError.message);
  if (branchConfigError && branchConfigError.code !== '42P01' && branchConfigError.code !== 'PGRST205') {
    throw new Error(branchConfigError.message);
  }

  let scopes = (branchConfig?.condiment_scopes as ScopeConfig | null) || {};
  // Hanya instalasi legacy sebelum migration 017 yang membutuhkan fallback
  // tenant. Jalur normal cukup dua query paralel tanpa auth/profile tambahan.
  if (!branchConfig) {
    const { tenantId } = await tenantContext();
    const { data: config } = await supabase
      .from('tenant_config')
      .select('kds_config')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    scopes = ((config?.kds_config as { condimentScopes?: ScopeConfig } | null)?.condimentScopes) || {};
  }

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

export async function saveCloudCondimentGroup(group: CondimentGroup, branchId: string): Promise<CondimentGroup> {
  const supabase = getSupabase();
  const { data: groupId, error } = await supabase.rpc('save_condiment_group_atomic', {
    p_group_id: UUID_PATTERN.test(group.id) ? group.id : null,
    p_branch_id: branchId,
    p_name: group.name.trim(),
    p_mode: group.mode,
    p_required: group.isRequired ?? group.required ?? false,
    p_min_select: group.minSelect ?? 0,
    p_max_select: Math.max(1, group.maxSelect ?? (group.mode === 'PAKET' ? 1 : group.options.length || 1)),
    p_target_categories: group.targetCategories?.length ? group.targetCategories : group.targetCategory ? [group.targetCategory] : [],
    p_is_active: group.isActive,
    p_options: group.options.map((option, index) => ({
      id: option.id,
      name: option.name.trim(),
      price: Number(option.price || 0),
      isAvailable: option.isAvailable !== false,
      sortOrder: index,
    })),
    p_scope: {
      targetProductIds: group.targetProductIds || [],
      targetProductNames: group.targetProductNames || [],
      allSelectedLabel: String(group.allSelectedLabel || '').trim().toUpperCase(),
      selfOrderRole: group.selfOrderRole || 'NONE',
      selfOrderDefaultOptions: group.selfOrderDefaultOptions || [],
      selfOrderBaksoOnlyOptions: group.selfOrderBaksoOnlyOptions || [],
      selfOrderCampurOptions: group.selfOrderCampurOptions || [],
      quickPresets: normalizeQuickPresets(group.quickPresets),
      disabledQuickPresets: normalizeDisabledQuickPresets(group.disabledQuickPresets),
    },
  });
  if (error || !groupId) throw new Error(error?.message || 'Grup condiment gagal disimpan');

  const refreshed = await listCloudCondiments(branchId);
  const saved = refreshed.find((item) => item.id === groupId);
  if (!saved) throw new Error('Grup tersimpan tetapi gagal dimuat ulang.');
  return saved;
}


export async function deleteCloudCondimentGroup(groupId: string, branchId: string): Promise<void> {
  if (!UUID_PATTERN.test(groupId)) return;
  const { error } = await getSupabase().rpc('delete_condiment_group_atomic', {
    p_group_id: groupId,
    p_branch_id: branchId,
  });
  if (error) throw new Error(error.message);
}
