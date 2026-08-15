import React, {useEffect, useMemo, useRef, useState} from 'react';
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
import {CondimentGroup, Order, OrderStatus} from '../../types/pos';
import {
  playNewOrderSound,
  playSelfOrderAlertSound,
  playWarningAlarmSound,
} from '../../utils/audioNotification';
import {summarizeCondimentOptions} from '../../utils/condimentUtils';
import {groupKitchenItems} from '../../utils/kitchenGrouping';
import {formatOrderLabel} from '../../utils/orderNumber';
import type {RealtimeConnectionState} from '../../services/orderService';

interface KitchenDisplayViewProps {
  orders: Order[];
  condimentGroups: CondimentGroup[];
  outletName: string;
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onPrintKitchenTicket: (order: Order) => void;
  connectionState?: RealtimeConnectionState;
  currentShiftId?: string;
  currentShiftStartedAt?: string;
  soundEnabledByDefault?: boolean;
  newOrderSound?: string;
  selfOrderSound?: string;
}

type ViewMode = 'ACTIVE' | 'HISTORY';
type FilterType = 'SEMUA' | 'FOOD' | 'DRINK';

const TAKE_AWAY_NOTE_PATTERN = /\b(bungkus|dibungkus|take\s*away|takeaway|bawa\s*pulang)\b/i;

