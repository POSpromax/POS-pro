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
      className={`h-11 border px-3.5 flex items-center justify-between gap-3 shrink-0 z-20 font-sans select-none transition-all duration-300 rounded-[14px] ${
        isOwnerMode
          ? 'bg-[#17202A] border-[#303A45] text-white'
          : 'bg-[#FCFCFB]/95 backdrop-blur-xl border-[#E2E5E9] text-[#17202A]'
      }`}
      style={{ boxShadow: isOwnerMode ? 'none' : '0 1px 3px rgba(15,23,42,0.05)' }}
    >
      {/* Left: Time & Connection */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-sm font-bold tracking-tight font-mono leading-none ${isOwnerMode ? 'text-white' : 'text-[#17202A]'}`}>
            {timeStr}
          </span>
          <span className={`text-[9px] font-semibold uppercase tracking-wider ${isOwnerMode ? 'text-white/50' : 'text-[#98A2B3]'}`}>
            {dateStr}
          </span>
        </div>

        <div
          id="btn-toggle-online-status"
          role="status"
          className={`h-5 px-2 rounded-md border flex items-center justify-center shrink-0 text-[8px] font-bold tracking-wider ${
            isOnline
              ? 'bg-[#EDF3FF] text-[#2D5FCC] border-[#CAD8FA]'
              : 'bg-[#F1F2F3] text-[#667085] border-[#D8DDE3]'
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
          <div className="bg-[#F1F2F3] text-[#17202A] rounded-[10px] px-3 py-1.5 flex items-center gap-2 border border-[#E2E5E9] transition-all w-40 sm:w-52 focus-within:w-56 focus-within:border-[#AAB4C0] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3B6FE8]/10 shrink-0">
            <Search className="w-3.5 h-3.5 text-[#98A2B3] shrink-0" />
            <input
              id="input-header-search"
              type="text"
              placeholder="Cari menu, kode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-[#17202A] text-xs outline-none placeholder:text-[#98A2B3] font-semibold"
            />
          </div>

          {/* Table Button */}
          {onOpenTableManagement && (
            <button
              id="btn-header-meja-customer"
              type="button"
              onClick={onOpenTableManagement}
              className="flex items-center gap-1.5 bg-[#17202A] hover:bg-[#24303C] text-white font-semibold text-[11px] px-3 py-1.5 rounded-[10px] transition-all shadow-sm shadow-slate-950/10 cursor-pointer active:scale-95 shrink-0"
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
                ? 'bg-[#F1F2F3] text-[#17202A] border-[#D8DDE3] hover:bg-[#E9ECEF]'
                : 'bg-[#FCFCFB] text-[#D85F00] border-[#FFD4AD] hover:bg-[#FFF2E6]'
            }`}
          >
            <Printer className={`w-3.5 h-3.5 ${printerConfig.isConnected ? 'text-[#D85F00]' : 'text-[#E5484D]'}`} />
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
            className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            <Store className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Terminal POS Kasir</span>
          </button>
        </div>
      )}
    </header>
  );
};
