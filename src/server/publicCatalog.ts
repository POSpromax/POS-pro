import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getPublicCatalog(branchId: string, admin: SupabaseClient, tenantId?: string) {
  if (!UUID_PATTERN.test(branchId)) return { status: 400, data: { error: 'Outlet tidak valid' } };
  if (tenantId && !UUID_PATTERN.test(tenantId)) return { status: 400, data: { error: 'Tenant tidak valid' } };
  let branchQuery = admin.from('branches').select('id,tenant_id,name,code,address,is_active').eq('id', branchId);
  if (tenantId) branchQuery = branchQuery.eq('tenant_id', tenantId);
  const { data: branch } = await branchQuery.maybeSingle();
  if (!branch?.is_active) return { status: 404, data: { error: 'Outlet tidak tersedia' } };
  const [{ data: menus }, { data: tables }, { data: groups }, { data: config }, { data: branchConfig }] = await Promise.all([
    admin.from('menu_items').select('*').eq('branch_id', branchId).eq('is_available', true).order('sort_order'),
    admin.from('restaurant_tables').select('*').eq('branch_id', branchId).eq('self_order_enabled', true).neq('status', 'DISABLED').order('number'),
    admin.from('condiment_groups').select('*, condiment_options(*)').eq('branch_id', branchId).eq('is_active', true).order('sort_order'),
    admin.from('tenant_config').select('*').eq('tenant_id', branch.tenant_id).maybeSingle(),
    admin.from('branch_operational_config').select('self_order_enabled,self_order_base_url,profile_overrides,condiment_scopes').eq('branch_id', branchId).maybeSingle(),
  ]);
  const scopes = branchConfig?.condiment_scopes || (config?.kds_config as any)?.condimentScopes || {};
  const tenantProfile = config ? {
    name: config.display_name || branch.name,
    tagline: config.tagline || '',
    address: branch.address || config.address || '',
    phone: config.phone || '',
    instagram: config.instagram || '',
    tiktok: config.tiktok || '',
    logoUrl: config.logo_url || '',
    ...((config.landing_page || {}) as Record<string, unknown>),
    ...((config.kds_config || {}) as Record<string, unknown>),
    ...((config.shift_config || {}) as Record<string, unknown>),
    ...((config.attendance_config || {}) as Record<string, unknown>),
    ...((config.finance_config || {}) as Record<string, unknown>),
  } : null;
  const publicProfile = tenantProfile
    ? { ...tenantProfile, ...((branchConfig?.profile_overrides || {}) as Record<string, unknown>), isSelfOrderEnabled: branchConfig?.self_order_enabled !== false }
    : null;
  const menuIds = (menus || []).map((row) => row.id);
  const { data: ingredientRows } = menuIds.length
    ? await admin
      .from('menu_item_ingredients')
      .select('menu_item_id,amount_needed,raw_materials(stock_quantity)')
      .in('menu_item_id', menuIds)
    : { data: [] };
  const unavailableByInventory = new Set<string>();
  for (const ingredient of ingredientRows || []) {
    const material = Array.isArray((ingredient as any).raw_materials)
      ? (ingredient as any).raw_materials[0]
      : (ingredient as any).raw_materials;
    if (!material || Number(material.stock_quantity || 0) < Number((ingredient as any).amount_needed || 0)) {
      unavailableByInventory.add((ingredient as any).menu_item_id);
    }
  }
  const availableMenus = (menus || []).filter((row) => (
    (row.stock_count === null || row.stock_count === undefined || Number(row.stock_count) > 0)
    && !unavailableByInventory.has(row.id)
  ));
  return {
    status: 200,
    data: {
      branch: { id: branch.id, name: branch.name, code: branch.code, address: branch.address || '' },
      operationalConfig: {
        branchId: branch.id,
        tenantId: branch.tenant_id,
        selfOrderEnabled: branchConfig?.self_order_enabled !== false,
        selfOrderBaseUrl: branchConfig?.self_order_base_url || '',
        profileOverrides: branchConfig?.profile_overrides || {},
      },
      profile: publicProfile,
      menuItems: availableMenus.filter((row) => !/^(menu tambahan )?lain(ya|nya)$/i.test(String(row.name).trim())).map((row) => ({
        id: row.id, name: row.name, category: row.category, price: Number(row.price), image: row.image_url || '',
        description: row.description || '', hppCost: Number(row.hpp_cost || 0), ingredients: [], isAvailable: true,
      })),
      tables: (tables || []).map((row) => ({
        id: row.id,
        number: row.number,
        capacity: row.capacity,
        status: row.status,
        isSelfOrderEnabled: row.self_order_enabled,
        activeOrderId: row.active_order_id || undefined,
        branchId,
      })),
      condimentGroups: (groups || []).map((row) => ({
        id: row.id, name: row.name, mode: row.mode, isRequired: row.required, minSelect: row.min_select, maxSelect: row.max_select,
        targetCategories: row.target_categories || [], targetProductIds: scopes[row.id]?.targetProductIds || [], targetProductNames: scopes[row.id]?.targetProductNames || [],
        isActive: row.is_active, options: (row.condiment_options || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((option: any) => ({ id: option.id, name: option.name, price: Number(option.price), isAvailable: option.is_available })),
      })),
    },
  };
}
