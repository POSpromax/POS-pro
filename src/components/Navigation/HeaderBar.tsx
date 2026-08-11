import React, { useState, useEffect } from 'react';
import { Printer, Search, Store, Grid2X2 } from 'lucide-react';
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
  activeTab = 'pos'
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      const dayName = now.toLocaleDateString('id-ID', { weekday: 'short' }).toUpperCase();
      const dateNum = now.getDate();
      const monthName = now.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase();
      setDateStr(`${dayName}, ${dateNum} ${monthName}`);
    };
    updateTime();
    const interval = window.setInterval(updateTime, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isOwnerMode = systemPortal === 'OWNER';

  return (
    <header
      id="app-header-bar"
      className="z-20 flex h-12 shrink-0 select-none items-center justify-between gap-3 rounded-2xl border border-[var(--panel-border)] bg-white/95 px-3.5 font-sans text-[var(--text-primary)] shadow-[0_3px_14px_rgba(26,23,20,0.06)] backdrop-blur-xl transition-all duration-300"
    >
      {/* Left: Time & Connection */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-sm font-bold leading-none tracking-tight text-[var(--text-primary)]">
            {timeStr}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {dateStr}
          </span>
        </div>

        <div
          id="btn-toggle-online-status"
          role="status"
          className={`h-5 px-2 rounded-lg border flex items-center justify-center shrink-0 text-[10px] font-bold tracking-wider ${
            isOnline
              ? 'bg-[#EAF8F1] text-[#168253] border-[#CCEBDC]'
              : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--panel-border-strong)]'
          }`}
          title={`Status internet: ${isOnline ? 'terhubung' : 'terputus'}`}
        >
          {isOnline ? 'INTERNET' : 'OFFLINE'}
        </div>
      </div>

      {/* Middle & Right Controls */}
      {activeTab === 'pos' && !isOwnerMode && (
        <div className="flex-1 flex items-center justify-end gap-2 overflow-x-auto scrollbar-none pl-2">
          {/* Search */}
          <div className="bg-[var(--surface-secondary)] text-[var(--text-primary)] rounded-lg px-3 py-1.5 flex items-center gap-2 border border-[var(--panel-border)] transition-all w-40 sm:w-52 focus-within:w-56 focus-within:border-[var(--brand-300)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--primary)]/10 shrink-0">
            <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
            <input
              id="input-header-search"
              type="text"
              placeholder="Cari menu, kode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-[var(--text-primary)] text-xs outline-none placeholder:text-[var(--text-tertiary)] font-semibold"
            />
          </div>

          {/* Table Button */}
          {onOpenTableManagement && (
            <button
              id="btn-header-meja-customer"
              type="button"
              onClick={onOpenTableManagement}
              className="flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg transition-all shadow-sm shadow-slate-950/10 cursor-pointer active:scale-95 shrink-0"
              title="Konfigurasi Meja Customer Order"
            >
              <Grid2X2 className="w-3.5 h-3.5" />
              <span>Meja Customer</span>
            </button>
          )}

          {/* Printer */}
          <button
            id="btn-header-setup-printer"
            onClick={onOpenPrinterSetup}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
              printerConfig.isConnected
                ? 'bg-[var(--surface-secondary)] text-[var(--text-primary)] border-[var(--panel-border-strong)] hover:bg-[#E6EEFF]'
                : 'bg-[var(--surface-card)] text-[var(--primary-hover)] border-[var(--primary-border)] hover:bg-[var(--primary-soft)]'
            }`}
          >
            <Printer className={`w-3.5 h-3.5 ${printerConfig.isConnected ? 'text-[var(--primary-hover)]' : 'text-[#E5484D]'}`} />
            <span>{printerConfig.isConnected ? 'Printer Ready' : 'Setup Printer'}</span>
          </button>
        </div>
      )}

      {/* Owner mode right */}
      {isOwnerMode && onSwitchPortal && (
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => onSwitchPortal('KASIR')}
            className="flex items-center gap-1.5 bg-[var(--primary-solid)] hover:bg-[var(--primary-pressed)] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            <Store className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Terminal POS Kasir</span>
          </button>
        </div>
      )}
    </header>
  );
};
