import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

export type StockMovementType =
  | 'SALE'
  | 'VOID_RETURN'
  | 'PURCHASE'
  | 'WASTE'
  | 'ADJUSTMENT'
  | 'OPNAME'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

export interface StockMovement {
  id: string;
  branchId: string;
  rawMaterialId: string;
  rawMaterialName?: string;
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason?: string;
  orderId?: string;
  createdAt: string;
}

export interface ListStockMovementsParams {
  branchId: string;
  rawMaterialId?: string;
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}

export interface ListStockMovementsResult {
  rows: StockMovement[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  SALE: 'Terjual',
  VOID_RETURN: 'Batal — stok kembali',
  PURCHASE: 'Belanja masuk',
  WASTE: 'Rusak / terbuang',
  ADJUSTMENT: 'Koreksi manual',
  OPNAME: 'Stock opname',
  TRANSFER_IN: 'Transfer masuk',
  TRANSFER_OUT: 'Transfer keluar'
};

/** Jenis pergerakan yang boleh dipilih petugas saat menyesuaikan stok. */
export const MANUAL_MOVEMENT_TYPES: StockMovementType[] = ['PURCHASE', 'WASTE', 'ADJUSTMENT', 'OPNAME'];

export async function listStockMovements({
  branchId,
  rawMaterialId,
  limit = 100,
  offset = 0,
  from,
  to,
}: ListStockMovementsParams): Promise<ListStockMovementsResult> {
  if (!isSupabaseConfigured()) {
    return { rows: [], total: 0, limit, offset, hasMore: false };
  }

  let query = getSupabase()
    .from('stock_movements')
    .select('id,branch_id,raw_material_id,movement_type,quantity,stock_before,stock_after,reason,order_id,created_at,raw_materials(name)', { count: 'exact' })
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (rawMaterialId) query = query.eq('raw_material_id', rawMaterialId);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lt('created_at', to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = (data || []).map((row: any) => ({
    id: row.id,
    branchId: row.branch_id,
    rawMaterialId: row.raw_material_id,
    rawMaterialName: row.raw_materials?.name,
    type: row.movement_type,
    quantity: Number(row.quantity),
    stockBefore: Number(row.stock_before),
    stockAfter: Number(row.stock_after),
    reason: row.reason || undefined,
    orderId: row.order_id || undefined,
    createdAt: row.created_at
  }));

  return {
    rows,
    total: count || 0,
    limit,
    offset,
    hasMore: offset + rows.length < (count || 0),
  };
}

/**
 * Menyetel stok ke angka baru lewat jalur yang mencatat ledger.
 * Jangan meng-update raw_materials.stock_quantity langsung — perubahannya
 * akan hilang dari riwayat dan stok jadi tidak bisa ditelusuri.
 */
export async function adjustStockManual(
  rawMaterialId: string,
  newQuantity: number,
  movementType: StockMovementType = 'ADJUSTMENT',
  reason?: string
): Promise<number> {
  const { data, error } = await getSupabase().rpc('adjust_stock_manual', {
    p_raw_material_id: rawMaterialId,
    p_new_quantity: newQuantity,
    p_movement_type: movementType,
    p_reason: reason || null
  });
  if (error) throw new Error(error.message);
  return Number(data);
}

/**
 * Menambah/mengurangi stok secara atomik dari saldo database terbaru.
 * Dipakai kontrol cepat Inventory agar dua terminal tidak saling menimpa
 * ketika keduanya membaca saldo lama lalu melakukan mutasi bersamaan.
 */
export async function adjustStockByDelta(
  rawMaterialId: string,
  branchId: string,
  quantityDelta: number,
  movementType: StockMovementType,
  reason?: string
): Promise<number> {
  const { data, error } = await getSupabase().rpc('adjust_stock_by_delta', {
    p_raw_material_id: rawMaterialId,
    p_branch_id: branchId,
    p_quantity_delta: quantityDelta,
    p_movement_type: movementType,
    p_reason: reason || null
  });
  if (error) throw new Error(error.message);
  return Number(data);
}
