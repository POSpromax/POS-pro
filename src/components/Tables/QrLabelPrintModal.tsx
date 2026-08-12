import React, { useMemo } from 'react';
import { X, Printer, QrCode } from 'lucide-react';
import type { Branch, RestaurantTable, RestaurantProfile } from '../../types/pos';
import { buildStaticSelfOrderUrl } from '../../utils/qrToken';
import { QrCodeCanvas } from './QrCodeCanvas';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  currentBranch: Branch;
  profile: RestaurantProfile;
}

// Alat CETAK LABEL QR — terpisah total dari manajemen/aktivasi meja. Setiap
// label berisi QR statis (branch + nomor meja) yang dicetak sekali lalu ditempel
// di meja; QR ini tidak pernah kedaluwarsa dan tidak terpengaruh on/off meja.
export const QrLabelPrintModal: React.FC<Props> = ({ isOpen, onClose, tables, currentBranch, profile }) => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const labels = useMemo(
    () =>
      [...tables]
        .filter((t) => !t.branchId || t.branchId === currentBranch.id)
        .sort((a, b) => a.number.localeCompare(b.number, 'id', { numeric: true }))
        .map((t) => ({
          number: t.number,
          url: buildStaticSelfOrderUrl(baseUrl, currentBranch.id, t.number.replace(/^0+(?=\d)/, '')),
        })),
    [tables, currentBranch.id, baseUrl],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-600/30 p-3 backdrop-blur-md sm:p-5">
      {/* Aturan cetak: sembunyikan seluruh app, tampilkan hanya area label. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .qr-print-area, .qr-print-area * { visibility: visible !important; }
          .qr-print-area { position: absolute; inset: 0; margin: 0; padding: 16px; }
          .qr-no-print { display: none !important; }
          .qr-label { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white shadow-[0_24px_70px_rgba(26,23,20,0.20)]">
        {/* Header */}
        <div className="qr-no-print flex shrink-0 items-center justify-between border-b border-[var(--panel-border)] p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-md">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] md:text-xl">Cetak Label QR Meja</h2>
              <p className="mt-0.5 text-xs font-medium text-[var(--text-secondary)]">
                Cetak sekali, tempel di tiap meja. QR tidak kedaluwarsa dan terpisah dari aktivasi meja.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={labels.length === 0}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Cetak
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Grid label */}
        <div className="qr-print-area flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
          {labels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <QrCode className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-bold">Belum ada meja untuk dicetak</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {labels.map((label) => (
                <div
                  key={label.number}
                  className="qr-label flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center"
                >
                  <p className="text-sm font-black uppercase tracking-wide text-[#1A1714]">
                    {profile.name || currentBranch.name}
                  </p>
                  <div className="rounded-xl border border-slate-100 bg-white p-1.5">
                    <QrCodeCanvas value={label.url} size={150} />
                  </div>
                  <p className="text-lg font-black text-[#1A1714]">Meja {label.number}</p>
                  <p className="text-[11px] font-bold text-slate-500">Scan untuk pesan sendiri</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
