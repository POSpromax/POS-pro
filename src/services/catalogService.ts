import type { MenuItem, RawMaterial } from '../types/pos';
import { getSupabase } from '../lib/supabase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function currentTenantId(): Promise<string> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesi telah berakhir');
  const { data, error } = await supabase.from('user_profiles').select('tenant_id').eq('user_id', user.id).single();
  if (error || !data?.tenant_id) throw new Error('Tenant akun tidak ditemukan');
  return data.tenant_id;
}

export async function listCloudCatalog(branchId: string): Promise<{ menuItems: MenuItem[]; rawMaterials: RawMaterial[] }> {
  const supabase = getSupabase();
  const [{ data: menuRows, error: menuError }, { data: rawRows, error: rawError }] = await Promise.all([
    supabase.from('menu_items').select('*').eq('branch_id', branchId).order('sort_order'),
    supabase.from('raw_materials').select('*').eq('branch_id', branchId).order('name'),
  ]);
  if (menuError || rawError) throw new Error(menuError?.message || rawError?.message || 'Master data cloud gagal dibaca');
  return {
    menuItems: (menuRows || []).map((row) => ({ id: row.id, name: row.name, category: row.category, price: Number(row.price), image: row.image_url || '', description: row.description || '', hppCost: Number(row.hpp_cost || 0), ingredients: [], isAvailable: row.is_available !== false, stockCount: row.stock_count ?? undefined })),
    rawMaterials: (rawRows || []).map((row) => ({ id: row.id, name: row.name, unit: row.unit, stockQuantity: Number(row.stock_quantity), minStockThreshold: Number(row.min_stock_threshold), costPerUnit: Number(row.cost_per_unit), branchId: row.branch_id, branchName: '' })),
  };
}

export async function saveCloudMenuItem(item: MenuItem, branchId: string): Promise<void> {
  const tenantId = await currentTenantId();
  const payload = { tenant_id: tenantId, branch_id: branchId, name: item.name, category: item.category, price: item.price, image_url: item.image || null, description: item.description || null, hpp_cost: item.hppCost || 0, is_available: item.isAvailable !== false, stock_count: item.stockCount ?? null };
  const supabase = getSupabase();
  const operation = UUID_PATTERN.test(item.id) ? supabase.from('menu_items').update(payload).eq('id', item.id).eq('branch_id', branchId) : supabase.from('menu_items').insert(payload);
  const { error } = await operation;
  if (error) throw new Error(error.message);
}

export async function deleteCloudMenuItem(id: string, branchId: string): Promise<void> {
  const { error } = await getSupabase().from('menu_items').delete().eq('id', id).eq('branch_id', branchId);
  if (error) throw new Error(error.message);
}

export async function saveCloudRawMaterial(material: RawMaterial, branchId: string): Promise<void> {
  const tenantId = await currentTenantId();
  const payload = { tenant_id: tenantId, branch_id: branchId, name: material.name, unit: material.unit, stock_quantity: material.stockQuantity, min_stock_threshold: material.minStockThreshold, cost_per_unit: material.costPerUnit };
  const supabase = getSupabase();
  const operation = UUID_PATTERN.test(material.id) ? supabase.from('raw_materials').update(payload).eq('id', material.id).eq('branch_id', branchId) : supabase.from('raw_materials').insert(payload);
  const { error } = await operation;
  if (error) throw new Error(error.message);
}

export async function deleteCloudRawMaterial(id: string, branchId: string): Promise<void> {
  const { error } = await getSupabase().from('raw_materials').delete().eq('id', id).eq('branch_id', branchId);
  if (error) throw new Error(error.message);
}
