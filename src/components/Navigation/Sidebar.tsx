import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Boxes,
  Building2,
  Clock,
  Compass,
  Crown,
  Grid2X2,
  LogOut,
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

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CASHIER_NAV_ITEMS: NavigationItem[] = [
  { id: 'pos', label: 'Kasir POS', icon: Receipt },
  { id: 'kds', label: 'Dapur / KDS', icon: UtensilsCrossed },
  { id: 'shift', label: 'Shift Kasir', icon: Clock },
  { id: 'inventory', label: 'Inventory Stok', icon: Boxes },
];

const OWNER_NAV_ITEMS: NavigationItem[] = [
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
  const [menuOpen, setMenuOpen] = useState(false);
  const quickAccessRef = useRef<HTMLDivElement>(null);
  const isOwnerMode = systemPortal === 'OWNER';

  const canOpenItem = (id: string) => {
    if (!accessRule) return false;
    if (id === 'pos') return accessRule.canAccessPOS;
    if (id === 'kds') return accessRule.canAccessKDS;
    if (id === 'shift') return accessRule.canAccessShift;
    if (id === 'inventory') return accessRule.canAccessInventory;
    if (id === 'analytics' || id === 'superowner') return accessRule.canAccessAnalytics;
    return accessRule.canAccessSettings;
  };

  const currentNavItems = useMemo(
    () => (isOwnerMode ? OWNER_NAV_ITEMS : CASHIER_NAV_ITEMS).filter((item) => canOpenItem(item.id)),
    [isOwnerMode, accessRule],
  );
  const currentItem = currentNavItems.find((item) => item.id === activeTab);
  const CurrentIcon = currentItem?.icon ?? Grid2X2;
  const canSwitchToOwner = Boolean(accessRule?.canAccessAnalytics || accessRule?.canAccessSettings);
  const canSwitchToCashier = Boolean(
    accessRule?.canAccessPOS || accessRule?.canAccessKDS || accessRule?.canAccessShift || accessRule?.canAccessInventory,
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [activeTab, systemPortal]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!quickAccessRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [menuOpen]);

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  const BubbleLabel = ({ children }: { children: React.ReactNode }) => (
    <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-[90] hidden -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-xl border border-[var(--panel-border)] bg-white px-3 py-2 text-[11px] font-semibold tracking-normal text-[var(--text-primary)] opacity-0 shadow-[0_10px_28px_rgba(26,23,20,0.12)] transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 md:block">
      {children}
    </span>
  );

  return (
    <div ref={quickAccessRef} className="fixed bottom-3 left-3 z-[80] flex flex-col items-start gap-2 md:bottom-4 md:left-4">
      <div
        id="quick-access-menu"
        className={`flex w-[224px] flex-row-reverse flex-wrap-reverse items-center justify-end gap-2 overflow-visible rounded-2xl border border-[var(--panel-border)] bg-white/92 p-2 shadow-[0_16px_44px_rgba(26,23,20,0.12)] backdrop-blur-xl transition-all duration-200 md:w-auto md:flex-col-reverse md:flex-nowrap ${
          menuOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          onClick={onLogout}
          tabIndex={menuOpen ? 0 : -1}
          className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#F3C8CB] bg-[#FFF8F8] text-[#D93D43] transition hover:-translate-y-0.5 hover:bg-[#FDECEC] focus-visible:-translate-y-0.5"
          aria-label="Logout dan akhiri sesi petugas"
        >
          <LogOut className="h-[18px] w-[18px] stroke-[1.9]" />
          <BubbleLabel>Keluar</BubbleLabel>
        </button>

        <div
          className="group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--panel-border)] bg-white text-[11px] font-bold text-[var(--text-primary)]"
          title={`${activeUser.name} (${activeUser.role})`}
          aria-label={`${activeUser.name} (${activeUser.role})`}
        >
          {activeUser.avatar ? (
            <img src={activeUser.avatar} alt={activeUser.name} className="h-full w-full object-cover" />
          ) : (
            activeUser.name.substring(0, 2).toUpperCase()
          )}
        </div>

        {(isOwnerMode ? canSwitchToCashier : canSwitchToOwner) && (
          <button
            id="btn-switch-system-portal"
            type="button"
            onClick={() => onSwitchPortal(isOwnerMode ? 'KASIR' : 'OWNER')}
            tabIndex={menuOpen ? 0 : -1}
            className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary-hover)] transition hover:-translate-y-0.5 hover:bg-[#E6EEFF] focus-visible:-translate-y-0.5"
            aria-label={isOwnerMode ? 'Beralih ke Kasir' : 'Beralih ke portal Owner'}
          >
            {isOwnerMode ? <Store className="h-[18px] w-[18px] stroke-[1.9]" /> : <Crown className="h-[18px] w-[18px] stroke-[1.9]" />}
            <BubbleLabel>{isOwnerMode ? 'Terminal Kasir' : 'Portal Owner'}</BubbleLabel>
          </button>
        )}

        <span className="my-0.5 hidden h-px w-7 shrink-0 bg-[var(--panel-border-strong)] md:block" aria-hidden="true" />

        {currentNavItems.slice().reverse().map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              type="button"
              onClick={() => selectTab(item.id)}
              tabIndex={menuOpen ? 0 : -1}
              className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition hover:-translate-y-0.5 focus-visible:-translate-y-0.5 ${
                active
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_8px_20px_rgba(234,88,12,0.22)]'
                  : 'border-transparent bg-white text-[var(--text-secondary)] hover:border-[var(--primary-border)] hover:bg-[#F2F6FF] hover:text-[var(--primary-hover)]'
              }`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-[19px] w-[19px] stroke-[1.9]" />
              {active && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[var(--primary)]" />}
              <BubbleLabel>{item.label}</BubbleLabel>
            </button>
          );
        })}
      </div>

      <button
        id="btn-quick-access"
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        className={`group relative flex h-[54px] w-[54px] items-center justify-center rounded-2xl border text-white transition duration-200 hover:-translate-y-0.5 active:scale-95 ${
          menuOpen ? 'border-[var(--primary-hover)] bg-[var(--primary-hover)] shadow-[0_12px_30px_rgba(234,88,12,0.28)]' : 'border-[var(--primary)] bg-[var(--primary)] shadow-[0_12px_30px_rgba(234,88,12,0.24)]'
        }`}
        aria-label={menuOpen ? 'Tutup quick access menu' : 'Buka quick access menu'}
        aria-expanded={menuOpen}
        aria-controls="quick-access-menu"
      >
        {menuOpen ? <X className="h-5 w-5 stroke-[2]" /> : <CurrentIcon className="h-5 w-5 stroke-[1.9]" />}
        {!menuOpen && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[var(--primary)]" />}
        {pendingSyncCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F59E0B] px-1 text-[10px] font-bold text-white ring-2 ring-[#F3F6FB]">
            {pendingSyncCount}
          </span>
        )}
        <BubbleLabel>{menuOpen ? 'Tutup menu' : currentItem?.label ?? 'Quick access'}</BubbleLabel>
      </button>
    </div>
  );
};
