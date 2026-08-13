import React, { useState, useEffect } from 'react';
import { Menu, Grid2X2, Printer, Search, Store, Utensils, ShoppingBag, Trash2 } from 'lucide-react';
import { Branch, PrinterConfig, UserAccount, RestaurantTable, Order, OrderType } from '../../types/pos';

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
  orderType?: OrderType;
  onSelectOrderType?: (type: OrderType) => void;
  onClearCart?: () => void;
  isCondimentsEnabled?: boolean;
  onToggleCondiments?: () => void;
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
  orderType = 'DINE_IN',
  onSelectOrderType,
  onClearCart,
  isCondimentsEnabled = true,
  onToggleCondiments,
}) => {
  const [timeStr, setTimeStr] = useState('14.35');
  const [dateStr, setDateStr] = useState('RAB, 12 AGU 2025');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      const day = now.toLocaleDateString('id-ID', { weekday: 'short' }).toUpperCase();
      const date = now.getDate();
      const mon = now.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase();
      const year = now.getFullYear();
      setDateStr(`${day}, ${date} ${mon} ${year}`);
    };
    update();
    const id = window.setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (activeTab !== 'pos') return;
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('input-header-search')?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, [activeTab]);

  const isOwnerMode = systemPortal === 'OWNER';
  const shortcutLabel = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

  return (
    <header
      id="app-header-bar"
      className="z-20 flex h-14 shrink-0 select-none items-center justify-between gap-2 sm:gap-3 rounded-2xl border px-2.5 sm:px-3.5 font-sans transition-all duration-200"
      style={{
        background: 'var(--surface-card)',
        borderColor: 'var(--panel-border)',
        boxShadow: 'var(--shadow-sm)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ── LEFT: Hamburger + Clock + Connection Badge ─────────────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Hamburger Menu Button — Toggles Quick Access Sidebar */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-quick-access-menu'))}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          title="Buka / Tutup Menu Navigasi"
        >
          <Menu className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
        </button>

        {/* Time and Date Display matching Target Mockup */}
        <div className="flex flex-col shrink-0">
          <span className="font-mono text-[10px] sm:text-xs font-extrabold leading-none text-[#111827]">
            {timeStr}
          </span>
          <span className="text-[7px] sm:text-[8px] font-extrabold uppercase tracking-wide text-slate-400 mt-0.5 whitespace-nowrap">
            {dateStr}
          </span>
        </div>

        {/* Online / Offline Pill Badge matching Target Mockup */}
        <div
          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] sm:text-[9px] font-extrabold tracking-wide border shadow-2xs shrink-0"
          style={
            isOnline
              ? { background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' }
              : { background: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1' }
          }
          role="status"
          title={`Status internet: ${isOnline ? 'terhubung' : 'terputus'}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#166534] animate-pulse" />
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </div>

      {!isOwnerMode && (
        <div
          className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1"
          title={`Outlet aktif: ${currentBranch.name}`}
        >
          <Store className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
          <div className="min-w-0 leading-none">
            <p className="text-[7px] font-black uppercase tracking-wider text-emerald-600">Outlet aktif</p>
            <p className="mt-0.5 max-w-32 truncate text-[9px] font-extrabold text-emerald-900">
              {currentBranch.code || currentBranch.name}
              <span className="hidden lg:inline"> · {currentBranch.name.replace(/^Bakso Ujo\s*-\s*/i, '')}</span>
            </p>
          </div>
        </div>
      )}

      {isOwnerMode && (
        <div className="ml-auto flex min-w-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5">
          <Store className="h-4 w-4 shrink-0 text-amber-700" />
          <div className="hidden min-w-0 sm:block">
            <p className="text-[9px] font-black uppercase tracking-wider text-amber-700">Konteks cabang</p>
            <p className="max-w-40 truncate text-[11px] font-bold text-amber-950">{currentBranch.name}</p>
          </div>
          <select
            value={currentBranch.id}
            onChange={(event) => {
              const branch = branches.find((item) => item.id === event.target.value);
              if (branch) onSelectBranch(branch);
            }}
            className="max-w-44 rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/60"
            aria-label="Pilih konteks cabang Owner"
          >
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code || branch.name}</option>)}
          </select>
        </div>
      )}

      {/* ── MIDDLE / RIGHT: Kasir mode controls matching Target Mockup ─────────── */}
      {activeTab === 'pos' && !isOwnerMode && (
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pl-1">

          {/* Saklar Topping ON / OFF at the LEFT of Search Bar */}
          {onToggleCondiments && (
            <button
              type="button"
              onClick={onToggleCondiments}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0 transition-all border h-8 ${
                isCondimentsEnabled
                  ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                  : 'bg-slate-100 text-slate-500 border-slate-300'
              }`}
              title={isCondimentsEnabled ? 'Saklar Topping Global AKTIF' : 'Saklar Topping Global NONAKTIF'}
            >
              <span className="text-[10px] uppercase font-black tracking-wide">Topping</span>
              <div
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${
                  isCondimentsEnabled ? 'bg-[#047857]' : 'bg-slate-400'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ${
                    isCondimentsEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </button>
          )}

          {/* Search Input Bar with keyboard shortcut */}
          <div className="flex min-w-[140px] max-w-[240px] flex-1 items-center gap-1.5 rounded-xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] px-3.5 py-1.5 text-xs transition-all focus-within:border-[var(--primary)] focus-within:bg-white focus-within:shadow-[var(--focus-ring)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              id="input-header-search"
              type="text"
              placeholder="Cari menu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-[#111827] outline-none border-none ring-0 placeholder:text-slate-400"
              style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
            />
            <kbd className="hidden md:inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 shrink-0">
              {shortcutLabel}
            </kbd>
          </div>

          {/* Meja Customer Pill Button */}
          {onOpenTableManagement && (
            <button
              id="btn-header-meja-customer"
              type="button"
              onClick={onOpenTableManagement}
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-[#111827] font-extrabold text-[11px] sm:text-xs px-3.5 py-1.5 rounded-full transition-all cursor-pointer shrink-0 whitespace-nowrap h-8"
              title="Konfigurasi Meja Customer Order"
            >
              <Grid2X2 className="h-3.5 w-3.5" />
              <span>Meja Customer</span>
            </button>
          )}

          {/* Setup Printer Pill Button */}
          <button
            id="btn-header-setup-printer"
            type="button"
            onClick={onOpenPrinterSetup}
            className="flex items-center gap-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-[#047857] font-extrabold text-[11px] sm:text-xs px-3.5 py-1.5 rounded-full transition-all cursor-pointer shrink-0 whitespace-nowrap h-8"
            style={{ color: '#047857', borderColor: '#A7F3D0' }}
          >
            <Printer className="h-3.5 w-3.5" style={{ color: '#047857' }} />
            <span>{printerConfig.isConnected ? 'Printer Ready' : 'Setup Printer'}</span>
          </button>

          {/* Dine In Pill Button (Solid Emerald Green #047857 when active) */}
          <button
            type="button"
            onClick={() => onSelectOrderType?.('DINE_IN')}
            className="flex items-center gap-1.5 font-extrabold text-[11px] sm:text-xs px-3.5 py-1.5 rounded-full transition-all cursor-pointer shrink-0 whitespace-nowrap h-8"
            style={
              orderType === 'DINE_IN'
                ? {
                    background: 'linear-gradient(180deg, #059669 0%, #047857 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(4,120,87,0.25)',
                    border: '1px solid #047857'
                  }
                : {
                    background: '#ffffff',
                    color: '#111827',
                    border: '1px solid #E5E7EB'
                  }
            }
          >
            <Utensils className="h-3.5 w-3.5" style={{ color: orderType === 'DINE_IN' ? '#ffffff' : '#111827' }} />
            <span>Dine In</span>
          </button>

          {/* Take Away Pill Button */}
          <button
            type="button"
            onClick={() => onSelectOrderType?.('TAKE_AWAY')}
            className="flex items-center gap-1.5 font-extrabold text-[11px] sm:text-xs px-3.5 py-1.5 rounded-full transition-all cursor-pointer shrink-0 whitespace-nowrap h-8"
            style={
              orderType === 'TAKE_AWAY'
                ? {
                    background: 'linear-gradient(180deg, #059669 0%, #047857 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(4,120,87,0.25)',
                    border: '1px solid #047857'
                  }
                : {
                    background: '#ffffff',
                    color: '#111827',
                    border: '1px solid #E5E7EB'
                  }
            }
          >
            <ShoppingBag className="h-3.5 w-3.5" style={{ color: orderType === 'TAKE_AWAY' ? '#ffffff' : '#111827' }} />
            <span>Take Away</span>
          </button>

          {/* Clear Cart / Trash Square Button */}
          <button
            type="button"
            onClick={onClearCart}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Kosongkan Keranjang"
          >
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      )}

      {/* ── OWNER mode right ─────────────────────────────── */}
      {isOwnerMode && onSwitchPortal && (
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => onSwitchPortal('KASIR')}
            className="flex items-center gap-1.5 text-white font-extrabold text-xs px-4 py-2 rounded-full transition-all cursor-pointer"
            style={{ background: '#047857', color: '#ffffff' }}
          >
            <Store className="h-4 w-4 text-white" />
            <span className="hidden sm:inline text-white">Terminal POS Kasir</span>
            <span className="sm:hidden text-white">Kasir</span>
          </button>
        </div>
      )}
    </header>
  );
};