const LiveClock = () => {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('id-ID'),
  );

  useEffect(() => {
    const timer = window.setInterval(
      () => setTime(new Date().toLocaleTimeString('id-ID')),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="font-mono text-sm font-extrabold tabular-nums text-[var(--text-primary)]">
      {time}
    </span>
  );
};

const timeTone = (minutes: number) => {
  if (minutes > 15) {
    return {
      accent: 'bg-[var(--accent-red)]',
      badge: 'ui-badge-danger',
      label: 'Terlambat',
    };
  }
  if (minutes >= 10) {
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
    label: minutes >= 5 ? 'Berjalan' : 'Baru',
  };
};

const filterKitchenItems = (order: Order, filterType: FilterType) =>
  order.items.filter(
    (item) =>
      (order.status === 'READY' || item.status !== 'DONE') &&
      (filterType === 'SEMUA' ||
        (filterType === 'FOOD'
          ? item.category !== 'MINUMAN'
          : item.category === 'MINUMAN')),
  );

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
  outletName,
  onUpdateOrderStatus,
  onPrintKitchenTicket,
  connectionState = 'CONNECTING',
  currentShiftId,
  currentShiftStartedAt,
  soundEnabledByDefault = true,
  newOrderSound = 'Kitchen Order',
  selfOrderSound = 'Customer Order',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('ACTIVE');
  const [filterType, setFilterType] = useState<FilterType>('SEMUA');
  const [soundEnabled, setSoundEnabled] = useState(soundEnabledByDefault);
  const [nowMs, setNowMs] = useState(Date.now());
  const previousOrderQuantitiesRef = useRef<Map<string, number> | null>(null);
  const alertedBucketRef = useRef(new Map<string, number>());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const kitchenOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED',
      ),
    [orders],
  );

  const completedOrders = useMemo(
    () =>
      orders
        .filter((order) => order.status === 'COMPLETED')
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [orders],
  );

  const visibleActiveOrders = useMemo(
    () =>
      kitchenOrders.filter(
        (order) => filterKitchenItems(order, filterType).length > 0,
      ),
    [kitchenOrders, filterType],
  );

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
        if (minutes <= 15) return;

        const escalationBucket = Math.floor(minutes / 5);
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
  }, [soundEnabled]);

  const elapsedMinutes = (createdAt: string) =>
    Math.max(
      0,
      Math.floor((nowMs - new Date(createdAt).getTime()) / 60_000),
    );

  return (
    <div className="ui-surface flex-1 overflow-y-auto p-3 font-sans text-[var(--text-primary)] md:p-4">
      <header className="sticky top-0 z-20 mb-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)]/96 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
              <Utensils className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight">
                Kitchen Monitor
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-secondary)]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    connectionState === 'HEALTHY'
                      ? 'bg-[var(--accent-green)]'
                      : connectionState === 'DEGRADED'
                        ? 'bg-[var(--accent-amber)]'
                        : 'bg-[var(--text-tertiary)]'
                  }`}
                />
                {connectionState === 'HEALTHY'
                  ? 'Realtime aktif'
                  : connectionState === 'DEGRADED'
                    ? 'Sinkronisasi cadangan'
                    : 'Menghubungkan'}
                <span className="text-[var(--text-tertiary)]">·</span>
                {outletName}
              </p>
            </div>
          </div>

          <div className="flex rounded-xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('ACTIVE')}
              className={`flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition ${
                viewMode === 'ACTIVE'
                  ? 'bg-white text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Flame className="h-3.5 w-3.5" /> Aktif ({kitchenOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('HISTORY')}
              className={`flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition ${
                viewMode === 'HISTORY'
                  ? 'bg-white text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <History className="h-3.5 w-3.5" /> Selesai (
              {completedOrders.length})
            </button>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex min-h-9 items-center gap-2 rounded-xl border border-[var(--panel-border)] bg-white px-2.5 text-[11px] font-bold text-[var(--text-secondary)]">
              <Filter className="h-3.5 w-3.5 text-[var(--primary)]" />
              <select
                value={filterType}
                onChange={(event) =>
                  setFilterType(event.target.value as FilterType)
                }
                className="bg-transparent outline-none"
                aria-label="Filter kategori Kitchen"
              >
                <option value="SEMUA">Semua menu</option>
                <option value="FOOD">Makanan</option>
                <option value="DRINK">Minuman</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setSoundEnabled((enabled) => !enabled);
                if (!soundEnabled) playNewOrderSound();
              }}
              className={`flex min-h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold ${
                soundEnabled
                  ? 'border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary-text)]'
                  : 'border-[var(--panel-border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
              }`}
              aria-label={
                soundEnabled ? 'Matikan suara Kitchen' : 'Aktifkan suara Kitchen'
              }
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
              {soundEnabled ? 'Suara aktif' : 'Suara mati'}
            </button>

            <button
              type="button"
              onClick={() => playNewOrderSound()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
              aria-label="Tes suara notifikasi"
              title="Tes suara notifikasi"
            >
              <Bell className="h-4 w-4" />
            </button>
            <LiveClock />
          </div>
        </div>
      </header>

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
              onClick={() => setFilterType('SEMUA')}
              className="mt-3 rounded-xl bg-[var(--primary-soft)] px-4 py-2 text-xs font-bold text-[var(--primary-text)]"
            >
              Tampilkan semua
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] items-start gap-3">
            {visibleActiveOrders.map((order) => {
              const elapsed = elapsedMinutes(order.createdAt);
              const tone = timeTone(elapsed);
              const visibleItems = filterKitchenItems(order, filterType);
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

              return (
                <article
                  key={order.id}
                  className="relative overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] shadow-sm"
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${tone.accent}`} />

                  <div className="p-3.5 pb-3">
                    <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-border-light)] pb-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="font-mono text-[22px] font-black leading-none tabular-nums tracking-tight"
                            title={order.orderNumber}
                          >
                            {formatOrderLabel(order, orders)}
                          </span>
                          <span className="rounded-full border border-[var(--panel-border)] bg-[var(--surface-secondary)] px-2 py-1 text-[9px] font-extrabold uppercase text-[var(--text-secondary)]">
                            {order.source === 'SELF_ORDER' ? (
                              <span className="inline-flex items-center gap-1">
                                <Smartphone className="h-3 w-3" /> Self Order
                              </span>
                            ) : (
                              'Kasir'
                            )}
                          </span>
                          {isCarryOver && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-extrabold text-amber-700">
                              Shift lalu
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-[var(--text-secondary)]">
                          <span>{order.customerName || 'Guest'}</span>
                          <span className="text-[var(--text-tertiary)]">·</span>
                          <span>{totalItemQuantity(order)} item</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-start gap-1.5">
                        <div className="min-w-[66px] rounded-xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] px-2.5 py-2 text-center">
                          <p className="text-[8px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">
                            {orderIsTakeAway ? 'Tipe' : 'Meja'}
                          </p>
                          <p className="mt-0.5 text-[18px] font-black leading-none text-[var(--text-primary)]">
                            {orderIsTakeAway ? 'TA' : order.tableNumber || '-'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onPrintKitchenTicket(order)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
                          aria-label={`Cetak tiket ${formatOrderLabel(order, orders)}`}
                          title="Cetak tiket dapur"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className={`ui-badge ${tone.badge}`}>
                        <Clock className="h-3 w-3" /> {elapsed} menit · {tone.label}
                      </span>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)]">
                        {orderIsTakeAway ? 'Take Away' : 'Dine In'}
                      </span>
                    </div>

                    {order.notes && (
                      <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] px-3 py-2.5 text-[11px] font-bold leading-snug text-[var(--text-primary)]">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                        <span>{order.notes}</span>
                      </div>
                    )}

                    <div className="mt-3 space-y-2.5">
                      {productGroups.map((product) => (
                        <section
                          key={product.key}
                          className="rounded-xl border border-[var(--panel-border)] bg-white p-3"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--text-primary)] px-2 text-[12px] font-black text-white">
                              ×{product.totalQuantity}
                            </span>
                            <h2 className="min-w-0 flex-1 text-[14px] font-black leading-snug tracking-[-.01em] text-[var(--text-primary)]">
                              {product.menuName}
                            </h2>
                          </div>

                          <div className="mt-2.5 space-y-2">
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
                                      ? 'border-t border-dashed border-[var(--panel-border)] pt-2.5'
                                      : ''
                                  }`}
                                >
                                  <div className="mb-1.5 flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-black text-[var(--primary)]">
                                      Porsi ×{subgroup.quantity}
                                    </span>
                                    {takeawayItem && (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-800">
                                        BUNGKUS
                                      </span>
                                    )}
                                  </div>

                                  {subgroup.selectedCondiments.length > 0 && (
                                    <div className="space-y-1.5">
                                      {subgroup.selectedCondiments.map((group) => (
                                        <div
                                          key={`${subgroup.key}-${group.groupName}`}
                                          className="grid grid-cols-[58px_1fr] gap-2 text-[11px] leading-snug"
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
                                      className={`mt-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-extrabold leading-snug ${
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
                                    <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">
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

                  <div className="border-t border-[var(--panel-border)] bg-[var(--surface-secondary)] p-2.5">
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, nextStatus)}
                      className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-[12px] font-extrabold text-white transition active:scale-[0.99] ${
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
                    {groupKitchenItems(order.items).map((item) => (
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