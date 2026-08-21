import type { MenuItem, RawMaterial } from '../types/pos';
import { getSupabase } from '../lib/supabase';
import { adjustStockByDelta, adjustStockManual, type StockMovementType } from './stockLedgerService';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Hanya bahan baku (tanpa menu & resep) — untuk dashboard owner yang cuma butuh
// hitung stok kritis. Jauh lebih ringan daripada listCloudCatalog penuh.
export async function listCloudRawMaterials(branchId: string): Promise<RawMaterial[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id,name,unit,stock_quantity,min_stock_threshold,cost_per_unit,branch_id,material_group,take_away_usage_per_item')
    .eq('branch_id', branchId)
    .order('name');
  if (error) throw new Error(error.message || 'Data bahan gagal dibaca');
  return (data || []).map((row) => ({
    id: row.id, name: row.name, unit: row.unit,
    stockQuantity: Number(row.stock_quantity), minStockThreshold: Number(row.min_stock_threshold),
    costPerUnit: Number(row.cost_per_unit), branchId: row.branch_id, branchName: '',
    group: row.material_group || undefined,
    takeAwayUsagePerItem: Number(row.take_away_usage_per_item || 0) || undefined,
  }));
}

export async function listCloudCatalog(branchId: string): Promise<{ menuItems: MenuItem[]; rawMaterials: RawMaterial[] }> {
  const supabase = getSupabase();
  const [{ data: menuRows, error: menuError }, { data: rawRows, error: rawError }] = await Promise.all([
    supabase.from('menu_items').select('*').eq('branch_id', branchId).order('sort_order'),
    supabase.from('raw_materials').select('*').eq('branch_id', branchId).order('name'),
  ]);
  if (menuError || rawError) throw new Error(menuError?.message || rawError?.message || 'Master data cloud gagal dibaca');
  const menuIds = (menuRows || []).map((row) => row.id);
  const { data: ingredientRows, error: ingredientError } = menuIds.length
    ? await supabase.from('menu_item_ingredients').select('*').in('menu_item_id', menuIds)
    : { data: [], error: null };
  if (ingredientError) throw new Error(ingredientError.message);
  const rawNames = new Map((rawRows || []).map((row) => [row.id, row.name]));
  return {
    menuItems: (menuRows || []).map((row) => {
      // Menu dianggap HARGA CUSTOM bila: id sistem, flag eksplisit, nama cocok
      // pola 'lainnya/custom', ATAU harganya 0. Aturan harga 0 penting karena
      // kolom is_manual_price tidak ada di DB sehingga flag tak pernah tersimpan:
      // tanpa ini, menu berharga 0 masuk keranjang sebagai Rp 0 tanpa bisa diisi.
      const isManualPrice = row.id === 'menu-custom'
        || Boolean(row.is_manual_price)
        || /^(menu tambahan|menu custom|custom|lainya|lainnya)$/i.test(String(row.name).trim())
        || Number(row.price || 0) <= 0;
      const isSticky = row.id === 'menu-custom' || Boolean(row.is_sticky) || isManualPrice;
      const ingredients = (ingredientRows || []).filter((ingredient) => ingredient.menu_item_id === row.id).map((ingredient) => {
        // Baris CUSTOM tidak punya raw_material_id: nama & biayanya tersimpan
        // langsung pada baris resep (mis. garam 3 gram, saus 5 ml).
        const custom = !ingredient.raw_material_id;
        return {
          rawMaterialId: ingredient.raw_material_id || '',
          rawMaterialName: custom
            ? (ingredient.custom_name || 'Bahan custom')
            : (rawNames.get(ingredient.raw_material_id) || 'Bahan baku'),
          amountNeeded: Number(ingredient.amount_needed),
          unit: ingredient.unit,
          ...(custom ? { isCustom: true, customCost: Number(ingredient.custom_cost || 0) } : {}),
        };
      });
      return { id: row.id, name: row.name, category: row.category, price: Number(row.price), image: row.image_url || '', description: row.description || '', hppCost: Number(row.hpp_cost || 0), ingredients, isAvailable: row.is_available !== false, stockCount: row.stock_count ?? undefined, isAutoStock: ingredients.length > 0, isManualPrice, isSticky, trackStock: !isManualPrice };
    }),
    rawMaterials: (rawRows || []).map((row) => ({ id: row.id, name: row.name, unit: row.unit, stockQuantity: Number(row.stock_quantity), minStockThreshold: Number(row.min_stock_threshold), costPerUnit: Number(row.cost_per_unit), branchId: row.branch_id, branchName: '', group: row.material_group || undefined, takeAwayUsagePerItem: Number(row.take_away_usage_per_item || 0) || undefined })),
  };
}

