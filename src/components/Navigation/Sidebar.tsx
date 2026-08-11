import React, { useState, useEffect } from 'react';
import {
  Store,
  Receipt,
  UtensilsCrossed,
  Clock,
  Boxes,
  TrendingUp,
  Settings,
  LogOut,
  Grid2X2,
  Building2,
  Crown,
  Smartphone,
  ArrowRight,
  Compass,
  WalletCards,
  Menu,
  X
} from 'lucide-react';
import { AccessControlRule, UserAccount } from '../../types/pos';

interface SidebarProps {
  systemPortal: 'KASIR' | 'OWNER';
  onSwitchPortal: (portal: 'KASIR' | 'OWNER') => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeUser: UserAccount;
  onLogout: () => void;
  pendingSyncCount: number;
  accessRule?: AccessControlRule;
}

export const Sidebar: React.FC<SidebarProps> = ({
  systemPortal,
  onSwitchPortal,
  activeTab,
  setActiveTab,
  activeUser,
  onLogout,
  pendingSyncCount,
  accessRule
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [activeTab]);

  const cashierNavItems = [
    { id: 'pos', label: 'Kasir POS', icon: Receipt },
    { id: 'kds', label: 'Dapur / KDS', icon: UtensilsCrossed },
    { id: 'shift', label: 'Shift Kasir', icon: Clock },
    { id: 'inventory', label: 'Inventory Stok', icon: Boxes }
  ];

  const ownerNavItems = [
    { id: 'superowner', label: 'Dashboard Owner', icon: Building2 },
    { id: 'blueprint', label: 'Rancang Bangun', icon: Compass },
    { id: 'analytics', label: 'Laporan & Omzet', icon: TrendingUp },
    { id: 'inventory', label: 'Stok, Bahan & HPP', icon: Boxes },
    { id: 'tables', label: 'Meja & QR Code', icon: Grid2X2 },
    { id: 'attendance', label: 'Absensi Staff', icon: Crown },
    { id: 'payroll', label: 'Payroll Staff', icon: WalletCards },
    { id: 'selforder', label: 'Landing Self-Order', icon: Smartphone },
    { id: 'settings', label: 'Konfigurasi Owner', icon: Settings }
  ];

  const canOpenItem = (id: string) => {
    if (!accessRule) return false;
    if (id === 'pos') return accessRule.canAccessPOS;
    if (id === 'kds') return accessRule.canAccessKDS;
    if (id === 'shift') return accessRule.canAccessShift;
    if (id === 'inventory') return accessRule.canAccessInventory;
    if (id === 'analytics' || id === 'superowner') return accessRule.canAccessAnalytics;
    if (id === 'payroll') return accessRule.canAccessSettings;
    return accessRule.canAccessSettings;
  };

  const currentNavItems = (systemPortal === 'KASIR' ? cashierNavItems : ownerNavItems).filter((item) => canOpenItem(item.id));
  const isOwnerMode = systemPortal === 'OWNER';
  const canSwitchToOwner = Boolean(accessRule?.canAccessAnalytics || accessRule?.canAccessSettings);
  const canSwitchToCashier = Boolean(accessRule?.canAccessPOS || accessRule?.canAccessKDS || accessRule?.canAccessShift || accessRule?.canAccessInventory);

  const sidebarContent = (
    <>
      {/* Logo & Mode Badge */}
      <div className="flex flex-col items-center gap-2 w-full px-2.5 shrink-0">
        <button
          id="btn-app-logo"
          onClick={() => setActiveTab(isOwnerMode ? 'superowner' : 'pos')}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer relative bg-[#1C1B19] shadow-lg shadow-black/15"
          title={isOwnerMode ? 'Portal Back-Office Owner' : 'Terminal Operasional Kasir POS'}
        >
          {isOwnerMode ? <Crown className="w-[18px] h-[18px] text-amber-200" /> : <Store className="w-[18px] h-[18px] text-white" />}
          {pendingSyncCount > 0 && (
            <span className="absolute -top-1 -right-1 text-[8px] bg-amber-500 text-white font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center animate-pulse ring-2 ring-white">
              {pendingSyncCount}
            </span>
          )}
        </button>

        <span
          className={`px-2 py-0.5 rounded-md text-[7px] font-bold uppercase tracking-widest ${
            isOwnerMode
              ? 'bg-[#FFF4EE] text-[#C2410C] border border-[#F1C7B5]'
              : 'bg-[#F5F5F5] text-[#5F5F5F] border border-[#E1E1E1]'
          }`}
        >
          {isOwnerMode ? 'OWNER' : 'KASIR'}
        </span>
      </div>

      {/* Navigation */}
      <nav id="nav-main-menu" className="flex-1 flex flex-col items-center justify-start gap-1.5 my-4 w-full px-2.5 overflow-y-auto scrollbar-none">
        <div className="w-full flex flex-col items-center gap-1">
          {currentNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`group relative w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1C1B19] text-white shadow-md shadow-black/15'
                    : 'text-[#929292] hover:bg-[#F3F3F3] hover:text-[#1C1B19]'
                }`}
                title={`[${isOwnerMode ? 'Sistem Owner' : 'Sistem Kasir'}] ${item.label}`}
              >
                {isActive && (
                  <span className="absolute -left-2.5 w-[3px] h-5 rounded-r-full bg-[#EA580C]" />
                )}
                <Icon className="w-[18px] h-[18px] stroke-[2]" />
                <span className={`text-[7px] font-semibold tracking-tight uppercase mt-0.5 leading-none ${
                  isActive ? 'text-white/90' : 'text-[#A0A0A0] group-hover:text-[#1C1B19]'
                }`}>
                  {item.label.split(' ')[0]}
                </span>

                {/* Tooltip — desktop only */}
                <span className="hidden md:flex absolute left-[60px] bg-[#1A1714] text-white text-[10px] font-semibold py-1.5 px-3 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl items-center gap-1.5">
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-bold bg-orange-500/20 text-orange-300">
                    {isOwnerMode ? 'OWNER' : 'KASIR'}
                  </span>
                  <span>{item.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-2 w-full px-2.5 pt-3 border-t border-[#E2E2E2] shrink-0">
        {(isOwnerMode ? canSwitchToCashier : canSwitchToOwner) && <button
          id="btn-switch-system-portal"
          type="button"
          onClick={() => onSwitchPortal(isOwnerMode ? 'KASIR' : 'OWNER')}
          className={`group relative w-10 h-9 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
            isOwnerMode
              ? 'bg-orange-50 hover:bg-orange-100 text-[#C2410C] border-orange-200'
              : 'bg-[#FFF4EE] hover:bg-[#FFE9DE] text-[#C2410C] border-[#F1C7B5]'
          }`}
          title={isOwnerMode ? 'Kembali ke Terminal Kasir POS' : 'Masuk Portal Back-Office Owner'}
        >
          {isOwnerMode ? <Store className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5 text-amber-500" />}
          <span className="text-[6px] font-bold tracking-tight uppercase mt-0.5 opacity-70">
            {isOwnerMode ? 'KASIR' : 'OWNER'}
          </span>

          <span className="hidden md:flex absolute left-[60px] bg-[#1A1714] text-white text-[10px] font-semibold py-1.5 px-3 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl items-center gap-1.5">
            <span>{isOwnerMode ? 'Terminal Kasir POS' : 'Portal Owner'}</span>
            <ArrowRight className="w-3 h-3 text-white/50" />
          </span>
        </button>}

        <div
          id="btn-user-avatar-badge"
          className="relative w-8 h-8 rounded-xl bg-[#F5F5F5] border border-[#E1E1E1] flex items-center justify-center font-bold text-[10px] text-[#1C1B19] overflow-hidden"
          title={`Pengguna aktif: ${activeUser.name} (${activeUser.role})`}
        >
          {activeUser.avatar ? (
            <img src={activeUser.avatar} alt={activeUser.name} className="w-full h-full object-cover" />
          ) : (
            activeUser.name.substring(0, 2).toUpperCase()
          )}
        </div>

        <button
          id="btn-logout-system"
          onClick={onLogout}
          className="w-11 h-8 text-[#8E8882] hover:text-[#C2410C] hover:bg-[#FFF4EE] rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer"
          title="Logout dan akhiri sesi petugas"
          aria-label="Logout dan akhiri sesi petugas"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-[6px] font-black uppercase tracking-wide">Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop/Tablet: fixed sidebar — always visible */}
      <aside
        id="app-sidebar"
        className="hidden md:flex w-[72px] flex-col justify-between items-center py-3.5 select-none shrink-0 z-30 bg-white/95 backdrop-blur-sm border-r border-[#E2E2E2] text-slate-700 h-full font-sans"
        style={{ boxShadow: '2px 0 16px rgba(0,0,0,0.03)' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile: floating menu button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className={`md:hidden fixed bottom-4 left-4 z-40 w-12 h-12 rounded-full bg-[#1C1B19] text-white shadow-xl flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${mobileOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        aria-label="Buka menu navigasi"
      >
        <Menu className="w-5 h-5" />
        {pendingSyncCount > 0 && (
          <span className="absolute -top-1 -right-1 text-[8px] bg-amber-500 text-white font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse ring-2 ring-white">
            {pendingSyncCount}
          </span>
        )}
      </button>

      {/* Mobile: overlay sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sidebar panel */}
          <aside
            className="relative w-[72px] flex flex-col justify-between items-center py-3.5 select-none shrink-0 bg-white/98 backdrop-blur-sm border-r border-[#E2E2E2] text-slate-700 h-full font-sans animate-slideInLeft"
            style={{ boxShadow: '2px 0 16px rgba(0,0,0,0.08)' }}
          >
            {sidebarContent}
          </aside>
          {/* Close button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 left-[80px] w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-600 cursor-pointer"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
};
