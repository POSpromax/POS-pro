import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_STATUSES = new Set(['NEW', 'COOKING', 'READY', 'COMPLETED', 'CANCELLED']);

export interface OrderRequestResult { status: number; data: unknown }
const fail = (status: number, error: string): OrderRequestResult => ({ status, data: { error } });

const mapOrder = (row: any, items: any[] = []) => {
  let metadata: any = {};
  try { metadata = typeof row.notes === 'string' ? JSON.parse(row.notes) : {}; } catch { metadata = {}; }
  return ({
  id: row.id,
  orderNumber: row.order_number,
  customerName: row.customer_name || 'Guest',
  tableNumber: row.restaurant_tables?.number || row.table_number || '',
  type: row.order_type,
  items: items.map((item) => ({
    id: item.id,
    menuId: item.menu_item_id || '',
    menuName: item.item_name,
    price: Number(item.unit_price || 0),
    quantity: Number(item.quantity || 0),
    category: item.category || 'MAKANAN',
    notes: item.notes || undefined,
    selectedCondiments: Array.isArray(item.modifiers) ? item.modifiers : [],
  })),
  subtotal: Number(row.subtotal_amount || 0),
  tax: Number(row.tax_amount || 0),
  discount: Number(row.discount_amount || 0),
  total: Number(row.total_amount || 0),
  paymentMethod: row.payment_method || metadata.paymentMethod || undefined,
  paymentStatus: row.payment_status === 'PAID' ? 'PAID' : 'UNPAID',
  cashPaid: row.paid_amount == null ? metadata.cashPaid ?? undefined : Number(row.paid_amount),
  change: row.change_amount == null ? metadata.change ?? undefined : Number(row.change_amount),
  status: row.status === 'ACCEPTED' ? 'NEW' : row.status,
  createdAt: row.created_at,
  shiftId: row.shift_id || metadata.shiftId || '',
  branchId: row.branch_id,
  cashierName: row.cashier_name || metadata.cashierName || 'Staff',
  source: row.source,
  syncStatus: 'SYNCED',
  });
};

async function getActor(accessToken: string, branchId: string, admin: SupabaseClient) {
  if (!accessToken) return null;
  const { data: authData } = await admin.auth.getUser(accessToken);
  if (!authData.user) return null;
  const [{ data: profile }, { data: member }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id,display_name,is_active').eq('user_id', authData.user.id).maybeSingle(),
    admin.from('branch_members').select('role,is_active').eq('user_id', authData.user.id).eq('branch_id', branchId).maybeSingle(),
  ]);
  if (!profile?.is_active || !member?.is_active) return null;
  return { id: authData.user.id, tenantId: profile.tenant_id, name: profile.display_name || 'Staff', role: member.role };
}

async function readOrders(branchId: string, admin: SupabaseClient, orderId?: string) {
  let query = admin.from('orders')
    .select('*, restaurant_tables(number)')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(orderId ? 1 : 150);
  if (orderId) query = query.eq('id', orderId);
  const { data: rows, error } = await query;
  if (error) throw error;
  const ids = (rows || []).map((row) => row.id);
  const { data: items, error: itemsError } = ids.length
    ? await admin.from('order_items').select('*').in('order_id', ids).order('created_at')
    : { data: [], error: null };
  if (itemsError) throw itemsError;
  return (rows || []).map((row) => mapOrder(row, (items || []).filter((item) => item.order_id === row.id)));
}

