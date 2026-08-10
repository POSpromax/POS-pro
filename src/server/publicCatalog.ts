import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getPublicCatalog(branchId: string, admin: SupabaseClient) {
  if (!UUID_PATTERN.test(branchId)) return { status: 400, data: { error: 'Outlet tidak valid' } };
  const { data: branch } = await admin.from('branches').select('id,tenant_id,name,code,address,is_active').eq('id', branchId).maybeSingle();
  if (!branch?.is_active) return { status: 404, data: { error: 'Outlet tidak tersedia' } };
  const [{ data: menus }, { data: tables }, { data: groups }, { data: config }] = await Promise.all([
    admin.from('menu_items').select('*').eq('branch_id', branchId).eq('is_available', true).order('sort_order'),
    admin.from('restaurant_tables').select('*').eq('branch_id', branchId).eq('self_order_enabled', true).neq('status', 'DISABLED').order('number'),
    admin.from('condiment_groups').select('*, condiment_options(*)').eq('branch_id', branchId).eq('is_active', true).order('sort_order'),
    admin.from('tenant_config').select('*').eq('tenant_id', branch.tenant_id).maybeSingle(),
  ]);
  const scopes = (config?.kds_config as any)?.condimentScopes || {};
  return {
    status: 200,
    data: {
      branch: { id: branch.id, name: branch.name, code: branch.code, address: branch.address || '' },
      profile: config ? {
        name: config.display_name || branch.name,
        tagline: config.tagline || '',
        address: config.address || branch.address || '',
        phone: config.phone || '',
        instagram: config.instagram || '',
        tiktok: config.tiktok || '',
        logo: config.logo_url || '',
        isSelfOrderEnabled: config.self_order_enabled !== false,
      } : null,
      menuItems: (menus || []).filter((row) => !/^(menu tambahan )?lain(ya|nya)$/i.test(String(row.name).trim())).map((row) => ({
        id: row.id, name: row.name, category: row.category, price: Number(row.price), image: row.image_url || '',
        description: row.description || '', hppCost: Number(row.hpp_cost || 0), ingredients: [], isAvailable: true,
      })),
      tables: (tables || []).map((row) => ({ id: row.id, number: row.number, capacity: row.capacity, status: row.status, isSelfOrderEnabled: row.self_order_enabled, branchId })),
      condimentGroups: (groups || []).map((row) => ({
        id: row.id, name: row.name, mode: row.mode, isRequired: row.required, minSelect: row.min_select, maxSelect: row.max_select,
        targetCategories: row.target_categories || [], targetProductIds: scopes[row.id]?.targetProductIds || [], targetProductNames: scopes[row.id]?.targetProductNames || [],
        isActive: row.is_active, options: (row.condiment_options || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((option: any) => ({ id: option.id, name: option.name, price: Number(option.price), isAvailable: option.is_available })),
      })),
    },
  };
}
