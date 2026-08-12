import React, { useState, useEffect } from 'react';
import { Bell, Grid2X2, Printer, Search, Store, Wifi, WifiOff } from 'lucide-react';
import { Branch, PrinterConfig, UserAccount, RestaurantTable, Order } from '../../types/pos';

interface HeaderBarProps {
  systemPortal?: 'KASIR' | 'OWNER';
  onSwitchPortal?: (portal: 'KASIR' | 'OWNER') => void;
  branches: Branch[];
  currentBranch: Branch;
  onSelectBranch: (branch: Branch) => void;
  printerConfig: PrinterConfig;
  onOpenPrinterSetup: () => void;
  onOpenCustomerSelfOrder?: () => void;
  onOpenTableManagement?: () => void;
  onOpenTableModal?: () => void;
  tables?: RestaurantTable[];
  orders?: Order[];
  isOnline: boolean;
  pendingSyncCount: number;
  onManualSync: () => void;
  activeUser: UserAccount;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeTab?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  systemPortal = 'KASIR',
  onSwitchPortal,
  branches,
  currentBranch,
  onSelectBranch,
  printerConfig,
  onOpenPrinterSetup,
  onOpenCustomerSelfOrder,
  onOpenTableManagement,
  onOpenTableModal,
  tables = [],
  orders = [],
  isOnline,
  pendingSyncCount,
  onManualSync,
  activeUser,
  searchTerm,
  setSearchTerm,
  activeTab = 'pos',
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      const day  = now.toLocaleDateString('id-ID', { weekday: 'short' }).toUpperCase();
      const date = now.getDate();
      const mon  = now.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase();
      setDateStr(`${day}, ${date} ${mon}`);
    };
    update();
    const id = window.setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  const isOwnerMode = systemPortal === 'OWNER';

  return (
    <header
      id="app-header-bar"
      className="z-20 flex h-12 shrink-0 select-none items-center justify-between gap-3 rounded-2xl border px-3.5 font-sans transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.96)',
        borderColor: 'var(--panel-border)',
        boxShadow: '0 2px 12px rgba(26,23,20,0.055)',
        backdropFilter: 'blur(16px)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ── LEFT: Clock + Connection ─────────────────────── */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Time */}
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-mono text-[13px] font-bold leading-none tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {timeStr}
          </span>
          <span
            className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {dateStr}
          </span>
        </div>

        {/* Online / Offline pill */}
        <div
          className="flex h-5 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold tracking-wider shrink-0"
          style={
            isOnline
              ? { background: 'var(--success-soft)', color: 'var(--accent-green)', borderColor: '#86efac' }
              : { background: 'var(--surface-secondary)', color: 'var(--text-secondary)', borderColor: 'var(--panel-border-strong)' }
          }
          role="status"
          title={`Status internet: ${isOnline ? 'terhubung' : 'terputus'}`}
          id="btn-toggle-online-status"
        >
          {isOnline
            ? <Wifi className="h-2.5 w-2.5" />
            : <WifiOff className="h-2.5 w-2.5" />}
          <span className="hidden sm:inline">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        {/* Pending sync badge */}
        {pendingSyncCount > 0 && (
          <button
            type="button"
            onClick={onManualSync}
            className="flex h-5 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold tracking-wider shrink-0 cursor-pointer transition-colors"
            style={{ background: 'var(--warning-soft)', color: '#b45309', borderColor: '#fde68a' }}
            title={`${pendingSyncCount} transaksi pending — klik untuk sync`}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            {pendingSyncCount} pending
          </button>
        )}
      </div>

      {/* ── MIDDLE / RIGHT: Kasir mode controls ─────────── */}
      {activeTab === 'pos' && !isOwnerMode && (
        <div className="flex flex-1 items-center justify-end gap-2 overflow-x-auto scrollbar-none pl-2">

          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all w-36 sm:w-48 focus-within:w-52"
            style={{
              background: 'var(--surface-secondary)',
              borderColor: 'var(--panel-border)',
              color: 'var(--text-primary)',
            }}
            onFocus={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'var(--brand-400)';
              el.style.background = 'var(--surface-card)';
              el.style.boxShadow = '0 0 0 3px rgb(234 88 12 / 10%)';
            }}
            onBlur={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'var(--panel-border)';
              el.style.background = 'var(--surface-secondary)';
              el.style.boxShadow = 'none';
            }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            <input
              id="input-header-search"
              type="text"
              placeholder="Cari menu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-[12px] font-semibold outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          {/* Table Management */}
          {onOpenTableManagement && (
            <button
              id="btn-header-meja-customer"
              type="button"
              onClick={onOpenTableManagement}
              className="ui-button ui-button-primary shrink-0 gap-1.5 text-[11px]"
              style={{ minHeight: '32px', padding: '0 12px' }}
              title="Konfigurasi Meja Customer Order"
            >
              <Grid2X2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Meja Customer</span>
              <span className="sm:hidden">Meja</span>
            </button>
          )}

          {/* Printer */}
          <button
            id="btn-header-setup-printer"
            type="button"
            onClick={onOpenPrinterSetup}
            className={`ui-button shrink-0 gap-1.5 text-[11px] ${
              printerConfig.isConnected ? 'ui-button-secondary' : 'ui-button-soft'
            }`}
            style={{ minHeight: '32px', padding: '0 12px' }}
          >
            <Printer
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: printerConfig.isConnected ? 'var(--primary-hover)' : 'var(--accent-red)' }}
            />
            <span className="hidden sm:inline">
              {printerConfig.isConnected ? 'Printer Ready' : 'Setup Printer'}
            </span>
          </button>
        </div>
      )}

      {/* ── OWNER mode right ─────────────────────────────── */}
      {isOwnerMode && onSwitchPortal && (
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => onSwitchPortal('KASIR')}
            className="ui-button ui-button-primary gap-1.5 text-[11px]"
            style={{ minHeight: '32px', padding: '0 14px' }}
          >
            <Store className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Terminal POS Kasir</span>
            <span className="sm:hidden">Kasir</span>
          </button>
        </div>
      )}
    </header>
  );
};
