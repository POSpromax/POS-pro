import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveBranchId(
  branchId: string,
  branchRouteCode: string,
  admin: SupabaseClient,
): Promise<string> {
  if (UUID_PATTERN.test(branchId)) return branchId;
  if (!/^\d{2,4}$/.test(branchRouteCode)) return '';

  const { data } = await admin
    .from('branch_operational_config')
    .select('branch_id')
    .eq('public_order_slug', branchRouteCode)
    .maybeSingle();
  if (data?.branch_id) return String(data.branch_id);

  // Kompatibilitas konfigurasi lama: public catalog juga menerima suffix kode
  // cabang (BGR-01 -> 01). Tetap batasi ke satu cabang aktif dan jangan pernah
  // memakai cabang aktif dari browser/session sebagai fallback publik.
  const { data: legacyBranch } = await admin
    .from('branches')
    .select('id')
    .ilike('code', `%-${branchRouteCode}`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return String(legacyBranch?.id || '');
}

/**
 * Snapshot publik berukuran kecil untuk halaman QR.
 *
 * Katalog lengkap (profil, gambar, condiment) hanya perlu dimuat saat halaman
 * dibuka. Polling operasional cukup membaca shift, meja, dan ketersediaan menu.
 * Checkout tetap melakukan validasi atomik sehingga snapshot ini bukan sumber
 * otorisasi dan tidak dapat menyebabkan meja ganda.
 */
export async function getPublicSelfOrderStatus(
  branchId: string,
  admin: SupabaseClient,
  branchRouteCode?: string,
) {
  const routeCode = String(branchRouteCode || '').trim();
  const resolvedBranchId = await resolveBranchId(String(branchId || ''), routeCode, admin);
  if (!UUID_PATTERN.test(resolvedBranchId)) {
    return { status: 400, data: { error: 'Outlet tidak valid' } };
  }

  const { data: branch } = await admin
    .from('branches')
    .select('id,is_active')
    .eq('id', resolvedBranchId)
    .maybeSingle();
  if (!branch?.is_active) return { status: 404, data: { error: 'Outlet tidak tersedia' } };

  const [{ data: tables }, { data: activeShift }, { data: menus }] = await Promise.all([
    admin
      .from('restaurant_tables')
      .select('id,number,capacity,status,self_order_enabled,active_order_id')
      .eq('branch_id', resolvedBranchId)
      .order('number'),
    admin
      .from('cashier_shifts')
      .select('id')
      .eq('branch_id', resolvedBranchId)
      .in('status', ['OPEN', 'HANDOVER'])
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('menu_items')
      .select('id,stock_count,is_available')
      .eq('branch_id', resolvedBranchId),
  ]);

  const businessEnabledMenus = (menus || []).filter((menu) => menu.is_available !== false);
  const menuIds = businessEnabledMenus.map((menu) => menu.id);
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

  const availableMenuIds = businessEnabledMenus
    .filter((menu) => (
      (menu.stock_count === null || menu.stock_count === undefined || Number(menu.stock_count) > 0)
      && !unavailableByInventory.has(menu.id)
    ))
    .map((menu) => menu.id);

  return {
    status: 200,
    data: {
      branchId: resolvedBranchId,
      isShiftActive: Boolean(activeShift?.id),
      availableMenuIds,
      tables: (tables || []).map((table) => ({
        id: table.id,
        number: table.number,
        capacity: table.capacity,
        status: table.status,
        isSelfOrderEnabled: table.self_order_enabled,
        activeOrderId: table.active_order_id || undefined,
        branchId: resolvedBranchId,
      })),
      serverTime: new Date().toISOString(),
    },
  };
}
