import React, { useMemo, useState } from 'react';
import { X, Printer, QrCode, Smartphone, Sparkles, Utensils } from 'lucide-react';
import type { Branch, RestaurantTable, RestaurantProfile } from '../../types/pos';
import { buildBranchSelfOrderUrl } from '../../utils/selfOrderUrl';
import { QrCodeCanvas } from './QrCodeCanvas';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  currentBranch: Branch;
  profile: RestaurantProfile;
  selfOrderBaseUrl?: string;
  tenantId?: string;
}

export const QrLabelPrintModal: React.FC<Props> = ({ isOpen, onClose, tables, currentBranch, profile, selfOrderBaseUrl, tenantId }) => {
  const baseUrl = selfOrderBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const [selectedTableNumber, setSelectedTableNumber] = useState<string>('ALL');

  const availableTables = useMemo(
    () =>
      [...tables]
        .filter((t) => t.branchId === currentBranch.id)
        .sort((a, b) => a.number.localeCompare(b.number, 'id', { numeric: true })),
    [tables, currentBranch.id]
  );

  const labels = useMemo(
    () =>
      availableTables
        .filter((t) => selectedTableNumber === 'ALL' || t.number === selectedTableNumber)
        .map((t) => ({
          number: t.number,
          capacity: t.capacity,
          url: buildBranchSelfOrderUrl(baseUrl, currentBranch.id, tenantId, currentBranch.code),
        })),
    [availableTables, selectedTableNumber, currentBranch.id, baseUrl, tenantId],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-md sm:p-5">
      {/* Aturan cetak cetak presisi: sembunyikan UI app, tampilkan hanya area label. */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body * { visibility: hidden !important; }
          .qr-print-area, .qr-print-area * { visibility: visible !important; }
          .qr-print-area {
            position: absolute;
            inset: 0;
            margin: 0;
            padding: 0;
            background: white !important;
          }
          .qr-no-print { display: none !important; }
          .qr-print-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 16px !important;
          }
          .qr-label-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: 2px solid #000 !important;
          }
        }
      `}</style>

      <div className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header Control */}
        <div className="qr-no-print flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 md:p-5 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 md:text-xl">Desain Label QR Code Meja</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                QR permanen per cabang. Pelanggan memilih meja yang sedang diaktifkan kasir.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Meja */}
            <select
              value={selectedTableNumber}
              onChange={(e) => setSelectedTableNumber(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="ALL">Semua Meja ({availableTables.length})</option>
              {availableTables.map((t) => (
                <option key={t.id} value={t.number}>
                  Meja {t.number}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={labels.length === 0}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Cetak Sekarang
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 text-slate-500 hover:bg-slate-200 cursor-pointer"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Print Preview & Printable Canvas Area */}
        <div className="qr-print-area flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100/70 scrollbar-thin">
          {labels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
              <QrCode className="mb-2 h-10 w-10 text-slate-300" />
              <p className="text-sm font-bold">Tidak ada label meja untuk ditampilkan</p>
            </div>
          ) : (
            <div className="qr-print-grid grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {labels.map((label) => (
                <div
                  key={label.number}
                  className="qr-label-card relative flex flex-col items-center justify-between rounded-3xl border-2 border-slate-900 bg-white p-5 text-center shadow-lg transition-all"
                >
                  {/* Banner Resto */}
                  <div className="w-full border-b-2 border-slate-900 pb-3">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-900 line-clamp-1">
                      {profile.name || currentBranch.name}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-700 tracking-tight flex items-center justify-center gap-1 mt-0.5">
                      <Sparkles className="h-3 w-3" /> SELF-ORDER MENU
                    </p>
                  </div>

                  {/* QR Canvas Container */}
                  <div className="my-3 flex flex-col items-center">
                    <div className="rounded-2xl border-2 border-slate-900 bg-white p-2.5 shadow-sm">
                      <QrCodeCanvas value={label.url} size={170} />
                    </div>
                  </div>

                  {/* Meja Badge & Instructions */}
                  <div className="w-full space-y-2">
                    <div className="rounded-xl bg-slate-900 py-1.5 px-3 text-white">
                      <p className="text-xl font-black tracking-wide">MEJA {label.number}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-900 flex items-center justify-center gap-1">
                        <Smartphone className="h-3.5 w-3.5 text-emerald-600" /> SCAN DENGAN KAMERA HP
                      </p>
                      <p className="text-[10px] font-medium text-slate-500 leading-tight">
                        1. Scan QR &nbsp;•&nbsp; 2. Pilih Menu &nbsp;•&nbsp; 3. Pesan Langsung
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

