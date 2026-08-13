import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_STATUSES = new Set(['NEW', 'COOKING', 'READY', 'COMPLETED', 'CANCELLED']);
const PAYMENT_METHODS = new Set(['CASH', 'QRIS', 'DEBIT', 'TRANSFER']);

export interface OrderRequestResult { status: number; data: unknown }
const fail = (status: number, error: string): OrderRequestResult => ({ status, data: { error } });

const mapOrder = (row: any, items: any[] = []) => {
  let metadata: any = {};
  try { metadata = typeof row.notes === 'string' ? JSON.parse(row.notes) : {}; } catch { metadata = {}; }
  return ({
  id: row.id,
  orderNumber: row.order_number,
  dailyNumber: row.daily_number ?? undefined,
  customerName: row.customer_name || 'Guest',
  tableNumber: row.restaurant_tables?.number || row.table_number || metadata.tableNumber || '',
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
    status: item.kitchen_status || 'PENDING',
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
    .select('*, restaurant_tables!orders_table_id_fkey(number)')
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
  const itemsByOrder = new Map<string, any[]>();
  (items || []).forEach((item) => {
    const bucket = itemsByOrder.get(item.order_id);
    if (bucket) bucket.push(item);
    else itemsByOrder.set(item.order_id, [item]);
  });
  return (rows || []).map((row) => mapOrder(row, itemsByOrder.get(row.id) || []));
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

    // Pembatalan bukan sekadar ganti status: stok dikembalikan, pembayaran
    // ditandai refund, dan peristiwanya dicatat — semuanya dalam satu transaksi.
    if (payload.status === 'CANCELLED') {
      const { error: voidError } = await admin.rpc('void_order', {
        p_order_id: payload.orderId,
        p_branch_id: branchId,
        p_reason: payload.reason ? String(payload.reason).slice(0, 500) : null,
        p_actor_user_id: actor.id,
        p_request_id: null,
      });
      if (voidError) return fail(500, 'Pembatalan pesanan gagal diproses');
      return { status: 200, data: { success: true } };
    }

    const { data: updated, error } = await admin.from('orders').update({ status: payload.status }).eq('id', payload.orderId).eq('branch_id', branchId).select('table_id').maybeSingle();
    if (error || !updated) return fail(500, 'Status pesanan gagal diperbarui');
    if (payload.status === 'COOKING') {
      await admin.from('order_items').update({ kitchen_status: 'PREPARING' }).eq('order_id', payload.orderId).eq('kitchen_status', 'PENDING');
    } else if (payload.status === 'COMPLETED') {
      await admin.from('order_items').update({ kitchen_status: 'DONE' }).eq('order_id', payload.orderId).neq('kitchen_status', 'DONE');
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
    const { data } = await admin.from('restaurant_tables')
      .select('id,number,status,self_order_enabled,active_order_id')
      .eq('branch_id', branchId)
      .eq('number', String(input.tableNumber))
      .maybeSingle();
    table = data;
  }
  if (source === 'SELF_ORDER') {
    const { data: branchConfig } = await admin.from('branch_operational_config')
      .select('self_order_enabled')
      .eq('branch_id', branchId)
      .maybeSingle();
    if (branchConfig?.self_order_enabled === false) {
      return fail(403, 'Self-order outlet ini sedang dinonaktifkan. Silakan hubungi kasir.');
    }
    if (!table || table.self_order_enabled === false || table.status === 'DISABLED') {
      return fail(403, `Meja ${input.tableNumber || ''} tidak aktif untuk self-order. Silakan hubungi kasir.`);
    }
  }

  // QR permanen per cabang tidak membawa token maupun nomor meja.
  // Gerbang self-order cukup: meja mengaktifkan self-order (self_order_enabled,
  // dikendalikan kasir per-meja/semua) dan cabang aktif — dicek di atas. Meja
  // yang dinonaktifkan kasir otomatis punya self_order_enabled=false → ditolak.

  // Self-order wajib memiliki shift kasir yang aktif di cabang. Bila shift kasir tutup,
  // pesanan ditolak untuk keamanan agar tidak ada yang memesan saat outlet tutup.
  let selfOrderShiftId = '';
  if (source === 'SELF_ORDER') {
    const since = new Date(Date.now() - 60_000).toISOString();
    const [{ count }, { data: activeShift }] = await Promise.all([
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('table_id', table.id).eq('source', 'SELF_ORDER').gte('created_at', since),
      admin.from('cashier_shifts').select('id').eq('branch_id', branchId).in('status', ['OPEN', 'HANDOVER']).order('opened_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if ((count || 0) >= 5) return fail(429, 'Terlalu banyak pesanan. Tunggu sebentar lalu coba lagi.');
    if (!activeShift?.id) {
      return fail(403, 'Shift kasir di outlet ini sedang tutup. Self-order tidak dapat menerima pesanan saat shift tutup.');
    }
    selfOrderShiftId = String(activeShift.id);
  }

  const menuIds = [...new Set(input.items.map((item: any) => String(item.menuId || '')).filter((id: string) => UUID_PATTERN.test(id)))];
  const [{ data: menus }, { data: groups }, { data: config }, { data: branchOrderConfig }] = await Promise.all([
    menuIds.length ? admin.from('menu_items').select('id,name,category,price,is_available,stock_count').eq('branch_id', branchId).in('id', menuIds) : Promise.resolve({ data: [] }),
    admin.from('condiment_groups').select('id,name,required,min_select,max_select,target_categories').eq('branch_id', branchId).eq('is_active', true),
    admin.from('tenant_config').select('kds_config').eq('tenant_id', branch.tenant_id).maybeSingle(),
    admin.from('branch_operational_config').select('condiment_scopes').eq('branch_id', branchId).maybeSingle(),
  ]);
  const groupIds = (groups || []).map((group) => group.id);
  const { data: options } = groupIds.length
    ? await admin.from('condiment_options').select('group_id,name,price').in('group_id', groupIds).eq('is_available', true)
    : { data: [] };
  const menuMap = new Map((menus || []).map((menu) => [menu.id, menu]));
  const { data: ingredientStockRows } = menuIds.length
    ? await admin.from('menu_item_ingredients')
      .select('menu_item_id,raw_material_id,amount_needed,raw_materials(name,stock_quantity)')
      .in('menu_item_id', menuIds)
    : { data: [] };
  const ingredientsByMenu = new Map<string, any[]>();
  const rawStock = new Map<string, { name: string; quantity: number }>();
  for (const row of ingredientStockRows || []) {
    const list = ingredientsByMenu.get(row.menu_item_id) || [];
    list.push(row);
    ingredientsByMenu.set(row.menu_item_id, list);
    const material = Array.isArray((row as any).raw_materials) ? (row as any).raw_materials[0] : (row as any).raw_materials;
    rawStock.set(row.raw_material_id, { name: material?.name || 'Bahan baku', quantity: Number(material?.stock_quantity || 0) });
  }
  const requiredRawStock = new Map<string, number>();
  const groupMap = new Map((groups || []).map((group) => [String(group.name).trim().toLocaleLowerCase('id-ID'), group]));
  const optionPrice = new Map((options || []).map((option) => [`${option.group_id}:${String(option.name).trim().toLocaleLowerCase('id-ID')}`, Number(option.price || 0)]));
  const scopes = (branchOrderConfig?.condiment_scopes || (config?.kds_config as any)?.condimentScopes || {}) as Record<string, { targetProductIds?: string[]; targetProductNames?: string[] }>;

  const normalizedItems: any[] = [];
  for (const item of input.items) {
    const dbMenu: any = menuMap.get(String(item.menuId || ''));
    const menu: any = dbMenu || {
      id: String(item.menuId || 'custom'),
      name: String(item.menuName || 'Item').trim(),
      category: String(item.category || 'MAKANAN'),
      price: Number(item.price || 0),
      is_available: true
    };
    if (!menu?.is_available) return fail(400, `Menu ${item.menuName || ''} tidak tersedia`);
    const isManual = /^(menu tambahan )?lain(ya|nya)$/i.test(String(menu.name).trim());
    if (isManual && source === 'SELF_ORDER') return fail(403, 'Item manual hanya tersedia di terminal kasir');
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
    if (menu.stock_count !== null && menu.stock_count !== undefined && Number(menu.stock_count) < quantity) {
      return fail(409, `Stok menu ${menu.name} tidak mencukupi`);
    }
    for (const ingredient of ingredientsByMenu.get(menu.id) || []) {
      requiredRawStock.set(
        ingredient.raw_material_id,
        (requiredRawStock.get(ingredient.raw_material_id) || 0) + Number(ingredient.amount_needed || 0) * quantity,
      );
    }
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
      kitchen_status: 'PENDING',
      category: menu.category,
    });
  }

  for (const [rawMaterialId, required] of requiredRawStock) {
    const available = rawStock.get(rawMaterialId);
    if (!available || available.quantity < required) {
      return fail(409, `Stok ${available?.name || 'bahan baku'} tidak mencukupi untuk pesanan ini`);
    }
  }

  // Tambahan self-order masuk sebagai item PENDING pada bill aktif yang sama.
  // Item lama tidak dihapus atau dikirim ulang ke Kitchen.
  if (source === 'SELF_ORDER' && table.status === 'OCCUPIED' && table.active_order_id) {
    const increment = normalizedItems.reduce((sum, item) => sum + item.total_price, 0);
    const { error: appendError } = await admin.rpc('append_self_order_items', {
      p_order_id: table.active_order_id,
      p_branch_id: branchId,
      p_items: normalizedItems.map(({ category: _category, ...item }) => item),
      p_total_increment: increment,
    });
    if (appendError) return fail(500, 'Tambahan pesanan gagal dimasukkan ke bill aktif');
    const orders = await readOrders(branchId, admin, table.active_order_id);
    return { status: 200, data: orders[0] };
  }

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.total_price, 0);
  const discount = Math.max(0, Math.min(subtotal, Math.floor(Number(input.discount) || 0)));
  const tax = Math.max(0, Math.floor(Number(input.tax) || 0));
  const total = Math.max(0, subtotal - discount + tax);
  const orderNumber = `${source === 'SELF_ORDER' ? 'SO' : 'POS'}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const clientRequestId = UUID_PATTERN.test(String(input.id || '')) ? String(input.id) : crypto.randomUUID();

  // Order tersimpan dikirim ulang memakai orders.id; retry offline hanya punya
  // client_request_id. Cari keduanya supaya tidak lahir order kembar.
  let existingOrderId = '';
  if (UUID_PATTERN.test(String(input.id || ''))) {
    const [{ data: byId }, { data: byRequest }] = await Promise.all([
      admin.from('orders').select('id').eq('id', input.id).eq('branch_id', branchId).maybeSingle(),
      admin.from('orders').select('id').eq('tenant_id', branch.tenant_id).eq('client_request_id', input.id).maybeSingle(),
    ]);
    existingOrderId = byId?.id || byRequest?.id || '';
  }

  // Self-order tidak boleh menimpa pesanan yang sudah masuk; kembalikan apa adanya.
  if (!actor && existingOrderId) {
    const orders = await readOrders(branchId, admin, existingOrderId);
    return { status: 200, data: orders[0] };
  }

  const paymentStatus = input.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID';
  const paymentMethod = PAYMENT_METHODS.has(String(input.paymentMethod)) ? String(input.paymentMethod) : null;
  const rawCashPaid = Math.floor(Number(input.cashPaid));
  const cashPaid = Number.isFinite(rawCashPaid) && rawCashPaid > 0 ? rawCashPaid : null;
  // Kembalian dihitung ulang di server; angka dari browser tidak dipercaya.
  const change = cashPaid !== null && cashPaid >= total ? cashPaid - total : null;

  const tableNumStr = input.tableNumber && input.tableNumber !== '-' ? String(input.tableNumber).trim() : null;

  const orderPayload = {
    order_id: existingOrderId || null,
    tenant_id: branch.tenant_id,
    branch_id: branchId,
    table_id: table?.id || null,
    table_number: tableNumStr,
    cashier_user_id: actor?.id || null,
    client_request_id: clientRequestId,
    order_number: orderNumber,
    source,
    order_type: input.type === 'TAKE_AWAY' ? 'TAKE_AWAY' : 'DINE_IN',
    status: ORDER_STATUSES.has(input.status) ? input.status : 'NEW',
    payment_status: paymentStatus,
    customer_name: String(input.customerName || 'Guest').trim().slice(0, 100),
    subtotal_amount: subtotal,
    discount_amount: discount,
    tax_amount: tax,
    total_amount: total,
    notes: JSON.stringify({ cashierName: actor?.name || 'Self Order', shiftId: input.shiftId || selfOrderShiftId || '', paymentMethod, cashPaid, change, tableNumber: tableNumStr }),
    payment_method: paymentMethod,
    paid_amount: cashPaid,
    change_amount: change,
    shift_id: input.shiftId ? String(input.shiftId).slice(0, 100) : (selfOrderShiftId || null),
    cashier_name: actor?.name || 'Self Order',
  };

  // Kunci idempotensi ditetapkan RPC dari order_id, supaya bill yang diedit
  // lalu dibayar ulang tetap menghasilkan satu baris payments.
  const paymentPayload = paymentStatus === 'PAID' && total > 0
    ? {
        method: paymentMethod || 'CASH',
        amount: total,
        paid_amount: cashPaid,
        processed_by: actor?.id || null,
      }
    : null;

  // Satu transaksi: order, item, payment, status meja, dan potong stok.
  const { data: checkout, error: checkoutError } = await admin.rpc('checkout_order', {
    p_order: orderPayload,
    p_items: normalizedItems.map(({ category: _category, ...item }) => item),
    p_payment: paymentPayload,
  });
  const savedOrderId = (checkout as any)?.order_id;
  if (checkoutError || !savedOrderId) return fail(500, 'Pesanan gagal disimpan');

  if (table?.id) {
    if (paymentStatus === 'PAID') {
      await admin.from('restaurant_tables').update({
        status: 'DISABLED', active_order_id: null,
      }).eq('id', table.id).eq('branch_id', branchId);
    } else {
      await admin.from('restaurant_tables').update({ status: 'OCCUPIED', active_order_id: savedOrderId })
        .eq('id', table.id).eq('branch_id', branchId);
    }
  }

  const [{ data: savedRow }, { data: savedItems }] = await Promise.all([
    admin.from('orders').select('*, restaurant_tables!orders_table_id_fkey(number)').eq('id', savedOrderId).single(),
    admin.from('order_items').select('*').eq('order_id', savedOrderId).order('created_at'),
  ]);
  if (!savedRow) return fail(500, 'Pesanan gagal dibaca setelah disimpan');

  const hydratedItems = (savedItems || []).map((item) => ({
    ...item,
    category: (menuMap.get(item.menu_item_id) as any)?.category || 'MAKANAN',
  }));

  return { status: (checkout as any)?.created ? 201 : 200, data: mapOrder(savedRow, hydratedItems) };
}
