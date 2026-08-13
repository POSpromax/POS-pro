import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const [sourceBranchId, targetBranchId] = args.filter((arg) => arg !== '--dry-run');

if (!UUID_PATTERN.test(sourceBranchId || '') || !UUID_PATTERN.test(targetBranchId || '') || sourceBranchId === targetBranchId) {
  throw new Error('Gunakan: tsx scripts/copy-branch-inventory.ts <source-branch-uuid> <target-branch-uuid> [--dry-run]');
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl || !serverKey) throw new Error('Konfigurasi Supabase server tidak tersedia');

const admin = createClient(supabaseUrl, serverKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const normalize = (value: string) => value.trim().toLocaleLowerCase('id-ID');
const materialKey = (row: { name: string; unit: string; material_group: string }) =>
  `${row.material_group}::${normalize(row.name)}::${normalize(row.unit)}`;
const menuKey = (row: { name: string; category: string }) =>
  `${normalize(row.category)}::${normalize(row.name)}`;

const [{ data: sourceBranch, error: sourceBranchError }, { data: targetBranch, error: targetBranchError }] = await Promise.all([
  admin.from('branches').select('id,tenant_id,name').eq('id', sourceBranchId).single(),
  admin.from('branches').select('id,tenant_id,name').eq('id', targetBranchId).single(),
]);
if (sourceBranchError || targetBranchError || !sourceBranch || !targetBranch) throw new Error('Cabang sumber atau tujuan tidak ditemukan');
if (sourceBranch.tenant_id !== targetBranch.tenant_id) throw new Error('Master inventory hanya dapat disalin di dalam tenant yang sama');

const [{ data: sourceMaterials, error: sourceMaterialError }, { data: targetMaterials, error: targetMaterialError }] = await Promise.all([
  admin.from('raw_materials')
    .select('id,name,unit,min_stock_threshold,cost_per_unit,material_group,take_away_usage_per_item')
    .eq('branch_id', sourceBranchId)
    .in('material_group', ['MENU', 'DAPUR'])
    .order('material_group')
    .order('name'),
  admin.from('raw_materials')
    .select('id,name,unit,material_group')
    .eq('branch_id', targetBranchId),
]);
if (sourceMaterialError || targetMaterialError) {
  throw new Error(sourceMaterialError?.message || targetMaterialError?.message || 'Master bahan gagal dibaca');
}

const targetMaterialKeys = new Set((targetMaterials || []).map(materialKey));
const materialRows = (sourceMaterials || [])
  .filter((material) => !targetMaterialKeys.has(materialKey(material)))
  .map((material) => ({
    tenant_id: targetBranch.tenant_id,
    branch_id: targetBranchId,
    name: material.name,
    unit: material.unit,
    stock_quantity: 0,
    min_stock_threshold: material.min_stock_threshold,
    cost_per_unit: material.cost_per_unit,
    material_group: material.material_group,
    take_away_usage_per_item: material.take_away_usage_per_item,
  }));

if (!dryRun && materialRows.length) {
  const { error } = await admin.from('raw_materials').insert(materialRows);
  if (error) throw new Error(`Master bahan gagal disalin: ${error.message}`);
}

let copiedRecipes = 0;
let sourceRecipeCount = 0;
if (!dryRun) {
  const [{ data: refreshedTargetMaterials, error: refreshedTargetError }, { data: sourceMenus }, { data: targetMenus }] = await Promise.all([
    admin.from('raw_materials').select('id,name,unit,material_group').eq('branch_id', targetBranchId),
    admin.from('menu_items').select('id,name,category').eq('branch_id', sourceBranchId),
    admin.from('menu_items').select('id,name,category').eq('branch_id', targetBranchId),
  ]);
  if (refreshedTargetError) throw new Error(`Hasil salinan bahan gagal dibaca: ${refreshedTargetError.message}`);

  const sourceMenuIds = (sourceMenus || []).map((menu) => menu.id);
  const { data: sourceRecipes, error: sourceRecipeError } = sourceMenuIds.length
    ? await admin.from('menu_item_ingredients').select('menu_item_id,raw_material_id,amount_needed,unit').in('menu_item_id', sourceMenuIds)
    : { data: [], error: null };
  if (sourceRecipeError) throw new Error(`Resep sumber gagal dibaca: ${sourceRecipeError.message}`);
  sourceRecipeCount = sourceRecipes?.length || 0;

  const sourceMaterialById = new Map((sourceMaterials || []).map((material) => [material.id, material]));
  const targetMaterialByKey = new Map((refreshedTargetMaterials || []).map((material) => [materialKey(material), material.id]));
  const sourceMenuById = new Map((sourceMenus || []).map((menu) => [menu.id, menu]));
  const targetMenuByKey = new Map((targetMenus || []).map((menu) => [menuKey(menu), menu.id]));
  const targetMenuIds = (targetMenus || []).map((menu) => menu.id);
  const { data: targetRecipes, error: targetRecipeError } = targetMenuIds.length
    ? await admin.from('menu_item_ingredients').select('menu_item_id,raw_material_id').in('menu_item_id', targetMenuIds)
    : { data: [], error: null };
  if (targetRecipeError) throw new Error(`Resep tujuan gagal dibaca: ${targetRecipeError.message}`);
  const existingRecipeKeys = new Set((targetRecipes || []).map((recipe) => `${recipe.menu_item_id}::${recipe.raw_material_id}`));

  const recipeRows = (sourceRecipes || []).flatMap((recipe) => {
    const sourceMaterial = sourceMaterialById.get(recipe.raw_material_id);
    const sourceMenu = sourceMenuById.get(recipe.menu_item_id);
    if (!sourceMaterial || !sourceMenu) return [];
    const targetMaterialId = targetMaterialByKey.get(materialKey(sourceMaterial));
    const targetMenuId = targetMenuByKey.get(menuKey(sourceMenu));
    if (!targetMaterialId || !targetMenuId || existingRecipeKeys.has(`${targetMenuId}::${targetMaterialId}`)) return [];
    return [{
      menu_item_id: targetMenuId,
      raw_material_id: targetMaterialId,
      amount_needed: recipe.amount_needed,
      unit: recipe.unit,
    }];
  });

  if (recipeRows.length) {
    const { error } = await admin.from('menu_item_ingredients').insert(recipeRows);
    if (error) throw new Error(`Resep gagal disalin: ${error.message}`);
  }
  copiedRecipes = recipeRows.length;
}

console.log(JSON.stringify({
  mode: dryRun ? 'DRY_RUN' : 'APPLY',
  source: sourceBranch.name,
  target: targetBranch.name,
  groups: ['MENU', 'DAPUR'],
  sourceMaterialCount: sourceMaterials?.length || 0,
  existingTargetMaterialCount: targetMaterials?.length || 0,
  copiedMaterialCount: materialRows.length,
  sourceRecipeCount,
  copiedRecipeCount: copiedRecipes,
  stockPolicy: 'Master baru dibuat dengan stock_quantity=0; stok fisik cabang sumber tidak disalin.',
}, null, 2));