export async function handleOrderRequest(
  method: string,
  payload: any,
  accessToken: string,
  admin: SupabaseClient,
): Promise<OrderRequestResult> {
  if (!['GET', 'POST', 'PATCH'].includes(method)) return fail(405, 'Method not allowed');
  const branchId = String(payload.branchId || '');
  if (!UUID_PATTERN.test(branchId)) return fail(400, 'Outlet tidak valid');
  const actor = await getActor(accessToken, branchId, admin);

  if (method === 'GET') {
    const orderId = payload.orderId ? String(payload.orderId) : undefined;
    if (!actor && (!orderId || !UUID_PATTERN.test(orderId))) return fail(401, 'Sesi telah berakhir');
    try {
      const orders = await readOrders(branchId, admin, orderId);
      return { status: 200, data: orderId ? (orders[0] || null) : orders };
    } catch {
      return fail(500, 'Pesanan tidak dapat dimuat');
    }
  }

  if (method === 'PATCH') {
    if (!actor) return fail(401, 'Sesi telah berakhir');
    if (!UUID_PATTERN.test(String(payload.orderId || '')) || !ORDER_STATUSES.has(payload.status)) return fail(400, 'Status pesanan tidak valid');
    const { data: updated, error } = await admin.from('orders').update({ status: payload.status }).eq('id', payload.orderId).eq('branch_id', branchId).select('table_id').maybeSingle();
    if (error || !updated) return fail(500, 'Status pesanan gagal diperbarui');
    if (updated.table_id && ['COMPLETED', 'CANCELLED'].includes(payload.status)) {
      await admin.from('restaurant_tables').update({ status: 'FREE' }).eq('id', updated.table_id).eq('branch_id', branchId);
    }
    return { status: 200, data: { success: true } };
  }

  const input = payload.order;
  if (!input || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 60) return fail(400, 'Isi pesanan tidak valid');
  const source = input.source === 'SELF_ORDER' ? 'SELF_ORDER' : 'POS';
  if (source === 'POS' && !actor) return fail(401, 'Sesi telah berakhir');
  const { data: branch } = await admin.from('branches').select('tenant_id,is_active').eq('id', branchId).maybeSingle();
  if (!branch?.is_active || (actor && actor.tenantId !== branch.tenant_id)) return fail(403, 'Outlet tidak aktif');

  let table: any = null;
  if (input.tableNumber) {
    const { data } = await admin.from('restaurant_tables').select('id,number,self_order_enabled').eq('branch_id', branchId).eq('number', String(input.tableNumber)).maybeSingle();
    table = data;
  }
  if (source === 'SELF_ORDER' && (!table || !table.self_order_enabled)) return fail(403, 'Self-order tidak tersedia pada meja ini');

  if (source === 'SELF_ORDER') {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('table_id', table.id).eq('source', 'SELF_ORDER').gte('created_at', since);
    if ((count || 0) >= 5) return fail(429, 'Terlalu banyak pesanan. Tunggu sebentar lalu coba lagi.');
  }

  const menuIds = [...new Set(input.items.map((item: any) => String(item.menuId || '')).filter((id: string) => UUID_PATTERN.test(id)))];
  const [{ data: menus }, { data: groups }, { data: config }] = await Promise.all([
    menuIds.length ? admin.from('menu_items').select('id,name,category,price,is_available').eq('branch_id', branchId).in('id', menuIds) : Promise.resolve({ data: [] }),
    admin.from('condiment_groups').select('id,name,required,min_select,max_select,target_categories').eq('branch_id', branchId).eq('is_active', true),
    admin.from('tenant_config').select('kds_config').eq('tenant_id', branch.tenant_id).maybeSingle(),
  ]);
  const groupIds = (groups || []).map((group) => group.id);
  const { data: options } = groupIds.length
    ? await admin.from('condiment_options').select('group_id,name,price').in('group_id', groupIds).eq('is_available', true)
    : { data: [] };
  const menuMap = new Map((menus || []).map((menu) => [menu.id, menu]));
  const groupMap = new Map((groups || []).map((group) => [String(group.name).trim().toLocaleLowerCase('id-ID'), group]));
  const optionPrice = new Map((options || []).map((option) => [`${option.group_id}:${String(option.name).trim().toLocaleLowerCase('id-ID')}`, Number(option.price || 0)]));
  const scopes = ((config?.kds_config as any)?.condimentScopes || {}) as Record<string, { targetProductIds?: string[]; targetProductNames?: string[] }>;

  const normalizedItems: any[] = [];
  for (const item of input.items) {
    const menu: any = menuMap.get(String(item.menuId || ''));
    if (!menu?.is_available) return fail(400, `Menu ${item.menuName || ''} tidak tersedia`);
    const isManual = /^(menu tambahan )?lain(ya|nya)$/i.test(String(menu.name).trim());
    if (isManual && source === 'SELF_ORDER') return fail(403, 'Item manual hanya tersedia di terminal kasir');
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
    const modifiers = Array.isArray(item.selectedCondiments) ? item.selectedCondiments : [];
    let extras = 0;
    const selectedGroupIds = new Set<string>();
    const normalizedMenuName = String(menu.name).toLocaleLowerCase('id-ID');
    for (const selection of modifiers) {
      const group: any = groupMap.get(String(selection.groupName || '').trim().toLocaleLowerCase('id-ID'));
      if (!group) return fail(400, `Grup condiment ${selection.groupName || ''} tidak valid`);
      const scope = scopes[group.id] || {};
      const applicable = Boolean(
        scope.targetProductIds?.includes(menu.id) ||
        scope.targetProductNames?.some((name) => normalizedMenuName.includes(String(name).toLocaleLowerCase('id-ID'))) ||
        (group.target_categories || []).includes('ALL') ||
        (group.target_categories || []).includes(menu.category)
      );
      if (!applicable) return fail(400, `${group.name} tidak berlaku untuk menu ini`);
      const names = Array.isArray(selection.options) ? selection.options : [];
      if (names.length > Number(group.max_select || 1)) return fail(400, `Pilihan ${group.name} melebihi batas`);
      selectedGroupIds.add(group.id);
      for (const name of names) {
        const key = `${group.id}:${String(name).trim().toLocaleLowerCase('id-ID')}`;
        if (!optionPrice.has(key)) return fail(400, `Pilihan ${name} tidak tersedia`);
        extras += optionPrice.get(key) || 0;
      }
    }
    for (const group of groups || []) {
      const scope = scopes[group.id] || {};
      const targetNames = scope.targetProductNames || [];
      const targetIds = scope.targetProductIds || [];
      const categoryTargets = group.target_categories || [];
      const applicable = targetIds.includes(menu.id) ||
        targetNames.some((name) => normalizedMenuName.includes(String(name).toLocaleLowerCase('id-ID'))) ||
        categoryTargets.includes('ALL') || categoryTargets.includes(menu.category);
      if (applicable && group.required && !selectedGroupIds.has(group.id)) return fail(400, `${group.name} wajib dipilih`);
    }
    const unitPrice = isManual && actor ? Math.max(0, Math.floor(Number(item.price) || 0)) : Number(menu.price || 0) + extras;
    normalizedItems.push({
      menu_item_id: menu.id,
      item_name: isManual ? String(item.menuName || 'Lainnya').trim().slice(0, 100) : menu.name,
      quantity,
      unit_price: unitPrice,
      total_price: unitPrice * quantity,
      modifiers,
      notes: item.notes ? String(item.notes).slice(0, 500) : null,
      category: menu.category,
    });
  }

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.total_price, 0);
  const discount = Math.max(0, Math.min(subtotal, Math.floor(Number(input.discount) || 0)));
  const tax = Math.max(0, Math.floor(Number(input.tax) || 0));
  const total = Math.max(0, subtotal - discount + tax);
  const orderNumber = `${source === 'SELF_ORDER' ? 'SO' : 'POS'}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const row = {
    tenant_id: branch.tenant_id,
    branch_id: branchId,
    table_id: table?.id || null,
    cashier_user_id: actor?.id || null,
    client_request_id: UUID_PATTERN.test(String(input.id || '')) ? input.id : crypto.randomUUID(),
    order_number: orderNumber,
    source,
    order_type: input.type === 'TAKE_AWAY' ? 'TAKE_AWAY' : 'DINE_IN',
    status: ORDER_STATUSES.has(input.status) ? input.status : 'NEW',
    payment_status: input.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID',
    customer_name: String(input.customerName || 'Guest').trim().slice(0, 100),
    subtotal_amount: subtotal,
    discount_amount: discount,
    tax_amount: tax,
    total_amount: total,
    notes: JSON.stringify({ cashierName: actor?.name || 'Self Order', shiftId: input.shiftId || '', paymentMethod: input.paymentMethod || null, cashPaid: input.cashPaid || null, change: input.change || null }),
  };
  let existingId = actor && UUID_PATTERN.test(String(input.id || ''))
    ? String(input.id)
    : '';
  if (UUID_PATTERN.test(String(input.id || ''))) {
    const { data: idempotentOrder } = await admin.from('orders').select('id').eq('tenant_id', branch.tenant_id).eq('client_request_id', input.id).maybeSingle();
    if (idempotentOrder?.id) {
      if (!actor) {
        const orders = await readOrders(branchId, admin, idempotentOrder.id);
        return { status: 200, data: orders[0] };
      }
      existingId = idempotentOrder.id;
    }
  }
  let savedRow: any = null;
  let error: any = null;
  if (existingId) {
    const { client_request_id: _clientRequestId, ...updates } = row;
    const result = await admin.from('orders').update(updates).eq('id', existingId).eq('branch_id', branchId).select('*, restaurant_tables(number)').maybeSingle();
    savedRow = result.data;
    error = result.error;
    if (savedRow) await admin.from('order_items').delete().eq('order_id', savedRow.id);
  }
  if (!savedRow && !error) {
    const result = await admin.from('orders').insert(row).select('*, restaurant_tables(number)').single();
    savedRow = result.data;
    error = result.error;
  }
  if (error || !savedRow) return fail(500, 'Pesanan gagal disimpan');
  const { data: savedItems, error: itemError } = await admin.from('order_items').insert(normalizedItems.map(({ category: _category, ...item }) => ({ ...item, order_id: savedRow.id }))).select('*');
  if (itemError) {
    await admin.from('orders').delete().eq('id', savedRow.id);
    return fail(500, 'Detail pesanan gagal disimpan');
  }
  if (table) await admin.from('restaurant_tables').update({ status: 'OCCUPIED' }).eq('id', table.id);
  if (row.payment_status === 'PAID') {
    // Idempotent database function; a retry cannot deduct recipe stock twice.
    await admin.rpc('deduct_order_inventory', { p_order_id: savedRow.id });
  }
  const hydratedItems = (savedItems || []).map((item, index) => ({ ...item, category: normalizedItems[index]?.category || 'MAKANAN' }));
  return { status: 201, data: mapOrder({ ...savedRow, cashier_name: actor?.name, shift_id: input.shiftId, payment_method: input.paymentMethod, paid_amount: input.cashPaid, change_amount: input.change }, hydratedItems) };
}
