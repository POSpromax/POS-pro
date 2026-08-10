import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { INITIAL_CONDIMENT_GROUPS, INITIAL_TABLES } from '../src/data/initialData';

const TENANT_ID = '00000000-0000-4000-a000-000000000001';

function deterministicUuid(scope: string) {
  const bytes = Buffer.from(createHash('sha256').update(scope).digest('hex').slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Environment Supabase belum lengkap');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: branches, error: branchError } = await admin.from('branches').select('id,name').eq('tenant_id', TENANT_ID).eq('is_active', true);
  if (branchError) throw branchError;
  const summary: Array<{ branchId: string; branch: string; manualItem: boolean; condimentGroups: number; tables: number }> = [];

  for (const branch of branches || []) {
    const manualId = deterministicUuid(`system-menu:${branch.id}:lainnya`);
    const { error: menuError } = await admin.from('menu_items').upsert({
      id: manualId, tenant_id: TENANT_ID, branch_id: branch.id, name: 'MENU TAMBAHAN LAINYA', category: 'TAMBAHAN',
      price: 0, description: 'Item manual POS non-stok. Nama dan harga diisi kasir.', hpp_cost: 0, is_available: true, stock_count: null, sort_order: 9999,
    }, { onConflict: 'id' });
    if (menuError) throw menuError;

    const { count } = await admin.from('condiment_groups').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id);
    if (!count) {
      const scopeConfig: Record<string, unknown> = {};
      for (let groupIndex = 0; groupIndex < INITIAL_CONDIMENT_GROUPS.length; groupIndex += 1) {
        const group = INITIAL_CONDIMENT_GROUPS[groupIndex];
        const groupId = deterministicUuid(`condiment:${branch.id}:${group.name.toLocaleLowerCase('id-ID')}`);
        const { error: groupError } = await admin.from('condiment_groups').upsert({
          id: groupId, tenant_id: TENANT_ID, branch_id: branch.id, name: group.name, mode: group.mode,
          required: group.required ?? group.isRequired ?? false, min_select: group.minSelect || 0, max_select: Math.max(1, group.maxSelect || 1),
          target_categories: group.targetCategories || [], is_active: group.isActive, sort_order: groupIndex,
        }, { onConflict: 'id' });
        if (groupError) throw groupError;
        const options = group.options.map((option, optionIndex) => ({
          id: deterministicUuid(`condiment-option:${groupId}:${option.name.toLocaleLowerCase('id-ID')}`), group_id: groupId,
          name: option.name, price: option.price, is_available: option.isAvailable, sort_order: optionIndex,
        }));
        const { error: optionError } = await admin.from('condiment_options').upsert(options, { onConflict: 'id' });
        if (optionError) throw optionError;
        scopeConfig[groupId] = { targetProductIds: group.targetProductIds || [], targetProductNames: group.targetProductNames || [] };
      }
      const { data: config } = await admin.from('tenant_config').select('kds_config').eq('tenant_id', TENANT_ID).maybeSingle();
      const kds = config?.kds_config && typeof config.kds_config === 'object' ? config.kds_config as Record<string, unknown> : {};
      const { error: configError } = await admin.from('tenant_config').update({ kds_config: { ...kds, condimentScopes: { ...((kds.condimentScopes || {}) as object), ...scopeConfig } } }).eq('tenant_id', TENANT_ID);
      if (configError) throw configError;
    }
    const { data: existingTables, error: tableReadError } = await admin.from('restaurant_tables').select('number').eq('branch_id', branch.id);
    if (tableReadError) throw tableReadError;
    const existingNumbers = new Set((existingTables || []).map((table) => table.number));
    const missingTables = INITIAL_TABLES
      .filter((table) => table.branchId === branch.id && !existingNumbers.has(table.number))
      .map((table) => ({
        id: deterministicUuid(`restaurant-table:${branch.id}:${table.number}`), branch_id: branch.id, number: table.number,
        capacity: table.capacity, status: 'FREE', self_order_enabled: table.isSelfOrderEnabled,
      }));
    if (missingTables.length) {
      const { error: tableInsertError } = await admin.from('restaurant_tables').insert(missingTables);
      if (tableInsertError) throw tableInsertError;
    }
    const { count: groupCount } = await admin.from('condiment_groups').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id);
    const { count: tableCount } = await admin.from('restaurant_tables').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id);
    summary.push({ branchId: branch.id, branch: branch.name, manualItem: true, condimentGroups: groupCount || 0, tables: tableCount || 0 });
  }
  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
