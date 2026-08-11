import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Grid2X2,
  Loader2,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { RestaurantTable } from '../../types/pos';
import { updateCloudTableSession } from '../../services/tableService';
import { QrCodeCanvas } from './QrCodeCanvas';

interface TableManagementViewProps {
  tables: RestaurantTable[];
  branchId: string;
  onToggleSelfOrder: (tableNumber: string, enabled: boolean) => void;
  onClearTableStatus: (tableNumber: string) => void;
  onOpenCustomerSelfOrderModal: (tableNumber: string, qrToken?: string) => void;
  onTableUpdated: (table: RestaurantTable) => void;
}

interface TableToken {
  token: string;
  url: string;
  generatedAt: number;
}

const normalizeNumber = (value: string) => value.trim().toUpperCase().replace(/^0+(?=\d)/, '');

export const TableManagementView: React.FC<TableManagementViewProps> = ({
  tables,
  branchId,
  onToggleSelfOrder,
  onClearTableStatus,
  onOpenCustomerSelfOrderModal,
  onTableUpdated,
}) => {
  const [customBaseUrl, setCustomBaseUrl] = useState(() => typeof window === 'undefined' ? 'https://pos-pro-eight.vercel.app' : window.location.origin);
  const [query, setQuery] = useState('');
  const [copiedTableNumber, setCopiedTableNumber] = useState<string | null>(null);
  const [tableTokens, setTableTokens] = useState<Record<string, TableToken>>({});
  const [busyTable, setBusyTable] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredTables = useMemo(() => {
    const normalizedQuery = normalizeNumber(query);
    if (!normalizedQuery) return tables;
    return tables.filter((table) => normalizeNumber(table.number).includes(normalizedQuery));
  }, [query, tables]);

  const copyLink = async (tableNumber: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedTableNumber(tableNumber);
    window.setTimeout(() => setCopiedTableNumber(null), 2000);
  };

  const activateTable = async (table: RestaurantTable) => {
    const tableNumber = normalizeNumber(table.number);
    setBusyTable(table.id);
    setErrorMessage(null);
    try {
      const active = table.status === 'READY' || table.status === 'OCCUPIED';
      const result = await updateCloudTableSession({
        action: active ? 'ROTATE' : 'ACTIVATE',
        branchId,
        tableNumber,
        baseUrl: customBaseUrl,
      });
      onTableUpdated(result.table);
      if (result.token && result.url) {
        setTableTokens((current) => ({ ...current, [tableNumber]: { token: result.token!, url: result.url!, generatedAt: Date.now() } }));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Meja gagal diaktifkan');
    } finally {
      setBusyTable(null);
    }
  };

  const deactivateTable = async (table: RestaurantTable) => {
    const occupied = table.status === 'OCCUPIED';
    const confirmed = window.confirm(occupied
      ? `Meja ${table.number} masih memiliki bill aktif. Nonaktifkan QR secara paksa tanpa menghapus bill?`
      : `Nonaktifkan sesi QR Meja ${table.number}? Foto QR sesi ini tidak akan berlaku lagi.`);
    if (!confirmed) return;
    setBusyTable(table.id);
    setErrorMessage(null);
    try {
      const result = await updateCloudTableSession({
        action: 'DEACTIVATE', branchId, tableNumber: normalizeNumber(table.number), force: occupied,
      });
      onTableUpdated(result.table);
      setTableTokens((current) => {
        const next = { ...current };
        delete next[normalizeNumber(table.number)];
        return next;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Meja gagal dinonaktifkan');
    } finally {
      setBusyTable(null);
    }
  };

  const toggleSelfOrder = async (table: RestaurantTable) => {
    const enabled = !table.isSelfOrderEnabled;
    setBusyTable(table.id);
    setErrorMessage(null);
    try {
      const result = await updateCloudTableSession({ action: 'SET_ENABLED', branchId, tableNumber: normalizeNumber(table.number), enabled });
      onTableUpdated(result.table);
      onToggleSelfOrder(normalizeNumber(table.number), enabled);
      if (!enabled) {
        setTableTokens((current) => {
          const next = { ...current };
          delete next[normalizeNumber(table.number)];
          return next;
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Pengaturan Self-order gagal disimpan');
    } finally {
      setBusyTable(null);
    }
  };

  return (
    <div className="ui-surface flex-1 overflow-y-auto p-4 font-sans text-[#17202A] md:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Grid2X2 className="h-6 w-6 text-[#FF7A00]" /><h1 className="text-xl font-black tracking-tight">Meja & QR Self-order</h1></div>
          <p className="mt-1 text-[11px] font-semibold text-[#667085]">Cari nomor fisik acak, aktifkan sesi, lalu QR lama otomatis gugur pada aktivasi berikutnya.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-bold">
          <span className="ui-badge bg-[#F1F2F3] text-[#667085]"><span className="h-2 w-2 rounded-full bg-[#98A2B3]" />Nonaktif</span>
          <span className="ui-badge border-[#BEE6CC] bg-[#EAF8EF] text-[#187A42]"><span className="h-2 w-2 rounded-full bg-[#22A559]" />Siap</span>
          <span className="ui-badge border-[#F4C6C8] bg-[#FDECEC] text-[#B4232A]"><span className="h-2 w-2 rounded-full bg-[#E5484D]" />Terisi</span>
        </div>
      </div>

      <div className="ui-card mb-4 grid gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)]">
        <label className="relative block">
          <span className="sr-only">Cari nomor meja</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari meja: 17, 38, A7..." className="ui-input w-full pl-9 pr-3 text-xs font-bold" />
        </label>
        <label className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#667085]">Domain QR</span>
          <input value={customBaseUrl} onChange={(event) => setCustomBaseUrl(event.target.value)} className="ui-input min-w-0 px-3 text-[11px] font-semibold" />
          <button type="button" onClick={() => setCustomBaseUrl(window.location.origin)} className="ui-button ui-button-secondary px-3 text-[10px]">Reset</button>
        </label>
      </div>

      {errorMessage && <div role="alert" className="mb-4 rounded-xl border border-[#F4C6C8] bg-[#FDECEC] px-4 py-3 text-xs font-bold text-[#B4232A]">{errorMessage}</div>}

      {filteredTables.length === 0 ? (
        <div className="ui-card py-16 text-center"><Search className="mx-auto mb-2 h-8 w-8 text-[#98A2B3]" /><p className="text-sm font-black">Nomor meja tidak ditemukan</p><p className="mt-1 text-xs text-[#667085]">Nomor meja boleh acak dan tidak harus berurutan.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTables.map((table) => {
            const tableNumber = normalizeNumber(table.number);
            const legacyInactive = table.status === 'FREE' || table.status === 'RESERVED';
            const status = legacyInactive ? 'DISABLED' : table.status;
            const ready = status === 'READY';
            const occupied = status === 'OCCUPIED';
            const tokenData = tableTokens[tableNumber];
            const busy = busyTable === table.id;
            const statusStyle = occupied
              ? 'border-[#F4C6C8] bg-[#FDECEC] text-[#B4232A]'
              : ready
                ? 'border-[#BEE6CC] bg-[#EAF8EF] text-[#187A42]'
                : 'border-[#E2E5E9] bg-[#F1F2F3] text-[#667085]';

            return (
              <article key={table.id} className="ui-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#ECEEF1] p-3">
                  <div><p className="text-lg font-black">Meja {tableNumber}</p><p className="flex items-center gap-1 text-[10px] font-bold text-[#667085]"><Users className="h-3 w-3" />{table.capacity} orang</p></div>
                  <span className={`ui-badge ${statusStyle}`}>{occupied ? 'Terisi' : ready ? 'Siap' : 'Nonaktif'}</span>
                </div>

                <div className="p-3">
                  <div className="flex min-h-[168px] flex-col items-center justify-center rounded-xl border border-[#E2E5E9] bg-[#F7F7F6] p-3">
                    {tokenData ? (
                      <><QrCodeCanvas value={tokenData.url} size={132} className="rounded-lg" /><p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-[#187A42]"><ShieldCheck className="h-3 w-3" />Sesi generasi {table.qrGeneration || '-'}</p></>
                    ) : (
                      <><ShieldCheck className="h-9 w-9 text-[#98A2B3]" /><p className="mt-2 text-center text-[10px] font-bold text-[#667085]">{ready || occupied ? 'QR tidak disimpan di browser. Rotasi untuk menampilkan lagi.' : 'Aktifkan meja untuk membuat QR sesi baru.'}</p></>
                    )}
                  </div>

                  <button type="button" onClick={() => void activateTable(table)} disabled={busy || !table.isSelfOrderEnabled} className="ui-button ui-button-primary mt-3 flex w-full items-center justify-center gap-2 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : ready || occupied ? <RefreshCw className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    {busy ? 'Memproses...' : ready || occupied ? 'Rotasi QR sesi' : 'Aktifkan & buat QR'}
                  </button>

                  {tokenData && (
                    <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2">
                      <button type="button" onClick={() => void copyLink(tableNumber, tokenData.url)} className="ui-button ui-button-secondary flex items-center justify-center gap-1 px-2 text-[10px]">{copiedTableNumber === tableNumber ? <Check className="h-3.5 w-3.5 text-[#22A559]" /> : <Copy className="h-3.5 w-3.5" />}{copiedTableNumber === tableNumber ? 'Tersalin' : 'Salin link'}</button>
                      <a href={tokenData.url} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E5E9] bg-white text-[#667085]" aria-label={`Buka Self-order Meja ${tableNumber}`} title="Buka self-order"><ExternalLink className="h-4 w-4" /></a>
                      <button type="button" onClick={() => onOpenCustomerSelfOrderModal(tableNumber, tokenData.token)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#FFD4AD] bg-[#FFF2E6] text-[#D85F00]" aria-label={`Simulasikan Self-order Meja ${tableNumber}`} title="Simulator self-order"><Smartphone className="h-4 w-4" /></button>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-[#E2E5E9] bg-white p-2.5">
                    <span className="text-[10px] font-black text-[#475467]">Fitur Self-order</span>
                    <button type="button" onClick={() => void toggleSelfOrder(table)} disabled={busy} className={`rounded-full px-3 py-1 text-[10px] font-black disabled:opacity-50 ${table.isSelfOrderEnabled ? 'bg-[#17202A] text-white' : 'bg-[#E2E5E9] text-[#667085]'}`} aria-label={`${table.isSelfOrderEnabled ? 'Matikan' : 'Aktifkan'} Self-order Meja ${tableNumber}`}>{table.isSelfOrderEnabled ? 'ON' : 'OFF'}</button>
                  </div>

                  {(ready || occupied) && <button type="button" onClick={() => void deactivateTable(table)} disabled={busy} className="mt-2 min-h-9 w-full rounded-xl text-[10px] font-bold text-[#B4232A] hover:bg-[#FDECEC]">Nonaktifkan / revoke QR</button>}
                  {occupied && <button type="button" onClick={() => onClearTableStatus(tableNumber)} className="mt-1 min-h-9 w-full rounded-xl text-[10px] font-bold text-[#667085] hover:bg-[#F1F2F3]">Perbaiki status lokal meja</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
