import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  History,
  MessageSquare,
  Printer,
  RotateCcw,
  Smartphone,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {CategoryType, CondimentGroup, MenuItem, Order, OrderItem, OrderStatus} from '../../types/pos';
import {
  playNewOrderSound,
  playSelfOrderAlertSound,
  playWarningAlarmSound,
} from '../../utils/audioNotification';
import {summarizeCondimentOptions} from '../../utils/condimentUtils';
import {groupKitchenItems} from '../../utils/kitchenGrouping';
import {formatOrderLabel} from '../../utils/orderNumber';
import {buildFifoRankMap, formatFifoRank, sortOrdersFifo, sortOrdersNewestFirst} from '../../utils/orderQueue';
import type {RealtimeConnectionState} from '../../services/orderService';

interface KitchenDisplayViewProps {
  orders: Order[];
  condimentGroups: CondimentGroup[];
  menuItems?: MenuItem[];
  categoryOrder?: CategoryType[];
  runningText?: string;
  outletName: string;
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onPrintKitchenTicket: (order: Order) => void;
  connectionState?: RealtimeConnectionState;
  currentShiftId?: string;
  currentShiftStartedAt?: string;
  soundEnabledByDefault?: boolean;
  newOrderSound?: string;
  selfOrderSound?: string;
  overdueMinutes?: number;
}

type ViewMode = 'ACTIVE' | 'HISTORY';
type FilterType = 'ALL' | 'FOOD' | 'DRINK';

const TAKE_AWAY_NOTE_PATTERN = /\b(bungkus|dibungkus|take\s*away|takeaway|bawa\s*pulang)\b/i;

