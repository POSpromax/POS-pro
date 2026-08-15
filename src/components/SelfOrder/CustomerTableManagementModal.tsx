import React from 'react';
import { X, Check, Info } from 'lucide-react';
import { RestaurantTable } from '../../types/pos';

interface CustomerTableManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  onToggleTableSelfOrder: (tableId: string, enabled: boolean) => void;
  onToggleAllTables: (enabled: boolean) => void;
}

export const CustomerTableManagementModal: React.FC<CustomerTableManagementModalProps> = ({
  isOpen,
  onClose,
  tables,
  onToggleTableSelfOrder,
  onToggleAllTables,
}) => {
  if (!isOpen) return null;

  const activeCount = tables.filter(
    (t) => t.isSelfOrderEnabled === true && t.status === 'READY'
  ).length;

  const totalCount = tables.length;

  return (
    <div className="theme-self-order fixed inset-0 z-50 flex items-center justify-center bg-slate-600/30 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md sm:max-w-lg rounded-2xl overflow-hidden shadow-xl border border-black/5 flex flex-col animate-in fade-in zoom-in-95 duration-200 font-sans">

        {/* Header */}
        <div className="p-6 pb-4 bg-white flex items-start justify-between shrink-0">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-0.5">
              CUSTOMER ORDER
            </span>

            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Manajemen Meja
            </h2>

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

        {/* Body */}
        <div className="px-6 pb-6 space-y-4 overflow-y-auto max-h-[80vh]">

          <div className="bg-[var(--surface-main)] rounded-2xl p-5 border border-slate-200/80 space-y-4">

            {/* Counter + Bulk Action */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">
                Meja aktif:{' '}
                <span className="text-slate-900">
                  {activeCount}/{totalCount}
                </span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleAllTables(true)}
                  className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all"
                  style={{
                    background:
                      'linear-gradient(180deg, #059669 0%, #047857 100%)',
                    color: '#ffffff',
                  }}
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

            {/* Table Grid */}
            <div className="grid grid-cols-5 gap-2.5 pt-1">
              {tables.map((tbl) => {
                /*
                  PRIORITAS STATUS VISUAL:

                  1. MERAH
                     = OCCUPIED / ada activeOrderId

                  2. HIJAU
                     = READY + self-order aktif

                  3. ABU-ABU
                     = self-order nonaktif

                  activeOrderId harus mengalahkan flag self_order_enabled,
                  karena meja dapat tetap memiliki self_order_enabled=true
                  ketika sedang digunakan.
                */

                const hasActiveBill = Boolean(tbl.activeOrderId);

                const isOccupied =
                  hasActiveBill || tbl.status === 'OCCUPIED';

                const isReadyForSelfOrder =
                  !isOccupied &&
                  tbl.status === 'READY' &&
                  tbl.isSelfOrderEnabled === true;

                const visualClass = isOccupied
                  ? 'bg-red-50 text-red-700 border-red-300 shadow-sm ring-1 ring-red-100'
                  : isReadyForSelfOrder
                    ? 'bg-[var(--primary-soft)] text-[var(--primary-text)] border-[var(--brand-200)] hover:border-[var(--primary)] shadow-sm'
                    : 'bg-white text-slate-400 border-slate-200 opacity-60 hover:opacity-100';

                const dotClass = isOccupied
                  ? 'bg-red-500'
                  : isReadyForSelfOrder
                    ? 'bg-[var(--primary)]'
                    : 'bg-slate-300';

                return (
                  <button
                    key={tbl.id}
                    type="button"

                    // Meja dengan bill aktif tidak boleh ON/OFF
                    disabled={isOccupied}

                    onClick={() =>
                      onToggleTableSelfOrder(
                        tbl.id,
                        !isReadyForSelfOrder
                      )
                    }

                    title={
                      isOccupied
                        ? `Meja ${tbl.number} sedang digunakan dan memiliki order aktif`
                        : isReadyForSelfOrder
                          ? `Nonaktifkan customer order Meja ${tbl.number}`
                          : `Aktifkan customer order Meja ${tbl.number}`
                    }

                    aria-label={
                      isOccupied
                        ? `Meja ${tbl.number} terpakai`
                        : isReadyForSelfOrder
                          ? `Meja ${tbl.number} siap untuk customer order`
                          : `Meja ${tbl.number} nonaktif`
                    }

                    className={`
                      py-2
                      px-1
                      rounded-2xl
                      border
                      transition-all
                      flex
                      items-center
                      justify-center
                      gap-1.5
                      select-none
                      disabled:cursor-not-allowed
                      ${visualClass}
                    `}
                  >
                    <span className="text-xs sm:text-sm font-bold">
                      {tbl.number}
                    </span>

                    <span
                      className={`
                        w-2
                        h-2
                        rounded-full
                        shrink-0
                        ${dotClass}
                      `}
                    />
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] font-semibold text-slate-400 text-center pt-1">
              Tap meja untuk mengaktifkan / menonaktifkan akses customer order
              meja tersebut.
            </p>
          </div>

          <div className="pt-1 px-1">
            <p className="text-xs font-semibold text-slate-400 leading-relaxed text-left">
              Setelah pesanan meja dibayar, meja akan kembali non aktif untuk
              customer order. Aktifkan kembali meja yang siap digunakan dari
              layar ini.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};