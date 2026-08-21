import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_STATUSES = new Set(['NEW', 'COOKING', 'READY', 'COMPLETED', 'CANCELLED']);
const PAYMENT_METHODS = new Set(['CASH', 'QRIS', 'DEBIT', 'TRANSFER']);
const DISCOUNT_TYPES = new Set(['NONE', 'STAFF_EATING', 'PROMO', 'VOUCHER', 'SERVICE_RECOVERY', 'OWNER_COMPLIMENTARY', 'OTHER']);

export interface OrderRequestResult { status: number; data: unknown }
const fail = (status: number, error: string): OrderRequestResult => ({ status, data: { error } });

const mapOrder = (row: any, items: any[] = []) => {
  let metadata: any = {};
  try { metadata = typeof row.notes === 'string' ? JSON.parse(row.notes) : {}; } catch { metadata = {}; }
  const subtotal = Number(row.subtotal_amount || 0);
  const discount = Number(row.discount_amount || 0);
  const storedDiscountType = String(metadata.discountType || '').toUpperCase();
  const discountType = DISCOUNT_TYPES.has(storedDiscountType)
    ? storedDiscountType
    : discount <= 0
      ? 'NONE'
      : subtotal > 0 && discount >= subtotal
        ? 'STAFF_EATING'
        : 'PROMO';
  return ({
  id: row.id,
  orderNumber: row.order_number,
  dailyNumber: row.daily_number ?? undefined,
  customerName: row.customer_name || 'Guest',
  notes: metadata.customerNotes || undefined,
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
  subtotal,
  tax: Number(row.tax_amount || 0),
  discount,
  discountType,
  total: Number(row.total_amount || 0),
  paymentMethod: row.payment_method || metadata.paymentMethod || undefined,
  paymentStatus: row.payment_status === 'PAID' ? 'PAID' : 'UNPAID',
  cashPaid: row.paid_amount == null ? metadata.cashPaid ?? undefined : Number(row.paid_amount),
  change: row.change_amount == null ? metadata.change ?? undefined : Number(row.change_amount),
  status: row.status === 'ACCEPTED' ? 'NEW' : row.status,
  createdAt: row.created_at,
  // Jam SERVER — dipakai klien sebagai kursor sinkron inkremental agar tidak
  // bergantung jam perangkat (jam tablet yang meleset bisa membuat order terlewat).
  updatedAt: row.updated_at || row.created_at,
  shiftId: row.shift_id || metadata.shiftId || '',
  createdShiftId: row.created_shift_id || row.shift_id || metadata.shiftId || undefined,
  paidShiftId: row.paid_shift_id || undefined,
  completedShiftId: row.completed_shift_id || undefined,
  branchId: row.branch_id,
  cashierName: row.cashier_name || metadata.cashierName || 'Staff',
  source: row.source,
  condimentsEnabled: metadata.condimentsEnabled !== false,
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

// summary=true melewati pengambilan order_items (payload jauh lebih kecil) —
// dipakai dashboard owner yang hanya butuh agregat total/status, bukan detail item.
async function readOrders(
  branchId: string,
  admin: SupabaseClient,
  orderId?: string,
  summary = false,
  since?: string,
  reportRange?: { from: string; to: string; offset: number; limit: number },
) {
  const select = '*, restaurant_tables!orders_table_id_fkey(number)';
  let rows: any[] = [];
  if (orderId) {
    const { data, error } = await admin.from('orders').select(select).eq('branch_id', branchId).eq('id', orderId).limit(1);
    if (error) throw error;
    rows = data || [];
  } else if (reportRange) {
    const { data, error } = await admin.from('orders').select(select)
      .eq('branch_id', branchId)
      .gte('created_at', reportRange.from)
      .lt('created_at', reportRange.to)
      .order('created_at', { ascending: false })
      .range(reportRange.offset, reportRange.offset + reportRange.limit - 1);
    if (error) throw error;
    rows = data || [];
  } else if (since) {
    // SINKRON INKREMENTAL: hanya order yang berubah sejak sinkron terakhir.
    // Menghindari mengunduh ulang 150 order + item (~300KB) tiap 120 detik.
    const { data, error } = await admin.from('orders').select(select)
      .eq('branch_id', branchId)
      .gt('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    rows = data || [];
  } else {
    const [{ data: recent, error: recentError }, { data: openLifecycle, error: openError }] = await Promise.all([
      admin.from('orders').select(select).eq('branch_id', branchId).order('created_at', { ascending: false }).limit(150),
      admin.from('orders').select(select)
        .eq('branch_id', branchId)
        .neq('status', 'CANCELLED')
        .or('status.neq.COMPLETED,payment_status.neq.PAID')
        .order('created_at', { ascending: false }),
    ]);
    if (recentError || openError) throw recentError || openError;
    const unique = new Map<string, any>();
    [...(openLifecycle || []), ...(recent || [])].forEach((row) => unique.set(row.id, row));
    rows = [...unique.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  const ids = rows.map((row) => row.id);
  let items: any[] = [];
  if (ids.length && !summary) {
    // Batasi panjang URL PostgREST. Laporan dapat membawa ratusan order dan
    // `.in()` tunggal yang terlalu panjang rawan ditolak proxy/browser.
    for (let index = 0; index < ids.length; index += 150) {
      const { data, error } = await admin.from('order_items').select('*').in('order_id', ids.slice(index, index + 150)).order('created_at');
      if (error) throw error;
      items.push(...(data || []));
    }
  }
  const itemsByOrder = new Map<string, any[]>();
  (items || []).forEach((item) => {
    const bucket = itemsByOrder.get(item.order_id);
    if (bucket) bucket.push(item);
    else itemsByOrder.set(item.order_id, [item]);
  });
  return rows.map((row) => mapOrder(row, itemsByOrder.get(row.id) || []));
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
    const summary = payload.summary === '1' || payload.summary === true || payload.summary === 'true';
    const since = typeof payload.since === 'string' && payload.since ? payload.since : undefined;
    const reportRangeRequested = typeof payload.from === 'string' || typeof payload.to === 'string';
    const from = typeof payload.from === 'string' ? new Date(payload.from) : null;
    const to = typeof payload.to === 'string' ? new Date(payload.to) : null;
    const hasReportRange = Boolean(from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to);
    if (reportRangeRequested && !hasReportRange) return fail(400, 'Rentang tanggal laporan tidak valid');
    if (hasReportRange && !['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(actor?.role || '')) {
      return fail(403, 'Role tidak memiliki akses laporan historis');
    }
    const reportPage = Math.max(0, Math.min(100, Number.parseInt(String(payload.page || '0'), 10) || 0));
    const reportPageSize = Math.max(1, Math.min(500, Number.parseInt(String(payload.pageSize || '500'), 10) || 500));
    try {
      const orders = await readOrders(branchId, admin, orderId, summary, since, hasReportRange ? {
        from: from!.toISOString(),
        to: to!.toISOString(),
        offset: reportPage * reportPageSize,
        limit: reportPageSize,
      } : undefined);
      return { status: 200, data: orderId ? (orders[0] || null) : orders };
    } catch {
      return fail(500, 'Pesanan tidak dapat dimuat');
    }
  }

  if (method === 'PATCH') {
    if (!actor) return fail(401, 'Sesi telah berakhir');

    // ========================================================================
    // P0 — PAY ORDER: Immutable payment snapshot via finalize_order_payment
    // ========================================================================
    if (payload.action === 'PAY') {
      // Validate payment parameters
      if (!UUID_PATTERN.test(String(payload.orderId || ''))) {
        return fail(400, 'ID pesanan tidak valid');
      }
      if (!PAYMENT_METHODS.has(String(payload.paymentMethod || ''))) {
        return fail(400, 'Metode pembayaran tidak valid');
      }
      if (!UUID_PATTERN.test(String(payload.paidShiftId || ''))) {
        return fail(400, 'ID shift pembayaran tidak valid');
      }

      // Role check: SUPER_OWNER, OWNER, MANAGER, ADMIN, KASIR
      const paymentRoles = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR']);
      if (!paymentRoles.has(actor.role)) {
        return fail(403, 'Role tidak memiliki izin untuk memproses pembayaran');
      }

      const paidAmount = Math.floor(Number(payload.paidAmount) || 0);
      if (!Number.isFinite(paidAmount) || paidAmount < 0) {
        return fail(400, 'Jumlah pembayaran tidak valid');
      }

      // Call finalize_order_payment RPC
      const { data: paymentResult, error: paymentError } = await admin.rpc(
        'finalize_order_payment',
        {
          p_order_id: payload.orderId,
          p_branch_id: branchId,
          p_payment_method: payload.paymentMethod,
          p_paid_amount: paidAmount,
          p_paid_shift_id: payload.paidShiftId,
          p_cashier_user_id: actor.id,
        },
      );

      if (paymentError) {
        return fail(500, `Pembayaran gagal: ${paymentError.message}`);
      }

      if (!paymentResult?.success) {
        const errorMsg = paymentResult?.error || 'Pembayaran pesanan gagal diproses';
        return fail(400, errorMsg);
      }

      // Fetch updated order after payment
      try {
        const orders = await readOrders(branchId, admin, payload.orderId);
        return {
          status: paymentResult.idempotent ? 200 : 200,
          data: orders[0] || null,
        };
      } catch {
        return fail(500, 'Pembayaran berhasil tetapi pesanan gagal dibaca ulang');
      }
    }

    // ========================================================================
    // Kitchen Status Updates (COOKING, READY, COMPLETED, CANCELLED)
    // ========================================================================
    if (!UUID_PATTERN.test(String(payload.orderId || '')) || !ORDER_STATUSES.has(payload.status)) {
      return fail(400, 'Status pesanan tidak valid');
    }

    const kitchenRoles = new Set(['KITCHEN', 'SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR']);
    if (!kitchenRoles.has(actor.role)) return fail(403, 'Role tidak memiliki izin memperbarui status dapur');

    // Pembatalan bukan sekadar ganti status: stok dikembalikan, pembayaran
    // ditandai refund, dan peristiwanya dicatat — semuanya dalam satu transaksi.
    if (payload.status === 'CANCELLED') {
      if (!['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(actor.role)) {
        return fail(403, 'Pembatalan membutuhkan persetujuan Manager atau Owner');
      }
      const voidShiftId = UUID_PATTERN.test(String(payload.shiftId || '')) ? String(payload.shiftId) : null;
      let { error: voidError } = await admin.rpc('void_order', {
        p_order_id: payload.orderId,
        p_branch_id: branchId,
        p_reason: payload.reason ? String(payload.reason).slice(0, 500) : null,
        p_actor_user_id: actor.id,
        p_request_id: null,
        p_shift_id: voidShiftId,
      });
      // Kompatibilitas singkat selama migrasi p_shift_id belum diterapkan di database.
      if (voidError && voidShiftId) {
        ({ error: voidError } = await admin.rpc('void_order', {
          p_order_id: payload.orderId,
          p_branch_id: branchId,
          p_reason: payload.reason ? String(payload.reason).slice(0, 500) : null,
          p_actor_user_id: actor.id,
          p_request_id: null,
        }));
        if (!voidError) {
          await admin.from('orders').update({ completed_shift_id: voidShiftId })
            .eq('id', payload.orderId).eq('branch_id', branchId).is('completed_shift_id', null);
        }
      }
      if (voidError) return fail(500, 'Pembatalan pesanan gagal diproses');
      return { status: 200, data: { success: true } };
    }

    const { data: currentOrder, error: currentOrderError } = await admin.from('orders')
      .select('status,payment_status')
      .eq('id', payload.orderId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (currentOrderError || !currentOrder) return fail(404, 'Pesanan tidak ditemukan');

    // Pembayaran tidak boleh membekukan proses dapur: order yang dibayar di
    // awal masih boleh maju NEW -> COOKING -> READY -> COMPLETED. Namun order
    // lunas yang sudah COMPLETED adalah final dan tidak boleh dibuka kembali.
    if (currentOrder.payment_status === 'PAID' && currentOrder.status === 'COMPLETED') {
      if (payload.status === 'COMPLETED') return { status: 200, data: { success: true } };
      return fail(409, 'Pesanan lunas yang sudah selesai tidak dapat dibuka atau diubah kembali');
    }
    if (currentOrder.status === 'CANCELLED') {
      return fail(409, 'Pesanan yang dibatalkan tidak dapat diubah');
    }
    if (currentOrder.payment_status === 'PAID') {
      const progressRank: Record<string, number> = { NEW: 0, COOKING: 1, READY: 2, COMPLETED: 3 };
      if ((progressRank[payload.status] ?? -1) < (progressRank[currentOrder.status] ?? -1)) {
        return fail(409, 'Status pesanan lunas hanya dapat bergerak maju sampai selesai');
      }
    }

    const completedShiftId = UUID_PATTERN.test(String(payload.shiftId || '')) ? String(payload.shiftId) : null;
    let updateResult = await admin.from('orders').update({
      status: payload.status,
      ...(payload.status === 'COMPLETED' && completedShiftId ? { completed_shift_id: completedShiftId } : {}),
    }).eq('id', payload.orderId).eq('branch_id', branchId).select('table_id,payment_status,status').maybeSingle();
    // Kompatibilitas singkat selama migrasi attribution belum diterapkan.
    if (updateResult.error && payload.status === 'COMPLETED' && completedShiftId) {
      updateResult = await admin.from('orders').update({ status: payload.status })
        .eq('id', payload.orderId).eq('branch_id', branchId).select('table_id,payment_status,status').maybeSingle();
    }
    const { data: updated, error } = updateResult;
    if (error || !updated) return fail(500, 'Status pesanan gagal diperbarui');
    if (payload.status === 'COOKING') {
      await admin.from('order_items').update({ kitchen_status: 'PREPARING' }).eq('order_id', payload.orderId).eq('kitchen_status', 'PENDING');
    } else if (payload.status === 'READY' || payload.status === 'COMPLETED') {
      await admin.from('order_items').update({ kitchen_status: 'DONE' }).eq('order_id', payload.orderId).neq('kitchen_status', 'DONE');
    }

    // Kompatibilitas sebelum trigger lifecycle 021 terbaru diterapkan.
    if (updated.table_id) {
      const isClosed = updated.status === 'CANCELLED'
        || (updated.status === 'COMPLETED' && updated.payment_status === 'PAID');
      await admin.from('restaurant_tables').update(isClosed
        ? { status: 'DISABLED', self_order_enabled: false, active_order_id: null }
        : { status: 'OCCUPIED', active_order_id: payload.orderId })
        .eq('id', updated.table_id)
        .eq('branch_id', branchId)
        .or(`active_order_id.is.null,active_order_id.eq.${payload.orderId}`);
    }

    return { status: 200, data: { success: true } };
  }

  const input = payload.order;
  if (!input || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 60) return fail(400, 'Isi pesanan tidak valid');
  const source = input.source === 'SELF_ORDER' ? 'SELF_ORDER' : 'POS';
  const condimentsEnabled = source === 'SELF_ORDER' || input.condimentsEnabled !== false;
  if (source === 'POS' && !actor) return fail(401, 'Sesi telah berakhir');
  if (source === 'POS' && actor && !['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR'].includes(actor.role)) {
    return fail(403, 'Role tidak memiliki izin membuat atau membayar order POS');
  }
  const { data: branch } = await admin.from('branches').select('tenant_id,is_active').eq('id', branchId).maybeSingle();
  if (!branch?.is_active || (actor && actor.tenantId !== branch.tenant_id)) return fail(403, 'Outlet tidak aktif');

  // Resolve idempotency BEFORE checking current table availability. A successful
  // self-order can already have changed the table to OCCUPIED while the HTTP
  // response was lost. Retrying the same client UUID must return the original
  // order instead of being rejected as a second order.
  let existingOrderId = '';
  if (UUID_PATTERN.test(String(input.id || ''))) {
    const [{ data: byId }, { data: byRequest }] = await Promise.all([
      admin.from('orders').select('id,status,payment_status').eq('id', input.id).eq('branch_id', branchId).maybeSingle(),
      admin.from('orders').select('id,status,payment_status').eq('tenant_id', branch.tenant_id).eq('branch_id', branchId).eq('client_request_id', input.id).maybeSingle(),
    ]);
    existingOrderId = byId?.id || byRequest?.id || '';
    const existingOrder = byId || byRequest;
    // Konten order yang sudah lunas merupakan snapshot transaksi. UI kasir
    // menguncinya, dan API juga wajib menolak klien lama/stale yang mencoba
    // mengganti item, meja, diskon, atau catatan melalui checkout_order.
    if (source === 'POS' && existingOrder?.payment_status === 'PAID') {
      return fail(409, 'Pesanan lunas sudah dikunci dan tidak dapat diubah');
    }
    if (source === 'POS' && existingOrder?.status === 'CANCELLED') {
      return fail(409, 'Pesanan yang dibatalkan tidak dapat diubah');
    }
  }
  if (source === 'SELF_ORDER' && existingOrderId) {
    const orders = await readOrders(branchId, admin, existingOrderId);
    return { status: 200, data: orders[0] };
  }

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
    // Per-table self_order_enabled + READY is the only self-order gate.
    // The legacy branch-wide flag is intentionally ignored.
    if (!table || table.self_order_enabled !== true || table.status !== 'READY') {
      return fail(409, table?.status === 'OCCUPIED'
        ? `Meja ${input.tableNumber || ''} sedang digunakan. Minta nomor meja lain kepada kasir.`
        : `Meja ${input.tableNumber || ''} belum diaktifkan untuk self-order. Silakan hubungi kasir.`);
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
  const scopes = (branchOrderConfig?.condiment_scopes || (config?.kds_config as any)?.condimentScopes || {}) as Record<string, {
    targetProductIds?: string[];
    targetProductNames?: string[];
    selfOrderRole?: 'NONE' | 'BROTH' | 'FILLING';
  }>;

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
      const names = Array.isArray(selection.options)
        ? selection.options.map((name: unknown) => String(name || '').trim()).filter(Boolean)
        : [];
      // Grup condiment TANPA pilihan = kasir memang tidak memilih apa pun.
      // Abaikan seluruhnya supaya tidak ditolak lewat aturan minimum/berlaku;
      // kewajiban sudah diatur pengecekan "wajib dipilih" di bawah yang
      // menghormati saklar Topping. Tanpa ini, mematikan saklar Topping membuat
      // order yang membawa grup kosong gagal disimpan maupun dibayar.
      if (names.length === 0) continue;
      if (!applicable) return fail(400, `${group.name} tidak berlaku untuk menu ini`);
      if (names.length > Number(group.max_select || 1)) return fail(400, `Pilihan ${group.name} melebihi batas`);
      if (names.length < Number(group.min_select || 0)) return fail(400, `${group.name} belum memenuhi jumlah pilihan minimum`);
      if (names.length > 0) selectedGroupIds.add(group.id);
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
      const configuredSelfOrderRole = scopes[group.id]?.selfOrderRole;
      const normalizedGroupName = String(group.name || '').trim().toLocaleUpperCase('id-ID');
      const selfOrderRole = configuredSelfOrderRole === 'BROTH' || configuredSelfOrderRole === 'FILLING'
        ? configuredSelfOrderRole
        : normalizedGroupName.includes('KUAH')
          ? 'BROTH'
          : normalizedGroupName.includes('ISIAN')
            ? 'FILLING'
            : 'NONE';
      const requiredForSelfOrder = source === 'SELF_ORDER' && (selfOrderRole === 'BROTH' || selfOrderRole === 'FILLING');
      if (condimentsEnabled && applicable && (group.required || Number(group.min_select || 0) > 0 || requiredForSelfOrder) && !selectedGroupIds.has(group.id)) {
        return fail(400, `${group.name} wajib dipilih`);
      }
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

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.total_price, 0);
  const discount = Math.max(0, Math.min(subtotal, Math.floor(Number(input.discount) || 0)));
  const requestedDiscountType = String(input.discountType || '').toUpperCase();
  const discountType = discount <= 0
    ? 'NONE'
    : DISCOUNT_TYPES.has(requestedDiscountType) && requestedDiscountType !== 'NONE'
      ? requestedDiscountType
      : 'PROMO';
  const tax = Math.max(0, Math.floor(Number(input.tax) || 0));
  const total = Math.max(0, subtotal - discount + tax);
  const orderNumber = `${source === 'SELF_ORDER' ? 'SO' : 'POS'}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const clientRequestId = UUID_PATTERN.test(String(input.id || '')) ? String(input.id) : crypto.randomUUID();

  // Self-order tidak pernah boleh menyatakan dirinya sudah dibayar. Tanpa
  // payment gateway, hanya terminal staff terautentikasi yang mengubah PAID.
  const paymentStatus = source === 'SELF_ORDER'
    ? 'UNPAID'
    : input.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID';
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
    notes: JSON.stringify({
      cashierName: actor?.name || 'Self Order',
      shiftId: input.shiftId || selfOrderShiftId || '',
      paymentMethod,
      cashPaid,
      change,
      tableNumber: tableNumStr,
      customerNotes: input.notes ? String(input.notes).trim().slice(0, 500) : undefined,
      discountType,
      condimentsEnabled,
    }),
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

  // Self-order memakai RPC khusus yang mengunci row meja sebelum membuat order.
  // POS tetap memakai checkout umum karena kasir boleh mengelola bill aktif.
  const checkoutItems = normalizedItems.map(({ category: _category, ...item }) => item);
  const { data: checkout, error: checkoutError } = source === 'SELF_ORDER'
    ? await admin.rpc('checkout_self_order', {
      p_order: orderPayload,
      p_items: checkoutItems,
    })
    : await admin.rpc('checkout_order', {
      p_order: orderPayload,
      p_items: checkoutItems,
      p_payment: paymentPayload,
    });
  const savedOrderId = (checkout as any)?.order_id;
  if (checkoutError || !savedOrderId) {
    if (source === 'SELF_ORDER' && checkoutError?.message?.includes('SELF_ORDER_TABLE_UNAVAILABLE')) {
      return fail(409, `Meja ${input.tableNumber || ''} baru saja digunakan pelanggan lain. Minta nomor meja lain kepada kasir.`);
    }
    return fail(500, 'Pesanan gagal disimpan');
  }

  if (table?.id && source !== 'SELF_ORDER') {
    const isClosed = paymentStatus === 'PAID' && orderPayload.status === 'COMPLETED';
    const tableUpdate = isClosed
      ? await admin.from('restaurant_tables').update({
        status: 'DISABLED', self_order_enabled: false, active_order_id: null,
      }).eq('id', table.id).eq('branch_id', branchId)
      : await admin.from('restaurant_tables').update({ status: 'OCCUPIED', active_order_id: savedOrderId })
        .eq('id', table.id).eq('branch_id', branchId);
    if (tableUpdate.error) {
      return fail(500, 'Pesanan tersimpan, tetapi status meja belum tersinkron. Muat ulang lalu coba lagi.');
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
