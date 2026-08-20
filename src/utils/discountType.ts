import type { DiscountType, Order } from '../types/pos';

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  NONE: 'Normal',
  STAFF_EATING: 'Staff Eating',
  PROMO: 'Promo',
  VOUCHER: 'Voucher',
  SERVICE_RECOVERY: 'Kompensasi / Komplain',
  OWNER_COMPLIMENTARY: 'Owner Complimentary',
  OTHER: 'Lainnya',
};

export const SELECTABLE_DISCOUNT_TYPES: DiscountType[] = [
  'STAFF_EATING',
  'PROMO',
  'VOUCHER',
  'SERVICE_RECOVERY',
  'OWNER_COMPLIMENTARY',
  'OTHER',
];

type DiscountOrder = Pick<Order, 'discountType' | 'discount' | 'subtotal'>;

/**
 * Transaksi baru menyimpan kategori secara eksplisit. Inferensi nominal hanya
 * dipertahankan untuk membaca data lama sebelum metadata discountType tersedia.
 */
export const resolveDiscountType = (order: DiscountOrder): DiscountType => {
  if (order.discountType && order.discountType !== 'NONE') return order.discountType;
  const discount = Number(order.discount || 0);
  const subtotal = Number(order.subtotal || 0);
  if (discount <= 0) return 'NONE';
  if (subtotal > 0 && discount >= subtotal) return 'STAFF_EATING';
  return 'PROMO';
};

export const getDiscountTypeLabel = (order: DiscountOrder): string => (
  DISCOUNT_TYPE_LABELS[resolveDiscountType(order)]
);

export const isStaffEatingOrder = (order: DiscountOrder): boolean => (
  resolveDiscountType(order) === 'STAFF_EATING'
);