export async function saveCloudMenuItem(item: MenuItem, branchId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('save_menu_item_with_ingredients', {
    p_menu_item_id: UUID_PATTERN.test(item.id) ? item.id : null,
    p_branch_id: branchId,
    p_name: item.name,
    p_category: item.category,
    p_price: item.price,
    p_image_url: item.image || null,
    p_description: item.description || null,
    p_hpp_cost: item.hppCost || 0,
    p_is_available: item.isAvailable !== false,
    p_stock_count: item.stockCount ?? null,
    p_ingredients: (item.ingredients || []).map((ingredient) => ({
      rawMaterialId: ingredient.isCustom ? null : ingredient.rawMaterialId,
      rawMaterialName: ingredient.rawMaterialName,
      amountNeeded: ingredient.amountNeeded,
      unit: ingredient.unit,
      isCustom: Boolean(ingredient.isCustom),
      customCost: ingredient.customCost || 0,
    })),
  });
  if (error) throw new Error(error.message);
}

export async function deleteCloudMenuItem(id: string, branchId: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_menu_item_secure', {
    p_menu_item_id: id,
    p_branch_id: branchId,
  });
  if (error) throw new Error(error.message);
}

export async function saveCloudRawMaterial(
  material: RawMaterial,
  branchId: string,
  stockMovementType: StockMovementType = 'ADJUSTMENT',
  stockReason?: string,
  stockDelta?: number
): Promise<number | undefined> {
  const supabase = getSupabase();

  if (!UUID_PATTERN.test(material.id)) {
    // Pembuatan master lewat RPC terproteksi. RPC menentukan tenant dari cabang
    // yang telah diverifikasi sehingga INSERT tidak bergantung pada payload
    // tenant browser dan tidak membuka akses lintas cabang.
    const { error } = await supabase.rpc('create_raw_material', {
      p_branch_id: branchId,
      p_name: material.name,
      p_unit: material.unit,
      p_stock_quantity: material.stockQuantity,
      p_min_stock_threshold: material.minStockThreshold,
      p_cost_per_unit: material.costPerUnit,
      p_material_group: material.group || 'DAPUR',
      p_take_away_usage_per_item: material.group === 'KEMASAN' ? (material.takeAwayUsagePerItem ?? 1) : 0,
    });
    if (error) {
      if (/tidak berhak membuat bahan/i.test(error.message || '')) {
        throw new Error('Sesi aktif tidak memiliki izin katalog pada cabang ini. Pastikan akun terdaftar sebagai kepala outlet pada cabang aktif, lalu login ulang.');
      }
      throw new Error(error.message);
    }
    return undefined;
  }


  // Mutasi cepat hanya menyentuh saldo lewat satu RPC atomik. Jangan kirim
  // UPDATE master lebih dulu: itu membuat dua event realtime dan membuka
  // peluang saldo layar lama menimpa mutasi dari terminal lain.
  if (Number.isFinite(stockDelta) && stockDelta !== 0) {
    return adjustStockByDelta(
      material.id,
      branchId,
      Number(stockDelta),
      stockMovementType,
      stockReason
    );
  }

  const { error } = await supabase.rpc('update_raw_material_master', {
    p_raw_material_id: material.id,
    p_branch_id: branchId,
    p_name: material.name,
    p_unit: material.unit,
    p_min_stock_threshold: material.minStockThreshold,
    p_cost_per_unit: material.costPerUnit,
    p_material_group: material.group || 'DAPUR',
    p_take_away_usage_per_item: material.group === 'KEMASAN' ? (material.takeAwayUsagePerItem ?? 1) : 0,
  });
  if (error) throw new Error(error.message);

  // Stok sengaja tidak ikut di-update di atas: perubahannya harus lewat ledger
  // supaya setiap penambahan dan pengurangan punya riwayat yang bisa ditelusuri.
  return adjustStockManual(material.id, material.stockQuantity, stockMovementType, stockReason);
}

export async function deleteCloudRawMaterial(id: string, branchId: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_raw_material_secure', {
    p_raw_material_id: id,
    p_branch_id: branchId,
  });
  if (error) throw new Error(error.message);
}
