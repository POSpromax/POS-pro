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
    <div className="flex-1 bg-[#121110] text-white p-4 overflow-y-auto font-sans flex flex-col justify-between select-none">
      {/* KDS Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-800/80 pb-4">
        {/* Left Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#EA580C] to-[#F97316] flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[#EA580C]">KDS DAPUR PRO</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
              MONITOR TIKET PESANAN REAL-TIME
            </p>
          </div>
        </div>

        {/* Center Filter Dropdown */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#EA580C]" />
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

          <div className="flex gap-2 text-xs font-black">
            <span className="bg-orange-950/80 text-orange-400 border border-orange-800 px-3 py-1.5 rounded-full">
              BARU: {kitchenOrders.filter((o) => o.status === 'NEW').length}
            </span>
            <span className="bg-amber-950/80 text-amber-400 border border-amber-800 px-3 py-1.5 rounded-full">
              PROSES: {kitchenOrders.filter((o) => o.status === 'COOKING').length}
            </span>
            <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-3 py-1.5 rounded-full">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 flex-1 items-start">
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
                className={`bg-slate-900/90 border rounded-2xl p-3.5 flex flex-col justify-between shadow-xl relative overflow-hidden transition-all duration-300 ${
                  isNew
                    ? 'border-[#EA580C] ring-2 ring-orange-500/20 shadow-orange-950/30'
                    : isCooking
                    ? 'border-amber-500/80 ring-2 ring-amber-500/20 shadow-amber-900/20'
                    : 'border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-emerald-900/20'
                }`}
              >
                {/* Top Status Progress Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isNew ? 'bg-[#EA580C] w-1/3' : isCooking ? 'bg-amber-500 w-2/3' : 'bg-emerald-500 w-full'
                    }`}
                  />
                </div>

                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2.5 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-black text-white font-mono tracking-tight">{order.orderNumber}</span>
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
                      <div
                        className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
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
                  <div className="text-[11px] text-slate-400 font-bold mb-2.5 flex items-center justify-between">
                    <span className="truncate max-w-[110px]">{order.customerName}</span>
                    <span className="text-white font-black bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700/60 text-[10px]">
                      MEJA {order.tableNumber}
                    </span>
                  </div>

                  {/* Animated Status Badge Header */}
                  <div className="mb-2.5">
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
                  </div>

                  {/* Order Items List - No internal card scrollbar */}
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
                            <div className="pl-7 text-[10px] text-rose-300 italic font-bold">
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
                      className="w-full py-3 rounded-full bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 active:scale-95 text-white font-black text-xs transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Flame className="w-4 h-4 text-amber-200" />
                      <span>MULAI MASAK PESANAN</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, 'COMPLETED')}
                      className="w-full py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
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
    </div>
  );
};
