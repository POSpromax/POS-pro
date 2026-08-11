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
  return <span className="font-mono text-base font-black tabular-nums text-[#17202A]">{time}</span>;
};

const timeTone = (minutes: number) => {
  if (minutes > 15) return { accent: 'bg-[#E5484D]', badge: 'border-[#F4C6C8] bg-[#FDECEC] text-[#B4232A]', label: 'Terlambat' };
  if (minutes >= 10) return { accent: 'bg-[#F59E0B]', badge: 'border-[#F4D79A] bg-[#FFF5DF] text-[#A15C00]', label: 'Perhatian' };
  if (minutes >= 5) return { accent: 'bg-[#22A559]', badge: 'border-[#BEE6CC] bg-[#EAF8EF] text-[#187A42]', label: 'Berjalan' };
  return { accent: 'bg-[#3B6FE8]', badge: 'border-[#C9D8FA] bg-[#EDF3FF] text-[#2B58BE]', label: 'Baru' };
};

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({
  orders,
  condimentGroups,
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
    <div className="ui-surface flex-1 overflow-y-auto p-3 font-sans text-[#17202A] md:p-4">
      <header className="sticky top-0 z-20 mb-3 rounded-2xl border border-[#E2E5E9] bg-[#FCFCFB]/95 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#17202A] text-white">
              <Utensils className="h-5 w-5 stroke-[1.9]" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight">Kitchen Display</h1>
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#667085]">
                <span className={`h-2 w-2 rounded-full ${connectionState === 'HEALTHY' ? 'bg-[#22A559]' : connectionState === 'DEGRADED' ? 'bg-[#F59E0B]' : 'bg-[#98A2B3]'}`} />
                {kitchenOrders.length} antrean · {connectionState === 'HEALTHY' ? 'realtime' : connectionState === 'DEGRADED' ? 'sinkronisasi cadangan' : 'menghubungkan'}
              </p>
            </div>
          </div>

          <div className="flex rounded-xl border border-[#E2E5E9] bg-[#F1F2F3] p-1">
            <button type="button" onClick={() => setViewMode('ACTIVE')} className={`flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-black transition ${viewMode === 'ACTIVE' ? 'bg-white text-[#17202A] shadow-sm' : 'text-[#667085]'}`}>
              <Flame className="h-3.5 w-3.5" /> Aktif ({kitchenOrders.length})
            </button>
            <button type="button" onClick={() => setViewMode('HISTORY')} className={`flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-black transition ${viewMode === 'HISTORY' ? 'bg-white text-[#17202A] shadow-sm' : 'text-[#667085]'}`}>
              <History className="h-3.5 w-3.5" /> Selesai ({completedOrders.length})
            </button>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex min-h-9 items-center gap-2 rounded-xl border border-[#E2E5E9] bg-white px-2.5 text-[10px] font-black text-[#475467]">
              <Filter className="h-3.5 w-3.5 text-[#FF7A00]" />
              <select value={filterType} onChange={(event) => setFilterType(event.target.value as FilterType)} className="bg-transparent outline-none" aria-label="Filter kategori Kitchen">
                <option value="SEMUA">Semua menu</option>
                <option value="FOOD">Makanan</option>
                <option value="DRINK">Minuman</option>
              </select>
            </label>
            <button type="button" onClick={() => { setSoundEnabled((enabled) => !enabled); if (!soundEnabled) playNewOrderSound(); }} className={`flex min-h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-black ${soundEnabled ? 'border-[#BEE6CC] bg-[#EAF8EF] text-[#187A42]' : 'border-[#E2E5E9] bg-[#F1F2F3] text-[#667085]'}`} aria-label={soundEnabled ? 'Matikan suara Kitchen' : 'Aktifkan suara Kitchen'}>
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {soundEnabled ? 'Suara aktif' : 'Suara mati'}
            </button>
            <button type="button" onClick={playNewOrderSound} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E5E9] bg-white text-[#667085] hover:bg-[#F1F2F3]" aria-label="Tes suara notifikasi" title="Tes suara notifikasi">
              <Bell className="h-4 w-4" />
            </button>
            <LiveClock />
          </div>
        </div>
      </header>

      {viewMode === 'ACTIVE' && (
        kitchenOrders.length === 0 ? (
          <div className="ui-card flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
            <Utensils className="mb-3 h-12 w-12 text-[#98A2B3]" />
            <p className="font-black">Belum ada antrean dapur</p>
            <p className="mt-1 text-xs font-medium text-[#667085]">Pesanan Kasir dan Self-order akan muncul otomatis.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {kitchenOrders.map((order) => {
              const elapsed = elapsedMinutes(order.createdAt);
              const tone = timeTone(elapsed);
              const visibleItems = order.items.filter((item) => (
                item.status !== 'DONE' &&
                (filterType === 'SEMUA' || (filterType === 'FOOD' ? item.category !== 'MINUMAN' : item.category === 'MINUMAN'))
              ));
              const productGroups = groupKitchenItems(visibleItems);
              const isNew = order.status === 'NEW';
              const isReady = order.status === 'READY';

              return (
                <article key={order.id} className="relative overflow-hidden rounded-[14px] border border-[#DDE1E6] bg-[#FCFCFB] shadow-sm">
                  <div className={`absolute inset-x-0 top-0 h-1 ${tone.accent}`} />
                  <div className="p-3 pb-2">
                    <div className="flex items-start justify-between gap-2 border-b border-[#ECEEF1] pb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xl font-black tabular-nums" title={order.orderNumber}>{formatOrderLabel(order)}</span>
                          <span className="ui-badge bg-[#F1F2F3] text-[#667085]">{order.type === 'DINE_IN' ? 'Dine in' : 'Take away'}</span>
                        </div>
                        <p className="mt-1 truncate text-[10px] font-bold text-[#667085]">{order.customerName} · <span className="text-[#17202A]">Meja {order.tableNumber || '-'}</span></p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => onPrintKitchenTicket(order)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F1F2F3]" aria-label={`Cetak tiket ${formatOrderLabel(order)}`} title="Cetak tiket dapur"><Printer className="h-3.5 w-3.5" /></button>
                        <span className={`ui-badge ${tone.badge}`}><Clock className="h-3 w-3" />{elapsed}m</span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className={`ui-badge ${tone.badge}`}>{elapsed > 15 && <AlertTriangle className="h-3 w-3" />}{tone.label}</span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-[#98A2B3]">{isNew ? 'Pesanan baru' : isReady ? 'Siap saji' : 'Sedang dimasak'}</span>
                    </div>

                    <div className="mt-2.5 space-y-2">
                      {productGroups.map((product) => (
                        <section key={product.key} className="rounded-xl border border-[#ECEEF1] bg-white p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="text-[12px] font-black leading-snug text-[#17202A]">{product.menuName}</h2>
                            <span className="shrink-0 rounded-lg bg-[#17202A] px-2 py-0.5 text-[11px] font-black text-white">×{product.totalQuantity}</span>
                          </div>
                          <div className="mt-1.5 space-y-1.5">
                            {product.modifierGroups.map((subgroup, index) => {
                              const hasDetails = subgroup.selectedCondiments.length > 0 || subgroup.note;
                              return (
                                <div key={subgroup.key} className={`${index ? 'border-t border-dashed border-[#E2E5E9] pt-1.5' : ''} flex items-start gap-1.5 text-[10px]`}>
                                  <span className="shrink-0 font-black text-[#E96E00]">×{subgroup.quantity}</span>
                                  <div className="min-w-0 flex-1">
                                    {subgroup.selectedCondiments.map((group) => (
                                      <p key={`${subgroup.key}-${group.groupName}`} className="font-semibold leading-snug text-[#475467]"><span className="text-[#98A2B3]">{group.groupName}:</span> {summarizeCondimentOptions(group, condimentGroups)}</p>
                                    ))}
                                    {subgroup.note && <p className="mt-0.5 font-bold leading-snug text-[#B4232A]">Catatan: {subgroup.note}</p>}
                                    {!hasDetails && <p className="font-semibold text-[#98A2B3]">Standar</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#E2E5E9] bg-[#F7F7F6] p-2">
                    <button type="button" onClick={() => onUpdateOrderStatus(order.id, isNew ? 'COOKING' : 'COMPLETED')} className={`flex min-h-9 w-full items-center justify-center gap-1.5 rounded-[10px] px-3 text-[10px] font-black text-white transition active:scale-[0.99] ${isNew ? 'bg-[#FF7A00] hover:bg-[#E96E00]' : 'bg-[#22A559] hover:bg-[#187A42]'}`}>
                      {isNew ? <><Flame className="h-3.5 w-3.5" /> Mulai masak</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Selesai & sajikan</>}
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
            <div><h2 className="flex items-center gap-2 text-sm font-black"><History className="h-4 w-4 text-[#22A559]" />Riwayat selesai</h2><p className="mt-1 text-[11px] text-[#667085]">Pesanan dapat dikembalikan ke dapur jika salah ditandai.</p></div>
            <span className="ui-badge border-[#BEE6CC] bg-[#EAF8EF] text-[#187A42]">{completedOrders.length} selesai</span>
          </div>
          {completedOrders.length === 0 ? <div className="ui-card py-20 text-center text-xs font-bold text-[#667085]">Belum ada pesanan selesai.</div> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
              {completedOrders.map((order) => (
                <article key={order.id} className="ui-card p-3">
                  <div className="flex items-center justify-between border-b border-[#ECEEF1] pb-2"><span className="font-mono text-base font-black">{formatOrderLabel(order)}</span><span className="ui-badge border-[#BEE6CC] bg-[#EAF8EF] text-[#187A42]"><Check className="h-3 w-3" />Selesai</span></div>
                  <p className="my-2 text-[10px] font-bold text-[#667085]">{order.customerName} · Meja {order.tableNumber || '-'}</p>
                  <div className="space-y-1">{groupKitchenItems(order.items).map((item) => <div key={item.key} className="flex justify-between text-[11px] font-bold"><span>{item.menuName}</span><span>×{item.totalQuantity}</span></div>)}</div>
                  <div className="mt-3 flex gap-2 border-t border-[#ECEEF1] pt-2">
                    <button type="button" onClick={() => onUpdateOrderStatus(order.id, 'COOKING')} className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[#FFF5DF] px-2 text-[10px] font-black text-[#A15C00]"><RotateCcw className="h-3.5 w-3.5" />Kembalikan</button>
                    <button type="button" onClick={() => onPrintKitchenTicket(order)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E5E9]" aria-label={`Cetak ulang ${formatOrderLabel(order)}`} title="Cetak ulang"><Printer className="h-3.5 w-3.5" /></button>
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
