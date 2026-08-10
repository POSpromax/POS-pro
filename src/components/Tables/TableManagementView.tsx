import React, { useState, useCallback } from 'react';
import {
  Grid2X2,
  Smartphone,
  Copy,
  ExternalLink,
  Check,
  Globe,
  ShieldCheck,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { RestaurantTable } from '../../types/pos';
import { QrCodeCanvas } from './QrCodeCanvas';
import { generateQrToken, buildSelfOrderUrl } from '../../utils/qrToken';

interface TableManagementViewProps {
  tables: RestaurantTable[];
  branchId: string;
  onToggleSelfOrder: (tableNumber: string, enabled: boolean) => void;
  onClearTableStatus: (tableNumber: string) => void;
  onOpenCustomerSelfOrderModal: (tableNumber: string) => void;
}

interface TableToken {
  url: string;
  generatedAt: number;
}

export const TableManagementView: React.FC<TableManagementViewProps> = ({
  tables,
  branchId,
  onToggleSelfOrder,
  onClearTableStatus,
  onOpenCustomerSelfOrderModal
}) => {
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') return window.location.origin;
    return 'https://pos-pro-eight.vercel.app';
  });
  const [copiedTableNumber, setCopiedTableNumber] = useState<string | null>(null);
  const [tableTokens, setTableTokens] = useState<Record<string, TableToken>>({});
  const [generatingTable, setGeneratingTable] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  const handleCopyLink = (tableNum: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedTableNumber(tableNum);
    setTimeout(() => setCopiedTableNumber(null), 2000);
  };

  const generateTokenForTable = useCallback(async (tableNumber: string): Promise<TableToken | null> => {
    try {
      const token = await generateQrToken(branchId, tableNumber);
      const url = buildSelfOrderUrl(customBaseUrl, branchId, tableNumber, token);
      return { url, generatedAt: Date.now() };
    } catch {
      return null;
    }
  }, [branchId, customBaseUrl]);

  const handleGenerateQr = useCallback(async (tableNumber: string) => {
    setGeneratingTable(tableNumber);
    const result = await generateTokenForTable(tableNumber);
    if (result) setTableTokens((prev) => ({ ...prev, [tableNumber]: result }));
    setGeneratingTable(null);
  }, [generateTokenForTable]);

  const handleGenerateAll = useCallback(async () => {
    setGeneratingAll(true);
    const enabledTables = tables.filter((t) => t.isSelfOrderEnabled);
    const results: Record<string, TableToken> = {};
    for (const table of enabledTables) {
      const num = (table.number || '').replace(/^0+/, '') || table.number;
      const result = await generateTokenForTable(num);
      if (result) results[num] = result;
    }
    setTableTokens((prev) => ({ ...prev, ...results }));
    setGeneratingAll(false);
  }, [tables, generateTokenForTable]);

  return (
    <div className="flex-1 bg-[#F8FAFC] p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col text-slate-900">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#1A1714] tracking-tight flex items-center gap-2">
            <Grid2X2 className="w-6 h-6 md:w-7 md:h-7 text-[#EA580C]" />
            Manajemen Meja & QR Self-Order
          </h1>
          <p className="text-[11px] md:text-xs text-slate-500 font-bold mt-1">
            Generate QR barcode aman per meja. Setiap QR berisi token unik yang berlaku 12 jam.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-[#EAE3DB] px-3 py-1.5 rounded-full text-[10px] font-bold shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Bebas</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ml-2" />
            <span className="text-slate-600">Terisi</span>
          </div>
          <button
            type="button"
            onClick={handleGenerateAll}
            disabled={generatingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C1B19] hover:bg-black text-white text-[10px] font-black cursor-pointer disabled:opacity-50 transition-all"
          >
            {generatingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {generatingAll ? 'Generating...' : 'Generate Semua QR'}
          </button>
        </div>
      </div>

      {/* Custom Domain Base URL */}
      <div className="bg-white border border-[#EAE3DB] p-3 md:p-4 rounded-2xl mb-6 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0">
            <Globe className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-[11px] font-black text-slate-900 uppercase">Base Domain QR</h3>
            <p className="text-[10px] font-bold text-slate-400">Domain dasar URL self-order</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={customBaseUrl}
            onChange={(e) => setCustomBaseUrl(e.target.value)}
            placeholder="https://pos-pro-eight.vercel.app"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={() => setCustomBaseUrl(window.location.origin)}
            className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Grid of Tables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map((table) => {
          const cleanNumber = (table.number || '').replace(/^0+/, '') || table.number;
          const isOccupied = table.status === 'OCCUPIED';
          const tokenData = tableTokens[cleanNumber];
          const hasQr = Boolean(tokenData?.url);
          const isGenerating = generatingTable === cleanNumber;
          const fallbackUrl = `${customBaseUrl.replace(/\/$/, '')}/?selforder=true&branch=${encodeURIComponent(branchId)}&table=${cleanNumber}`;
          const displayUrl = tokenData?.url || fallbackUrl;

          return (
            <div
              key={table.id}
              className={`bg-white rounded-2xl p-4 md:p-5 border shadow-2xs flex flex-col justify-between transition-all ${
                isOccupied
                  ? 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/50'
                  : 'border-[#EAE3DB] hover:border-[#EA580C]'
              }`}
            >
              <div>
                {/* Table Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg md:text-xl font-black text-[#1A1714]">MEJA {cleanNumber}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{table.capacity} Org</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      isOccupied
                        ? 'bg-rose-500 text-white shadow-2xs'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {isOccupied ? 'TERISI' : 'BEBAS'}
                  </span>
                </div>

                {/* QR Code Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center my-3 flex flex-col items-center gap-2">
                  {hasQr ? (
                    <QrCodeCanvas value={displayUrl} size={140} className="rounded-lg" />
                  ) : (
                    <div className="w-[140px] h-[140px] flex items-center justify-center bg-white rounded-lg border border-dashed border-slate-300">
                      <button
                        type="button"
                        onClick={() => handleGenerateQr(cleanNumber)}
                        disabled={isGenerating || !table.isSelfOrderEnabled}
                        className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-orange-600 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-8 h-8 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-8 h-8" />
                        )}
                        <span className="text-[10px] font-black">
                          {!table.isSelfOrderEnabled ? 'Aktifkan dulu' : isGenerating ? 'Generating...' : 'Generate QR'}
                        </span>
                      </button>
                    </div>
                  )}

                  {hasQr && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      Token aman · berlaku 12 jam
                    </div>
                  )}

                  <div className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[8px] font-mono text-slate-500 truncate">
                    {displayUrl}
                  </div>

                  <div className="flex items-center justify-center gap-2 w-full pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(cleanNumber, displayUrl)}
                      className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {copiedTableNumber === cleanNumber ? (
                        <><Check className="w-3 h-3 text-emerald-400" /> Tersalin!</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Salin Link</>
                      )}
                    </button>
                    <a
                      href={displayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 flex items-center justify-center cursor-pointer"
                      title="Buka Self-Order"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {hasQr && (
                      <button
                        type="button"
                        onClick={() => handleGenerateQr(cleanNumber)}
                        disabled={isGenerating}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer disabled:opacity-50"
                        title="Regenerate token"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Self-Order Toggle */}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-full border border-slate-200 my-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-bold text-slate-800">Self-Order HP:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleSelfOrder(cleanNumber, !table.isSelfOrderEnabled)}
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
                  onClick={() => onOpenCustomerSelfOrderModal(cleanNumber)}
                  className="w-full py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer active:scale-95"
                >
                  <Smartphone className="w-4 h-4" /> Simulator QR Order
                </button>
                {isOccupied && (
                  <button
                    type="button"
                    onClick={() => onClearTableStatus(cleanNumber)}
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
