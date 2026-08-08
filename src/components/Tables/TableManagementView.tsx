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
    <div className="flex-1 bg-[#F5F5F5] p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight flex items-center gap-2">
            <Grid2X2 className="w-7 h-7 text-[#F05A1F]" />
            Manajemen Meja & Control Self-Order QR
          </h1>
          <p className="text-xs text-[#9C9590] font-bold mt-1">
            Atur status meja (Merah/Hijau) & kontrol akses pemesanan langsung dari HP pembeli agar terhindar dari pemesanan ganda.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 ios-card bg-white border border-black/5 px-4 py-2 rounded-2xl text-xs font-bold shadow-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#F05A1F]" />
            <span className="text-[#6B6560]">Hijau (Kosong)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF3B30] animate-pulse" />
            <span className="text-[#6B6560]">Merah (Terisi / Terkunci)</span>
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
              className={`ios-card bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between transition-all ${
                isOccupied
                  ? 'border-[#FF3B30]/40 ring-2 ring-[#FF3B30]/20 bg-[#FF3B30]/5'
                  : 'border-black/5 hover:border-[#F05A1F]/40'
              }`}
            >
              <div>
                {/* Table Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-[#1A1714]">MEJA {table.number}</span>
                    <span className="text-[10px] text-[#B8B0A8] font-bold">Kapasitas: {table.capacity} Org</span>
                  </div>

                  {/* Status Indicator */}
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isOccupied
                        ? 'bg-[#FF3B30] text-white shadow-xs'
                        : 'bg-[#F2F2F2] text-[#444444]'
                    }`}
                  >
                    {isOccupied ? 'RED (TERISI)' : 'GREEN (KOSONG)'}
                  </span>
                </div>

                {/* QR Code Graphic Box */}
                <div className="bg-[#FAFAF8] border border-black/5 rounded-2xl p-4 text-center my-3 flex flex-col items-center">
                  <QrCode className="w-16 h-16 text-slate-800 mb-1" />
                  <p className="text-[10px] text-[#9C9590] font-bold">QR Self-Order Meja {table.number}</p>
                </div>

                {/* Self-Order Toggle Control */}
                <div className="flex items-center justify-between bg-slate-100/80 p-2.5 rounded-2xl border border-black/5 my-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#F05A1F]" />
                    <span className="text-xs font-bold text-slate-800">Self-Order HP:</span>
                  </div>

                  <button
                    onClick={() => onToggleSelfOrder(table.number, !table.isSelfOrderEnabled)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      table.isSelfOrderEnabled
                        ? 'bg-[#1C1B19] text-white shadow-xs'
                        : 'bg-slate-300 text-slate-600'
                    }`}
                  >
                    {table.isSelfOrderEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-black/5">
                <button
                  disabled={!table.isSelfOrderEnabled}
                  onClick={() => onOpenCustomerSelfOrderModal(table.number)}
                  className="w-full py-2.5 rounded-2xl bg-[#1C1B19] hover:bg-black text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                >
                  <Smartphone className="w-4 h-4" /> Simulator QR Order
                </button>

                {isOccupied && (
                  <button
                    onClick={() => onClearTableStatus(table.number)}
                    className="w-full py-2 rounded-2xl bg-slate-200 hover:bg-[#F05A1F] hover:text-white text-[#6B6560] font-semibold text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    Reset Meja (Kosongkan)
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
