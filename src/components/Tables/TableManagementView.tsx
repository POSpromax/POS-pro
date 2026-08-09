import React from 'react';
import { Grid2X2, QrCode, Power, Smartphone, ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react';
import { RestaurantTable } from '../../types/pos';

interface TableManagementViewProps {
  tables: RestaurantTable[];
  onToggleSelfOrder: (tableNumber: string, enabled: boolean) => void;
  onClearTableStatus: (tableNumber: string) => void;
  onOpenCustomerSelfOrderModal: (tableNumber: string) => void;
}

export const TableManagementView: React.FC<TableManagementViewProps> = ({
  tables,
  onToggleSelfOrder,
  onClearTableStatus,
  onOpenCustomerSelfOrderModal
}) => {
  return (
    <div className="flex-1 bg-[#F8FAFC] p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between text-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1714] tracking-tight flex items-center gap-2">
            <Grid2X2 className="w-7 h-7 text-[#EA580C]" />
            Manajemen Meja & Kontrol Self-Order QR
          </h1>
          <p className="text-xs text-slate-500 font-bold mt-1">
            Atur status meja (Merah/Hijau) & kontrol akses pemesanan langsung dari HP pembeli agar terhindar dari pemesanan ganda.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 bg-white border border-[#EAE3DB] px-4 py-2 rounded-full text-xs font-bold shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-700">Hijau (Bebas / Kosong)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-slate-700">Merah (Terisi / Active Order)</span>
          </div>
        </div>
      </div>

      {/* Grid of Tables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map((table) => {
          const isOccupied = table.status === 'OCCUPIED';

          return (
            <div
              key={table.id}
              className={`bg-white rounded-2xl p-5 border shadow-2xs flex flex-col justify-between transition-all ${
                isOccupied
                  ? 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/50'
                  : 'border-[#EAE3DB] hover:border-[#EA580C]'
              }`}
            >
              <div>
                {/* Table Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-[#1A1714]">MEJA {table.number}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{table.capacity} Org</span>
                  </div>

                  {/* Status Indicator */}
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isOccupied
                        ? 'bg-rose-500 text-white shadow-2xs'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {isOccupied ? 'TERISI (RED)' : 'BEBAS (GREEN)'}
                  </span>
                </div>

                {/* QR Code Graphic Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center my-3 flex flex-col items-center">
                  <QrCode className="w-16 h-16 text-slate-800 mb-1" />
                  <p className="text-[10px] text-slate-500 font-bold">QR Self-Order Meja {table.number}</p>
                </div>

                {/* Self-Order Toggle Control */}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-full border border-slate-200 my-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-bold text-slate-800">Self-Order HP:</span>
                  </div>

                  <button
                    onClick={() => onToggleSelfOrder(table.number, !table.isSelfOrderEnabled)}
                    className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                      table.isSelfOrderEnabled
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-300 text-slate-600'
                    }`}
                  >
                    {table.isSelfOrderEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <button
                  disabled={!table.isSelfOrderEnabled}
                  onClick={() => onOpenCustomerSelfOrderModal(table.number)}
                  className="w-full py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer active:scale-95"
                >
                  <Smartphone className="w-4 h-4" /> Simulator QR Order
                </button>

                {isOccupied && (
                  <button
                    onClick={() => onClearTableStatus(table.number)}
                    className="w-full py-2 rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Reset Meja (Bebaskan)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
