import React from 'react';
import { X, Check, Info } from 'lucide-react';
import { RestaurantTable } from '../../types/pos';

interface CustomerTableManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  onToggleTableSelfOrder: (tableId: string, enabled: boolean) => void;
  onToggleAllTables: (enabled: boolean) => void;
  isSelfOrderSystemEnabled: boolean;
  onToggleSystemSelfOrder: (enabled: boolean) => void;
}

export const CustomerTableManagementModal: React.FC<CustomerTableManagementModalProps> = ({
  isOpen,
  onClose,
  tables,
  onToggleTableSelfOrder,
  onToggleAllTables,
  isSelfOrderSystemEnabled,
  onToggleSystemSelfOrder
}) => {
  if (!isOpen) return null;

  const activeCount = tables.filter((t) => t.isSelfOrderEnabled ?? true).length;
  const totalCount = tables.length;

  return (
    <div className="theme-self-order fixed inset-0 z-50 flex items-center justify-center bg-slate-600/30 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md sm:max-w-lg rounded-[32px] overflow-hidden shadow-2xl border border-black/5 flex flex-col animate-in fade-in zoom-in-95 duration-200 font-sans">
        
        {/* Header matching Image 2 */}
        <div className="p-6 pb-4 bg-white flex items-start justify-between shrink-0">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-0.5">
              CUSTOMER ORDER
            </span>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Meja</h2>
            <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
              Hanya mengatur meja untuk customer order, POS kasir tetap bebas.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer shrink-0 mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 pb-6 space-y-4 overflow-y-auto max-h-[80vh]">
          
          {/* Card 1: Master Restriction Toggle matching Image 2 */}
          <div className="bg-[#F5F5F5] rounded-2xl p-4 flex items-center justify-between border border-black/5 shadow-2xs">
            <span className="font-extrabold text-xs text-slate-800">
              Pembatasan meja customer order
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleSystemSelfOrder(!isSelfOrderSystemEnabled)}
                className={`w-12 h-6.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${
                  isSelfOrderSystemEnabled ? 'bg-[#EA580C]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform ${
                    isSelfOrderSystemEnabled ? 'translate-x-5.5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-md tracking-wider ${
                  isSelfOrderSystemEnabled ? 'bg-[#FFF4EE] text-[#C94716]' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isSelfOrderSystemEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Card 2: Table Control & Badge Pills Grid matching Image 2 */}
          <div className="bg-[#F9FAFB] rounded-3xl p-5 border border-slate-200/80 space-y-4">
            
            {/* Control & Active Counter Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">
                Meja aktif: <span className="text-slate-900">{activeCount}/{totalCount}</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleAllTables(true)}
                  className="cursor-pointer rounded-full bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-orange-700"
                >
                  Aktifkan semua
                </button>
                <button
                  type="button"
                  onClick={() => onToggleAllTables(false)}
                  className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs rounded-full transition-all cursor-pointer"
                >
                  Nonaktifkan semua
                </button>
              </div>
            </div>

            {/* Grid of Table Badges Pills (5 Columns like Image 2) */}
            <div className="grid grid-cols-5 gap-2.5 pt-1">
              {tables.map((tbl) => {
                const isEnabled = tbl.isSelfOrderEnabled ?? true;

                return (
                  <button
                    key={tbl.id}
                    type="button"
                    onClick={() => onToggleTableSelfOrder(tbl.id, !isEnabled)}
                    className={`py-2 px-1 rounded-2xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
                      isEnabled
                        ? 'bg-[#FFF4EE] text-[#C94716] border-[#F1C7B5] hover:border-[#EA580C] shadow-2xs'
                        : 'bg-white text-slate-400 border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold">{tbl.number}</span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isEnabled ? 'bg-[#EA580C]' : 'bg-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Instruction Microcopy */}
            <p className="text-[11px] font-semibold text-slate-400 text-center pt-1">
              Tap meja untuk mengaktifkan / menonaktifkan akses customer order meja tersebut.
            </p>
          </div>

          {/* Footer Warning Note matching Image 2 */}
          <div className="pt-1 px-1">
            <p className="text-xs font-semibold text-slate-400 leading-relaxed text-left">
              Setelah pesanan meja dibayar, meja akan kembali non aktif untuk customer order. Aktifkan kembali meja yang siap digunakan dari layar ini.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
