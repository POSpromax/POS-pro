import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Grid2X2,
  Printer,
  Search,
  Smartphone,
  Users,
} from 'lucide-react';
import { RestaurantTable } from '../../types/pos';
import { updateCloudTableSession } from '../../services/tableService';
import { buildBranchSelfOrderUrl } from '../../utils/selfOrderUrl';
import { QrCodeCanvas } from './QrCodeCanvas';

interface TableManagementViewProps {
  tables: RestaurantTable[];
  branchId: string;
  branchName?: string;
  selfOrderBaseUrl?: string;
  onSelfOrderBaseUrlChange?: (baseUrl: string) => void | Promise<void>;
  onToggleSelfOrder: (tableNumber: string, enabled: boolean) => void;
  onClearTableStatus: (tableNumber: string) => void;
  onOpenCustomerSelfOrderModal: (tableNumber: string) => void;
  onTableUpdated: (table: RestaurantTable) => void;
  onOpenQrPrint?: () => void;
}

const normalizeNumber = (value: string) => value.trim().toUpperCase().replace(/^0+(?=\d)/, '');

export const TableManagementView: React.FC<TableManagementViewProps> = ({
  tables,
  branchId,
  branchName,
  selfOrderBaseUrl,
  onSelfOrderBaseUrlChange,
  onToggleSelfOrder,
  onClearTableStatus,
  onOpenCustomerSelfOrderModal,
  onTableUpdated,
  onOpenQrPrint,
}) => {
  const [customBaseUrl, setCustomBaseUrl] = useState(() => selfOrderBaseUrl || (typeof window === 'undefined' ? '' : window.location.origin));
  const [query, setQuery] = useState('');
  const [copiedTableNumber, setCopiedTableNumber] = useState<string | null>(null);
  const [busyTable, setBusyTable] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setCustomBaseUrl(selfOrderBaseUrl || window.location.origin);
  }, [branchId, selfOrderBaseUrl]);

  const saveBaseUrl = async (value: string) => {
    try {
      const normalized = new URL(value).origin;
      setCustomBaseUrl(normalized);
      await onSelfOrderBaseUrlChange?.(normalized);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Domain QR harus berupa URL lengkap, contoh https://order-nama-outlet.com');
    }
  };

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

  const toggleSelfOrder = async (table: RestaurantTable) => {
    const enabled = !table.isSelfOrderEnabled;
    setBusyTable(table.id);
    setErrorMessage(null);
    try {
      const result = await updateCloudTableSession({ action: 'SET_ENABLED', branchId, tableNumber: normalizeNumber(table.number), enabled });
      onTableUpdated(result.table);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Pengaturan Self-order gagal disimpan');
    } finally {
      setBusyTable(null);
    }
  };

  return (
    <div className="ui-surface flex-1 overflow-y-auto p-4 font-sans text-[var(--text-primary)] md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Grid2X2 className="h-6 w-6 text-[var(--primary)]" />
            <h1 className="text-xl font-bold tracking-tight">Meja & QR Self-order</h1>
            {branchName && (
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-0.5 text-xs font-extrabold text-orange-700 shadow-xs">
                📍 Outlet: {branchName}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Satu QR permanen untuk satu cabang. Kasir menentukan meja yang dapat dipilih pelanggan melalui kontrol ON/OFF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          {onOpenQrPrint && (
            <button
              type="button"
              onClick={onOpenQrPrint}
              className="ui-button ui-button-primary gap-1.5 px-3 py-2 text-xs shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Cetak Semua Label QR Meja
            </button>
          )}
          <span className="ui-badge bg-[var(--surface-secondary)] text-[var(--text-secondary)]"><span className="h-2 w-2 rounded-full bg-[var(--text-tertiary)]" />Nonaktif</span>
          <span className="ui-badge border-[var(--accent-green)] bg-[var(--success-soft)] text-[var(--accent-green)]"><span className="h-2 w-2 rounded-full bg-[var(--accent-green)]" />Siap</span>
          <span className="ui-badge border-[var(--accent-red)] bg-[var(--danger-soft)] text-[var(--accent-red)]"><span className="h-2 w-2 rounded-full bg-[var(--accent-red)]" />Terisi</span>
        </div>
      </div>

      <div className="ui-card mb-4 grid gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)]">
        <label className="relative block">
          <span className="sr-only">Cari nomor meja</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari meja: 17, 38, A7..." className="ui-input w-full !pl-9 !pr-3 text-xs font-bold" />
        </label>
        <label className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Domain QR</span>
          <input
            value={customBaseUrl}
            onChange={(event) => setCustomBaseUrl(event.target.value)}
            onBlur={() => void saveBaseUrl(customBaseUrl)}
            className="ui-input min-w-0 px-3 text-[11px] font-semibold"
          />
          <button
            type="button"
            onClick={() => {
              void saveBaseUrl(window.location.origin);
            }}
            className="ui-button ui-button-secondary px-3 text-[11px]"
          >
            Reset
          </button>
        </label>
      </div>

      {errorMessage && <div role="alert" className="mb-4 rounded-xl border border-[var(--accent-red)] bg-[var(--danger-soft)] px-4 py-3 text-xs font-bold text-[var(--accent-red)]">{errorMessage}</div>}

      {filteredTables.length === 0 ? (
        <div className="ui-card py-16 text-center"><Search className="mx-auto mb-2 h-8 w-8 text-[var(--text-tertiary)]" /><p className="text-sm font-bold">Nomor meja tidak ditemukan</p><p className="mt-1 text-xs text-[var(--text-secondary)]">Nomor meja boleh acak dan tidak harus berurutan.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTables.map((table) => {
            const tableNumber = normalizeNumber(table.number);
            const legacyInactive = table.status === 'FREE' || table.status === 'RESERVED';
            const status = legacyInactive ? 'DISABLED' : table.status;
            const ready = status === 'READY';
            const occupied = status === 'OCCUPIED';
            const busy = busyTable === table.id;
            const statusStyle = occupied
              ? 'border-[var(--accent-red)] bg-[var(--danger-soft)] text-[var(--accent-red)]'
              : ready
                ? 'border-[var(--accent-green)] bg-[var(--success-soft)] text-[var(--accent-green)]'
                : 'border-[var(--panel-border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]';

            // QR Code URL statis yang selalu dapat digunakan tanpa bergantung pada API server
            const qrUrl = buildBranchSelfOrderUrl(customBaseUrl, branchId);

            return (
              <article key={table.id} className="ui-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--panel-border-light)] p-3">
                  <div>
                    <p className="text-lg font-bold">Meja {tableNumber}</p>
                    <p className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-secondary)]">
                      <Users className="h-3 w-3" />{table.capacity} orang
                    </p>
                  </div>
                  <span className={`ui-badge ${statusStyle}`}>{occupied ? 'Terisi' : ready ? 'Siap' : 'Nonaktif'}</span>
                </div>

                <div className="p-3 space-y-3">
                  {/* Visual QR Code Meja */}
                  <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--panel-border)] bg-white p-3 shadow-xs">
                    <QrCodeCanvas value={qrUrl} size={140} className="rounded-lg border border-slate-100 p-1" />
                    <p className="mt-2 text-center text-[11px] font-bold text-[var(--text-secondary)]">
                      Scan lalu pilih meja aktif
                    </p>
                  </div>

                  {/* Action Bar per Meja */}
                  <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
                    <button
                      type="button"
                      onClick={() => void copyLink(tableNumber, qrUrl)}
                      className="ui-button ui-button-secondary flex items-center justify-center gap-1 px-2 text-[11px]"
                    >
                      {copiedTableNumber === tableNumber ? <Check className="h-3.5 w-3.5 text-[var(--accent-green)]" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedTableNumber === tableNumber ? 'Tersalin' : 'Salin link'}
                    </button>
                    <a
                      href={qrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
                      title="Buka Self-Order"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onOpenCustomerSelfOrderModal(tableNumber)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary-hover)]"
                      title="Simulator Self-Order"
                    >
                      <Smartphone className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Tombol Cetak Label Meja & Toggle Self-Order */}
                  <div className="flex items-center justify-between gap-2 border-t pt-2.5" style={{ borderColor: 'var(--panel-border-light)' }}>
                    <span className="text-[11px] font-bold text-[var(--text-secondary)]">Akses Self-order</span>
                    <button
                      type="button"
                      onClick={() => void toggleSelfOrder(table)}
                      disabled={busy}
                      className={`rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-50 ${table.isSelfOrderEnabled ? 'bg-[var(--primary)] text-white' : 'bg-[var(--panel-border)] text-[var(--text-secondary)]'}`}
                    >
                      {table.isSelfOrderEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {occupied && (
                    <button
                      type="button"
                      onClick={() => onClearTableStatus(tableNumber)}
                      className="w-full rounded-xl py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
                    >
                      Kosongkan meja
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
