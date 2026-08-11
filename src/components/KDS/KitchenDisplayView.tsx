import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Utensils,
  Clock,
  CheckCircle2,
  Filter,
  Printer,
  Flame,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  History,
  Check,
  Bell
} from 'lucide-react';
import { CondimentGroup, Order, OrderStatus } from '../../types/pos';
import { playNewOrderSound, playWarningAlarmSound } from '../../utils/audioNotification';
import { summarizeCondimentOptions } from '../../utils/condimentUtils';
import { formatOrderLabel } from '../../utils/orderNumber';

interface KitchenDisplayViewProps {
  orders: Order[];
  condimentGroups: CondimentGroup[];
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onPrintKitchenTicket: (order: Order) => void;
}

type ViewMode = 'ACTIVE' | 'HISTORY';

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({
  orders,
  condimentGroups,
  onUpdateOrderStatus,
  onPrintKitchenTicket
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('ACTIVE');
  const [filterType, setFilterType] = useState<'SEMUA' | 'FOOD' | 'DRINK'>('SEMUA');
  const [nowTime, setNowTime] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const prevNewCountRef = useRef<number>(0);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date().toLocaleTimeString('id-ID'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Di-memo supaya identitasnya stabil: jam di atas me-render tiap detik, dan
  // daftar baru setiap render akan terus-menerus mereset timer alarm di bawah.
  const kitchenOrders = useMemo(
    () => orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'),
    [orders],
  );
  const completedOrders = useMemo(
    () => orders
      .filter((o) => o.status === 'COMPLETED')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders],
  );

  // Detect new orders arriving & trigger audio chime sound
  useEffect(() => {
    const newCount = kitchenOrders.filter((o) => o.status === 'NEW').length;
    if (soundEnabled && newCount > prevNewCountRef.current && prevNewCountRef.current >= 0) {
      playNewOrderSound();
    }
    prevNewCountRef.current = newCount;
  }, [kitchenOrders, soundEnabled]);

  // Antrean dibaca lewat ref, bukan dependency: setiap pesanan baru masuk akan
  // mereset interval, dan alarm 25 detik tidak pernah sempat berbunyi.
  const kitchenOrdersRef = useRef(kitchenOrders);
  kitchenOrdersRef.current = kitchenOrders;

  // Periodic alarm sound trigger for overdue orders (> 15 minutes)
  useEffect(() => {
    if (!soundEnabled) return;
    const alarmInterval = setInterval(() => {
      const hasOverdue = kitchenOrdersRef.current.some((o) => {
        const diffMs = Date.now() - new Date(o.createdAt).getTime();
        return diffMs / (1000 * 60) >= 15;
      });
      if (hasOverdue) {
        playWarningAlarmSound();
      }
    }, 25_000);
    return () => clearInterval(alarmInterval);
  }, [soundEnabled]);

  // Helper to calculate minutes elapsed
  const getElapsedMinutes = (isoString: string): number => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60)));
  };

  return (
    <div className="flex-1 bg-[#121110] text-white p-4 md:p-6 overflow-y-auto font-sans select-none">
      {/* KDS Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        {/* Left Title & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#EA580C] to-[#F97316] flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[#C2410C]">KDS DAPUR PRO</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
              MONITOR TIKET PESANAN & ALARM WAKTU REAL-TIME
            </p>
          </div>
        </div>

        {/* View Mode Tabs (Active Orders vs Riwayat Selesai) */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setViewMode('ACTIVE')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'ACTIVE'
                ? 'bg-[#EA580C] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            Antrean Aktif ({kitchenOrders.length})
          </button>

          <button
            type="button"
            onClick={() => setViewMode('HISTORY')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'HISTORY'
                ? 'bg-[#EA580C] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            Riwayat Selesai ({completedOrders.length})
          </button>
        </div>

        {/* Center Controls: Category Filter & Audio Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#C2410C]" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-transparent text-xs font-black text-slate-200 outline-none cursor-pointer"
            >
              <option value="SEMUA" className="bg-slate-900">SEMUA MENU</option>
              <option value="FOOD" className="bg-slate-900">MAKANAN ONLY</option>
              <option value="DRINK" className="bg-slate-900">MINUMAN ONLY</option>
            </select>
          </div>

          {/* Sound Notification Controls */}
          <button
            type="button"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playNewOrderSound();
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="Toggle Suara Notifikasi & Alarm"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
            <span>{soundEnabled ? 'BUNYI: ON' : 'BUNYI: OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => playNewOrderSound()}
            className="px-2.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-[10px] font-black text-slate-300 border border-slate-800 flex items-center gap-1 cursor-pointer"
            title="Tes Suara Notifikasi Web Audio"
          >
            <Bell className="w-3 h-3 text-amber-400" /> Tes Sound
          </button>
        </div>

        {/* Right Live Clock */}
        <div className="text-right">
          <span className="text-xl font-black text-slate-200 tracking-wider font-mono">{nowTime}</span>
        </div>
      </div>

      {/* VIEW 1: ANTREAN KITCHEN AKTIF */}
      {viewMode === 'ACTIVE' && (
        <>
          {kitchenOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 py-24 animate-fade-in">
              <Utensils className="w-16 h-16 mb-3 text-slate-700 animate-pulse" />
              <p className="text-lg font-black text-slate-400">Tidak ada antrean pesanan di dapur saat ini</p>
              <p className="text-xs text-slate-600 mt-1">Pesanan baru dari Kasir / Customer Self-Order akan muncul di sini secara real-time</p>
              {completedOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setViewMode('HISTORY')}
                  className="mt-4 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-xs font-black text-orange-400 border border-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <History className="w-4 h-4" /> Lihat {completedOrders.length} Pesanan Selesai Hari Ini
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 flex-1 items-start">
              {kitchenOrders.map((order) => {
                const elapsed = getElapsedMinutes(order.createdAt);
                const isWarning = elapsed >= 10 && elapsed < 15;
                const isOverdue = elapsed >= 15;

                const isNew = order.status === 'NEW';
                const isCooking = order.status === 'COOKING';
                const isReady = order.status === 'READY';

                return (
                  <div
                    key={order.id}
                    className={`bg-slate-900/90 border rounded-2xl p-3.5 flex flex-col justify-between shadow-xl relative overflow-hidden transition-all duration-300 ${
                      isOverdue
                        ? 'border-rose-600 ring-4 ring-rose-600/40 bg-rose-950/30 animate-pulse'
                        : isWarning
                        ? 'border-amber-500 ring-2 ring-amber-500/40'
                        : isNew
                        ? 'border-[#EA580C] ring-2 ring-orange-500/20 shadow-orange-950/30'
                        : isCooking
                        ? 'border-amber-500/80 ring-2 ring-amber-500/20'
                        : 'border-emerald-500/80 ring-2 ring-emerald-500/20'
                    }`}
                  >
                    {/* Top Status Progress Bar */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isOverdue
                            ? 'bg-rose-600 w-full animate-pulse'
                            : isNew
                            ? 'bg-[#EA580C] w-1/3'
                            : isCooking
                            ? 'bg-amber-500 w-2/3'
                            : 'bg-emerald-500 w-full'
                        }`}
                      />
                    </div>

                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2.5 pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-2xl font-black text-white font-mono tracking-tight tabular-nums" title={order.orderNumber}>{formatOrderLabel(order)}</span>
                          <span className="bg-slate-800 text-slate-300 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-slate-700">
                            {order.type === 'DINE_IN' ? 'DINE IN' : 'TAKE AWAY'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onPrintKitchenTicket(order)}
                            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Cetak Tiket Dapur"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Timer Badge with Alarm state */}
                          <div
                            className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                              isOverdue
                                ? 'bg-rose-600 text-white border border-rose-400 animate-bounce'
                                : isWarning
                                ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>{elapsed}m</span>
                          </div>
                        </div>
                      </div>

                      {/* Customer & Table Info */}
                      <div className="text-[11px] text-slate-400 font-bold mb-2 flex items-center justify-between">
                        <span className="truncate max-w-[110px]">{order.customerName}</span>
                        <span className="text-white font-black bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700/60 text-[10px]">
                          MEJA {order.tableNumber}
                        </span>
                      </div>

                      {/* Status Badge Header */}
                      <div className="mb-2.5">
                        {isOverdue ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white border border-rose-400">
                            <AlertTriangle className="w-3 h-3 animate-spin" />
                            <span>?? ALARM OVERDUE (&gt;15M)</span>
                          </div>
                        ) : (
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${
                              isNew
                                ? 'bg-orange-950/80 text-orange-300 border-orange-700/60'
                                : isCooking
                                ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                            }`}
                          >
                            {isNew && (
                              <>
                                <Sparkles className="w-3 h-3 text-orange-400 animate-spin" />
                                <span>PESANAN BARU</span>
                              </>
                            )}
                            {isCooking && (
                              <>
                                <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
                                <span>SEDANG DIMASAK (PROSES)</span>
                              </>
                            )}
                            {isReady && (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>SIAP DISAJIKAN</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Order Items List (No internal scrollbar) */}
                      <div className="space-y-1.5 mb-3">
                        {order.items
                          .flatMap((item) => {
                            if (filterType === 'FOOD' && item.category === 'MINUMAN') return [];
                            if (filterType === 'DRINK' && item.category !== 'MINUMAN') return [];

                            return Array.from({ length: item.quantity }).map((_, qIndex) => ({
                              portionId: `${item.id}-p${qIndex + 1}`,
                              menuName: item.menuName,
                              portionNum: qIndex + 1,
                              totalQty: item.quantity,
                              category: item.category,
                              selectedCondiments: item.selectedCondiments,
                              notes: item.notes
                            }));
                          })
                          .map((portionItem) => (
                            <div
                              key={portionItem.portionId}
                              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-bold space-y-1"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="bg-[#EA580C] text-white px-2 py-0.5 rounded-md font-black text-xs shrink-0">
                                    1x
                                  </span>
                                  <span className="text-slate-100 font-black flex-1 leading-snug">
                                    {portionItem.menuName}
                                  </span>
                                </div>

                                {portionItem.totalQty > 1 && (
                                  <span className="text-[9px] font-black bg-slate-800 text-orange-300 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                                    Porsi {portionItem.portionNum}/{portionItem.totalQty}
                                  </span>
                                )}
                              </div>

                              {/* Condiments / Toppings if selected */}
                              {portionItem.selectedCondiments && portionItem.selectedCondiments.length > 0 && (
                                <div className="pl-7 space-y-0.5 pt-0.5 border-t border-slate-800/60 mt-1">
                                  {portionItem.selectedCondiments.map((cg, idx) => {
                                    const summary = summarizeCondimentOptions(cg, condimentGroups);
                                    const isCollapsed = summary !== cg.options.join(', ');

                                    return (
                                      <div key={idx} className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                                        <span className="text-slate-400">{cg.groupName}:</span>
                                        <span className={isCollapsed
                                          ? 'font-black text-slate-900 bg-amber-300 px-1.5 rounded uppercase tracking-wide'
                                          : 'font-bold text-amber-200'}>
                                          {summary}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Notes */}
                              {portionItem.notes && (
                                <div className="pl-7 text-[10px] text-rose-300 italic font-bold">
                                  Catatan: "{portionItem.notes}"
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2 border-t border-slate-800">
                      {isNew ? (
                        <button
                          type="button"
                          onClick={() => onUpdateOrderStatus(order.id, 'COOKING')}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 active:scale-95 text-white font-black text-xs transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Flame className="w-4 h-4 text-amber-200" />
                          <span>MULAI MASAK PESANAN</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUpdateOrderStatus(order.id, 'COMPLETED')}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>TANDAI SELESAI & SAJIKAN</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: RIWAYAT PESANAN SELESAI */}
      {viewMode === 'HISTORY' && (
        <div className="space-y-4 flex-1">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                Riwayat Tiket Pesanan Selesai Dimasak Hari Ini
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Daftar pesanan yang telah disajikan. Anda dapat mencetak ulang tiket atau mengembalikan pesanan ke antrean dapur jika salah klik.
              </p>
            </div>
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-full text-xs font-black">
              Total Selesai: {completedOrders.length} Order
            </span>
          </div>

          {completedOrders.length === 0 ? (
            <div className="py-20 text-center text-slate-500 font-bold bg-slate-900/50 rounded-2xl border border-slate-800">
              Belum ada riwayat pesanan yang diselesaikan hari ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {completedOrders.map((order) => (
                <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                      <span className="text-lg font-black font-mono text-emerald-400 tabular-nums" title={order.orderNumber}>{formatOrderLabel(order)}</span>
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> SELESAI
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-bold mb-2 flex items-center justify-between">
                      <span>{order.customerName}</span>
                      <span className="text-white font-black bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">
                        MEJA {order.tableNumber}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 font-mono mb-2">
                      Selesai: {new Date(order.createdAt).toLocaleTimeString('id-ID')}
                    </p>

                    {/* Items List */}
                    <div className="space-y-1 border-t border-slate-800/80 pt-2">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="text-xs text-slate-300 font-bold flex justify-between">
                          <span>{it.quantity}x {it.menuName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions: Re-open & Print */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, 'COOKING')}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-black text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Kembalikan pesanan ini ke antrean dapur"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Kembalikan ke Dapur
                    </button>
                    <button
                      type="button"
                      onClick={() => onPrintKitchenTicket(order)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                      title="Cetak Tiket Dapur"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