const formatElapsedCompact = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}j ${rest}m` : `${hours}j`;
};

const timeTone = (minutes: number, overdueMinutes: number) => {
  const safeOverdue = Math.max(1, Number(overdueMinutes) || 5);
  if (minutes >= safeOverdue) {
    return {
      accent: 'bg-[var(--accent-red)]',
      badge: 'ui-badge-danger',
      label: 'Terlambat',
    };
  }
  if (minutes >= Math.max(1, safeOverdue - 2)) {
    return {
      accent: 'bg-[var(--accent-amber)]',
      badge: 'ui-badge-warning',
      label: 'Perhatian',
    };
  }
  return {
    accent: 'bg-[var(--primary)]',
    badge:
      'border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary-text)]',
    label: minutes >= Math.max(1, safeOverdue - 4) ? 'Berjalan' : 'Baru',
  };
};

const DEFAULT_KITCHEN_CATEGORY_ORDER: CategoryType[] = [
  'BAKSO',
  'MIE AYAM',
  'MAKANAN',
  'TAMBAHAN',
  'KRIUK',
  'BUNDLING',
  'MINUMAN',
];

const normalizeKitchenCategory = (value?: string) =>
  String(value || '').trim().toUpperCase();

const normalizeMenuIdentity = (value?: string) =>
  String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');

const normalizeCategoryOrder = (configured?: CategoryType[]): CategoryType[] => {
  const allowed = new Set(DEFAULT_KITCHEN_CATEGORY_ORDER);
  const seen = new Set<string>();
  const result: CategoryType[] = [];
  for (const category of configured || []) {
    const normalized = normalizeKitchenCategory(category) as CategoryType;
    if (!allowed.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  for (const category of DEFAULT_KITCHEN_CATEGORY_ORDER) {
    if (!seen.has(category)) result.push(category);
  }
  return result;
};

type MenuCategoryLookup = {
  byId: Map<string, string>;
  byName: Map<string, string>;
  rankById: Map<string, number>;
  rankByName: Map<string, number>;
};

const resolveKitchenCategory = (item: OrderItem, lookup: MenuCategoryLookup) => {
  const masterCategory =
    lookup.byId.get(String(item.menuId || '')) ||
    lookup.byName.get(normalizeMenuIdentity(item.menuName));
  return normalizeKitchenCategory(masterCategory || item.category);
};

const resolveMenuInventoryRank = (item: OrderItem, lookup: MenuCategoryLookup) => {
  const byId = lookup.rankById.get(String(item.menuId || ''));
  if (typeof byId === 'number') return byId;
  const byName = lookup.rankByName.get(normalizeMenuIdentity(item.menuName));
  return typeof byName === 'number' ? byName : Number.MAX_SAFE_INTEGER;
};

const kitchenCategoryRank = (category: string, categoryOrder: CategoryType[]) => {
  const normalized = normalizeKitchenCategory(category);
  const index = categoryOrder.findIndex((item) => normalizeKitchenCategory(item) === normalized);
  // Unknown/legacy categories stay visible. Put them immediately before MINUMAN
  // so they remain in FOOD without disrupting the configured known-category sequence.
  if (index >= 0) return index;
  const drinkIndex = categoryOrder.findIndex((item) => item === 'MINUMAN');
  return drinkIndex >= 0 ? drinkIndex - 0.5 : categoryOrder.length;
};

const sortKitchenItemsByCategory = (
  items: OrderItem[],
  lookup: MenuCategoryLookup,
  categoryOrder: CategoryType[],
) =>
  items
    .map((item, index) => ({
      item,
      index,
      category: resolveKitchenCategory(item, lookup),
      menuRank: resolveMenuInventoryRank(item, lookup),
    }))
    .sort((left, right) => {
      const categoryDifference =
        kitchenCategoryRank(left.category, categoryOrder) - kitchenCategoryRank(right.category, categoryOrder);
      if (categoryDifference) return categoryDifference;
      const inventoryDifference = left.menuRank - right.menuRank;
      return inventoryDifference || left.index - right.index;
    })
    .map(({item}) => item);

const filterKitchenItems = (
  order: Order,
  filterType: FilterType,
  lookup: MenuCategoryLookup,
  categoryOrder: CategoryType[],
) => {
  const activeItems = order.items.filter(
    (item) => order.status === 'READY' || item.status !== 'DONE',
  );
  const bucketed = filterType === 'ALL'
    ? activeItems
    : activeItems.filter((item) => {
        const isDrink = resolveKitchenCategory(item, lookup) === 'MINUMAN';
        return filterType === 'DRINK' ? isDrink : !isDrink;
      });
  return sortKitchenItemsByCategory(bucketed, lookup, categoryOrder);
};

const isTakeAwayNote = (note?: string) =>
  Boolean(note && TAKE_AWAY_NOTE_PATTERN.test(note));

const totalItemQuantity = (order: Order) =>
  order.items.reduce(
    (sum, item) => sum + Math.max(1, Number(item.quantity) || 1),
    0,
  );

const formatKitchenGroupName = (name: string) => {
  const normalized = String(name || '').trim().toUpperCase();
  if (normalized.includes('KUAH')) return 'KUAH';
  if (normalized.includes('ISIAN')) return 'ISIAN';
  return normalized || 'PILIHAN';
};

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({
  orders,
  condimentGroups,
  menuItems = [],
  categoryOrder,
  runningText = '',
  outletName,
  onUpdateOrderStatus,
  onPrintKitchenTicket,
  connectionState = 'CONNECTING',
  currentShiftId,
  currentShiftStartedAt,
  soundEnabledByDefault = true,
  newOrderSound = 'Kitchen Order',
  selfOrderSound = 'Customer Order',
  overdueMinutes = 5,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('ACTIVE');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(soundEnabledByDefault);
  const [nowMs, setNowMs] = useState(Date.now());
  const previousOrderQuantitiesRef = useRef<Map<string, number> | null>(null);
  const alertedBucketRef = useRef(new Map<string, number>());
  const masonryContainerRef = useRef<HTMLDivElement>(null);
  const [masonryColumnCount, setMasonryColumnCount] = useState(1);
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);

  // Reuse the existing application header instead of rendering a second KDS
  // control panel. This keeps the Kitchen screen one level flatter while
  // preserving HeaderBar logic used by the rest of the application.
  useEffect(() => {
    const host = document.getElementById('app-header-bar');
    if (!host) return;

    const previousInlinePosition = host.style.position;
    const previousInlineOverflow = host.style.overflow;
    if (window.getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }
    host.style.overflow = 'visible';
    setHeaderHost(host);

    return () => {
      setHeaderHost(null);
      host.style.position = previousInlinePosition;
      host.style.overflow = previousInlineOverflow;
    };
  }, []);

  const effectiveCategoryOrder = useMemo(
    () => normalizeCategoryOrder(categoryOrder),
    [categoryOrder],
  );

  const menuCategoryLookup = useMemo<MenuCategoryLookup>(() => {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    const rankById = new Map<string, number>();
    const rankByName = new Map<string, number>();
    menuItems.forEach((menu, index) => {
      if (menu.id) {
        byId.set(String(menu.id), menu.category);
        rankById.set(String(menu.id), index);
      }
      if (menu.name) {
        const normalizedName = normalizeMenuIdentity(menu.name);
        byName.set(normalizedName, menu.category);
        rankByName.set(normalizedName, index);
      }
    });
    return {byId, byName, rankById, rankByName};
  }, [menuItems]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const kitchenOrders = useMemo(
    () => sortOrdersFifo(orders.filter(
      (order) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED',
    )),
    [orders],
  );

  const completedOrders = useMemo(
    () => sortOrdersNewestFirst(orders.filter((order) => order.status === 'COMPLETED')),
    [orders],
  );

  const fifoRankMap = useMemo(() => buildFifoRankMap(kitchenOrders), [kitchenOrders]);

  const visibleActiveOrders = useMemo(
    () =>
      kitchenOrders.filter(
        (order) => filterKitchenItems(order, filterType, menuCategoryLookup, effectiveCategoryOrder).length > 0,
      ),
    [kitchenOrders, filterType, menuCategoryLookup, effectiveCategoryOrder],
  );

  // Dense FIFO lanes: unlike normal CSS Grid, each column stacks its next
  // ticket immediately below the previous one, so a tall ticket never creates
  // an empty horizontal row across the whole Kitchen screen. Distribution is
  // deterministic by FIFO index (1..N), not by card height, so priorities do
  // not visually jump around when condiment/note content changes.
  useEffect(() => {
    if (viewMode !== 'ACTIVE') return;
    const node = masonryContainerRef.current;
    if (!node) return;

    const updateColumnCount = () => {
      const width = node.clientWidth;
      const gap = 5;
      const minColumnWidth = 226;
      const next = Math.min(6, Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap))));
      setMasonryColumnCount((current) => (current === next ? current : next));
    };

    updateColumnCount();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateColumnCount)
      : null;
    observer?.observe(node);
    window.addEventListener('resize', updateColumnCount);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateColumnCount);
    };
  }, [viewMode, visibleActiveOrders.length]);

  const masonryColumns = useMemo(() => {
    // Jumlah kolom mengikuti LEBAR LAYAR (masonryColumnCount), bukan jumlah order.
    // Dulu di-cap ke jumlah order sehingga 1 order → 1 kolom → kartu melebar
    // penuh, lalu mengecil saat order lain masuk. Dengan kolom tetap, kartu
    // punya ukuran baku; kolom yang belum terisi dibiarkan kosong.
    const count = Math.max(1, masonryColumnCount);
    const columns: Order[][] = Array.from({length: count}, () => []);
    visibleActiveOrders.forEach((order, index) => {
      columns[index % count].push(order);
    });
    return columns;
  }, [masonryColumnCount, visibleActiveOrders]);

  useEffect(() => {
    const newOrders = kitchenOrders.filter((order) => order.status === 'NEW');
    const nextQuantities = new Map(
      kitchenOrders.map((order) => [order.id, totalItemQuantity(order)]),
    );
    const added = previousOrderQuantitiesRef.current
      ? newOrders.filter(
          (order) =>
            (nextQuantities.get(order.id) || 0) >
            (previousOrderQuantitiesRef.current?.get(order.id) || 0),
        )
      : [];

    if (soundEnabled && added.length > 0) {
      if (added.some((order) => order.source === 'SELF_ORDER')) {
        playSelfOrderAlertSound(selfOrderSound);
      } else {
        playNewOrderSound(newOrderSound);
      }
    }

    previousOrderQuantitiesRef.current = nextQuantities;
  }, [kitchenOrders, soundEnabled, newOrderSound, selfOrderSound]);

  useEffect(
    () => setSoundEnabled(soundEnabledByDefault),
    [soundEnabledByDefault, outletName],
  );

  const kitchenOrdersRef = useRef(kitchenOrders);
  kitchenOrdersRef.current = kitchenOrders;

  useEffect(() => {
    if (!soundEnabled) return;

    const checkOverdue = () => {
      const activeIds = new Set(
        kitchenOrdersRef.current.map((order) => order.id),
      );
      for (const orderId of alertedBucketRef.current.keys()) {
        if (!activeIds.has(orderId)) alertedBucketRef.current.delete(orderId);
      }

      let shouldAlert = false;
      kitchenOrdersRef.current.forEach((order) => {
        const minutes =
          (Date.now() - new Date(order.createdAt).getTime()) / 60_000;
        if (minutes < Math.max(1, overdueMinutes)) return;

        const escalationBucket = Math.floor((minutes - Math.max(1, overdueMinutes)) / 5);
        if (
          (alertedBucketRef.current.get(order.id) ?? -1) < escalationBucket
        ) {
          alertedBucketRef.current.set(order.id, escalationBucket);
          shouldAlert = true;
        }
      });

      if (shouldAlert) playWarningAlarmSound();
    };

    checkOverdue();
    const alarmTimer = window.setInterval(checkOverdue, 25_000);
    return () => window.clearInterval(alarmTimer);
  }, [soundEnabled, overdueMinutes]);

  const elapsedMinutes = (createdAt: string) =>
    Math.max(
      0,
      Math.floor((nowMs - new Date(createdAt).getTime()) / 60_000),
    );

  const countPortionsForFilter = (type: FilterType) =>
    kitchenOrders.reduce(
      (orderTotal, order) =>
        orderTotal +
        filterKitchenItems(order, type, menuCategoryLookup, effectiveCategoryOrder).reduce(
          (itemTotal, item) => itemTotal + Math.max(1, Number(item.quantity) || 1),
          0,
        ),
      0,
    );

  // Counters intentionally show portions, not ticket count. A mixed ticket may
  // exist in both FOOD and DRINK; portion counters make the three filters
  // visibly distinct and avoid the misleading “Semua 10 / Makanan 10” state.
  const allPortionCount = useMemo(
    () => countPortionsForFilter('ALL'),
    [kitchenOrders, menuCategoryLookup, effectiveCategoryOrder],
  );
  const foodPortionCount = useMemo(
    () => countPortionsForFilter('FOOD'),
    [kitchenOrders, menuCategoryLookup, effectiveCategoryOrder],
  );
  const drinkPortionCount = useMemo(
    () => countPortionsForFilter('DRINK'),
    [kitchenOrders, menuCategoryLookup, effectiveCategoryOrder],
  );

  const headerToolbar = (
    <div
      className="pointer-events-none absolute inset-y-1.5 z-10 hidden items-center md:flex"
      style={{
        left: 'clamp(240px, 24vw, 320px)',
        right: 'clamp(145px, 14vw, 190px)',
      }}
    >
      <div className="pointer-events-auto flex h-full min-w-0 flex-1 items-center gap-1.5">
        <div className="hidden min-w-0 items-center gap-1.5 lg:flex">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
            <Utensils className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-none">
            <p className="truncate text-[11px] font-black text-slate-950">Kitchen Monitor</p>
            <p className="mt-1 flex items-center gap-1 truncate text-[8px] font-bold text-slate-500">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  connectionState === 'HEALTHY'
                    ? 'bg-emerald-500'
                    : connectionState === 'DEGRADED'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                }`}
              />
              {connectionState === 'HEALTHY' ? 'Realtime' : connectionState === 'DEGRADED' ? 'Cadangan' : 'Menghubungkan'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('ACTIVE')}
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-[9px] font-black transition ${
              viewMode === 'ACTIVE' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Flame className="h-3 w-3" /> Aktif {kitchenOrders.length}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('HISTORY')}
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-[9px] font-black transition ${
              viewMode === 'HISTORY' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
            }`}
          >
            <History className="h-3 w-3" /> Selesai {completedOrders.length}
          </button>
        </div>

        <div
          className="flex min-w-0 shrink rounded-lg border border-slate-200 bg-slate-100 p-0.5"
          aria-label="Filter Kitchen semua, makanan, atau minuman"
        >
          {[
            ['ALL', 'Semua', allPortionCount, 'bg-slate-900'],
            ['FOOD', 'Makanan', foodPortionCount, 'bg-emerald-600'],
            ['DRINK', 'Minuman', drinkPortionCount, 'bg-sky-500'],
          ].map(([value, label, count, dotClass]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setFilterType(value as FilterType)}
              className={`flex h-7 min-w-0 items-center gap-1 rounded-md px-2 text-[9px] font-black transition ${
                filterType === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
              }`}
              title={`${label}: ${count} porsi aktif`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
              <span className="hidden xl:inline">{label}</span>
              <span className="tabular-nums text-[8px] opacity-70">{count}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setSoundEnabled((enabled) => !enabled);
            if (!soundEnabled) playNewOrderSound();
          }}
          className={`ml-auto flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-[9px] font-black transition ${
            soundEnabled
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-500'
          }`}
          title={soundEnabled ? 'Matikan suara Kitchen' : 'Aktifkan suara Kitchen'}
        >
          {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          <span className="hidden 2xl:inline">{soundEnabled ? 'Suara' : 'Mute'}</span>
        </button>
        <button
          type="button"
          onClick={() => playNewOrderSound()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          aria-label="Tes suara Kitchen"
          title="Tes suara Kitchen"
        >
          <Bell className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="ui-surface flex-1 overflow-y-auto p-2 font-sans text-[var(--text-primary)] md:p-2.5">
      {headerHost ? createPortal(headerToolbar, headerHost) : null}

      {runningText.trim() && (
        <div
          className="sticky top-0 z-20 mb-1.5 overflow-hidden rounded-lg border border-orange-200 bg-orange-50/95 px-2.5 py-1 shadow-sm backdrop-blur"
          aria-label="Informasi dapur berjalan"
        >
          <style>{`@keyframes kdsTickerMove { from { transform: translateX(100%); } to { transform: translateX(-100%); } }`}</style>
          <div
            className="w-max min-w-full whitespace-nowrap text-[9px] font-black uppercase tracking-[0.04em] text-orange-800 motion-reduce:transform-none motion-reduce:text-center"
            style={{animation: 'kdsTickerMove 22s linear infinite'}}
          >
            {runningText.trim()}
          </div>
        </div>
      )}

      {viewMode === 'ACTIVE' &&
        (kitchenOrders.length === 0 ? (
          <div className="ui-card flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
            <Utensils className="mb-3 h-12 w-12 text-[var(--text-tertiary)]" />
            <p className="font-bold">Belum ada antrean dapur</p>
            <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
              Pesanan Kasir dan Self Order akan muncul otomatis.
            </p>
          </div>
        ) : visibleActiveOrders.length === 0 ? (
          <div className="ui-card flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
            <Filter className="mb-3 h-10 w-10 text-[var(--text-tertiary)]" />
            <p className="font-bold">Tidak ada item pada filter ini</p>
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className="mt-3 rounded-xl bg-[var(--primary-soft)] px-4 py-2 text-xs font-bold text-[var(--primary-text)]"
            >
              Tampilkan Semua
            </button>
          </div>
        ) : (
          <div
            ref={masonryContainerRef}
            className="grid items-start gap-[5px]"
            style={{gridTemplateColumns: `repeat(${Math.max(1, masonryColumns.length)}, minmax(0, 1fr))`}}
          >
            {masonryColumns.map((column, columnIndex) => (
              <div key={`fifo-lane-${columnIndex}`} className="flex min-w-0 flex-col gap-[5px]">
                {column.map((order) => {
              const elapsed = elapsedMinutes(order.createdAt);
              const tone = timeTone(elapsed, overdueMinutes);
              const visibleItems = filterKitchenItems(order, filterType, menuCategoryLookup, effectiveCategoryOrder);
              const productGroups = groupKitchenItems(visibleItems);
              const isNew = order.status === 'NEW';
              const nextStatus: OrderStatus = isNew ? 'COOKING' : 'COMPLETED';
              const originShiftId = order.createdShiftId || order.shiftId;
              const isCarryOver = Boolean(
                currentShiftId &&
                  originShiftId &&
                  originShiftId !== currentShiftId &&
                  currentShiftStartedAt &&
                  new Date(order.createdAt).getTime() <
                    new Date(currentShiftStartedAt).getTime(),
              );
              const orderIsTakeAway = order.type === 'TAKE_AWAY';
              const fifoRank = fifoRankMap.get(order.id) || 0;
              const fifoLabel = formatFifoRank(fifoRank, kitchenOrders.length);

              return (
                <article
                  key={order.id}
                  className="relative overflow-hidden rounded-lg border-2 border-slate-400 bg-white shadow-[0_2px_7px_rgba(15,23,42,.09)]"
                >
                  <div className={`absolute inset-x-0 top-0 h-[3px] ${tone.accent}`} />

                  <div className="border-b border-slate-300 bg-slate-100/95 px-2 pb-1.5 pt-2">
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="inline-flex shrink-0 items-center rounded-md bg-slate-950 px-1.5 py-1 font-mono text-[10px] font-black tracking-wide text-white">
                        FIFO {fifoLabel}
                      </span>
                      <span
                        className="truncate font-mono text-[13px] font-black leading-none tabular-nums tracking-tight text-slate-950"
                        title={order.orderNumber}
                      >
                        {formatOrderLabel(order, orders)}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[7px] font-black uppercase text-slate-600">
                        {order.source === 'SELF_ORDER' ? <><Smartphone className="h-2.5 w-2.5" /> SELF</> : 'KASIR'}
                      </span>

                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <span className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-[9px] font-black text-slate-700 shadow-sm">
                          {orderIsTakeAway ? 'TA' : `MEJA ${order.tableNumber || '-'}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => onPrintKitchenTicket(order)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
                          aria-label={`Cetak tiket ${formatOrderLabel(order, orders)}`}
                          title="Cetak tiket dapur"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-black leading-tight text-slate-950">
                        {order.customerName || 'Guest'}
                      </span>
                      <span className="shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[7px] font-black uppercase text-slate-500">
                        {visibleItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0)} PORSI
                      </span>
                      <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[8px] font-black ${tone.badge}`}>
                        <Clock className="h-2.5 w-2.5" /> {formatElapsedCompact(elapsed)} · {tone.label}
                      </span>
                      <span className="shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[7px] font-black uppercase text-slate-600">
                        {orderIsTakeAway ? 'TAKE AWAY' : 'DINE IN'}
                      </span>
                      {isCarryOver && (
                        <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[7px] font-black uppercase text-amber-700">SHIFT LALU</span>
                      )}
                    </div>
                  </div>

                  <div className="p-1.5">
                    {order.notes && (
                      <div className="flex items-start gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-[9px] font-bold leading-snug text-slate-800">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                        <span>{order.notes}</span>
                      </div>
                    )}

                    <div className="mt-1 overflow-hidden rounded-md border border-slate-300 bg-white divide-y divide-slate-200">
                      {productGroups.map((product) => (
                        <section
                          key={product.key}
                          className="bg-white px-2 py-1.5"
                        >
                          <div className="flex items-start gap-2">
                            <h2 className="min-w-0 flex-1 text-[12.5px] font-black leading-tight tracking-[-.01em] text-slate-950">
                              {product.menuName}
                            </h2>
                            {product.modifierGroups.length > 1 && (
                              <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-1 text-[8px] font-black uppercase tracking-wide text-amber-800">
                                {product.modifierGroups.length} racikan
                              </span>
                            )}
                            <span className="flex h-6 min-w-7 shrink-0 items-center justify-center rounded-md bg-slate-950 px-1.5 text-[10px] font-black text-white">
                              ×{product.totalQuantity}
                            </span>
                          </div>

                          <div className="mt-0.5 space-y-0.5">
                            {product.modifierGroups.map((subgroup, index) => {
                              const hasDetails =
                                subgroup.selectedCondiments.length > 0 ||
                                Boolean(subgroup.note);
                              const takeawayItem = isTakeAwayNote(subgroup.note);

                              return (
                                <div
                                  key={subgroup.key}
                                  className={`${
                                    index
                                      ? 'border-t border-dashed border-slate-200 pt-1'
                                      : ''
                                  }`}
                                >
                                  {(product.modifierGroups.length > 1 || subgroup.quantity !== product.totalQuantity || takeawayItem) && (
                                    <div className="mb-0.5 flex items-center justify-between gap-1.5">
                                      <span className="text-[8px] font-black text-[var(--primary)]">
                                        {product.modifierGroups.length > 1
                                          ? `RACIKAN ${index + 1} · ×${subgroup.quantity}`
                                          : `×${subgroup.quantity}`}
                                      </span>
                                      {takeawayItem && (
                                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-black text-amber-800">
                                          BUNGKUS
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {subgroup.selectedCondiments.length > 0 && (
                                    <div className="space-y-0.5">
                                      {subgroup.selectedCondiments.map((group) => (
                                        <div
                                          key={`${subgroup.key}-${group.groupName}`}
                                          className="grid grid-cols-[42px_1fr] gap-1 text-[9px] leading-snug"
                                        >
                                          <span className="font-extrabold uppercase tracking-wide text-[var(--text-tertiary)]">
                                            {formatKitchenGroupName(group.groupName)}
                                          </span>
                                          <span className="font-extrabold text-[var(--text-primary)]">
                                            {summarizeCondimentOptions(
                                              group,
                                              condimentGroups,
                                            )}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {subgroup.note && (
                                    <div
                                      className={`mt-1 flex items-start gap-1 rounded-md border px-1.5 py-1 text-[9px] font-extrabold leading-snug ${
                                        takeawayItem
                                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                                          : 'border-rose-200 bg-rose-50 text-rose-800'
                                      }`}
                                    >
                                      {takeawayItem ? (
                                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                      ) : (
                                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                      )}
                                      <span>{subgroup.note}</span>
                                    </div>
                                  )}

                                  {!hasDetails && (
                                    <p className="text-[8px] font-semibold text-[var(--text-tertiary)]">
                                      Standar
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, nextStatus)}
                      className={`flex min-h-8 w-full items-center justify-center gap-1.5 rounded-md px-2.5 text-[10px] font-black text-white transition active:scale-[0.99] ${
                        isNew
                          ? 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]'
                          : 'bg-[var(--accent-green)] hover:opacity-90'
                      }`}
                    >
                      {isNew ? (
                        <>
                          <Flame className="h-4 w-4" /> Terima &amp; mulai
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Selesai dapur
                        </>
                      )}
                    </button>
                  </div>
                </article>
                  );
                })}
              </div>
            ))}
          </div>
        ))}

      {viewMode === 'HISTORY' && (
        <div className="space-y-3">
          <div className="ui-card flex items-center justify-between p-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <History className="h-4 w-4 text-[var(--accent-green)]" />
                Riwayat selesai
              </h2>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                Riwayat shift berjalan. Kembalikan hanya jika tiket salah
                ditandai selesai.
              </p>
            </div>
            <span className="ui-badge ui-badge-success">
              {completedOrders.length} selesai
            </span>
          </div>

          {completedOrders.length === 0 ? (
            <div className="ui-card py-20 text-center text-xs font-bold text-[var(--text-secondary)]">
              Belum ada pesanan selesai.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
              {completedOrders.map((order) => (
                <article key={order.id} className="ui-card p-3.5">
                  <div className="flex items-start justify-between gap-2 border-b border-[var(--panel-border-light)] pb-2.5">
                    <div>
                      <span className="font-mono text-lg font-black">
                        {formatOrderLabel(order, orders)}
                      </span>
                      <p className="mt-1 text-[10px] font-bold text-[var(--text-secondary)]">
                        {order.type === 'DINE_IN'
                          ? `Meja ${order.tableNumber || '-'}`
                          : 'Take Away'}
                        {' · '}
                        {order.customerName || 'Guest'}
                      </p>
                    </div>
                    <span className="ui-badge ui-badge-success">
                      <Check className="h-3 w-3" /> Selesai
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1.5">
                    {groupKitchenItems(sortKitchenItemsByCategory(order.items, menuCategoryLookup, effectiveCategoryOrder)).map((item) => (
                      <div
                        key={item.key}
                        className="flex justify-between gap-3 text-[11px] font-bold"
                      >
                        <span className="line-clamp-2">{item.menuName}</span>
                        <span className="shrink-0">×{item.totalQuantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2 border-t border-[var(--panel-border-light)] pt-2.5">
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, 'COOKING')}
                      className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--warning-soft)] px-2 text-[11px] font-bold text-[var(--accent-amber)]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Kembalikan
                    </button>
                    <button
                      type="button"
                      onClick={() => onPrintKitchenTicket(order)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--panel-border)]"
                      aria-label={`Cetak ulang ${formatOrderLabel(order, orders)}`}
                      title="Cetak ulang"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
