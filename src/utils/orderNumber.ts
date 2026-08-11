import { Order } from '../types/pos';

/**
 * Label antrean yang dibaca kasir, pelanggan, dan dapur.
 *
 * Order dari cloud punya nomor urut harian per cabang — itu yang ditampilkan.
 * Order lama dan order offline yang belum sempat naik ke cloud hanya punya
 * order_number acak; ambil ekor pendeknya supaya kolom tidak melebar.
 */
export const formatOrderLabel = (order: Pick<Order, 'orderNumber' | 'dailyNumber'>): string => {
  if (typeof order.dailyNumber === 'number' && order.dailyNumber > 0) {
    return `#${String(order.dailyNumber).padStart(3, '0')}`;
  }

  const raw = String(order.orderNumber || '').trim();
  if (!raw) return '#—';
  if (raw.startsWith('#')) return raw;
  return `#${raw.slice(-4).toUpperCase()}`;
};
