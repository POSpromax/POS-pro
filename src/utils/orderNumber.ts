import { Order } from '../types/pos';

/**
 * Label antrean harian berurutan yang dibaca kasir (#001, #002, #003...).
 * Berurutan per hari, dan meriset ulang dari #001 setiap hari baru.
 */
export const formatOrderLabel = (
  order: Pick<Order, 'orderNumber' | 'dailyNumber' | 'createdAt'>,
  allOrdersForToday: Order[] = []
): string => {
  if (typeof order.dailyNumber === 'number' && order.dailyNumber > 0) {
    return `#${String(order.dailyNumber).padStart(3, '0')}`;
  }

  if (allOrdersForToday && allOrdersForToday.length > 0) {
    const todayDate = new Date(order.createdAt || Date.now()).toDateString();
    const todayOrders = allOrdersForToday
      .filter((o) => new Date(o.createdAt || Date.now()).toDateString() === todayDate)
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

    const index = todayOrders.findIndex(
      (o) => (order as any).id && (o.id === (order as any).id || o.orderNumber === order.orderNumber)
    );

    if (index >= 0) {
      return `#${String(index + 1).padStart(3, '0')}`;
    }
  }

  const raw = String(order.orderNumber || '').trim();
  if (!raw) return '#001';
  if (/^\d+$/.test(raw)) return `#${String(Number(raw)).padStart(3, '0')}`;
  return `#${raw.replace(/^POS-/, '').slice(-3).toUpperCase()}`;
};
