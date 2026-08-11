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

export async function listStockMovements(branchId: string, rawMaterialId?: string, limit = 100): Promise<StockMovement[]> {
  if (!isSupabaseConfigured()) return [];

  let query = getSupabase()
    .from('stock_movements')
    .select('id,raw_material_id,movement_type,quantity,stock_before,stock_after,reason,order_id,created_at,raw_materials(name)')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (rawMaterialId) query = query.eq('raw_material_id', rawMaterialId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
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
