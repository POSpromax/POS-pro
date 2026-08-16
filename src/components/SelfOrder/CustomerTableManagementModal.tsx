import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { RestaurantTable } from '../../types/pos';
import { getTablePresentation } from '../../utils/tablePresentation';

interface CustomerTableManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  targetTableNumbers?: string[];
  onEnsureTables?: (tableNumbers: string[]) => void | Promise<void>;
  onToggleTableSelfOrder: (tableId: string, enabled: boolean) => void;
  onToggleAllTables: (enabled: boolean) => void;
}

const normalizeTableNumber = (value: string) =>
  String(value || '').trim().replace(/^0+(?=\d)/, '');

const normalizeTableNumbers = (values?: string[]) => {
  const seen = new Set<string>();
  return (values || [])
    .map(normalizeTableNumber)
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));
};

export const CustomerTableManagementModal: React.FC<CustomerTableManagementModalProps> = ({
  isOpen,
  onClose,
  tables,
  targetTableNumbers,
  onEnsureTables,
  onToggleTableSelfOrder,
  onToggleAllTables,
}) => {
  if (!isOpen) return null;

  const sortedTables = [...tables].sort((a, b) =>
    String(a.number).localeCompare(String(b.number), 'id', { numeric: true, sensitivity: 'base' }),
  );
  const actualNumberSet = new Set(sortedTables.map((table) => normalizeTableNumber(table.number)));
  const configuredTargetNumbers = normalizeTableNumbers(targetTableNumbers);
  const effectiveTargetNumbers = configuredTargetNumbers.length
    ? configuredTargetNumbers
    : normalizeTableNumbers(sortedTables.map((table) => table.number));
  const missingTargetNumbers = effectiveTargetNumbers.filter((number) => !actualNumberSet.has(number));

  const readyCount = sortedTables.filter(
    (table) => table.isSelfOrderEnabled === true && table.status === 'READY' && !table.activeOrderId,
  ).length;
  const occupiedCount = sortedTables.filter(
    (table) => Boolean(table.activeOrderId) || table.status === 'OCCUPIED',
  ).length;
  const enabledCount = sortedTables.filter((table) => table.isSelfOrderEnabled === true).length;
  const databaseCount = sortedTables.length;
  const targetCount = effectiveTargetNumbers.length || databaseCount;

  const requestReconcile = () => {
    if (!onEnsureTables || !effectiveTargetNumbers.length) return;
    void Promise.resolve(onEnsureTables(effectiveTargetNumbers));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,.28)] animate-in fade-in zoom-in-95 duration-200 font-sans sm:max-w-lg">
        <div className="p-6 pb-4 bg-white flex items-start justify-between shrink-0">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-0.5">
              CUSTOMER ORDER
            </span>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Meja</h2>
            <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
              Inventori meja cabang dan akses customer order. POS kasir tetap bebas.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer shrink-0 mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4 overflow-y-auto max-h-[80vh]">
          <div className="bg-[var(--surface-main)] rounded-2xl p-5 border border-slate-200/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">Siap {readyCount}</span>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">Terpakai {occupiedCount}</span>
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">ON {enabledCount}</span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">DB {databaseCount}</span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-800">Target {targetCount}</span>
                {missingTargetNumbers.length > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
                    Sinkron {missingTargetNumbers.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleAllTables(true)}
                  className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all"
                  style={{ background: 'linear-gradient(180deg, #059669 0%, #047857 100%)', color: '#ffffff' }}
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

            {missingTargetNumbers.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-900">Database belum lengkap</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-amber-800">
                    Menunggu meja: <span className="font-mono font-black">{missingTargetNumbers.join(', ')}</span>. Meja baru dibuat NONAKTIF.
                  </p>
                </div>
                {onEnsureTables && (
                  <button
                    type="button"
                    onClick={requestReconcile}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-2 text-[10px] font-black text-white hover:bg-amber-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Sinkronkan
                  </button>
                )}
              </div>
            )}

            {sortedTables.length === 0 && missingTargetNumbers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                <p className="text-sm font-black text-slate-700">Belum ada meja di database cabang ini</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">Daftarkan inventori meja dari Pengaturan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2.5 pt-1">
                {sortedTables.map((tbl) => {
                  const presentation = getTablePresentation(tbl);
                  const isOccupied = presentation.isOccupied;
                  const isReadyForSelfOrder = presentation.selfOrderAvailable;
                  const visualClass = `${presentation.cardClass} ${isReadyForSelfOrder ? 'text-emerald-800 shadow-sm' : isOccupied ? 'text-rose-800 shadow-sm' : 'text-slate-500'}`;
                  const dotClass = presentation.dotClass;

                  return (
                    <button
                      key={tbl.id}
                      type="button"
                      disabled={!presentation.canToggleSelfOrder}
                      onClick={() => onToggleTableSelfOrder(tbl.id, !isReadyForSelfOrder)}
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
                      className={`py-2 px-1 rounded-2xl border transition-all flex items-center justify-center gap-1.5 select-none disabled:cursor-not-allowed ${visualClass}`}
                    >
                      <span className="text-xs sm:text-sm font-bold">{tbl.number}</span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                    </button>
                  );
                })}

                {missingTargetNumbers.map((number) => (
                  <button
                    key={`pending-${number}`}
                    type="button"
                    disabled
                    title={`Meja ${number} sedang dibuat di database`}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-1 py-2 text-amber-700 opacity-80"
                  >
                    <span className="text-xs sm:text-sm font-bold">{number}</span>
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] font-semibold text-slate-400 text-center pt-1">
              Hijau = siap customer order, merah = sedang dipakai, abu = nonaktif, kuning putus-putus = menunggu sinkron database.
            </p>
          </div>

          <div className="pt-1 px-1">
            <p className="text-xs font-semibold text-slate-400 leading-relaxed text-left">
              Setelah pesanan meja dibayar, meja kembali nonaktif untuk customer order. Aktifkan kembali meja yang siap digunakan dari layar ini.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
