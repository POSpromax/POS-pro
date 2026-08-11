import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Crown,
  Grid2X2,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Smartphone,
  Store,
  TrendingUp,
  UtensilsCrossed,
  WalletCards,
  X,
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

const SIDEBAR_EXPANDED_KEY = 'omnipos_sidebar_expanded';

export const Sidebar: React.FC<SidebarProps> = ({
  systemPortal,
  onSwitchPortal,
  activeTab,
  setActiveTab,
  activeUser,
  onLogout,
  pendingSyncCount,
  accessRule,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => localStorage.getItem(SIDEBAR_EXPANDED_KEY) === 'true');

  useEffect(() => {
    setMobileOpen(false);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(expanded));
  }, [expanded]);

  const cashierNavItems = [
    { id: 'pos', label: 'Kasir POS', icon: Receipt },
    { id: 'kds', label: 'Dapur / KDS', icon: UtensilsCrossed },
    { id: 'shift', label: 'Shift Kasir', icon: Clock },
    { id: 'inventory', label: 'Inventory Stok', icon: Boxes },
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
    { id: 'settings', label: 'Konfigurasi Owner', icon: Settings },
  ];

  const canOpenItem = (id: string) => {
    if (!accessRule) return false;
    if (id === 'pos') return accessRule.canAccessPOS;
    if (id === 'kds') return accessRule.canAccessKDS;
    if (id === 'shift') return accessRule.canAccessShift;
    if (id === 'inventory') return accessRule.canAccessInventory;
    if (id === 'analytics' || id === 'superowner') return accessRule.canAccessAnalytics;
    return accessRule.canAccessSettings;
  };

  const isOwnerMode = systemPortal === 'OWNER';
  const currentNavItems = useMemo(
    () => (isOwnerMode ? ownerNavItems : cashierNavItems).filter((item) => canOpenItem(item.id)),
    [isOwnerMode, accessRule],
  );
  const canSwitchToOwner = Boolean(accessRule?.canAccessAnalytics || accessRule?.canAccessSettings);
  const canSwitchToCashier = Boolean(accessRule?.canAccessPOS || accessRule?.canAccessKDS || accessRule?.canAccessShift || accessRule?.canAccessInventory);

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const Rail = () => (
    <aside
      id="app-sidebar"
      className="relative z-40 flex h-full w-[72px] shrink-0 select-none flex-col items-center border-r border-[#E2E5E9] bg-[#FCFCFB]/95 py-3 backdrop-blur-xl"
      style={{ boxShadow: '2px 0 14px rgba(23,32,42,0.035)' }}
    >
      <button
        id="btn-app-logo"
        type="button"
        onClick={() => selectTab(isOwnerMode ? 'superowner' : 'pos')}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#17202A] text-white shadow-sm transition active:scale-95"
        aria-label={isOwnerMode ? 'Buka dashboard Owner' : 'Buka Kasir POS'}
      >
        {isOwnerMode ? <Crown className="h-[18px] w-[18px] text-amber-200" /> : <Store className="h-[18px] w-[18px]" />}
        {pendingSyncCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-black text-white ring-2 ring-[#FCFCFB]">
            {pendingSyncCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-2 hidden h-8 w-10 items-center justify-center rounded-lg border border-[#E2E5E9] bg-white text-[#667085] transition hover:border-[#FFD4AD] hover:bg-[#FFF2E6] hover:text-[#E96E00] md:flex"
        aria-label={expanded ? 'Tutup panel menu' : 'Buka panel menu'}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      <nav id="nav-main-menu" className="scrollbar-none my-3 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2.5">
        {currentNavItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              type="button"
              onClick={() => selectTab(item.id)}
              className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition ${active ? 'bg-[#17202A] text-white shadow-sm' : 'text-[#667085] hover:bg-[#F1F2F3] hover:text-[#17202A]'}`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              {active && <span className="absolute -left-2.5 h-5 w-[3px] rounded-r-full bg-[#FF7A00]" />}
              <Icon className="h-[19px] w-[19px] stroke-[1.9]" />
              {!expanded && (
                <span className="pointer-events-none absolute left-[52px] z-[70] hidden translate-x-1 items-center whitespace-nowrap rounded-xl border border-[#303A45] bg-[#17202A] px-3 py-2 text-[11px] font-bold text-white opacity-0 shadow-xl transition-all group-hover:translate-x-0 group-hover:opacity-100 md:flex">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex w-full flex-col items-center gap-2 border-t border-[#E2E5E9] px-2.5 pt-3">
        {(isOwnerMode ? canSwitchToCashier : canSwitchToOwner) && (
          <button
            id="btn-switch-system-portal"
            type="button"
            onClick={() => onSwitchPortal(isOwnerMode ? 'KASIR' : 'OWNER')}
            className="group relative flex h-9 w-10 items-center justify-center rounded-xl border border-[#FFD4AD] bg-[#FFF2E6] text-[#D85F00] transition hover:bg-[#FFE5CF]"
            aria-label={isOwnerMode ? 'Beralih ke Kasir' : 'Beralih ke portal Owner'}
          >
            {isOwnerMode ? <Store className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
          </button>
        )}
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-[#E2E5E9] bg-[#F1F2F3] text-[10px] font-black text-[#17202A]" title={`${activeUser.name} (${activeUser.role})`}>
          {activeUser.avatar ? <img src={activeUser.avatar} alt={activeUser.name} className="h-full w-full object-cover" /> : activeUser.name.substring(0, 2).toUpperCase()}
        </div>
        <button type="button" onClick={onLogout} className="flex h-9 w-10 items-center justify-center rounded-xl text-[#667085] transition hover:bg-[#FDECEC] hover:text-[#E5484D]" aria-label="Logout dan akhiri sesi petugas">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );

  const ExpandedPanel = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={`${mobile ? 'absolute inset-y-0 left-0 w-[286px] rounded-none' : 'fixed bottom-3 left-[84px] top-3 w-[248px] rounded-2xl'} z-[60] flex flex-col border border-[#E2E5E9] bg-[#FCFCFB]/98 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur-xl`}
      aria-label="Panel navigasi"
    >
      <div className="flex items-center justify-between border-b border-[#E2E5E9] px-2 pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FF7A00]">{isOwnerMode ? 'Portal Owner' : 'Operasional'}</p>
          <p className="mt-0.5 text-sm font-black text-[#17202A]">Bakso Ujo</p>
        </div>
        <button type="button" onClick={() => mobile ? setMobileOpen(false) : setExpanded(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E5E9] text-[#667085] hover:bg-[#F1F2F3]" aria-label="Tutup panel menu">
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="scrollbar-thin my-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
        {currentNavItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button key={item.id} type="button" onClick={() => selectTab(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${active ? 'bg-[#17202A] text-white shadow-sm' : 'text-[#475467] hover:bg-[#F1F2F3] hover:text-[#17202A]'}`} aria-current={active ? 'page' : undefined}>
              <Icon className={`h-[18px] w-[18px] stroke-[1.9] ${active ? 'text-[#FFB46E]' : 'text-[#667085]'}`} />
              <span className="flex-1">{item.label}</span>
              {active && <span className="h-2 w-2 rounded-full bg-[#FF7A00]" />}
            </button>
          );
        })}
      </nav>

      {(isOwnerMode ? canSwitchToCashier : canSwitchToOwner) && (
        <button type="button" onClick={() => onSwitchPortal(isOwnerMode ? 'KASIR' : 'OWNER')} className="flex w-full items-center gap-3 rounded-xl border border-[#FFD4AD] bg-[#FFF2E6] px-3 py-2.5 text-xs font-bold text-[#C55600] hover:bg-[#FFE5CF]">
          {isOwnerMode ? <Store className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
          <span className="flex-1 text-left">{isOwnerMode ? 'Terminal Kasir POS' : 'Portal Owner'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </aside>
  );

  return (
    <>
      <div className="hidden md:block"><Rail /></div>
      {expanded && <div className="hidden md:block"><ExpandedPanel /></div>}

      <button type="button" onClick={() => setMobileOpen(true)} className={`fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#17202A] text-white shadow-xl transition active:scale-90 md:hidden ${mobileOpen ? 'pointer-events-none opacity-0' : ''}`} aria-label="Buka menu navigasi">
        <Menu className="h-5 w-5" />
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 h-full w-full bg-slate-950/35 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} aria-label="Tutup menu navigasi" />
          <ExpandedPanel mobile />
        </div>
      )}
    </>
  );
};
