import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const [sourceBranchId, targetBranchId] = process.argv.slice(2);

if (!UUID_PATTERN.test(sourceBranchId || '') || !UUID_PATTERN.test(targetBranchId || '') || sourceBranchId === targetBranchId) {
  throw new Error('Gunakan: tsx scripts/copy-branch-menu.ts <source-branch-uuid> <target-branch-uuid>');
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl || !serverKey) throw new Error('Konfigurasi Supabase server tidak tersedia');

const admin = createClient(supabaseUrl, serverKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const [{ data: sourceBranch, error: sourceBranchError }, { data: targetBranch, error: targetBranchError }] = await Promise.all([
  admin.from('branches').select('id,tenant_id,name').eq('id', sourceBranchId).single(),
  admin.from('branches').select('id,tenant_id,name').eq('id', targetBranchId).single(),
]);
if (sourceBranchError || targetBranchError || !sourceBranch || !targetBranch) throw new Error('Cabang sumber atau tujuan tidak ditemukan');
if (sourceBranch.tenant_id !== targetBranch.tenant_id) throw new Error('Menu hanya dapat disalin di dalam tenant yang sama');

const [{ data: sourceMenus, error: sourceError }, { data: targetMenus, error: targetError }] = await Promise.all([
  admin.from('menu_items')
    .select('name,category,price,image_url,description,hpp_cost,is_available,sort_order')
    .eq('branch_id', sourceBranchId)
    .order('sort_order'),
  admin.from('menu_items').select('name,category').eq('branch_id', targetBranchId),
]);
if (sourceError || targetError) throw new Error(sourceError?.message || targetError?.message || 'Master menu gagal dibaca');

const keyOf = (name: string, category: string) => `${category.trim().toUpperCase()}::${name.trim().toLocaleLowerCase('id-ID')}`;
const existing = new Set((targetMenus || []).map((menu) => keyOf(menu.name, menu.category)));
const rows = (sourceMenus || [])
  .filter((menu) => !existing.has(keyOf(menu.name, menu.category)))
  .map((menu) => ({
    tenant_id: targetBranch.tenant_id,
    branch_id: targetBranchId,
    name: menu.name,
    category: menu.category,
    price: menu.price,
    image_url: menu.image_url,
    description: menu.description,
    hpp_cost: menu.hpp_cost,
    is_available: true,
    stock_count: null,
    sort_order: menu.sort_order,
  }));

if (rows.length) {
  const { error: insertError } = await admin.from('menu_items').insert(rows);
  if (insertError) throw new Error(insertError.message);
}

console.log(JSON.stringify({
  source: sourceBranch.name,
  target: targetBranch.name,
  sourceCount: sourceMenus?.length || 0,
  existingTargetCount: targetMenus?.length || 0,
  copiedCount: rows.length,
  finalTargetCount: (targetMenus?.length || 0) + rows.length,
}, null, 2));
