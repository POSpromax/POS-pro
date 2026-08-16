import type { Order } from '../types/pos';

const INVALID_TIMESTAMP = Number.MAX_SAFE_INTEGER;

const safeTimestamp = (value?: string) => {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : INVALID_TIMESTAMP;
};

/**
 * Canonical FIFO comparator used by POS Queue and Kitchen Monitor.
 * Oldest valid createdAt comes first. Ties are resolved deterministically so
 * two screens always render the same queue order.
 */
export function compareOrdersFifo(a: Order, b: Order): number {
  const aTime = safeTimestamp(a.createdAt);
  const bTime = safeTimestamp(b.createdAt);
  if (aTime !== bTime) return aTime - bTime;

  const byDailyNumber =
    (a.dailyNumber ?? Number.MAX_SAFE_INTEGER) -
    (b.dailyNumber ?? Number.MAX_SAFE_INTEGER);
  if (byDailyNumber !== 0) return byDailyNumber;

  return String(a.orderNumber || a.id).localeCompare(
    String(b.orderNumber || b.id),
    'id-ID',
    { numeric: true, sensitivity: 'base' },
  );
}

export const sortOrdersFifo = (orders: Order[]): Order[] =>
  [...orders].sort(compareOrdersFifo);

/**
 * History view is newest-first, but malformed/missing timestamps stay at the
 * end rather than jumping to the top of the list.
 */
export const sortOrdersNewestFirst = (orders: Order[]): Order[] =>
  [...orders].sort((a, b) => {
    const aTime = safeTimestamp(a.createdAt);
    const bTime = safeTimestamp(b.createdAt);
    if (aTime === INVALID_TIMESTAMP && bTime !== INVALID_TIMESTAMP) return 1;
    if (bTime === INVALID_TIMESTAMP && aTime !== INVALID_TIMESTAMP) return -1;
    if (aTime !== bTime) return bTime - aTime;
    return -compareOrdersFifo(a, b);
  });

export function buildFifoRankMap(orders: Order[]): Map<string, number> {
  return new Map(sortOrdersFifo(orders).map((order, index) => [order.id, index + 1]));
}

export function formatFifoRank(rank: number, total: number): string {
  const width = Math.max(2, String(Math.max(total, 1)).length);
  return String(rank).padStart(width, '0');
}