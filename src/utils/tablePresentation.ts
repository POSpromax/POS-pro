import type { RestaurantTable } from '../types/pos';

export type TableVisualState = 'READY' | 'OCCUPIED' | 'OFF' | 'RESERVED';

export interface TablePresentation {
  state: TableVisualState;
  label: string;
  shortLabel: string;
  isOccupied: boolean;
  isReady: boolean;
  isReserved: boolean;
  selfOrderAvailable: boolean;
  canToggleSelfOrder: boolean;
  cardClass: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * One presentation model for every table surface. activeOrderId / a matching
 * operational order always wins over cached status flags, because a live bill
 * must never be presented as READY/OFF.
 */
export function getTablePresentation(
  table: RestaurantTable,
  hasMatchingActiveOrder = false,
): TablePresentation {
  const isOccupied = Boolean(table.activeOrderId) || hasMatchingActiveOrder || table.status === 'OCCUPIED';
  const isReserved = !isOccupied && table.status === 'RESERVED';
  const isReady = !isOccupied && !isReserved && table.status === 'READY';
  const state: TableVisualState = isOccupied ? 'OCCUPIED' : isReserved ? 'RESERVED' : isReady ? 'READY' : 'OFF';
  const selfOrderAvailable = isReady && table.isSelfOrderEnabled === true;

  if (state === 'OCCUPIED') {
    return {
      state,
      label: 'Terisi / Bill Aktif',
      shortLabel: 'Terisi',
      isOccupied: true,
      isReady: false,
      isReserved: false,
      selfOrderAvailable: false,
      canToggleSelfOrder: false,
      cardClass: 'border-rose-200 bg-rose-50/70',
      badgeClass: 'border-rose-200 bg-rose-100 text-rose-700',
      dotClass: 'bg-rose-500',
    };
  }

  if (state === 'RESERVED') {
    return {
      state,
      label: 'Reserved',
      shortLabel: 'Reserved',
      isOccupied: false,
      isReady: false,
      isReserved: true,
      selfOrderAvailable: false,
      canToggleSelfOrder: true,
      cardClass: 'border-violet-200 bg-violet-50/70',
      badgeClass: 'border-violet-200 bg-violet-100 text-violet-700',
      dotClass: 'bg-violet-500',
    };
  }

  if (state === 'READY') {
    return {
      state,
      label: selfOrderAvailable ? 'Siap · Self-order ON' : 'Siap',
      shortLabel: 'Siap',
      isOccupied: false,
      isReady: true,
      isReserved: false,
      selfOrderAvailable,
      canToggleSelfOrder: true,
      cardClass: 'border-emerald-200 bg-emerald-50/70',
      badgeClass: 'border-emerald-200 bg-emerald-100 text-emerald-700',
      dotClass: 'bg-emerald-500',
    };
  }

  return {
    state: 'OFF',
    label: 'Nonaktif',
    shortLabel: 'Off',
    isOccupied: false,
    isReady: false,
    isReserved: false,
    selfOrderAvailable: false,
    canToggleSelfOrder: true,
    cardClass: 'border-slate-200 bg-white',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
    dotClass: 'bg-slate-300',
  };
}