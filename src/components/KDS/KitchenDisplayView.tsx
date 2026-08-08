import React, { useState, useEffect } from 'react';
import { Utensils, Clock, CheckCircle2, Filter, Printer, Flame, Sparkles, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { Order, OrderStatus } from '../../types/pos';

interface KitchenDisplayViewProps {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onPrintKitchenTicket: (order: Order) => void;
}

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({
  orders,
  onUpdateOrderStatus,
  onPrintKitchenTicket
}) => {
  const [filterType, setFilterType] = useState<'SEMUA' | 'FOOD' | 'DRINK'>('SEMUA');
  const [nowTime, setNowTime] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date().toLocaleTimeString('id-ID'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter active kitchen orders (NEW or COOKING or READY)
  const kitchenOrders = orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

  // Helper to calculate minutes elapsed
  const getElapsedMinutes = (isoString: string): number => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    return Math.floor(diffMs / (1000 * 60));
  };

  return (
    <div className="flex-1 bg-[#11110F] text-white p-4 overflow-y-auto font-sans flex flex-col justify-between select-none">
      {/* KDS Header Bar matching Image 2 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        {/* Left Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-blue-400">KDSPRO</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              MONITOR DAPUR REAL-TIME
            </p>
          </div>
        </div>

        {/* Center Filter Dropdown */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-2xl flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer"
            >
              <option value="SEMUA" className="bg-slate-900">SEMUA MENU</option>
              <option value="FOOD" className="bg-slate-900">FOOD ONLY</option>
              <option value="DRINK" className="bg-slate-900">DRINK ONLY</option>
            </select>
          </div>

          <div className="flex gap-2 text-xs font-bold">
            <span className="bg-blue-950/80 text-blue-400 border border-blue-800 px-3 py-1.5 rounded-2xl">
              BARU: {kitchenOrders.filter((o) => o.status === 'NEW').length}
            </span>
            <span className="bg-amber-950/80 text-amber-400 border border-amber-800 px-3 py-1.5 rounded-2xl">
              PROSES: {kitchenOrders.filter((o) => o.status === 'COOKING').length}
            </span>
            <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-3 py-1.5 rounded-2xl">
              SELESAI: {orders.filter((o) => o.status === 'COMPLETED').length}
            </span>
          </div>
        </div>

        {/* Right Time Badge */}
        <div className="text-right">
          <span className="text-xl font-black text-slate-200 tracking-wider font-mono">{nowTime}</span>
        </div>
      </div>

      {/* Kitchen Order Grid */}
      {kitchenOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 py-20 animate-fade-in">
          <Utensils className="w-16 h-16 mb-2 text-slate-700 animate-pulse" />
          <p className="text-base font-bold text-slate-400">Tidak ada antrean pesanan di dapur saat ini</p>
          <p className="text-xs text-slate-600">Pesanan baru dari Kasir / Customer Self-Order akan muncul di sini secara real-time</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 align-start">
          {kitchenOrders.map((order) => {
            const elapsed = getElapsedMinutes(order.createdAt);
            const isLate = elapsed > 20;

            // Status configuration
            const isNew = order.status === 'NEW';
            const isCooking = order.status === 'COOKING';
            const isReady = order.status === 'READY';

            return (
              <div
                key={order.id}
                className={`bg-slate-900/90 border rounded-3xl p-4 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                  isNew
                    ? 'border-blue-500/80 ring-2 ring-blue-500/20 shadow-blue-900/20'
                    : isCooking
                    ? 'border-amber-500/80 ring-2 ring-amber-500/20 shadow-amber-900/20'
                    : 'border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-emerald-900/20'
                }`}
              >
                {/* Top Status Progress Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isNew ? 'bg-blue-500 w-1/3' : isCooking ? 'bg-amber-500 w-2/3' : 'bg-emerald-500 w-full'
                    }`}
                  />
                </div>

                <div>
                  {/* Card Header matching KDS specs */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-white font-mono tracking-tight">{order.orderNumber}</span>
                      <span className="bg-slate-800 text-slate-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-slate-700">
                        {order.type === 'DINE_IN' ? 'DINE IN' : 'TAKE AWAY'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onPrintKitchenTicket(order)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Cetak Tiket Dapur"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <div
                        className={`flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                          isLate
                            ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                            : 'bg-slate-800/90 text-slate-300'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{elapsed}m</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer & Table Info */}
                  <div className="text-xs text-slate-400 font-semibold mb-3 flex items-center justify-between">
                    <span className="truncate max-w-[120px]">{order.customerName}</span>
                    <span className="text-white font-black bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700/60">
                      MEJA {order.tableNumber}
                    </span>
                  </div>

                  {/* Animated Status Badge Header */}
                  <div className="mb-3">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                        isNew
                          ? 'bg-blue-950/80 text-blue-300 border-blue-700/60'
                          : isCooking
                          ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                      }`}
                    >
                      {isNew && (
                        <>
                          <Sparkles className="w-3 h-3 text-blue-400 animate-spin" />
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
                  </div>

                  {/* Order Items List - Unpacked into individual 1x portion items for precise kitchen preparation */}
                  <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                    {order.items
                      .flatMap((item) => {
                        if (filterType === 'FOOD' && item.category === 'MINUMAN') return [];
                        if (filterType === 'DRINK' && item.category !== 'MINUMAN') return [];

                        // If qty > 1, unpack each portion so kitchen sees individual 1x items with exact condiments
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
                              <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md font-black text-xs shrink-0">
                                1x
                              </span>
                              <span className="text-slate-100 font-black flex-1 leading-snug">
                                {portionItem.menuName}
                              </span>
                            </div>

                            {portionItem.totalQty > 1 && (
                              <span className="text-[9px] font-extrabold bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                                Porsi {portionItem.portionNum}/{portionItem.totalQty}
                              </span>
                            )}
                          </div>

                          {/* Condiments / Toppings if selected */}
                          {portionItem.selectedCondiments && portionItem.selectedCondiments.length > 0 && (
                            <div className="pl-7 space-y-0.5 pt-0.5 border-t border-slate-800/60 mt-1">
                              {portionItem.selectedCondiments.map((cg, idx) => (
                                <div key={idx} className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                                  <span className="text-slate-500">•</span>
                                  <span className="text-slate-400">{cg.groupName}:</span>
                                  <span className="font-bold text-amber-200">{cg.options.join(', ')}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Notes */}
                          {portionItem.notes && (
                            <div className="pl-7 text-[10px] text-rose-300 italic font-semibold">
                              Catatan: "{portionItem.notes}"
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="pt-2 border-t border-slate-800">
                  {isNew ? (
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, 'COOKING')}
                      className="w-full py-3 rounded-2xl bg-[#1C1B19] hover:bg-black active:scale-95 text-white font-black text-xs transition-all shadow-lg shadow-black/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Flame className="w-4 h-4 text-amber-300" />
                      <span>MULAI MASAK PESANAN</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, 'COMPLETED')}
                      className="w-full py-3 rounded-2xl bg-[#F05A1F] hover:bg-[#D94B15] active:scale-95 text-white font-black text-xs transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>TANDAI SELESAI & SAJIKAN</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
