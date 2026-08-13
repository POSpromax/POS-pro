import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  History,
  Printer,
  RotateCcw,
  Sparkles,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CondimentGroup, Order, OrderStatus } from '../../types/pos';
import { playNewOrderSound, playWarningAlarmSound } from '../../utils/audioNotification';
import { summarizeCondimentOptions } from '../../utils/condimentUtils';
import { groupKitchenItems } from '../../utils/kitchenGrouping';
import { formatOrderLabel } from '../../utils/orderNumber';
import type { RealtimeConnectionState } from '../../services/orderService';

interface KitchenDisplayViewProps {
  orders: Order[];
  condimentGroups: CondimentGroup[];
  outletName: string;
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onPrintKitchenTicket: (order: Order) => void;
  connectionState?: RealtimeConnectionState;
}

type ViewMode = 'ACTIVE' | 'HISTORY';
type FilterType = 'SEMUA' | 'FOOD' | 'DRINK';

const LiveClock = () => {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('id-ID'));
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date().toLocaleTimeString('id-ID')), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="font-mono text-base font-bold tabular-nums text-[var(--text-primary)]">{time}</span>;
};

const timeTone = (minutes: number) => {
  if (minutes > 15) return { accent: 'bg-[var(--accent-red)]', badge: 'ui-badge-danger', label: 'Terlambat' };
  if (minutes >= 10) return { accent: 'bg-[var(--accent-amber)]', badge: 'ui-badge-warning', label: 'Perhatian' };
  if (minutes >= 5) return { accent: 'bg-[var(--accent-green)]', badge: 'ui-badge-success', label: 'Berjalan' };
  return { accent: 'bg-[var(--primary)]', badge: 'border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary-text)]', label: 'Baru' };
};

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({
  orders,
  condimentGroups,
  outletName,
  onUpdateOrderStatus,
  onPrintKitchenTicket,
  connectionState = 'CONNECTING',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('ACTIVE');
  const [filterType, setFilterType] = useState<FilterType>('SEMUA');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());
  const previousNewCountRef = useRef<number | null>(null);
  const alertedBucketRef = useRef(new Map<string, number>());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const kitchenOrders = useMemo(
    () => orders.filter((order) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED'),
    [orders],
  );
  // `orders` sudah dibatasi ke shift berjalan dari App, jadi riwayat dapur ikut
  // reset 0 tiap buka shift baru. Riwayat lengkap lintas shift ada di Laporan.
  const completedOrders = useMemo(
    () => orders
      .filter((order) => order.status === 'COMPLETED')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders],
  );

  useEffect(() => {
    const count = kitchenOrders.filter((order) => order.status === 'NEW').length;
    if (previousNewCountRef.current !== null && soundEnabled && count > previousNewCountRef.current) playNewOrderSound();
    previousNewCountRef.current = count;
  }, [kitchenOrders, soundEnabled]);

  const kitchenOrdersRef = useRef(kitchenOrders);
  kitchenOrdersRef.current = kitchenOrders;

  useEffect(() => {
    if (!soundEnabled) return;
    const checkOverdue = () => {
      const activeIds = new Set(kitchenOrdersRef.current.map((order) => order.id));
      for (const orderId of alertedBucketRef.current.keys()) {
        if (!activeIds.has(orderId)) alertedBucketRef.current.delete(orderId);
      }

      let shouldAlert = false;
      kitchenOrdersRef.current.forEach((order) => {
        const minutes = (Date.now() - new Date(order.createdAt).getTime()) / 60_000;
        if (minutes <= 15) return;
        const escalationBucket = Math.floor(minutes / 5);
        if ((alertedBucketRef.current.get(order.id) ?? -1) < escalationBucket) {
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

  const elapsedMinutes = (createdAt: string) => Math.max(0, Math.floor((nowMs - new Date(createdAt).getTime()) / 60_000));

  return (
    <div className="ui-surface flex-1 overflow-y-auto p-3 font-sans text-[var(--text-primary)] md:p-4">
      <header className="sticky top-0 z-20 mb-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)]/95 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
              <Utensils className="h-5 w-5 stroke-[1.9]" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Kitchen Display</h1>
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
                <span className={`h-2 w-2 rounded-full ${connectionState === 'HEALTHY' ? 'bg-[var(--accent-green)]' : connectionState === 'DEGRADED' ? 'bg-[var(--accent-amber)]' : 'bg-[var(--text-tertiary)]'}`} />
                {kitchenOrders.length} antrean · {connectionState === 'HEALTHY' ? 'realtime' : connectionState === 'DEGRADED' ? 'sinkronisasi cadangan' : 'menghubungkan'}
              </p>
            </div>
          </div>

          <div className="flex rounded-xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-1">
            <button type="button" onClick={() => setViewMode('ACTIVE')} className={`flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition ${viewMode === 'ACTIVE' ? 'bg-white text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
              <Flame className="h-3.5 w-3.5" /> Aktif ({kitchenOrders.length})
            </button>
            <button type="button" onClick={() => setViewMode('HISTORY')} className={`flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition ${viewMode === 'HISTORY' ? 'bg-white text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
              <History className="h-3.5 w-3.5" /> Selesai ({completedOrders.length})
            </button>
          </div>

          {/* Running Ticker / Info Announcement Ticker Bar ONLY on Kitchen Display */}
          <div className="hidden lg:flex items-center gap-2 overflow-hidden rounded-full bg-[#ECFDF5] border border-[#A7F3D0] px-3.5 py-1.5 text-xs font-extrabold text-[#047857] max-w-[240px] xl:max-w-[340px] shrink-0 shadow-2xs">
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-[#047857] animate-pulse" />
            <p className="truncate whitespace-nowrap text-xs font-extrabold text-[#047857] select-none">
              KDS aktif · Pesanan dapur tersinkron · {outletName}
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex min-h-9 items-center gap-2 rounded-xl border border-[var(--panel-border)] bg-white px-2.5 text-[11px] font-bold text-[var(--text-secondary)]">
              <Filter className="h-3.5 w-3.5 text-[var(--primary)]" />
              <select value={filterType} onChange={(event) => setFilterType(event.target.value as FilterType)} className="bg-transparent outline-none" aria-label="Filter kategori Kitchen">
                <option value="SEMUA">Semua menu</option>
                <option value="FOOD">Makanan</option>
                <option value="DRINK">Minuman</option>
              </select>
            </label>
            <button type="button" onClick={() => { setSoundEnabled((enabled) => !enabled); if (!soundEnabled) playNewOrderSound(); }} className={`flex min-h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold ${soundEnabled ? 'border-[var(--accent-green)] bg-[var(--success-soft)] text-[var(--accent-green)]' : 'border-[var(--panel-border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'}`} aria-label={soundEnabled ? 'Matikan suara Kitchen' : 'Aktifkan suara Kitchen'}>
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {soundEnabled ? 'Suara aktif' : 'Suara mati'}
            </button>
            <button type="button" onClick={playNewOrderSound} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]" aria-label="Tes suara notifikasi" title="Tes suara notifikasi">
              <Bell className="h-4 w-4" />
            </button>
            <LiveClock />
          </div>
        </div>
      </header>

      {viewMode === 'ACTIVE' && (
        kitchenOrders.length === 0 ? (
          <div className="ui-card flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
            <Utensils className="mb-3 h-12 w-12 text-[var(--text-tertiary)]" />
            <p className="font-bold">Belum ada antrean dapur</p>
            <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">Pesanan Kasir dan Self-order akan muncul otomatis.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {kitchenOrders.map((order) => {
              const elapsed = elapsedMinutes(order.createdAt);
              const tone = timeTone(elapsed);
              const visibleItems = order.items.filter((item) => (
                (order.status === 'READY' || item.status !== 'DONE') &&
                (filterType === 'SEMUA' || (filterType === 'FOOD' ? item.category !== 'MINUMAN' : item.category === 'MINUMAN'))
              ));
              const productGroups = groupKitchenItems(visibleItems);
              const isNew = order.status === 'NEW';
              const isReady = order.status === 'READY';
              const nextStatus: OrderStatus = isNew ? 'COOKING' : isReady ? 'COMPLETED' : 'READY';

              return (
                <article key={order.id} className="ui-card relative overflow-hidden">
                  <div className={`absolute inset-x-0 top-0 h-1 ${tone.accent}`} />
                  <div className="p-3 pb-2">
                    <div className="flex items-start justify-between gap-2 border-b border-[var(--panel-border-light)] pb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xl font-bold tabular-nums" title={order.orderNumber}>{formatOrderLabel(order, orders)}</span>
                          <span className="ui-badge bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] font-extrabold text-[10px]">{order.type === 'DINE_IN' ? 'Dine in' : 'Take away'}</span>
                        </div>
                        <p className="mt-1 truncate text-xs font-extrabold text-[#111827]">
                          {order.customerName || 'Guest'} · <span className="text-[#047857] font-black">Meja {order.tableNumber || '-'}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => onPrintKitchenTicket(order)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]" aria-label={`Cetak tiket ${formatOrderLabel(order, orders)}`} title="Cetak tiket dapur"><Printer className="h-3.5 w-3.5" /></button>
                        <span className={`ui-badge ${tone.badge}`}><Clock className="h-3 w-3" />{elapsed}m</span>
                      </div>
                    </div>

                    <div className="mt-2.5 space-y-2">
                      {productGroups.map((product) => (
                        <section key={product.key} className="rounded-xl border border-[var(--panel-border-light)] bg-white p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="text-[12px] font-bold leading-snug text-[var(--text-primary)]">{product.menuName}</h2>
                            <span className="shrink-0 rounded-lg bg-[var(--primary)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-inverse)]">×{product.totalQuantity}</span>
                          </div>
                          <div className="mt-1.5 space-y-1.5">
                            {product.modifierGroups.map((subgroup, index) => {
                              const hasDetails = subgroup.selectedCondiments.length > 0 || subgroup.note;
                              return (
                                <div key={subgroup.key} className={`${index ? 'border-t border-dashed border-[var(--panel-border)] pt-1.5' : ''} flex items-start gap-1.5 text-[11px]`}>
                                  <span className="shrink-0 font-bold text-[var(--primary-hover)]">×{subgroup.quantity}</span>
                                  <div className="min-w-0 flex-1">
                                    {subgroup.selectedCondiments.map((group) => (
                                      <p key={`${subgroup.key}-${group.groupName}`} className="font-semibold leading-snug text-[var(--text-secondary)]"><span className="text-[var(--text-tertiary)]">{group.groupName}:</span> {summarizeCondimentOptions(group, condimentGroups)}</p>
                                    ))}
                                    {subgroup.note && <p className="mt-0.5 font-bold leading-snug text-[var(--accent-red)]">Catatan: {subgroup.note}</p>}
                                    {!hasDetails && <p className="font-semibold text-[var(--text-tertiary)]">Standar</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[var(--panel-border)] bg-[var(--surface-main)] p-2">
                    <button type="button" onClick={() => onUpdateOrderStatus(order.id, nextStatus)} className={`flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-bold text-[var(--text-inverse)] transition active:scale-[0.99] ${isNew ? 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]' : 'bg-[var(--accent-green)] hover:opacity-90'}`}>
                      {isNew
                        ? <><Flame className="h-3.5 w-3.5" /> Mulai masak</>
                        : isReady
                          ? <><CheckCircle2 className="h-3.5 w-3.5" /> Selesai disajikan</>
                          : <><CheckCircle2 className="h-3.5 w-3.5" /> Siap disajikan</>}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {viewMode === 'HISTORY' && (
        <div className="space-y-3">
          <div className="ui-card flex items-center justify-between p-4">
            <div><h2 className="flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4 text-[var(--accent-green)]" />Riwayat selesai</h2><p className="mt-1 text-[11px] text-[var(--text-secondary)]">Pesanan dapat dikembalikan ke dapur jika salah ditandai.</p></div>
            <span className="ui-badge ui-badge-success">{completedOrders.length} selesai</span>
          </div>
          {completedOrders.length === 0 ? <div className="ui-card py-20 text-center text-xs font-bold text-[var(--text-secondary)]">Belum ada pesanan selesai.</div> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
              {completedOrders.map((order) => (
                <article key={order.id} className="ui-card p-3">
                  <div className="flex items-center justify-between border-b border-[var(--panel-border-light)] pb-2"><span className="font-mono text-base font-bold">{formatOrderLabel(order, orders)}</span><span className="ui-badge ui-badge-success"><Check className="h-3 w-3" />Selesai</span></div>
                  <p className="my-2 text-[11px] font-bold text-[var(--text-secondary)]">{order.customerName} · Meja {order.tableNumber || '-'}</p>
                  <div className="space-y-1">{groupKitchenItems(order.items).map((item) => <div key={item.key} className="flex justify-between text-[11px] font-bold"><span>{item.menuName}</span><span>×{item.totalQuantity}</span></div>)}</div>
                  <div className="mt-3 flex gap-2 border-t border-[var(--panel-border-light)] pt-2">
                    <button type="button" onClick={() => onUpdateOrderStatus(order.id, 'COOKING')} className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--warning-soft)] px-2 text-[11px] font-bold text-[var(--accent-amber)]"><RotateCcw className="h-3.5 w-3.5" />Kembalikan</button>
                    <button type="button" onClick={() => onPrintKitchenTicket(order)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--panel-border)]" aria-label={`Cetak ulang ${formatOrderLabel(order, orders)}`} title="Cetak ulang"><Printer className="h-3.5 w-3.5" /></button>
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
