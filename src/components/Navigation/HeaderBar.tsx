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
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isOwnerMode = systemPortal === 'OWNER';

  return (
    <header
      id="app-header-bar"
      className={`h-11 border px-3.5 flex items-center justify-between gap-3 shrink-0 z-20 font-sans select-none transition-all duration-300 rounded-xl ${
        isOwnerMode
          ? 'bg-[#1A1714] border-[#302E2B] text-white'
          : 'bg-white/95 backdrop-blur-sm border-[#E2E2E2] text-[#181715]'
      }`}
      style={{ boxShadow: isOwnerMode ? 'none' : '0 1px 4px rgba(0,0,0,0.03)' }}
    >
      {/* Left: Time & Connection */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-sm font-bold tracking-tight font-mono leading-none ${isOwnerMode ? 'text-white' : 'text-[#1A1714]'}`}>
            {timeStr}
          </span>
          <span className={`text-[9px] font-semibold uppercase tracking-wider ${isOwnerMode ? 'text-white/50' : 'text-[#9C9590]'}`}>
            {dateStr}
          </span>
        </div>

        <div
          id="btn-toggle-online-status"
          role="status"
          className={`h-5 px-2 rounded-md border flex items-center justify-center shrink-0 text-[8px] font-bold tracking-wider ${
            isOnline
              ? 'bg-[#FFF4EE] text-[#C94716] border-[#F1C7B5]'
              : 'bg-[#F2F2F2] text-[#626262] border-[#DADADA]'
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
          <div className="bg-[#F5F5F5] text-[#181715] rounded-lg px-3 py-1.5 flex items-center gap-2 border border-[#E1E1E1] transition-all w-40 sm:w-52 focus-within:w-56 focus-within:border-[#BDBDBD] focus-within:bg-white focus-within:ring-1 focus-within:ring-black/5 shrink-0">
            <Search className="w-3.5 h-3.5 text-[#8E8E8E] shrink-0" />
            <input
              id="input-header-search"
              type="text"
              placeholder="Cari menu, kode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-[#1A1A1A] text-xs outline-none placeholder:text-[#A0A0A0] font-semibold"
            />
          </div>

          {/* Table Button */}
          {onOpenTableManagement && (
            <button
              id="btn-header-meja-customer"
              type="button"
              onClick={onOpenTableManagement}
              className="flex items-center gap-1.5 bg-[#1C1B19] hover:bg-black text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg transition-all shadow-sm shadow-black/10 cursor-pointer active:scale-95 shrink-0"
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
                ? 'bg-[#F5F5F5] text-[#2B2B2B] border-[#DDDDDD] hover:bg-[#EEEEEE]'
                : 'bg-white text-[#F05A1F] border-[#E0E0E0] hover:bg-[#F7F7F7]'
            }`}
          >
            <Printer className={`w-3.5 h-3.5 ${printerConfig.isConnected ? 'text-[#F05A1F]' : 'text-rose-500'}`} />
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
