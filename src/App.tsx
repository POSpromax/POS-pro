/**
 * @license
 * Apache-2.0
 * Nusantara POS & Resto Full-Stack System
 */

import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Sidebar } from './components/Navigation/Sidebar';
import { HeaderBar } from './components/Navigation/HeaderBar';
import { PinAuthModal } from './components/Auth/PinAuthModal';
import { PaymentModal } from './components/POS/PaymentModal';
import { ThermalReceiptModal } from './components/Printer/ThermalReceiptModal';
import { CustomerTableManagementModal } from './components/SelfOrder/CustomerTableManagementModal';
import { QuickTableModal } from './components/Tables/QuickTableModal';
import { QrLabelPrintModal } from './components/Tables/QrLabelPrintModal';
import { playNewOrderSound, playSelfOrderAlertSound } from './utils/audioNotification';
import { BluetoothPrinterService, type ZReportData } from './services/bluetoothPrinter';

import {
  MenuItem,
  RawMaterial,
  RestaurantTable,
  Branch,
  Order,
  Shift,
  ExpenseIncomeRecord,
  AttendanceRecord,
  PrinterConfig,
  RestaurantProfile,
  UserAccount,
  PaymentMethod,
  OrderStatus,
  CondimentGroup,
  AccessControlRule,
  BranchOperationalConfig
} from './types/pos';
import { DBStorage } from './services/dbStorage';
import { INITIAL_BRANCHES } from './data/initialData';
import { cloudReadiness } from './lib/runtimeEnv';
import { getSupabase } from './lib/supabase';
import { watchSessionExpiry } from './lib/sessionGuard';
import { PWAUpdatePrompt } from './components/System/PWAUpdatePrompt';
import { cloudSignOut } from './services/authService';
import {
  createCloudStaff,
  deactivateCloudStaff,
  listCloudStaff,
  updateCloudStaff,
} from './services/staffService';
import { AttendanceSessionError, listCloudAttendance, saveCloudAttendance } from './services/attendanceService';
import { deleteCloudMenuItem, deleteCloudRawMaterial, listCloudCatalog, saveCloudMenuItem, saveCloudRawMaterial } from './services/catalogService';
import { deleteCloudCondimentGroup, listCloudCondiments, saveCloudCondimentGroup } from './services/condimentService';
import { listCloudOrders, payCloudOrder, submitCloudOrder, subscribeCloudOrders, updateCloudOrderStatus, RealtimeConnectionState } from './services/orderService';
import { getCloudActiveShift, listCloudShiftHistory, openCloudShift, closeCloudShift, ShiftServiceError, subscribeCloudShift } from './services/shiftService';
import { getPublicCatalogContext } from './services/publicCatalogService';
import { createCloudTable, listCloudTables, setAllCloudTablesEnabled, updateCloudTableSession } from './services/tableService';
import { defaultBranchOperationalConfig, getCloudBranchOperationalConfig, saveCloudBranchOperationalConfig } from './services/branchConfigService';
import { getCloudAttendanceConfig, getCloudTenantBrand, saveCloudTenantBrand } from './services/tenantConfigService';
import { listCloudExpenseRecords, saveCloudExpenseRecord } from './services/expenseService';
import { subscribeBranchOperations } from './services/operationalRealtimeService';
import { createCloudBranch, listCloudBranches } from './services/branchService';
import { formatOrderLabel } from './utils/orderNumber';
import { buildBranchSelfOrderUrl } from './utils/selfOrderUrl';
import { normalizeBranchId } from './utils/branchId';
import { recoverFromAssetVersionError } from './utils/versionRecovery';
import { BranchRuntimeGuard } from './utils/branchRuntime';
import { buildOrderItemVariantKey } from './utils/orderItemIdentity';

const lazyWithVersionRecovery = <T extends React.ComponentType<any>>(
  key: string,
  importer: () => Promise<{ default: T }>,
) => lazy(async () => {
  try {
    const module = await importer();
    sessionStorage.removeItem(`omnipos_chunk_recovery_${key}`);
    return module;
  } catch (error) {
    const started = await recoverFromAssetVersionError(error);
    if (started) {
      return new Promise<never>(() => undefined);
    }
    throw error;
  }
});

const KitchenDisplayView = lazyWithVersionRecovery('kds', () => import('./components/KDS/KitchenDisplayView').then((m) => ({ default: m.KitchenDisplayView })));
const CashierView = lazyWithVersionRecovery('pos', () => import('./components/POS/CashierView').then((m) => ({ default: m.CashierView })));
const AttendanceHrPanel = lazyWithVersionRecovery('attendance-hr', () => import('./components/Attendance/AttendanceHrPanel').then((m) => ({ default: m.AttendanceHrPanel })));
const CustomerSelfOrderModal = lazyWithVersionRecovery('self-order-modal', () => import('./components/SelfOrder/CustomerSelfOrderModal').then((m) => ({ default: m.CustomerSelfOrderModal })));
const TableManagementView = lazyWithVersionRecovery('tables', () => import('./components/Tables/TableManagementView').then((m) => ({ default: m.TableManagementView })));
const SelfOrderLandingPage = lazyWithVersionRecovery('self-order', () => import('./components/SelfOrder/SelfOrderLandingPage').then((m) => ({ default: m.SelfOrderLandingPage })));
const ShiftMonitorView = lazyWithVersionRecovery('shift', () => import('./components/Shift/ShiftMonitorView').then((m) => ({ default: m.ShiftMonitorView })));
const AttendanceView = lazyWithVersionRecovery('attendance', () => import('./components/Attendance/AttendanceView').then((m) => ({ default: m.AttendanceView })));
const InventoryHppView = lazyWithVersionRecovery('inventory', () => import('./components/Inventory/InventoryHppView').then((m) => ({ default: m.InventoryHppView })));
const AnalyticsExportView = lazyWithVersionRecovery('analytics', () => import('./components/Analytics/AnalyticsExportView').then((m) => ({ default: m.AnalyticsExportView })));
const SettingsView = lazyWithVersionRecovery('settings', () => import('./components/Settings/SettingsView').then((m) => ({ default: m.SettingsView })));
const SuperOwnerDashboardView = lazyWithVersionRecovery('owner', () => import('./components/Analytics/SuperOwnerDashboardView').then((m) => ({ default: m.SuperOwnerDashboardView })));
const BlueprintArchitectureView = lazyWithVersionRecovery('blueprint', () => import('./components/Owner/BlueprintArchitectureView').then((m) => ({ default: m.BlueprintArchitectureView })));

const TERMINAL_SESSION_KEY = 'omnipos_terminal_session_v2';
const TERMINAL_BRANCH_KEY = 'omnipos_terminal_branch';
const TERMINAL_MODE_KEY = 'omnipos_terminal_mode';
const condimentCloudSaveTimers = new Map<string, number>();

// Server hanya menerima id order berupa UUID cloud. Order yang masih memakai id
// lokal (mis. `ord-123456`) belum pernah sampai ke database, sehingga PATCH
// status ke cloud pasti ditolak 400. Guard ini memisahkan keduanya.
const CLOUD_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isCloudUuid = (id?: string | null): boolean => CLOUD_UUID_PATTERN.test(String(id || ''));
const isCloudOrderId = (id: string): boolean => isCloudUuid(id);

const normalizeOrderItemsForComparison = (items: Order['items'] = []) => {
  const quantities = new Map<string, number>();
  items.forEach((item) => {
    const key = buildOrderItemVariantKey(item);
    quantities.set(key, (quantities.get(key) || 0) + item.quantity);
  });
  return [...quantities.entries()].sort(([left], [right]) => left.localeCompare(right, 'id'));
};

const hasUnsavedOrderChanges = (draft: Partial<Order>, saved: Order): boolean => {
  const comparableDraft = {
    customerName: draft.customerName || 'Guest',
    tableNumber: draft.tableNumber || '',
    type: draft.type,
    items: normalizeOrderItemsForComparison(draft.items),
    subtotal: draft.subtotal || 0,
    discount: draft.discount || 0,
    tax: draft.tax || 0,
    total: draft.total || 0,
    condimentsEnabled: draft.condimentsEnabled !== false,
  };
  const comparableSaved = {
    customerName: saved.customerName || 'Guest',
    tableNumber: saved.tableNumber || '',
    type: saved.type,
    items: normalizeOrderItemsForComparison(saved.items),
    subtotal: saved.subtotal || 0,
    discount: saved.discount || 0,
    tax: saved.tax || 0,
    total: saved.total || 0,
    condimentsEnabled: saved.condimentsEnabled !== false,
  };
  return JSON.stringify(comparableDraft) !== JSON.stringify(comparableSaved);
};

const getPaidOrdersForShift = (orders: Order[], shiftId: string): Order[] =>
  orders.filter((order) => order.paidShiftId === shiftId && order.paymentStatus === 'PAID' && order.status !== 'CANCELLED');

const buildZReportData = (shift: Shift, orders: Order[]): ZReportData => {
  const paidOrders = getPaidOrdersForShift(orders, shift.id);
  const hasLoadedOrders = paidOrders.length > 0;
  const sum = (predicate: (order: Order) => boolean, value: (order: Order) => number) =>
    paidOrders.filter(predicate).reduce((total, order) => total + value(order), 0);
  const cashSales = hasLoadedOrders ? sum((order) => order.paymentMethod === 'CASH', (order) => order.total) : shift.cashSales;
  const qrisSales = sum((order) => order.paymentMethod === 'QRIS', (order) => order.total);
  const debitSales = sum((order) => order.paymentMethod === 'DEBIT', (order) => order.total);
  const grossOmset = hasLoadedOrders ? paidOrders.reduce((total, order) => total + order.total, 0) : shift.grossOmset;
  const expectedCash = shift.expectedCash ?? (shift.initialCash + cashSales + shift.totalIncome - shift.totalExpense);
  const actualCash = shift.actualCash ?? expectedCash;
  // Order yang dibatalkan (void) diatribusikan ke shift saat void disetujui
  // (completedShiftId), sama seperti order yang selesai — konsisten dengan
  // aturan riwayat shift, bukan shift saat order pertama kali dibuat.
  const voidOrders = orders.filter((order) => order.status === 'CANCELLED' && order.completedShiftId === shift.id);

  return {
    shift: { ...shift, grossOmset, cashSales },
    qrisSales,
    debitSales,
    totalDiscount: hasLoadedOrders ? paidOrders.reduce((total, order) => total + (order.discount || 0), 0) : 0,
    totalTax: hasLoadedOrders ? paidOrders.reduce((total, order) => total + (order.tax || 0), 0) : 0,
    expectedCash,
    actualCash,
    varianceAmount: shift.varianceAmount ?? actualCash - expectedCash,
    voidCount: voidOrders.length,
    voidAmount: voidOrders.reduce((total, order) => total + (order.total || 0), 0),
  };
};

const normalizeConfiguredTableNumber = (value: string) =>
  String(value || '').trim().replace(/^0+(?=\d)/, '');

const parseConfiguredTableNumbers = (value?: string): string[] => {
  const seen = new Set<string>();
  return String(value || '')
    .split(',')
    .map(normalizeConfiguredTableNumber)
    .filter((number) => {
      if (!number || seen.has(number)) return false;
      seen.add(number);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));
};

const createInactiveShift = (branchId?: string): Shift => ({
  id: 'shift-not-opened',
  staffId: '',
  staffName: 'Belum ada petugas',
  staffRole: 'KASIR',
  startTime: new Date(0).toISOString(),
  initialCash: 0,
  grossOmset: 0,
  cashSales: 0,
  nonCashSales: 0,
  totalExpense: 0,
  totalIncome: 0,
  status: 'CLOSED',
  branchId,
});

interface SyncHealth {
  connectionState: RealtimeConnectionState;
  lastSuccessfulSync: number | null;
  lastRealtimeEvent: number | null;
}

// Penyimpanan browser hanya dipakai untuk mode demo tanpa Supabase. Saat cloud
// aktif, jangan membuat atau memigrasikan salinan data operasional lokal karena
// salinan itu mudah disalahartikan sebagai sumber sinkronisasi lintas perangkat.
if (typeof window !== 'undefined' && !cloudReadiness.supabase) {
  DBStorage.initDefaults();

  // One-time migration: normalize table numbers (strip old leading zeros: '01' → '1', '02' → '2')
  try {
    const storedTables = DBStorage.getTables();
    const needsMigration = storedTables.some((t) => /^0\d/.test(t.number));
    if (needsMigration) {
      const normalized = storedTables.map((t) => ({
        ...t,
        number: t.number.replace(/^0+(\d)/, '$1'),
      }));
      DBStorage.setTables(normalized);
    }
  } catch (_) {
    // ignore migration errors
  }
}

const RouteFallback = () => (
  <div className="flex flex-1 items-center justify-center bg-[#f5f5f4] text-sm font-bold text-stone-500">
    <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
    Memuat modul…
  </div>
);

const canAccessTab = (rule: AccessControlRule | undefined, tab: string): boolean => {
  if (!rule) return false;
  if (tab === 'pos') return rule.canAccessPOS;
  if (tab === 'kds') return rule.canAccessKDS;
  if (tab === 'shift') return rule.canAccessShift;
  if (tab === 'inventory') return rule.canAccessInventory;
  if (tab === 'analytics' || tab === 'superowner') return rule.canAccessAnalytics;
  if (tab === 'attendance') return rule.canAccessAttendance ?? rule.canAccessSettings;
  // 'payroll' sempat tertinggal di sini: sidebar menampilkan menunya lewat
  // aturan canAccessSettings, tapi fungsi ini menjatuhkannya ke false, jadi
  // menunya terlihat namun selalu ditolak saat diklik.
  if (['settings', 'blueprint', 'tables', 'selforder', 'payroll'].includes(tab)) return rule.canAccessSettings;
  return false;
};

const getDefaultAccessDestination = (rule: AccessControlRule): { portal: 'KASIR' | 'OWNER'; tab: string } => {
  if (rule.canAccessAnalytics) return { portal: 'OWNER', tab: 'superowner' };
  if (rule.canAccessSettings) return { portal: 'OWNER', tab: 'settings' };
  if (rule.canAccessPOS) return { portal: 'KASIR', tab: 'pos' };
  if (rule.canAccessKDS) return { portal: 'KASIR', tab: 'kds' };
  if (rule.canAccessShift) return { portal: 'KASIR', tab: 'shift' };
  if (rule.canAccessInventory) return { portal: 'KASIR', tab: 'inventory' };
  return { portal: 'KASIR', tab: '' };
};

export default function App() {
  const requestedSelfOrderBranchId = typeof window !== 'undefined'
    ? normalizeBranchId(new URLSearchParams(window.location.search).get('branch'))
    : null;
  const requestedSelfOrderTenantId = typeof window !== 'undefined'
    ? normalizeBranchId(new URLSearchParams(window.location.search).get('tenant'))
    : null;
  const requestedSelfOrderRouteCode = typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/(?:order|menu|pesan)\/(\d{2,4})\/?$/)?.[1] || null
    : null;
  const isSelfOrderUrlParam = typeof window !== 'undefined' && (
    window.location.search.includes('selforder') ||
    window.location.search.includes('table=') ||
    window.location.pathname.startsWith('/order/') ||
    window.location.pathname.startsWith('/menu/') ||
    window.location.pathname.startsWith('/pesan/') ||
    window.location.pathname.startsWith('/self-order') ||
    Boolean(requestedSelfOrderRouteCode) ||
    window.location.hash.includes('self-order') ||
    window.location.hash.includes('order')
  );

  useEffect(() => {
    document.title = isSelfOrderUrlParam ? 'Pesan di Bakso Ujo' : 'Bakso Ujo POS';
  }, [isSelfOrderUrlParam]);

  // 1. Navigation State & System Portals ('KASIR' | 'OWNER')
  const [systemPortal, setSystemPortal] = useState<'KASIR' | 'OWNER'>(() => {
    const saved = sessionStorage.getItem('omnipos_portal');
    return saved === 'OWNER' ? 'OWNER' : 'KASIR';
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    return sessionStorage.getItem('omnipos_tab') || 'pos';
  });
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Explicit Portal Switcher (Kasir Terminal vs Owner Portal)
  const handleSwitchPortal = (targetPortal: 'KASIR' | 'OWNER') => {
    const baseRule = DBStorage.getAccessControl().find((item) => item.role === activeUser.role);
    const rule = baseRule ? { ...baseRule, ...(activeUser.permissions || {}) } : undefined;
    if (targetPortal === 'OWNER') {
      if (!rule || (!rule.canAccessAnalytics && !rule.canAccessSettings)) {
        showPushToast('Akses Ditolak', 'PIN aktif tidak memiliki izin menuju Portal Owner.');
        setIsPinModalOpen(true);
        return;
      }
      setSystemPortal('OWNER');
      setActiveTab(rule.canAccessAnalytics ? 'superowner' : 'settings');
      showPushToast('Portal Manajemen Aktif', `Akses mengikuti kontrol role ${activeUser.role}.`);
    } else {
      setSystemPortal('KASIR');
      setActiveTab('pos');
      showPushToast('Terminal POS Kasir', 'Kembali ke Sistem Operasional Kasir POS.');
    }
  };

  // Tab change with system portal awareness
  const handleTabChange = (targetTab: string) => {
    const cashierTabs = ['pos', 'kds', 'shift', 'inventory'];
    const ownerTabs = ['superowner', 'blueprint', 'analytics', 'inventory', 'tables', 'attendance', 'payroll', 'selforder', 'settings'];
    const baseRule = DBStorage.getAccessControl().find((item) => item.role === activeUser.role);
    const rule = baseRule ? { ...baseRule, ...(activeUser.permissions || {}) } : undefined;

    if (!canAccessTab(rule, targetTab)) {
      showPushToast('Akses Ditolak', `Role ${activeUser.role} tidak memiliki izin untuk modul ini.`);
      return;
    }

    if (ownerTabs.includes(targetTab) && targetTab !== 'inventory') {
      setSystemPortal('OWNER');
      setActiveTab(targetTab);
    } else if (cashierTabs.includes(targetTab)) {
      if (systemPortal === 'OWNER' && targetTab !== 'inventory') {
        setSystemPortal('KASIR');
      }
      setActiveTab(targetTab);
    } else {
      setActiveTab(targetTab);
    }
  };

  // 2. System Data State
  const [activeUser, setActiveUser] = useState<UserAccount>(() => DBStorage.getActiveUser());
  const [isTerminalUnlocked, setIsTerminalUnlocked] = useState<boolean>(
    () => sessionStorage.getItem(TERMINAL_SESSION_KEY) === 'unlocked'
  );
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(
    () => sessionStorage.getItem(TERMINAL_SESSION_KEY) !== 'unlocked'
  );
  const [isSessionValidated, setIsSessionValidated] = useState<boolean>(() => !cloudReadiness.supabase);
  const [isAttendanceMode, setIsAttendanceMode] = useState<boolean>(
    () => sessionStorage.getItem(TERMINAL_MODE_KEY) === 'ATTENDANCE',
  );
  const isAttendanceTerminal = isAttendanceMode || (typeof window !== 'undefined' && (
    window.location.pathname === '/attendance' ||
    new URLSearchParams(window.location.search).get('mode') === 'attendance'
  ));

  const clearTerminalSessionState = () => {
    sessionStorage.removeItem(TERMINAL_SESSION_KEY);
    sessionStorage.removeItem(TERMINAL_BRANCH_KEY);
    sessionStorage.removeItem(TERMINAL_MODE_KEY);
    setIsTerminalUnlocked(false);
    setIsPinModalOpen(true);
    setIsAttendanceMode(false);
    setSystemPortal('KASIR');
    setActiveTab('pos');
  };

  const logoutTerminal = async () => {
    clearTerminalSessionState();
    if (cloudReadiness.supabase) {
      try {
        await cloudSignOut();
      } catch {
        // Ignore sign-out failures so the terminal can still lock locally.
      }
    }
  };

  const [branches, setBranches] = useState<Branch[]>(() => DBStorage.getBranches());
  const [currentBranch, setCurrentBranch] = useState<Branch>(() => {
    const list = DBStorage.getBranches();
    const requestedBranchId = typeof window !== 'undefined'
      ? normalizeBranchId(new URLSearchParams(window.location.search).get('branch'))
      : null;
    const sessionBranchId = typeof window !== 'undefined' ? normalizeBranchId(sessionStorage.getItem(TERMINAL_BRANCH_KEY)) : null;
    return list.find((branch) => branch.id === (requestedBranchId || sessionBranchId)) || list[0] || INITIAL_BRANCHES[0];
  });
  const branchRuntimeGuardRef = useRef(new BranchRuntimeGuard());

  const [branchOperationalConfig, setBranchOperationalConfig] = useState<BranchOperationalConfig>(
    () => defaultBranchOperationalConfig(currentBranch.id),
  );
  const [isSelfOrderSystemEnabled, setIsSelfOrderSystemEnabled] = useState<boolean>(() => DBStorage.getProfile().isSelfOrderEnabled !== false);
  const [selfOrderCatalogState, setSelfOrderCatalogState] = useState<{ loading: boolean; error: string | null }>({ loading: isSelfOrderUrlParam && cloudReadiness.supabase, error: null });
  const [publicSelfOrderShiftActive, setPublicSelfOrderShiftActive] = useState(false);

  useEffect(() => {
    // Switch outlet = new runtime epoch. Any late response captured by the
    // previous epoch is ignored by branch-scoped effects below.
    branchRuntimeGuardRef.current.begin(currentBranch.id);
  }, [currentBranch.id]);


  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const devWindow = window as typeof window & {
      __POS_BRANCH_RUNTIME__?: { getDiagnostic: () => ReturnType<BranchRuntimeGuard['diagnostic']> };
    };
    devWindow.__POS_BRANCH_RUNTIME__ = {
      getDiagnostic: () => branchRuntimeGuardRef.current.diagnostic(),
    };
    return () => {
      delete devWindow.__POS_BRANCH_RUNTIME__;
    };
  }, []);

  useEffect(() => {
    if (!isSelfOrderUrlParam || !cloudReadiness.supabase) return;
    if (!requestedSelfOrderBranchId && !requestedSelfOrderRouteCode) {
      setSelfOrderCatalogState({ loading: false, error: 'Link QR tidak memiliki tujuan cabang yang valid.' });
      return;
    }
    let active = true;
    setSelfOrderCatalogState({ loading: true, error: null });
    const refreshPublicCatalog = () => getPublicCatalogContext(requestedSelfOrderBranchId || undefined, requestedSelfOrderTenantId || undefined, requestedSelfOrderRouteCode || undefined)
      .then((context) => {
        if (!active) return;
        setCurrentBranch((branch) => ({ ...branch, ...context.branch }));
        setMenuItems(context.menuItems);
        setTables(context.tables);
        setCondimentGroups(context.condimentGroups);
        setBranchOperationalConfig(context.operationalConfig || defaultBranchOperationalConfig(context.branch.id));
        setIsSelfOrderSystemEnabled(context.operationalConfig?.selfOrderEnabled !== false);
        setPublicSelfOrderShiftActive(context.isShiftActive === true);
        if (context.profile) setProfile((current) => ({ ...current, ...context.profile }));
        setSelfOrderCatalogState({ loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Katalog cabang tidak dapat dimuat.';
        setSelfOrderCatalogState({ loading: false, error: message });
        showPushToast('Self-order Belum Siap', message);
      });
    void refreshPublicCatalog();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshPublicCatalog();
    }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isSelfOrderUrlParam, requestedSelfOrderBranchId, requestedSelfOrderTenantId, requestedSelfOrderRouteCode]);

  const handleAddBranch = (newBranch: Branch) => {
    if (!cloudReadiness.supabase) {
      const updated = DBStorage.saveBranch(newBranch);
      setBranches(updated);
      showPushToast('Outlet Baru Ditambahkan', `Cabang ${newBranch.name} berhasil didaftarkan.`);
      return;
    }
    void createCloudBranch(newBranch)
      .then(async (created) => {
        const cloudBranches = await listCloudBranches();
        setBranches(cloudBranches);
        setCurrentBranch(created);
        showPushToast('Outlet Baru Ditambahkan', `Cabang ${created.name} berhasil didaftarkan ke cloud.`);
      })
      .catch((error) => showPushToast('Outlet Gagal Dibuat', error instanceof Error ? error.message : 'Cabang gagal disimpan.'));
  };

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => cloudReadiness.supabase ? [] : DBStorage.getMenuItems());
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(() => cloudReadiness.supabase ? [] : DBStorage.getRawMaterials());
  const [tables, setTables] = useState<RestaurantTable[]>(() => cloudReadiness.supabase ? [] : DBStorage.getTables());
  const [condimentGroups, setCondimentGroups] = useState<CondimentGroup[]>(() => cloudReadiness.supabase ? [] : DBStorage.getCondimentGroups());
  const condimentGroupsRef = useRef(condimentGroups);
  useEffect(() => { condimentGroupsRef.current = condimentGroups; }, [condimentGroups]);
  const [orders, setOrders] = useState<Order[]>(() => cloudReadiness.supabase ? [] : DBStorage.getOrders());
  const [ownerMonitorData, setOwnerMonitorData] = useState<{
    branchIds: string[];
    orders: Order[];
    tables: RestaurantTable[];
    rawMaterials: RawMaterial[];
  }>({ branchIds: [], orders: [], tables: [], rawMaterials: [] });
  const [currentShift, setCurrentShift] = useState<Shift>(() => cloudReadiness.supabase ? createInactiveShift(currentBranch.id) : DBStorage.getCurrentShift(currentBranch.id));
  const [isShiftStatusLoading, setIsShiftStatusLoading] = useState<boolean>(cloudReadiness.supabase);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>(() => cloudReadiness.supabase ? [] : DBStorage.getShiftHistory());
  const [expenseRecords, setExpenseRecords] = useState<ExpenseIncomeRecord[]>(() => cloudReadiness.supabase ? [] : DBStorage.getExpenseRecords());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => DBStorage.getAttendanceRecords());
  const [profile, setProfile] = useState<RestaurantProfile>(() => DBStorage.getProfile());
  const [isAttendanceConfigReady, setIsAttendanceConfigReady] = useState<boolean>(() => !cloudReadiness.supabase);
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => DBStorage.getPrinterConfig());
  const printerConfigRef = useRef(printerConfig);
  useEffect(() => { printerConfigRef.current = printerConfig; }, [printerConfig]);
  const handleToggleAutoPrintKitchen = useCallback(() => {
    setPrinterConfig((current) => {
      const next: PrinterConfig = { ...current, autoPrintKitchenOnNewOrder: !current.autoPrintKitchenOnNewOrder };
      DBStorage.savePrinterConfig(next);
      showPushToast(
        next.autoPrintKitchenOnNewOrder ? 'Auto Print Dinyalakan' : 'Auto Print Dimatikan',
        next.autoPrintKitchenOnNewOrder
          ? 'Tiket dapur akan otomatis tercetak saat order baru masuk.'
          : 'Order baru tidak akan dicetak otomatis lagi.'
      );
      return next;
    });
  }, []);
  const [staffAccounts, setStaffAccounts] = useState<UserAccount[]>(() => DBStorage.getStaff());
  const [accessControl, setAccessControl] = useState<AccessControlRule[]>(() => DBStorage.getAccessControl());
  const roleAccessRule = accessControl.find((rule) => rule.role === activeUser.role);
  const activeAccessRule = roleAccessRule
    ? { ...roleAccessRule, ...(activeUser.permissions || {}) }
    : undefined;

  useEffect(() => {
    sessionStorage.setItem('omnipos_portal', systemPortal);
    sessionStorage.setItem('omnipos_tab', activeTab);
  }, [systemPortal, activeTab]);

  useEffect(() => {
    // Saat startup, activeUser masih dapat berisi ID seed lokal (`usr-2`)
    // beberapa milidetik sebelum validateCloudSession memulihkan UUID Auth.
    // Jangan kirim ID legacy itu ke branch_members.user_id (uuid), karena
    // PostgREST akan menolaknya sebagai HTTP 400 / invalid input syntax.
    if (
      !cloudReadiness.supabase
      || !isSessionValidated
      || !isTerminalUnlocked
      || !isCloudUuid(currentBranch.id)
      || !isCloudUuid(activeUser.id)
    ) return;
    let cancelled = false;
    void (async () => {
      const { data: membership, error } = await getSupabase().from('branch_members')
        .select('role,permissions,is_active')
        .eq('user_id', activeUser.id)
        .eq('branch_id', currentBranch.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        showPushToast('Validasi Akses Cabang Tertunda', error.message);
        return;
      }
      if (!membership?.is_active) {
        showPushToast('Akses Cabang Ditolak', `Akun tidak memiliki membership aktif di ${currentBranch.name}.`);
        return;
      }
      sessionStorage.setItem(TERMINAL_BRANCH_KEY, currentBranch.id);
      setActiveUser((current) => ({
        ...current,
        role: membership.role as UserAccount['role'],
        permissions: membership.permissions || {},
      }));
    })();
    return () => { cancelled = true; };
  }, [isSessionValidated, isTerminalUnlocked, currentBranch.id, activeUser.id]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || isAttendanceTerminal) return;
    let cancelled = false;
    void listCloudBranches()
      .then((cloudBranches) => {
        if (!cancelled && cloudBranches.length) {
          setBranches(cloudBranches);
          setCurrentBranch((current) => cloudBranches.find((branch) =>
            branch.id === normalizeBranchId(current.id) || branch.code === current.code
          ) || current);
        }
      })
      .catch((error) => {
        if (!cancelled) showPushToast('Daftar Cabang Belum Tersinkron', error instanceof Error ? error.message : 'Cabang cloud gagal dibaca.');
      });
    return () => { cancelled = true; };
  }, [isAttendanceTerminal, isTerminalUnlocked, activeUser.id]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || isAttendanceTerminal) return;
    if (!['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(activeUser.role)) return;
    if (!['settings', 'attendance', 'payroll', 'shift'].includes(activeTab)) return;
    let cancelled = false;
    void listCloudStaff()
      .then((staff) => {
        if (!cancelled) setStaffAccounts(staff);
      })
      .catch((error) => {
        if (!cancelled) showPushToast('Data Staff Belum Tersinkron', error instanceof Error ? error.message : 'Daftar staff cloud gagal dibaca.');
      });
    return () => {
      cancelled = true;
    };
  }, [isAttendanceTerminal, isTerminalUnlocked, activeUser.id, activeUser.role, activeTab]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || !currentBranch.id) return;
    if (!isAttendanceTerminal && !['attendance', 'payroll'].includes(activeTab)) return;
    let cancelled = false;
    void listCloudAttendance(currentBranch.id)
      .then((records) => {
        if (!cancelled) setAttendanceRecords(records);
      })
      .catch((error) => {
        if (!cancelled) showPushToast('Riwayat Presensi Belum Tersinkron', error instanceof Error ? error.message : 'Riwayat cloud gagal dibaca.');
      });
    return () => {
      cancelled = true;
    };
  }, [isAttendanceTerminal, isTerminalUnlocked, currentBranch.id, activeUser.id, activeUser.role, activeTab]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || !isAttendanceTerminal || !currentBranch.id) return;
    let cancelled = false;
    setIsAttendanceConfigReady(false);
    void getCloudAttendanceConfig(currentBranch.id)
      .then((config) => {
        if (!cancelled) {
          setProfile((current) => ({ ...current, ...config }));
          setIsAttendanceConfigReady(true);
        }
      })
      .catch((error) => {
        if (!cancelled) showPushToast(
          'Konfigurasi Absensi Belum Siap',
          error instanceof Error ? error.message : 'Aturan GPS outlet gagal dimuat.',
        );
      });
    return () => { cancelled = true; };
  }, [isAttendanceTerminal, isTerminalUnlocked, currentBranch.id]);

  const refreshCloudCatalog = async (branchId = currentBranch.id, branchName = currentBranch.name) => {
    const runtimeToken = branchRuntimeGuardRef.current.snapshot(branchId);
    const catalog = await listCloudCatalog(branchId);
    if (!branchRuntimeGuardRef.current.isCurrent(runtimeToken)) return;
    setMenuItems(catalog.menuItems);
    setRawMaterials(catalog.rawMaterials.map((material) => ({ ...material, branchName })));
  };

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || isAttendanceTerminal || !currentBranch.id || !['pos', 'kds', 'inventory', 'settings', 'selforder'].includes(activeTab)) return;
    let cancelled = false;
    const branchId = currentBranch.id;
    const branchName = currentBranch.name;
    const runtimeToken = branchRuntimeGuardRef.current.snapshot(branchId);
    void listCloudCatalog(branchId)
      .then((catalog) => {
        if (cancelled || !branchRuntimeGuardRef.current.isCurrent(runtimeToken)) return;
        setMenuItems(catalog.menuItems);
        setRawMaterials(catalog.rawMaterials.map((material) => ({ ...material, branchName })));
      })
      .catch((error) => {
        if (!cancelled && branchRuntimeGuardRef.current.isCurrent(runtimeToken)) showPushToast('Katalog Belum Tersinkron', error instanceof Error ? error.message : 'Master data cloud gagal dibaca.');
      });
    return () => { cancelled = true; };
  }, [isAttendanceTerminal, isTerminalUnlocked, currentBranch.id, activeTab]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || isAttendanceTerminal || systemPortal !== 'OWNER' || activeTab !== 'superowner') return;
    if (!['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(activeUser.role)) return;
    let cancelled = false;
    let running = false;
    const refreshOwnerMonitor = async () => {
      if (running) return;
      running = true;
      try {
        const results = await Promise.allSettled(branches.map(async (branch) => {
          const [branchOrders, branchTables, catalog] = await Promise.all([
            listCloudOrders(branch.id),
            listCloudTables(branch.id),
            listCloudCatalog(branch.id),
          ]);
          return {
            branchId: branch.id,
            orders: branchOrders,
            tables: branchTables,
            rawMaterials: catalog.rawMaterials.map((material) => ({ ...material, branchName: branch.name })),
          };
        }));
        const snapshots = results
          .filter((result): result is PromiseFulfilledResult<{ branchId: string; orders: Order[]; tables: RestaurantTable[]; rawMaterials: RawMaterial[] }> => result.status === 'fulfilled')
          .map((result) => result.value);
        if (snapshots.length === 0) throw new Error('Tidak ada cabang yang dapat dibaca oleh akun ini');
        if (!cancelled) setOwnerMonitorData({
          branchIds: snapshots.map((snapshot) => snapshot.branchId),
          orders: snapshots.flatMap((snapshot) => snapshot.orders),
          tables: snapshots.flatMap((snapshot) => snapshot.tables),
          rawMaterials: snapshots.flatMap((snapshot) => snapshot.rawMaterials),
        });
      } catch (error) {
        if (!cancelled) showPushToast('Monitoring Pusat Belum Lengkap', error instanceof Error ? error.message : 'Data lintas cabang gagal dimuat.');
      } finally {
        running = false;
      }
    };
    void refreshOwnerMonitor();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshOwnerMonitor();
    };
    const timer = window.setInterval(refreshWhenVisible, 120_000);
    window.addEventListener('focus', refreshWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [isAttendanceTerminal, isTerminalUnlocked, systemPortal, activeTab, activeUser.id, activeUser.role, branches]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || isAttendanceTerminal || !currentBranch.id || !['pos', 'kds', 'tables', 'settings', 'selforder'].includes(activeTab)) return;
    let cancelled = false;
    const branchId = currentBranch.id;
    const runtimeToken = branchRuntimeGuardRef.current.snapshot(branchId);
    const isCurrent = () => !cancelled && branchRuntimeGuardRef.current.isCurrent(runtimeToken);
    const mergeCloudTables = (cloudTables: RestaurantTable[]) => {
      if (!isCurrent()) return;
      setTables((existing) => [...existing.filter((table) => table.branchId !== branchId), ...cloudTables]);
    };
    void Promise.all([
      listCloudTables(branchId),
      getCloudBranchOperationalConfig(branchId),
      getCloudTenantBrand(),
    ]).then(([cloudTables, config, tenantBrand]) => {
      if (!isCurrent()) return;
      mergeCloudTables(cloudTables);
      setBranchOperationalConfig(config);
      setIsSelfOrderSystemEnabled(config.selfOrderEnabled);
      setProfile({ ...DBStorage.getProfile(), ...tenantBrand, ...(config.profileOverrides || {}), isSelfOrderEnabled: config.selfOrderEnabled });
    }).catch((error) => {
      if (isCurrent()) showPushToast('Konfigurasi Cabang Belum Tersinkron', error instanceof Error ? error.message : 'Meja dan self-order cabang gagal dibaca.');
    });
    return () => { cancelled = true; };
  }, [isAttendanceTerminal, isTerminalUnlocked, currentBranch.id, activeTab]);

  useEffect(() => {
    const needsLiveOrders = !isAttendanceTerminal && systemPortal === 'KASIR' && ['pos', 'kds', 'shift'].includes(activeTab);
    if (!cloudReadiness.supabase || !isTerminalUnlocked || !currentBranch.id || !needsLiveOrders) return;
    let active = true;
    const branchId = currentBranch.id;
    const runtimeToken = branchRuntimeGuardRef.current.snapshot(branchId);
    const isRuntimeActive = () => active && branchRuntimeGuardRef.current.isCurrent(runtimeToken);
    let knownItemQuantities = new Map<string, number>(orders.filter((order) => !order.branchId || order.branchId === branchId).map((order) => [
      order.id,
      order.items.reduce((sum, item) => sum + item.quantity, 0),
    ] as [string, number]));
    let isFirstLoad = true;
    let isRefreshing = false;
    let refreshQueued = false;
    let realtimeState: RealtimeConnectionState = 'CONNECTING';
    const branchMountedAt = Date.now();
    let lastFallbackAt = 0;
    let consecutiveRefreshFailures = 0;
    let initialRetryTimer = 0;
    const refresh = () => {
      if (isRefreshing) { refreshQueued = true; return; }
      isRefreshing = true;
      void listCloudOrders(branchId)
        .then((cloudOrders) => {
          if (!isRuntimeActive()) return;
          const nextItemQuantities = new Map<string, number>(cloudOrders.map((order) => [
            order.id,
            order.items.reduce((sum, item) => sum + item.quantity, 0),
          ] as [string, number]));
          const changedOrders = cloudOrders.filter((order) => (
            (nextItemQuantities.get(order.id) || 0) > (knownItemQuantities.get(order.id) || 0)
          ));

          // Mendeteksi order baru dan tambahan item pada bill yang sama.
          if (!isFirstLoad && changedOrders.length > 0) {
            const selfOrders = changedOrders.filter((order) => order.source === 'SELF_ORDER');

            if (selfOrders.length > 0) {
              if (profile.soundNotificationsEnabled !== false && activeTabRef.current !== 'kds') {
                playSelfOrderAlertSound(profile.soundCustomerOrder);
              }
              selfOrders.forEach((order) => {
                showPushToast(
                  'Pesanan Self-order Masuk',
                  `Meja ${order.tableNumber} — ${order.orderNumber} menerima item baru.`
                );
              });
            } else {
              if (profile.soundNotificationsEnabled !== false && activeTabRef.current !== 'kds') {
                playNewOrderSound(profile.soundPesananMasuk);
              }
            }

            // Auto-cetak tiket dapur (tanpa harga) untuk order baru/tambahan item,
            // hanya ketika toggle Auto Print diaktifkan dari panel Kasir atau KDS.
            if (printerConfigRef.current.autoPrintKitchenOnNewOrder) {
              changedOrders.forEach((order) => {
                void BluetoothPrinterService.printKitchenTicket(order, profile, printerConfigRef.current, condimentGroupsRef.current).then((result) => {
                  if (!result.success) {
                    showPushToast('Auto Print Gagal', `${formatOrderLabel(order)} — ${result.error || 'Periksa koneksi printer.'}`);
                  }
                });
              });
            }
          }
          // Saat Supabase aktif, database adalah satu-satunya sumber kebenaran.
          // Order lokal tidak boleh disisipkan ke layar cloud karena dapat membuat
          // kasir/KDS melihat transaksi yang belum pernah diterima server.
          setOrders(cloudOrders);

          // Update state trackers for next realtime comparison
          knownItemQuantities = nextItemQuantities;
          isFirstLoad = false;
          consecutiveRefreshFailures = 0;
          window.clearTimeout(initialRetryTimer);

          setOrderSyncHealth((current) => ({ ...current, lastSuccessfulSync: Date.now() }));
          branchRuntimeGuardRef.current.recordSync(runtimeToken, 'ORDERS');
        })
        .catch((error) => {
          consecutiveRefreshFailures += 1;
          if (isRuntimeActive() && isFirstLoad && consecutiveRefreshFailures < 3) {
            window.clearTimeout(initialRetryTimer);
            initialRetryTimer = window.setTimeout(refresh, 600 * consecutiveRefreshFailures);
            return;
          }
          showPushToast('Sinkronisasi Order Tertunda', error instanceof Error ? error.message : 'Order cloud belum dapat dimuat.');
        })
        .finally(() => {
          isRefreshing = false;
          if (refreshQueued && isRuntimeActive()) { refreshQueued = false; refresh(); }
        });
    };
    lastFallbackAt = Date.now();
    refresh();
    const unsubscribe = subscribeCloudOrders(
      branchId,
      () => {
        if (!isRuntimeActive()) return;
        setOrderSyncHealth((current) => ({ ...current, lastRealtimeEvent: Date.now() }));
        branchRuntimeGuardRef.current.recordRealtime(runtimeToken, 'ORDERS');
        refresh();
        void refreshBranchTables(branchId);
      },
      (state) => {
        if (!isRuntimeActive()) return;
        const recovered = realtimeState === 'DEGRADED' && state === 'HEALTHY';
        realtimeState = state;
        setOrderSyncHealth((current) => ({ ...current, connectionState: state }));
        branchRuntimeGuardRef.current.recordConnection(runtimeToken, 'ORDERS', state);
        if (recovered) {
          refresh();
          void refreshBranchTables(branchId);
        }
      },
    );
    const fallbackTimer = window.setInterval(() => {
      if (!isRuntimeActive() || document.visibilityState !== 'visible') return;
      const visibleTab = activeTabRef.current;
      // Fast reconciliation for the first minute after switching outlet.
      // Afterwards Broadcast remains primary and polling becomes a sparse
      // safety net, keeping free-tier traffic low.
      const warmup = Date.now() - branchMountedAt < 60_000;
      const fallbackDelay = realtimeState === 'HEALTHY'
        ? (warmup ? 10_000 : 120_000)
        : visibleTab === 'pos' ? 5_000 : visibleTab === 'kds' ? 8_000 : 20_000;
      if (!fallbackDelay || Date.now() - lastFallbackAt < fallbackDelay) return;
      lastFallbackAt = Date.now();
      refresh();
    }, 5_000);
    const reconcileVisible = () => { if (isRuntimeActive() && document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', reconcileVisible);
    window.addEventListener('online', reconcileVisible);
    document.addEventListener('visibilitychange', reconcileVisible);
    return () => {
      active = false;
      window.clearTimeout(initialRetryTimer);
      window.clearInterval(fallbackTimer);
      window.removeEventListener('focus', reconcileVisible);
      window.removeEventListener('online', reconcileVisible);
      document.removeEventListener('visibilitychange', reconcileVisible);
      unsubscribe();
    };
  }, [isAttendanceTerminal, isTerminalUnlocked, currentBranch.id, systemPortal, activeTab, profile.soundNotificationsEnabled, profile.soundCustomerOrder, profile.soundPesananMasuk]);

  // Database adalah sumber tunggal status shift. Realtime memberi respons
  // cepat; polling/focus menjadi pengaman saat websocket terputus.
  useEffect(() => {
    const needsLiveShift = !isAttendanceTerminal && systemPortal === 'KASIR' && ['pos', 'kds', 'shift'].includes(activeTab);
    if (!cloudReadiness.supabase || !isTerminalUnlocked || !currentBranch.id || !needsLiveShift) return;
    let cancelled = false;
    const branchId = currentBranch.id;
    const runtimeToken = branchRuntimeGuardRef.current.snapshot(branchId);
    const isRuntimeCurrent = () => !cancelled && branchRuntimeGuardRef.current.isCurrent(runtimeToken);
    let requestSequence = 0;
    let syncErrorShown = false;
    let realtimeState: RealtimeConnectionState = 'CONNECTING';
    let lastFallbackAt = 0;

    // Pertahankan hasil server terakhir untuk cabang yang sama ketika pindah tab.
    // Saat cabang berubah, tampilkan status verifikasi tanpa sempat memakai shift cabang lama.
    setIsShiftStatusLoading(true);
    setCurrentShift((current) => current.branchId === branchId ? current : createInactiveShift(branchId));

    const syncShiftFromCloud = async () => {
      // Block sync during the close-shift window to prevent race condition:
      // after closeCloudShift(), the realtime listener fires and getCloudActiveShift()
      // returns null → clearCurrentShift() would overwrite the just-saved CLOSED shift.
      if (isClosingShiftRef.current) return;
      const sequence = ++requestSequence;
      try {
        const cloudShift = await getCloudActiveShift(branchId);
        if (!isRuntimeCurrent() || sequence !== requestSequence) return;
        if (isClosingShiftRef.current) return;
        const nextShift = cloudShift || createInactiveShift(currentBranch.id);
        setCurrentShift(nextShift);
        setIsShiftStatusLoading(false);
        setShiftSyncHealth((current) => ({ ...current, lastSuccessfulSync: Date.now() }));
        branchRuntimeGuardRef.current.recordSync(runtimeToken, 'SHIFT');
        syncErrorShown = false;
      } catch (error) {
        if (!isRuntimeCurrent() || sequence !== requestSequence || syncErrorShown) return;
        syncErrorShown = true;
        if (error instanceof ShiftServiceError && error.status === 401) {
          clearTerminalSessionState();
        }
        showPushToast(
          'Status Shift Belum Tersinkron',
          error instanceof Error ? error.message : 'Data shift pusat belum dapat dibaca.',
        );
      }
    };

    lastFallbackAt = Date.now();
    void syncShiftFromCloud();
    const unsubscribe = subscribeCloudShift(
      branchId,
      () => {
        if (!isRuntimeCurrent()) return;
        setShiftSyncHealth((current) => ({ ...current, lastRealtimeEvent: Date.now() }));
        branchRuntimeGuardRef.current.recordRealtime(runtimeToken, 'SHIFT');
        void syncShiftFromCloud();
        void listCloudShiftHistory(branchId).then((history) => { if (isRuntimeCurrent()) setShiftHistory(history); }).catch(() => {});
      },
      (state) => {
        if (!isRuntimeCurrent()) return;
        const recovered = realtimeState === 'DEGRADED' && state === 'HEALTHY';
        realtimeState = state;
        setShiftSyncHealth((current) => ({ ...current, connectionState: state }));
        branchRuntimeGuardRef.current.recordConnection(runtimeToken, 'SHIFT', state);
        if (recovered) void syncShiftFromCloud();
      },
    );
    const pollTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const fallbackDelay = realtimeState === 'HEALTHY' ? 600_000 : 60_000;
      if (Date.now() - lastFallbackAt < fallbackDelay) return;
      lastFallbackAt = Date.now();
      void syncShiftFromCloud();
    }, 15_000);
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void syncShiftFromCloud();
    };
    window.addEventListener('focus', syncWhenVisible);
    window.addEventListener('online', syncWhenVisible);
    document.addEventListener('visibilitychange', syncWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      window.removeEventListener('focus', syncWhenVisible);
      window.removeEventListener('online', syncWhenVisible);
      document.removeEventListener('visibilitychange', syncWhenVisible);
      unsubscribe();
    };
  }, [isAttendanceTerminal, isTerminalUnlocked, currentBranch.id, activeUser.id, systemPortal, activeTab]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || isAttendanceTerminal || !currentBranch.id || !['pos', 'kds', 'settings', 'selforder'].includes(activeTab)) return;
    let cancelled = false;
    const branchId = currentBranch.id;
    const runtimeToken = branchRuntimeGuardRef.current.snapshot(branchId);
    const isCurrent = () => !cancelled && branchRuntimeGuardRef.current.isCurrent(runtimeToken);
    void listCloudCondiments(branchId).then((groups) => {
      if (isCurrent() && groups.length) setCondimentGroups(groups);
    }).catch((error) => {
      if (isCurrent()) showPushToast('Condiment Belum Tersinkron', error instanceof Error ? error.message : 'Konfigurasi condiment cloud gagal dibaca.');
    });
    return () => { cancelled = true; };
  }, [isAttendanceTerminal, isTerminalUnlocked, currentBranch.id, activeTab]);

  useEffect(() => {
    const needsFinance = activeTab === 'shift' || activeTab === 'analytics';
    if (!cloudReadiness.supabase || !isTerminalUnlocked || isAttendanceTerminal || !currentBranch.id || !needsFinance) return;
    let cancelled = false;
    const branchId = currentBranch.id;
    const runtimeToken = branchRuntimeGuardRef.current.snapshot(branchId);
    const isCurrent = () => !cancelled && branchRuntimeGuardRef.current.isCurrent(runtimeToken);
    const refreshFinance = () => void Promise.all([
      listCloudExpenseRecords(branchId),
      listCloudShiftHistory(branchId),
    ])
      .then(([records, history]) => {
        if (isCurrent()) {
          setExpenseRecords(records);
          setShiftHistory(history);
        }
      })
      .catch((error) => {
        if (isCurrent()) showPushToast('Kas Cabang Belum Tersinkron', error instanceof Error ? error.message : 'Pengeluaran dan pemasukan gagal dimuat.');
      });
    refreshFinance();
    return () => { cancelled = true; };
  }, [isAttendanceTerminal, isTerminalUnlocked, currentBranch.id, activeTab]);

  useEffect(() => {
    const needsOperations = ['pos', 'kds', 'shift', 'inventory', 'tables', 'settings', 'selforder'].includes(activeTab);
    if (!cloudReadiness.supabase || !isTerminalUnlocked || isAttendanceTerminal || !currentBranch.id || !needsOperations) return;

    let cancelled = false;
    const branchId = currentBranch.id;
    const runtimeToken = branchRuntimeGuardRef.current.snapshot(branchId);
    const isRuntimeCurrent = () => !cancelled && branchRuntimeGuardRef.current.isCurrent(runtimeToken);
    let realtimeState: RealtimeConnectionState = 'CONNECTING';
    const branchMountedAt = Date.now();
    let lastReconcileAt = 0;
    let reconciling = false;
    const timers = new Map<string, number>();

    const debounce = (key: string, action: () => void) => {
      const previous = timers.get(key);
      if (previous) window.clearTimeout(previous);
      timers.set(key, window.setTimeout(action, 350));
    };

    const mergeTables = (cloudTables: RestaurantTable[]) => {
      if (!isRuntimeCurrent()) return;
      setTables((existing) => [
        ...existing.filter((item) => item.branchId !== branchId),
        ...cloudTables,
      ]);
    };

    const applyOperationalConfig = (config: BranchOperationalConfig) => {
      if (!isRuntimeCurrent()) return;
      setBranchOperationalConfig(config);
      setIsSelfOrderSystemEnabled(config.selfOrderEnabled);
      setProfile((current) => ({
        ...current,
        ...(config.profileOverrides || {}),
        isSelfOrderEnabled: config.selfOrderEnabled,
      }));
    };

    const reconcileOperations = async () => {
      if (!isRuntimeCurrent() || reconciling || document.visibilityState === 'hidden') return;
      reconciling = true;
      try {
        const jobs: Promise<unknown>[] = [
          listCloudTables(branchId).then(mergeTables),
        ];

        if (['pos', 'kds', 'settings', 'selforder'].includes(activeTab)) {
          jobs.push(
            listCloudCondiments(branchId).then((groups) => {
              if (isRuntimeCurrent()) setCondimentGroups(groups);
            }),
          );
        }

        if (['pos', 'kds', 'tables', 'settings', 'selforder'].includes(activeTab)) {
          jobs.push(
            getCloudBranchOperationalConfig(branchId).then(applyOperationalConfig),
          );
        }

        if (['pos', 'kds', 'inventory', 'settings'].includes(activeTab)) {
          jobs.push(refreshCloudCatalog(branchId, currentBranch.name));
        }

        if (activeTab === 'shift') {
          jobs.push(
            listCloudExpenseRecords(branchId).then((records) => {
              if (isRuntimeCurrent()) setExpenseRecords(records);
            }),
          );
        }

        await Promise.allSettled(jobs);
        if (isRuntimeCurrent()) {
          lastReconcileAt = Date.now();
          branchRuntimeGuardRef.current.recordSync(runtimeToken, 'OPERATIONS');
        }
      } finally {
        reconciling = false;
      }
    };

    const unsubscribe = subscribeBranchOperations(
      branchId,
      (table) => {
        if (!isRuntimeCurrent()) return;
        branchRuntimeGuardRef.current.recordRealtime(runtimeToken, 'OPERATIONS');

        if (table === 'restaurant_tables') {
          debounce('tables', () => {
            if (isSelfOrderUrlParam) {
              void getPublicCatalogContext(branchId)
                .then((ctx) => mergeTables(ctx.tables))
                .catch(() => undefined);
            } else {
              void listCloudTables(branchId)
                .then(mergeTables)
                .catch(() => undefined);
            }
          });
        } else if (table === 'menu_items' || table === 'menu_item_ingredients' || table === 'raw_materials') {
          debounce('catalog', () => { void refreshCloudCatalog(branchId, currentBranch.name); });
        } else if (table === 'condiment_groups' || table === 'condiment_options') {
          debounce('condiments', () => {
            void listCloudCondiments(branchId)
              .then((groups) => { if (isRuntimeCurrent()) setCondimentGroups(groups); })
              .catch(() => undefined);
          });
        } else if (table === 'branch_operational_config') {
          debounce('config', () => {
            void getCloudBranchOperationalConfig(branchId)
              .then(applyOperationalConfig)
              .catch(() => undefined);
          });
        } else if (table === 'expense_income_records') {
          debounce('expenses', () => {
            void listCloudExpenseRecords(branchId)
              .then((records) => { if (isRuntimeCurrent()) setExpenseRecords(records); })
              .catch(() => undefined);
          });
        }
      },
      (state) => {
        if (!isRuntimeCurrent()) return;
        const recovered = realtimeState === 'DEGRADED' && state === 'HEALTHY';
        const firstHealthy = realtimeState !== 'HEALTHY' && state === 'HEALTHY' && lastReconcileAt === 0;
        realtimeState = state;
        branchRuntimeGuardRef.current.recordConnection(runtimeToken, 'OPERATIONS', state);
        if (recovered || firstHealthy) void reconcileOperations();
      },
    );

    // Broadcast is primary. This watchdog only prevents an outlet from staying
    // stale when a private channel is authorized late or briefly reconnects.
    const fallbackTimer = window.setInterval(() => {
      if (!isRuntimeCurrent() || document.visibilityState !== 'visible') return;
      const warmup = Date.now() - branchMountedAt < 60_000;
      const delay = realtimeState === 'HEALTHY'
        ? (warmup ? 10_000 : 120_000)
        : 5_000;
      if (Date.now() - lastReconcileAt < delay) return;
      void reconcileOperations();
    }, 5_000);

    const reconcileWhenVisible = () => {
      if (isRuntimeCurrent() && document.visibilityState === 'visible') void reconcileOperations();
    };
    window.addEventListener('focus', reconcileWhenVisible);
    window.addEventListener('online', reconcileWhenVisible);
    document.addEventListener('visibilitychange', reconcileWhenVisible);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(fallbackTimer);
      window.removeEventListener('focus', reconcileWhenVisible);
      window.removeEventListener('online', reconcileWhenVisible);
      document.removeEventListener('visibilitychange', reconcileWhenVisible);
      unsubscribe();
    };
  }, [isAttendanceTerminal, isTerminalUnlocked, currentBranch.id, activeTab]);

  const refreshCloudStaff = async () => {
    const staff = await listCloudStaff();
    setStaffAccounts(staff);
  };

  const permissionsForRole = (role: UserAccount['role']) => {
    const rule = accessControl.find((item) => item.role === role);
    if (!rule) return undefined;
    const { role: _role, ...permissions } = rule;
    return permissions;
  };

  const saveStaff = async (staff: UserAccount) => {
    if (!cloudReadiness.supabase) {
      setStaffAccounts(DBStorage.saveStaff(staff));
      showPushToast('Staff Disimpan', `Detail akun staf ${staff.name} berhasil diperbarui.`);
      return;
    }
    try {
      const enriched = {
        ...staff,
        permissions: staff.permissions || permissionsForRole(staff.role),
      };
      if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(staff.id)) await updateCloudStaff(enriched);
      else await createCloudStaff(enriched);
      await refreshCloudStaff();
      showPushToast('Staff Disimpan', `Akun, role, outlet, jadwal, dan PIN ${staff.name} telah tersimpan aman.`);
    } catch (error) {
      showPushToast('Staff Gagal Disimpan', error instanceof Error ? error.message : 'Operasi staff gagal.');
      throw error;
    }
  };

  const removeStaff = async (id: string) => {
    if (!cloudReadiness.supabase) {
      setStaffAccounts(DBStorage.deleteStaff(id));
      showPushToast('Staff Dihapus', 'Akun staf berhasil dihapus.');
      return;
    }
    try {
      await deactivateCloudStaff(id);
      await refreshCloudStaff();
      showPushToast('Staff Dinonaktifkan', 'Sesi dan akses outlet staff telah dinonaktifkan.');
    } catch (error) {
      showPushToast('Staff Gagal Dinonaktifkan', error instanceof Error ? error.message : 'Operasi staff gagal.');
      throw error;
    }
  };

  const saveAccessRules = async (rules: AccessControlRule[]) => {
    if (!cloudReadiness.supabase) {
      setAccessControl(rules);
      DBStorage.saveAccessControl(rules);
      return;
    }
    try {
      await Promise.all(staffAccounts.map((staff) => {
        const rule = rules.find((item) => item.role === staff.role);
        if (!rule) return Promise.resolve();
        const { role: _role, ...permissions } = rule;
        return updateCloudStaff({ ...staff, permissions });
      }));
      setAccessControl(rules);
      await refreshCloudStaff();
      showPushToast('Hak Akses Tersimpan', 'Matriks role telah diterapkan ke membership seluruh staff yang dapat Anda kelola.');
    } catch (error) {
      showPushToast('Sinkronisasi Hak Akses Gagal', error instanceof Error ? error.message : 'Matriks akses cloud gagal diperbarui.');
      throw error;
    }
  };

  useEffect(() => {
    if (!activeAccessRule || canAccessTab(activeAccessRule, activeTab)) return;
    const destination = getDefaultAccessDestination(activeAccessRule);
    if (!destination.tab) {
      setIsPinModalOpen(true);
      return;
    }
    setSystemPortal(destination.portal);
    setActiveTab(destination.tab);
  }, [accessControl, activeUser.role, activeUser.permissions, activeTab]);

  useEffect(() => {
    if (!cloudReadiness.supabase) {
      setIsSessionValidated(true);
      return;
    }

    const validateCloudSession = async () => {
      const hasLocalUnlock = sessionStorage.getItem(TERMINAL_SESSION_KEY) === 'unlocked';
      const branchId = normalizeBranchId(sessionStorage.getItem(TERMINAL_BRANCH_KEY));
      if (!hasLocalUnlock || !branchId) {
        clearTerminalSessionState();
        setIsSessionValidated(true);
        return;
      }
      try {
        const supabase = getSupabase();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) throw new Error('No session');
        const [{ data: profile }, { data: memberships }] = await Promise.all([
          supabase.from('user_profiles').select('display_name,is_active').eq('user_id', user.id).maybeSingle(),
          supabase.from('branch_members').select('branch_id,role,permissions,is_active').eq('user_id', user.id).eq('is_active', true),
        ]);
        const membership = memberships?.find((item) => item.branch_id === branchId);
        if (!profile?.is_active || !membership?.is_active) throw new Error('Inactive session');
        const cloudBranches = await listCloudBranches();
        const branch = cloudBranches.find((item) => item.id === branchId);
        if (!branch) throw new Error('Unknown branch');
        const restoredUser: UserAccount = {
          id: user.id,
          name: profile.display_name || 'Staff',
          pin: '',
          role: membership.role as UserAccount['role'],
          branchIds: (memberships || []).map((item) => item.branch_id),
          permissions: membership.permissions || {},
          isActive: true,
        };
        setActiveUser(restoredUser);
        setBranches(cloudBranches);
        setCurrentBranch(branch);
        setIsAttendanceMode(sessionStorage.getItem(TERMINAL_MODE_KEY) === 'ATTENDANCE');
        setIsTerminalUnlocked(true);
        setIsPinModalOpen(false);
      } catch {
        clearTerminalSessionState();
      } finally {
        setIsSessionValidated(true);
      }
    };
    void validateCloudSession();
  }, []);

  // 4. Online/Offline & Sync Queue State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => cloudReadiness.supabase ? 0 : DBStorage.getOfflineQueue().length);
  const [orderSyncHealth, setOrderSyncHealth] = useState<SyncHealth>({ connectionState: 'CONNECTING', lastSuccessfulSync: null, lastRealtimeEvent: null });
  const [shiftSyncHealth, setShiftSyncHealth] = useState<SyncHealth>({ connectionState: 'CONNECTING', lastSuccessfulSync: null, lastRealtimeEvent: null });
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // 5. Toast Push Notifications State
  const [toastNotification, setToastNotification] = useState<{ title: string; message: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  // Flag to block cloud shift sync immediately after closeShift — prevents race condition
  // where subscribeCloudShift fires right after close and overwrites the saved CLOSED shift
  const isClosingShiftRef = useRef<boolean>(false);

  // 6. Modals State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [activeCheckoutOrder, setActiveCheckoutOrder] = useState<Partial<Order> | null>(null);

  const [isSelfOrderModalOpen, setIsSelfOrderModalOpen] = useState<boolean>(false);
  const [isTableManagementOpen, setIsTableManagementOpen] = useState<boolean>(false);
  const [isQuickTableModalOpen, setIsQuickTableModalOpen] = useState<boolean>(false);
  const [isQrPrintOpen, setIsQrPrintOpen] = useState<boolean>(false);
  const [selectedSelfOrderTable, setSelectedSelfOrderTable] = useState<string>('1');
  const [tableSelectionRequest, setTableSelectionRequest] = useState<{ tableNumber: string; requestId: number } | null>(null);

  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);
  const [isQuickAccessMenuOpen, setIsQuickAccessMenuOpen] = useState(false);

  // Listen to Online/Offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Session expiry watcher: auto-lock terminal when session expires
  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked) return;
    
    const unsubscribe = watchSessionExpiry(() => {
      // Session expired - lock terminal immediately
      void logoutTerminal();
      showPushToast(
        'Sesi Berakhir',
        'Sesi login telah berakhir. Terminal dikunci untuk keamanan. Silakan login kembali.'
      );
    });

    return unsubscribe;
  }, [isTerminalUnlocked]);

  const showPushToast = (title: string, message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToastNotification({ title, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToastNotification(null);
      toastTimerRef.current = null;
    }, 4000);
  };

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    condimentCloudSaveTimers.forEach((timer) => window.clearTimeout(timer));
    condimentCloudSaveTimers.clear();
  }, []);

  const ensureOpenShift = (actionLabel: string): boolean => {
    const isShiftOpen = currentShift.status === 'OPEN';
    if (isShiftOpen) return true;

    setSystemPortal('KASIR');
    setActiveTab('shift');
    showPushToast('Shift Belum Dibuka', `Buka shift kasir aktif untuk ${currentBranch.name} sebelum ${actionLabel}.`);
    return false;
  };

  // Rekonsiliasi manual: muat ulang snapshot resmi dari cloud.
  const handleManualSync = async () => {
    if (cloudReadiness.supabase && !isOnline) {
      showPushToast('Sinkronisasi Gagal', 'Terminal sedang offline. Tidak ada transaksi lokal yang dibuat.');
      return;
    }
    if (cloudReadiness.supabase && isOnline) {
      const [cloudOrders, cloudTables, catalog, expenses, cloudShift] = await Promise.all([
        listCloudOrders(currentBranch.id),
        listCloudTables(currentBranch.id),
        listCloudCatalog(currentBranch.id),
        listCloudExpenseRecords(currentBranch.id),
        getCloudActiveShift(currentBranch.id),
      ]);
      setOrders(cloudOrders);
      setTables((existing) => [...existing.filter((table) => table.branchId !== currentBranch.id), ...cloudTables]);
      setMenuItems(catalog.menuItems);
      setRawMaterials(catalog.rawMaterials.map((material) => ({ ...material, branchName: currentBranch.name })));
      setExpenseRecords(expenses);
      setCurrentShift(cloudShift || createInactiveShift(currentBranch.id));
      // Antrean versi lama tidak lagi dikirim ke cloud.
      DBStorage.clearOfflineQueue();
    }
    setPendingSyncCount(0);
    showPushToast('Sinkronisasi Realtime Sukses', 'Data dimuat ulang dari cloud sebagai sumber kebenaran terminal.');
  };

  // Order Handlers
  const refreshBranchTables = async (branchId = currentBranch.id) => {
    if (!cloudReadiness.supabase || !branchId) return;
    const runtimeToken = branchRuntimeGuardRef.current.snapshot(branchId);
    const cloudTables = await listCloudTables(branchId);
    if (!branchRuntimeGuardRef.current.isCurrent(runtimeToken)) return;
    setTables((existing) => [...existing.filter((table) => table.branchId !== branchId), ...cloudTables]);
  };

  const handleSaveHoldOrder = async (draftOrder: Order) => {
    if (!ensureOpenShift('menyimpan transaksi')) return;
    let saved = draftOrder;
    if (cloudReadiness.supabase) {
      if (!isOnline) {
        showPushToast('Order Belum Disimpan', 'Terminal offline. Sambungkan internet lalu coba kembali.');
        return;
      }
      try {
        saved = await submitCloudOrder(draftOrder);
        setOrders((current) => [saved, ...current.filter((order) => order.id !== draftOrder.id && order.id !== saved.id)]);
        await refreshBranchTables(saved.branchId);
      } catch (error) {
        setIsShiftStatusLoading(false);
        showPushToast('Order Gagal Disimpan', error instanceof Error ? error.message : 'Cloud belum menerima transaksi. Silakan coba kembali.');
        return;
      }
    } else {
      saved = DBStorage.saveOrder(draftOrder, isOnline);
      setOrders(DBStorage.getOrders());
      setRawMaterials(DBStorage.getRawMaterials());
      setTables(DBStorage.getTables());
      setCurrentShift(DBStorage.getCurrentShift());
    }
    showPushToast('Pesanan Disimpan', `Order ${formatOrderLabel(saved)} masuk antrean. Buka lewat Queue POS untuk melanjutkan.`);
  };

  const handleOpenCheckoutModal = (draftOrder: Partial<Order>) => {
    if (!ensureOpenShift('membuka pembayaran')) return;
    if (cloudReadiness.supabase && isCloudOrderId(draftOrder.id || '')) {
      const savedOrder = orders.find((order) => order.id === draftOrder.id);
      if (!savedOrder || hasUnsavedOrderChanges(draftOrder, savedOrder)) {
        showPushToast('Perubahan Order Belum Disimpan', 'Simpan perubahan order sebelum pembayaran.');
        return;
      }
    }
    setActiveCheckoutOrder(draftOrder);
    setIsPaymentModalOpen(true);
  };

  const handleProcessPayment = async (paymentMethod: PaymentMethod, cashPaid: number, shouldPrint: boolean) => {
    if (!activeCheckoutOrder) return;
    if (!ensureOpenShift('memproses pembayaran')) return;

    const fullOrder: Order = {
      ...(activeCheckoutOrder as Order),
      paymentMethod,
      paymentStatus: 'PAID',
      cashPaid,
      change: Math.max(0, cashPaid - (activeCheckoutOrder.total || 0)),
      status: activeCheckoutOrder.status || 'NEW'
    };

    let saved = fullOrder;
    if (cloudReadiness.supabase) {
      if (!isOnline) {
        showPushToast('Pembayaran Belum Diproses', 'Terminal offline. Sambungkan internet lalu coba kembali.');
        return;
      }
      try {
        saved = isCloudOrderId(fullOrder.id)
          ? await payCloudOrder(currentBranch.id, fullOrder.id, paymentMethod, cashPaid, currentShift.id)
          : await submitCloudOrder(fullOrder);
        setOrders((current) => [saved, ...current.filter((order) => order.id !== fullOrder.id && order.id !== saved.id)]);
        await refreshBranchTables(saved.branchId);
        try {
          const refreshedShift = await getCloudActiveShift(currentBranch.id);
          if (refreshedShift?.id === currentShift.id) setCurrentShift(refreshedShift);
        } catch (shiftError) {
          showPushToast(
            'Pembayaran Tersimpan',
            shiftError instanceof Error
              ? `Ringkasan shift akan disinkronkan ulang: ${shiftError.message}`
              : 'Ringkasan shift akan disinkronkan ulang.',
          );
        }
      } catch (error) {
        showPushToast('Pembayaran Gagal', error instanceof Error ? error.message : 'Cloud belum mengakui pembayaran. Silakan coba kembali.');
        return;
      }
    } else {
      saved = DBStorage.saveOrder(fullOrder, isOnline);
      if (fullOrder.type === 'DINE_IN' && fullOrder.tableNumber && fullOrder.tableNumber !== '-') {
        DBStorage.updateTableStatus(fullOrder.tableNumber, 'DISABLED', undefined, fullOrder.branchId);
      }
      setOrders(DBStorage.getOrders());
      setRawMaterials(DBStorage.getRawMaterials());
      setTables(DBStorage.getTables());
      setCurrentShift(DBStorage.getCurrentShift());
    }
    setIsPaymentModalOpen(false);
    setActiveCheckoutOrder(null);

    showPushToast('Pembayaran Lunas!', `Order ${saved.orderNumber} telah dibayar (${paymentMethod}). Disampaikan ke Dapur.`);
    if (profile.soundNotificationsEnabled !== false) {
      playNewOrderSound(profile.soundPembayaranSukses || 'Success Chime');
    }

    if (shouldPrint) {
      void printOrder(saved);
    }
  };

  const printOrder = async (order: Order) => {
    // Coba pulihkan koneksi yang pernah diizinkan sebelum meminta operator
    // memilih ulang printer. Pembayaran tetap sah ketika proses cetak gagal.
    const result = await BluetoothPrinterService.printReceipt(order, profile, printerConfig);
    if (result.success) {
      showPushToast('Struk Tercetak', `Struk ${order.orderNumber} berhasil dikirim ke printer.`);
    } else {
      showPushToast('Cetak Gagal', result.error || `Struk ${order.orderNumber} belum tercetak. Buka Setup Printer lalu coba ulang.`);
    }
  };

  const printZReport = async (shift: Shift, shiftOrders: Order[]) => {
    const result = await BluetoothPrinterService.printZReport(buildZReportData(shift, shiftOrders), profile, printerConfig);
    if (result.success) {
      showPushToast('Z-Report Tercetak', `Laporan shift ${shift.id} berhasil dikirim ke printer.`);
    } else {
      showPushToast('Cetak Z-Report Gagal', result.error || 'Shift tetap ditutup. Gunakan Reprint Z-Report dari riwayat shift.');
    }
  };

  const handlePrintPreBill = (order: Order) => {
    void printOrder(order);
  };

  const printKitchenTicket = async (order: Order) => {
    const result = await BluetoothPrinterService.printKitchenTicket(order, profile, printerConfig, condimentGroups);
    if (result.success) {
      showPushToast('Tiket Dapur Tercetak', `${formatOrderLabel(order)} dikirim tanpa harga ke printer kitchen.`);
    } else {
      showPushToast('Cetak Kitchen Gagal', result.error || 'Periksa koneksi printer kitchen lalu coba lagi.');
    }
  };

  // Kitchen Status Update
  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const found = orders.find((order) => order.id === orderId);
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: newStatus } : order));
    const label = found ? formatOrderLabel(found, orders) : orderId;
    if (cloudReadiness.supabase && isOnline && isCloudOrderId(orderId)) {
      // Hanya order berid cloud (UUID) yang bisa di-PATCH. Perubahannya tersiar
      // realtime ke semua terminal lewat trigger database.
      void updateCloudOrderStatus(currentBranch.id, orderId, newStatus, currentShift.id)
        .then(async () => {
          await refreshBranchTables(currentBranch.id);
          showPushToast('Update Status Dapur', `Status order ${label} diperbarui menjadi ${newStatus}.`);
        })
        .catch((error) => {
          void listCloudOrders(currentBranch.id).then(setOrders);
          showPushToast('Update Dapur Ditolak', error instanceof Error ? error.message : 'Status cloud belum berubah.');
        });
      return;
    } else if (cloudReadiness.supabase) {
      // Mode cloud tidak pernah mengantrekan perubahan status ke localStorage.
      // Pulihkan layar dari database dan minta operator mencoba ulang.
      void listCloudOrders(currentBranch.id).then(setOrders);
      showPushToast('Update Dapur Ditolak', isOnline ? 'Order belum memiliki ID cloud yang valid.' : 'Terminal sedang offline.');
      return;
    } else if (!cloudReadiness.supabase) {
      DBStorage.updateOrderStatus(orderId, newStatus);
      setOrders(DBStorage.getOrders());
    }
    showPushToast('Update Status Dapur', `Status order ${label} diperbarui menjadi ${newStatus}.`);
  };

  // Customer Self-Order Submission from Meja QR Code
  const handleSubmitCustomerOrder = async (newOrder: Order): Promise<Order> => {
    const targetBranchId = newOrder.branchId || currentBranch.id;
    const orderToSave = { ...newOrder, branchId: targetBranchId };
    if (cloudReadiness.supabase) {
      if (!isOnline) {
        showPushToast('Self-order Belum Terkirim', 'Perangkat sedang offline. Sambungkan internet lalu kirim ulang.');
        throw new Error('Perangkat sedang offline. Sambungkan internet lalu kirim ulang.');
      }
      try {
        const saved = await submitCloudOrder(orderToSave);
        setOrders((current) => [saved, ...current.filter((order) => order.id !== orderToSave.id && order.id !== saved.id)]);
        
        // CRITICAL FIX: Don't call refreshBranchTables for public self-order URLs (no auth)
        // Instead, refresh tables using public catalog API
        if (isSelfOrderUrlParam) {
          void getPublicCatalogContext(targetBranchId).then((ctx) => {
            setTables((existing) => [...existing.filter((t) => t.branchId !== targetBranchId), ...ctx.tables]);
          }).catch(() => undefined);
        } else {
          await refreshBranchTables(targetBranchId);
        }
        
        showPushToast('Order Baru dari HP Customer!', `Meja ${saved.tableNumber} memesan order ${saved.orderNumber}.`);
        return saved;
      } catch (error) {
        // Public self-order has no staff token. Recovery must never call the
        // authenticated branch order list, otherwise the error path creates a 401.
        if (isSelfOrderUrlParam) {
          void getPublicCatalogContext(targetBranchId).then((ctx) => {
            setTables((existing) => [...existing.filter((t) => t.branchId !== targetBranchId), ...ctx.tables]);
          }).catch(() => undefined);
        } else {
          void Promise.all([
            listCloudOrders(targetBranchId).then((cloudOrders) => setOrders((current) => [
              ...current.filter((order) => order.branchId !== targetBranchId),
              ...cloudOrders,
            ])),
            refreshBranchTables(targetBranchId),
          ]).catch(() => undefined);
        }
        showPushToast('Self-order Belum Terkirim', error instanceof Error ? error.message : 'Silakan kirim ulang pesanan.');
        throw error instanceof Error ? error : new Error('Pesanan belum terkirim. Silakan coba lagi.');
      }
    }

    DBStorage.saveOrder(orderToSave, isOnline);
    DBStorage.updateTableStatus(orderToSave.tableNumber, 'OCCUPIED', orderToSave.id, targetBranchId);
    setOrders(DBStorage.getOrders());
    setTables(DBStorage.getTables());
    setRawMaterials(DBStorage.getRawMaterials());
    showPushToast('Order Baru dari HP Customer!', `Meja ${orderToSave.tableNumber} memesan order ${orderToSave.orderNumber}. Meja dikunci (RED).`);
    return orderToSave;
  };

  const handleVoidOrder = async (orderId: string, reason: string) => {
    const found = orders.find((order) => order.id === orderId);
    const label = found ? formatOrderLabel(found, orders) : orderId;
    if (cloudReadiness.supabase) {
      if (!isOnline || !isCloudOrderId(orderId)) throw new Error('Void membutuhkan koneksi dan order cloud yang valid.');
      try {
        await updateCloudOrderStatus(currentBranch.id, orderId, 'CANCELLED', currentShift.id, reason);
        const [cloudOrders] = await Promise.all([listCloudOrders(currentBranch.id), refreshBranchTables(currentBranch.id)]);
        setOrders(cloudOrders);
        showPushToast('Pesanan Berhasil Divoid', `${label} dibatalkan dan stok dikembalikan.`);
      } catch (error) {
        showPushToast('Void Pesanan Gagal', error instanceof Error ? error.message : 'Pesanan tidak dapat dibatalkan.');
      }
      return;
    }
    DBStorage.updateOrderStatus(orderId, 'CANCELLED');
    setOrders(DBStorage.getOrders());
    showPushToast('Pesanan Berhasil Divoid', `${label} dibatalkan pada mode demo.`);
  };

  // Condiments Management
  // FIX11: Settings now edits a local draft and explicitly saves per group.
  // Returning the persisted group gives the editor the real cloud UUID for newly
  // created groups and prevents the old debounce/refetch cycle from moving focus.
  const handleSaveCondimentGroup = async (group: CondimentGroup): Promise<CondimentGroup> => {
    if (!cloudReadiness.supabase) {
      DBStorage.saveCondimentGroup(group);
      const saved = DBStorage.getCondimentGroups().find((item) => item.id === group.id) || group;
      setCondimentGroups(DBStorage.getCondimentGroups());
      return saved;
    }

    try {
      const saved = await saveCloudCondimentGroup(group, currentBranch.id);
      setCondimentGroups((current) => {
        const next = current.filter((item) => item.id !== group.id && item.id !== saved.id);
        const originalIndex = current.findIndex((item) => item.id === group.id);
        if (originalIndex < 0 || originalIndex >= next.length) return [...next, saved];
        next.splice(originalIndex, 0, saved);
        return next;
      });
      return saved;
    } catch (error) {
      showPushToast('Condiment Gagal Disimpan', error instanceof Error ? error.message : 'Konfigurasi condiment gagal.');
      throw error;
    }
  };

  const handleDeleteCondimentGroup = async (groupId: string): Promise<void> => {
    const group = condimentGroups.find((item) => item.id === groupId);
    if (!group) return;

    if (!cloudReadiness.supabase) {
      // Demo/local mode has no hard-delete primitive in the legacy storage adapter.
      // Remove it from the active runtime and mark the local record inactive so it
      // can no longer appear in POS/Self Order/KDS. Production cloud uses hard delete.
      DBStorage.saveCondimentGroup({ ...group, isActive: false, options: [] });
      setCondimentGroups((current) => current.filter((item) => item.id !== groupId));
      return;
    }

    try {
      await deleteCloudCondimentGroup(groupId, currentBranch.id);
      setCondimentGroups((current) => current.filter((item) => item.id !== groupId));
      showPushToast('Grup Dihapus', `${group.name} sudah dihapus dari konfigurasi transaksi baru.`);
    } catch (error) {
      showPushToast('Grup Gagal Dihapus', error instanceof Error ? error.message : 'Grup condiment tidak dapat dihapus.');
      throw error;
    }
  };

  const handleToggleGroupActive = (groupId: string, isActive: boolean) => {
    const group = condimentGroups.find((item) => item.id === groupId);
    if (group) handleSaveCondimentGroup({ ...group, isActive });
  };

  const handleToggleOptionAvailable = (groupId: string, optionId: string, isAvailable: boolean) => {
    const group = condimentGroups.find((item) => item.id === groupId);
    if (group) handleSaveCondimentGroup({ ...group, options: group.options.map((option) => option.id === optionId ? { ...option, isAvailable } : option) });
  };

  // Bulk Table Control for Customer Order Modal
  const handleToggleTableById = (tableId: string, enabled: boolean) => {
    const target = tables.find((table) => table.id === tableId && table.branchId === currentBranch.id);
    if (!target) return;
    if (!enabled && target.activeOrderId) {
      showPushToast('Meja Masih Memiliki Order', `Meja ${target.number} masih memiliki bill aktif. Selesaikan order terlebih dahulu.`);
      return;
    }
    void updateCloudTableSession({ action: 'SET_ENABLED', branchId: currentBranch.id, tableNumber: target.number, enabled })
      .then((result) => { if (result.table) handleTableSessionUpdated(result.table); })
      .catch((error) => showPushToast('Meja Gagal Diperbarui', error instanceof Error ? error.message : 'Status meja gagal disimpan.'));
  };

  const handleToggleAllTables = (enabled: boolean) => {
    if (!cloudReadiness.supabase) {
      const updated = tables.map((table) => {
        if (table.branchId !== currentBranch.id || table.activeOrderId) return table;
        return { ...table, isSelfOrderEnabled: enabled, status: enabled ? 'READY' as const : 'DISABLED' as const };
      });
      DBStorage.setTables(updated);
      setTables(updated);
      return;
    }
    void setAllCloudTablesEnabled(currentBranch.id, enabled)
      .then((cloudTables) => {
        setTables((existing) => {
          return [...existing.filter((table) => table.branchId !== currentBranch.id), ...cloudTables];
        });
      })
      .catch((error) => showPushToast('Meja Gagal Diperbarui', error instanceof Error ? error.message : 'Status seluruh meja gagal disimpan.'));
  };

  // Table Control
  const handleToggleTableSelfOrder = (tableNumber: string, enabled: boolean) => {
    const target = tables.find((table) => table.branchId === currentBranch.id && table.number.replace(/^0+(?=\d)/, '') === tableNumber.replace(/^0+(?=\d)/, ''));
    if (!enabled && target?.activeOrderId) {
      showPushToast('Meja Masih Memiliki Order', `Meja ${target.number} masih memiliki bill aktif. Selesaikan order terlebih dahulu.`);
      return;
    }
    if (!cloudReadiness.supabase) {
      DBStorage.toggleTableSelfOrder(tableNumber, enabled, currentBranch.id);
      setTables(DBStorage.getTables());
      return;
    }
    void updateCloudTableSession({ action: 'SET_ENABLED', branchId: currentBranch.id, tableNumber, enabled })
      .then((result) => { if (result.table) handleTableSessionUpdated(result.table); })
      .catch((error) => showPushToast('Meja Gagal Diperbarui', error instanceof Error ? error.message : 'Status meja gagal disimpan.'));
  };

  const handleTableSessionUpdated = (updatedTable: RestaurantTable) => {
    const normalizedNumber = updatedTable.number.replace(/^0+(?=\d)/, '');
    setTables((current) => {
      let matched = false;
      const next = current.map((table) => {
        const sameBranch = table.branchId === updatedTable.branchId;
        const sameNumber = table.number.replace(/^0+(?=\d)/, '') === normalizedNumber;
        if (table.id === updatedTable.id || (sameBranch && sameNumber)) {
          matched = true;
          return { ...table, ...updatedTable };
        }
        return table;
      });
      return matched ? next : [...next, updatedTable];
    });
  };

  const handleClearTableStatus = (tableNumber: string) => {
    const target = tables.find((table) => table.branchId === currentBranch.id && table.number.replace(/^0+(?=\d)/, '') === tableNumber.replace(/^0+(?=\d)/, ''));
    if (target?.activeOrderId) {
      showPushToast('Meja Belum Bisa Dikosongkan', `Meja ${target.number} masih terhubung ke bill aktif. Selesaikan/void order terlebih dahulu.`);
      return;
    }
    const nextStatus = target?.isSelfOrderEnabled ? 'READY' : 'DISABLED';
    if (!cloudReadiness.supabase) {
      DBStorage.updateTableStatus(tableNumber, nextStatus, undefined, currentBranch.id);
      setTables(DBStorage.getTables());
      return;
    }
    void updateCloudTableSession({ action: 'SET_STATUS', branchId: currentBranch.id, tableNumber, status: nextStatus })
      .then((result) => {
        if (result.table) handleTableSessionUpdated(result.table);
        showPushToast('Status Meja', `Meja ${tableNumber} di ${currentBranch.name} telah kosong.`);
      })
      .catch((error) => showPushToast('Status Meja Ditolak', error instanceof Error ? error.message : 'Status meja gagal disimpan.'));
  };

  const handleSetTableOccupied = (tableNumber: string) => {
    if (!cloudReadiness.supabase) {
      DBStorage.updateTableStatus(tableNumber, 'OCCUPIED', undefined, currentBranch.id);
      setTables(DBStorage.getTables());
      return;
    }
    void updateCloudTableSession({ action: 'SET_STATUS', branchId: currentBranch.id, tableNumber, status: 'OCCUPIED' })
      .then((result) => {
        if (result.table) handleTableSessionUpdated(result.table);
        showPushToast('Status Meja', `Meja ${tableNumber} di ${currentBranch.name} ditandai terisi.`);
      })
      .catch((error) => showPushToast('Status Meja Ditolak', error instanceof Error ? error.message : 'Status meja gagal disimpan.'));
  };

  const handleResetAllTablesToFree = () => {
    if (!cloudReadiness.supabase) {
      const updated = tables.map((table) => table.branchId === currentBranch.id && !table.activeOrderId
        ? { ...table, status: table.isSelfOrderEnabled ? 'READY' as const : 'DISABLED' as const, activeOrderId: undefined }
        : table);
      DBStorage.setTables(updated);
      setTables(updated);
      return;
    }
    void updateCloudTableSession({ action: 'RESET_ALL', branchId: currentBranch.id, tableNumber: '' })
      .then((result) => {
        const cloudTables = result.tables || [];
        setTables((existing) => [...existing.filter((table) => table.branchId !== currentBranch.id), ...cloudTables]);
        showPushToast('Reset Status Meja', `Meja tanpa bill aktif di ${currentBranch.name} telah direkonsiliasi.`);
      })
      .catch((error) => showPushToast('Reset Meja Ditolak', error instanceof Error ? error.message : 'Status meja gagal direset.'));
  };

  const handleAddNewTable = (tableNumber: string, capacity: number) => {
    if (cloudReadiness.supabase) {
      void createCloudTable(currentBranch.id, tableNumber, capacity)
        .then((created) => {
          setTables((existing) => {
            return [...existing.filter((table) => table.id !== created.id), created];
          });
          showPushToast('Meja Baru Ditambahkan', `Meja ${tableNumber} tersimpan khusus untuk ${currentBranch.name}.`);
        })
        .catch((error) => showPushToast('Meja Gagal Dibuat', error instanceof Error ? error.message : 'Meja baru gagal disimpan.'));
      return;
    }
    const created: RestaurantTable = {
      id: 'tbl-' + Date.now(),
      number: tableNumber,
      capacity,
      status: 'DISABLED',
      isSelfOrderEnabled: false,
      branchId: currentBranch.id
    };
    const updated = [...tables, created];
    DBStorage.setTables(updated);
    setTables(updated);
    showPushToast('Meja Baru Ditambahkan', `Meja ${tableNumber} (Kapasitas ${capacity} orang) berhasil dibuat.`);
  };

  const handleEnsureCustomerOrderTables = async (tableNumbers: string[]) => {
    const normalizeTableNumber = (value: string) => String(value || '').trim().replace(/^0+(?=\d)/, '');
    const requested = Array.from(new Set(tableNumbers.map(normalizeTableNumber).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));
    if (!requested.length) return;

    const branchTableSnapshot = tables.filter((table) => table.branchId === currentBranch.id);
    const existingNumbers = new Set(branchTableSnapshot.map((table) => normalizeTableNumber(table.number)));
    const missingNumbers = requested.filter((number) => !existingNumbers.has(number));

    if (!missingNumbers.length) {
      showPushToast('Inventori Meja Sudah Sinkron', `${branchTableSnapshot.length} meja di ${currentBranch.name} sudah mencakup seluruh daftar target.`);
      return;
    }

    const defaultCapacity = branchTableSnapshot.find((table) => Number(table.capacity) > 0)?.capacity || 4;

    if (!cloudReadiness.supabase) {
      const createdAt = Date.now();
      const additions: RestaurantTable[] = missingNumbers.map((number, index) => ({
        id: `tbl-sync-${createdAt}-${index}`,
        number,
        capacity: defaultCapacity,
        status: 'DISABLED',
        isSelfOrderEnabled: false,
        branchId: currentBranch.id,
      }));
      const updated = [...tables, ...additions];
      DBStorage.setTables(updated);
      setTables(updated);
      showPushToast('Sinkronisasi Meja Selesai', `${additions.length} meja baru dibuat NONAKTIF untuk ${currentBranch.name}.`);
      return;
    }

    let createdCount = 0;
    try {
      // Sequential creation keeps duplicate/conflict handling deterministic and
      // avoids a burst of writes when an operator pastes a long table list.
      for (const tableNumber of missingNumbers) {
        await createCloudTable(currentBranch.id, tableNumber, defaultCapacity);
        createdCount += 1;
      }
    } finally {
      // Refresh authoritative cloud rows even after a partial failure. This keeps
      // Settings and Manajemen Meja consistent with what was actually committed.
      await refreshBranchTables(currentBranch.id).catch(() => undefined);
    }

    showPushToast('Sinkronisasi Meja Selesai', `${createdCount} meja baru dibuat NONAKTIF untuk ${currentBranch.name}. Aktifkan meja yang siap digunakan dari Manajemen Meja.`);
  };

  const persistBranchOperationalConfig = async (updates: Partial<BranchOperationalConfig>) => {
    const previous = branchOperationalConfig;
    const next = { ...branchOperationalConfig, ...updates, branchId: currentBranch.id };
    setBranchOperationalConfig(next);
    setIsSelfOrderSystemEnabled(next.selfOrderEnabled);
    if (!cloudReadiness.supabase) return next;
    try {
      const saved = await saveCloudBranchOperationalConfig(next);
      setBranchOperationalConfig(saved);
      setIsSelfOrderSystemEnabled(saved.selfOrderEnabled);
      return saved;
    } catch (error) {
      setBranchOperationalConfig(previous);
      setIsSelfOrderSystemEnabled(previous.selfOrderEnabled);
      showPushToast('Konfigurasi Cabang Gagal Disimpan', error instanceof Error ? error.message : 'Pengaturan cabang gagal disimpan.');
      throw error;
    }
  };

  const saveScopedRestaurantProfile = async (nextProfile: RestaurantProfile) => {
    if (!cloudReadiness.supabase) {
      setProfile(nextProfile);
      DBStorage.saveProfile(nextProfile);
      return;
    }

    const { name, logoUrl, instagram, tiktok, isSelfOrderEnabled: _legacyGlobalSelfOrder, ...branchProfile } = nextProfile;
    await persistBranchOperationalConfig({ profileOverrides: branchProfile });

    if (['SUPER_OWNER', 'OWNER'].includes(activeUser.role)) {
      try {
        await saveCloudTenantBrand({ name, logoUrl, instagram, tiktok });
      } catch (error) {
        showPushToast('Brand Pusat Gagal Disimpan', error instanceof Error ? error.message : 'Identitas brand gagal disimpan.');
        // Keep the Settings draft dirty so the operator can retry. Branch config
        // writes are idempotent, so a retry is safer than reporting a false success.
        throw error;
      }
    }

    setProfile(nextProfile);

    // allowedSelfOrderTables is a desired inventory list, while restaurant_tables
    // remains the operational source of truth. Saving Settings performs a safe
    // create-only reconcile so a target such as 1..15 cannot silently stay at
    // only 12 database rows. Existing/occupied tables are never modified here.
    const targetNumbers = parseConfiguredTableNumbers(nextProfile.allowedSelfOrderTables);
    if (targetNumbers.length && ['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(activeUser.role)) {
      const existingNumbers = new Set(
        tables
          .filter((table) => table.branchId === currentBranch.id)
          .map((table) => normalizeConfiguredTableNumber(table.number)),
      );
      if (targetNumbers.some((number) => !existingNumbers.has(number))) {
        await handleEnsureCustomerOrderTables(targetNumbers).catch((error) => {
          showPushToast(
            'Target Meja Tersimpan, Sinkronisasi Belum Lengkap',
            error instanceof Error ? error.message : 'Sebagian meja target belum dapat dibuat di database.',
          );
        });
      }
    }
  };

  const branchOrders = orders.filter((order) => !order.branchId || order.branchId === currentBranch.id);
  // Hanya order dari shift aktif saat ini — untuk CashierView dan KitchenDisplayView
  const isOrderOperationallyClosed = (order: Order) => (
    order.status === 'CANCELLED' || (order.status === 'COMPLETED' && order.paymentStatus === 'PAID')
  );
  const shiftOrders = currentShift.status === 'OPEN'
    ? branchOrders.filter((order) => (order.createdShiftId || order.shiftId) === currentShift.id || !isOrderOperationallyClosed(order))
    : [];
  const branchTables = tables
    .filter((table) => table.branchId === currentBranch.id)
    .slice()
    .sort((a, b) => a.number.localeCompare(b.number, 'id', { numeric: true, sensitivity: 'base' }));
  const branchTargetTableNumbers = parseConfiguredTableNumbers(profile.allowedSelfOrderTables);
  const canManageTableInventory = ['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(activeUser.role);
  const branchRawMaterials = rawMaterials.filter((material) => material.branchId === currentBranch.id);
  const branchAttendanceRecords = attendanceRecords.filter(
    (record) => !record.branchId || record.branchId === currentBranch.id
  );

  if (isSelfOrderUrlParam && cloudReadiness.supabase && (selfOrderCatalogState.loading || selfOrderCatalogState.error)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#fff7ed] p-5 text-center">
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-[#17130f] p-7 text-white shadow-[0_28px_80px_rgba(124,45,18,.22)] [&_h1]:relative [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-black [&_h1]:text-white">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-orange-500/25 blur-3xl" />
          <div className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] ${selfOrderCatalogState.loading ? 'bg-orange-500' : 'bg-rose-500'}`}>
            {selfOrderCatalogState.loading ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <span className="text-xl font-black">!</span>}
          </div>
          <h1 className="text-lg font-extrabold text-slate-900">{selfOrderCatalogState.loading ? 'Memuat outlet…' : 'Link Self-order Tidak Valid'}</h1>
          <p className="relative mt-2 text-xs font-medium leading-relaxed text-white/50">
            {selfOrderCatalogState.loading ? 'Memastikan tenant dan cabang tujuan QR.' : selfOrderCatalogState.error}
          </p>
          {selfOrderCatalogState.loading && <div className="relative mt-6 flex justify-center gap-1.5">{[0, 1, 2].map((item) => <span key={item} className={`h-1.5 rounded-full bg-orange-400 ${item === 0 ? 'w-8 animate-pulse' : 'w-3 opacity-20'}`} />)}</div>}
        </div>
      </div>
    );
  }

  // If isolated self order tab or URL param is active, render native standalone mobile self-order
  if (isSelfOrderUrlParam) {
    const selfOrderParams = new URLSearchParams(window.location.search);
    const tableFromUrl = selfOrderParams.get('table') || '';
    const selfOrderBranch = currentBranch;
    const selfOrderTables = tables.filter((table) => table.branchId === selfOrderBranch.id);
    const selfOrderOrders = orders.filter((order) => !order.branchId || order.branchId === selfOrderBranch.id);
    return (
      <div className="relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#fff7ed]">
        {/* Cashier return floating bar if logged in as cashier */}
        {!isSelfOrderUrlParam && (
          <div className="bg-white border-b border-[var(--panel-border)] px-4 py-2 flex items-center justify-between text-xs text-[var(--text-secondary)] z-50">
            <span className="font-bold text-orange-400">📱 Mode Tampilan Customer Self-Order QR</span>
            <button
              type="button"
              onClick={() => setActiveTab('pos')}
              className="bg-[var(--primary-solid)] hover:bg-[var(--primary-pressed)] text-white px-3 py-1 rounded-xl font-bold transition-all cursor-pointer"
            >
              ← Kembali ke POS Kasir
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <Suspense fallback={<RouteFallback />}>
            <SelfOrderLandingPage
              tables={selfOrderTables}
              menuItems={menuItems}
              profile={profile}
              condimentGroups={condimentGroups}
              isSelfOrderSystemEnabled={isSelfOrderSystemEnabled}
              orders={selfOrderOrders}
              currentBranch={selfOrderBranch}
              onSubmitCustomerOrder={handleSubmitCustomerOrder}
              initialTableNumber={tableFromUrl}
              onShowToast={showPushToast}
              isShiftActive={publicSelfOrderShiftActive}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (!isSessionValidated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F5F5F4]">
        <RouteFallback />
      </div>
    );
  }

  const handleSuccessfulLogin = (
    user: { id: string; name: string | null; role: string | null; tenantId?: string | null; branchId?: string; branchIds?: string[]; permissions?: Record<string, boolean> },
    selectedBranch: Branch,
    mode: 'SYSTEM' | 'ATTENDANCE',
  ) => {
    const canonicalBranchId = normalizeBranchId(user.branchId || selectedBranch.id);
    const canonicalBranch = branches.find((branch) =>
      branch.id === canonicalBranchId || branch.code === selectedBranch.code
    ) || { ...selectedBranch, id: canonicalBranchId };
    const userAccount: UserAccount = {
      id: user.id,
      name: user.name || 'Staff',
      pin: '',
      role: (user.role as UserAccount['role']) || 'KASIR',
      branchIds: user.branchIds?.length ? user.branchIds.map(normalizeBranchId) : [canonicalBranch.id],
      permissions: user.permissions || {},
      isActive: true,
    };

    setIsTerminalUnlocked(true);
    setIsPinModalOpen(false);
    sessionStorage.setItem(TERMINAL_SESSION_KEY, 'unlocked');
    sessionStorage.setItem(TERMINAL_BRANCH_KEY, canonicalBranch.id);
    sessionStorage.setItem(TERMINAL_MODE_KEY, mode);
    setActiveUser(userAccount);
    if (!cloudReadiness.supabase) DBStorage.setActiveUser(userAccount);
    setCurrentBranch(canonicalBranch);

    if (mode === 'ATTENDANCE') {
      if (userAccount.role === 'OWNER' || userAccount.role === 'SUPER_OWNER') {
        showPushToast('Absensi Tidak Diperlukan', 'Akun Owner mengelola operasional dan tidak termasuk staff absensi/payroll.');
        void logoutTerminal();
        return;
      }
      setIsAttendanceMode(true);
      showPushToast('Identitas Terverifikasi', `${userAccount.name} dapat melanjutkan presensi.`);
      return;
    }

    const baseRule = accessControl.find((item) => item.role === userAccount.role);
    const rule = baseRule ? { ...baseRule, ...(userAccount.permissions || {}) } : undefined;
    if (!rule) {
      void logoutTerminal();
      showPushToast('Akses Belum Diatur', `Role ${userAccount.role} belum memiliki matriks akses.`);
      return;
    }
    const destination = getDefaultAccessDestination(rule);
    if (!destination.tab) {
      void logoutTerminal();
      showPushToast('Akses Ditolak', `Role ${userAccount.role} belum diberi akses ke modul apa pun.`);
      return;
    }
    setSystemPortal(destination.portal);
    setActiveTab(destination.tab);
    showPushToast('Akses Berhasil', `${userAccount.name} masuk sebagai ${userAccount.role}. Hak menu diterapkan otomatis.`);
  };

  // Owner accounts manage the operation but are not operational attendance/payroll staff.
  // Keep the full staff list for Settings/access management and use this derived list
  // only in workforce modules.
  const operationalStaffAccounts = staffAccounts.filter(
    (staff) => staff.role !== 'OWNER' && staff.role !== 'SUPER_OWNER',
  );

  // Authentication is a separate entry portal. The protected POS shell is not
  // mounted until a terminal session has been established.
  if (!isTerminalUnlocked || isPinModalOpen) {
    return (
      <PinAuthModal
        isOpen
        onClose={() => undefined}
        canClose={false}
        onSuccessLogin={handleSuccessfulLogin}
        branches={branches}
        currentBranch={currentBranch}
        onSelectBranch={setCurrentBranch}
      />
    );
  }

  // Attendance kiosks intentionally run outside the administrative/POS shell.
  if (isAttendanceTerminal) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--canvas-bg)] text-[var(--text-primary)]">
        <div className="flex h-16 items-center justify-between border-b border-[#E2E2E2] bg-white px-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--primary-hover)]">Terminal absensi</p>
            <p className="text-sm font-bold">{currentBranch.name}</p>
          </div>
          <button type="button" onClick={() => void logoutTerminal()} className="rounded-xl border border-[#E2E2E2] bg-white px-4 py-2 text-xs font-bold hover:bg-[#F5F5F5]">
            Selesai & logout
          </button>
        </div>
        <AttendanceView
          attendanceRecords={branchAttendanceRecords}
          onSaveAttendance={async (record) => {
            // PIN cloud harus menghasilkan sesi Supabase Auth penuh. Presensi cloud
            // tidak pernah dialihkan ke penyimpanan browser agar tidak hilang,
            // terduplikasi, atau hanya tercatat pada satu perangkat.
            if (cloudReadiness.supabase) {
              try {
                const saved = await saveCloudAttendance(record);
                setAttendanceRecords((current) => [...current, saved]);
              } catch (error) {
                // Sesi kedaluwarsa mengunci terminal; gangguan lain tetap dapat dicoba ulang.
                if (error instanceof AttendanceSessionError) {
                  window.setTimeout(() => void logoutTerminal(), 300);
                }
                throw error;
              }
            } else {
              DBStorage.saveAttendance(record);
              setAttendanceRecords(DBStorage.getAttendanceRecords());
            }
            window.setTimeout(() => {
              void logoutTerminal();
            }, 400);
          }}
          activeUser={activeUser}
          staffAccounts={operationalStaffAccounts}
          profile={profile}
          currentBranch={currentBranch}
          terminalMode
          configReady={isAttendanceConfigReady}
          onShowToast={showPushToast}
        />
      </div>
    );
  }

  const accessibleBranches = activeUser.branchIds?.length
    ? branches.filter((branch) => activeUser.branchIds?.includes(branch.id))
    : [currentBranch];

  return (
    <div className="app-shell flex h-screen w-screen overflow-hidden font-sans antialiased">
      <PWAUpdatePrompt />
      {toastNotification && (
        // Ditaruh di tengah bawah: tombol aksi kasir ada di sisi bawah layar,
        // notifikasi di pojok atas terlalu jauh dari pandangan dan terlewat.
        <div
          role="status"
          aria-live="polite"
          className="animate-fadeIn fixed bottom-6 left-1/2 z-[60] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-white py-3 pl-3 pr-5 text-[var(--text-primary)] shadow-[0_18px_48px_rgba(26,23,20,0.16)]"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--text-primary)]">{toastNotification.title}</p>
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">{toastNotification.message}</p>
          </div>
        </div>
      )}

      {/* Main Sidebar */}
      <Sidebar
        systemPortal={systemPortal}
        onSwitchPortal={handleSwitchPortal}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        activeUser={activeUser}
        onLogout={() => void logoutTerminal()}
        pendingSyncCount={pendingSyncCount}
        accessRule={activeAccessRule}
        menuOpen={isQuickAccessMenuOpen}
        onMenuOpenChange={setIsQuickAccessMenuOpen}
      />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/*
          The owner portal uses dedicated page banners inside each screen.
          Reusing the cashier utility header here creates duplicated chrome and
          a misleading "Terminal POS" strip above owner content.
        */}
        {(systemPortal === 'OWNER' || (systemPortal === 'KASIR' && activeTab !== 'pos')) && (
          <HeaderBar
            systemPortal={systemPortal}
            onSwitchPortal={handleSwitchPortal}
            activeTab={activeTab}
            branches={accessibleBranches}
            currentBranch={currentBranch}
            onSelectBranch={setCurrentBranch}
            printerConfig={printerConfig}
            onOpenPrinterSetup={() => setIsPrinterModalOpen(true)}
            onToggleAutoPrintKitchen={handleToggleAutoPrintKitchen}
            onOpenCustomerSelfOrder={() => {
              setSelectedSelfOrderTable('');
              setIsSelfOrderModalOpen(true);
            }}
            onOpenTableManagement={() => setIsTableManagementOpen(true)}
            onOpenTableModal={() => setIsQuickTableModalOpen(true)}
            tables={branchTables}
            orders={branchOrders}
            isOnline={isOnline}
            pendingSyncCount={pendingSyncCount}
            onManualSync={handleManualSync}
            activeUser={activeUser}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onToggleQuickAccess={() => setIsQuickAccessMenuOpen((open) => !open)}
          />
        )}

        {/* Dynamic View Router */}
        <main id="app-main-view" className="flex-1 overflow-hidden flex flex-col">
          <Suspense fallback={<RouteFallback />}>
          {activeTab === 'pos' && (
            <CashierView
              headerElement={
                <HeaderBar
                  systemPortal={systemPortal}
                  onSwitchPortal={handleSwitchPortal}
                  activeTab={activeTab}
                  branches={accessibleBranches}
                  currentBranch={currentBranch}
                  onSelectBranch={setCurrentBranch}
                  printerConfig={printerConfig}
                  onOpenPrinterSetup={() => setIsPrinterModalOpen(true)}
                  onToggleAutoPrintKitchen={handleToggleAutoPrintKitchen}
                  onOpenCustomerSelfOrder={() => {
                    setSelectedSelfOrderTable('');
                    setIsSelfOrderModalOpen(true);
                  }}
                  onOpenTableManagement={() => setIsTableManagementOpen(true)}
                  onOpenTableModal={() => setIsQuickTableModalOpen(true)}
                  tables={branchTables}
                  orders={branchOrders}
                  isOnline={isOnline}
                  pendingSyncCount={pendingSyncCount}
                  onManualSync={handleManualSync}
                  activeUser={activeUser}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onToggleQuickAccess={() => setIsQuickAccessMenuOpen((open) => !open)}
                />
              }
              menuItems={menuItems}
              orders={shiftOrders}
              tables={branchTables}
              activeUser={activeUser}
              currentBranch={currentBranch}
              currentShift={currentShift}
              isShiftStatusLoading={isShiftStatusLoading}
              searchTerm={searchTerm}
              condimentGroups={condimentGroups}
              onOpenCheckoutModal={handleOpenCheckoutModal}
              onSaveHoldOrder={handleSaveHoldOrder}
              onCompleteOrder={(orderId) => handleUpdateOrderStatus(orderId, 'COMPLETED')}
              onVoidOrder={handleVoidOrder}
              onPrintPreBill={handlePrintPreBill}
              onSelectExistingOrderToEdit={(ord) => {
                showPushToast('Order Dimuat', `Order ${formatOrderLabel(ord)} dibuka di Kasir.`);
              }}
              onOpenTableModal={() => setIsQuickTableModalOpen(true)}
              onOpenShiftTab={() => handleTabChange('shift')}
              confirmBeforeSaveOrder={profile.confirmBeforeSaveOrder === true}
              confirmBeforePayment={profile.confirmBeforePayment === true}
              taxEnabled={profile.isTaxEnabled === true}
              taxRatePercent={profile.taxRatePercent || 0}
              manualDiscountEnabled={profile.isManualDiscountEnabled !== false && activeAccessRule?.canGiveDiscount !== false}
              tableSelectionRequest={tableSelectionRequest || undefined}
            />
          )}

          {activeTab === 'kds' && (
            <KitchenDisplayView
              orders={shiftOrders}
              condimentGroups={condimentGroups}
              menuItems={menuItems}
              categoryOrder={profile.kdsCategoryOrder}
              runningText={profile.runningText}
              outletName={currentBranch.name}
              connectionState={orderSyncHealth.connectionState}
              currentShiftId={currentShift.id}
              currentShiftStartedAt={currentShift.startTime}
              soundEnabledByDefault={profile.soundNotificationsEnabled !== false}
              newOrderSound={profile.soundOrderBaru}
              selfOrderSound={profile.soundCustomerOrder}
              overdueMinutes={profile.orderTimeLimitMinutes || 5}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onPrintKitchenTicket={(ord) => void printKitchenTicket(ord)}
            />
          )}

          {activeTab === 'superowner' && (
            <SuperOwnerDashboardView
              branches={branches.filter((branch) => ownerMonitorData.branchIds.includes(branch.id))}
              orders={ownerMonitorData.orders}
              tables={ownerMonitorData.tables}
              rawMaterials={ownerMonitorData.rawMaterials}
              currentBranch={currentBranch}
              onSelectBranch={setCurrentBranch}
              onAddBranch={handleAddBranch}
              onNavigateTab={handleTabChange}
              onShowToast={showPushToast}
            />
          )}

          {activeTab === 'blueprint' && (
            <BlueprintArchitectureView
              profile={profile}
              onSaveProfile={saveScopedRestaurantProfile}
              tables={branchTables}
              branches={accessibleBranches}
              currentBranch={currentBranch}
              onSelectBranch={(branch) => {
                setCurrentBranch(branch);
                showPushToast('Outlet Terpilih', `Konfigurasi beralih ke cabang ${branch.name}`);
              }}
              onAddBranch={handleAddBranch}
              printerConfig={printerConfig}
              onUpdatePrinterConfig={(cfg) => {
                DBStorage.savePrinterConfig(cfg);
                setPrinterConfig(cfg);
              }}
              menuItems={menuItems}
              onNavigateTab={handleTabChange}
              onShowToast={showPushToast}
            />
          )}

          {activeTab === 'tables' && (
            <TableManagementView
              tables={branchTables}
              branchId={currentBranch.id}
              branchCode={currentBranch.code}
              publicOrderSlug={branchOperationalConfig.publicOrderSlug}
              tenantId={branchOperationalConfig.tenantId}
              branchName={currentBranch.name}
              selfOrderBaseUrl={branchOperationalConfig.selfOrderBaseUrl}
              onSelfOrderBaseUrlChange={async (selfOrderBaseUrl) => {
                await persistBranchOperationalConfig({ selfOrderBaseUrl });
              }}
              onToggleSelfOrder={handleToggleTableSelfOrder}
              onClearTableStatus={handleClearTableStatus}
              onOpenCustomerSelfOrderModal={(tblNum) => {
                setSelectedSelfOrderTable(tblNum);
                setIsSelfOrderModalOpen(true);
              }}
              onTableUpdated={handleTableSessionUpdated}
              onOpenQrPrint={() => setIsQrPrintOpen(true)}
            />
          )}

          {activeTab === 'selforder' && (
            <div className="ui-surface flex-1 overflow-y-auto p-5">
              <div className="mx-auto mb-4 flex max-w-5xl items-center justify-between rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] px-5 py-4 shadow-sm">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Pratinjau Landing Self-Order</h2>
                  <p className="mt-0.5 text-[11px] font-medium text-[#8E8882]">Pratinjau admin tetap berada di portal Owner. Halaman pelanggan dibuka terpisah.</p>
                </div>
                <button
                  type="button"
                  onClick={() => window.open(buildBranchSelfOrderUrl(branchOperationalConfig.selfOrderBaseUrl || window.location.origin, currentBranch.id, branchOperationalConfig.tenantId, currentBranch.code, branchOperationalConfig.publicOrderSlug), '_blank', 'noopener,noreferrer')}
                  className="rounded-xl bg-[var(--primary)] px-4 py-2 text-[11px] font-bold text-white hover:bg-[var(--primary-hover)]"
                >
                  Buka Halaman Publik
                </button>
              </div>
              <div className="theme-self-order mx-auto h-[720px] w-full max-w-sm overflow-hidden rounded-2xl border-[8px] border-[var(--panel-border-strong)] bg-white shadow-xl">
                <div className="h-full overflow-y-auto">
                  <SelfOrderLandingPage
                    tables={branchTables}
                    menuItems={menuItems}
                    profile={profile}
                    condimentGroups={condimentGroups}
                    isSelfOrderSystemEnabled={isSelfOrderSystemEnabled}
                    orders={branchOrders}
                    currentBranch={currentBranch}
                    onSubmitCustomerOrder={handleSubmitCustomerOrder}
                    initialTableNumber="1"
                    onShowToast={showPushToast}
                    isShiftActive={currentShift?.status === 'OPEN'}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shift' && (
            <ShiftMonitorView
              currentShift={currentShift}
              orders={branchOrders}
              expenseRecords={expenseRecords.filter((r) => r.shiftId === currentShift.id)}
              shiftHistory={shiftHistory}
              activeUser={activeUser}
              onShowToast={showPushToast}
              onReprintZReport={async (shift) => {
                await printZReport(shift, branchOrders);
              }}
              onAddExpenseIncome={(rec) => {
                if (!cloudReadiness.supabase) {
                  DBStorage.addExpenseOrIncome(rec);
                  setExpenseRecords(DBStorage.getExpenseRecords());
                  setCurrentShift(DBStorage.getCurrentShift());
                  return;
                }
                void saveCloudExpenseRecord(currentBranch.id, rec)
                  .then((saved) => setExpenseRecords((current) => [saved, ...current.filter((item) => item.id !== saved.id)]))
                  .catch((error) => showPushToast('Catatan Kas Gagal Disimpan', error instanceof Error ? error.message : 'Pengeluaran/pemasukan gagal disimpan.'));
              }}
              onRefreshShift={async () => {
                if (!cloudReadiness.supabase) {
                  setCurrentShift(DBStorage.getCurrentShift(currentBranch.id));
                  return;
                }
                const cloudShift = await getCloudActiveShift(currentBranch.id);
                setCurrentShift(cloudShift || createInactiveShift(currentBranch.id));
              }}
              onCloseShift={async (notes, actualCash, expectedCash, shouldPrintZReport) => {
                // Snapshot shift and all data BEFORE any async operation
                const shiftBeingClosed = { ...currentShift };
                const ordersForShift = getPaidOrdersForShift(orders, shiftBeingClosed.id);

                // Recalculate metrics from orders in case cloud sync already zeroed currentShift
                if (ordersForShift.length > 0 && shiftBeingClosed.grossOmset === 0) {
                  shiftBeingClosed.grossOmset = ordersForShift.reduce((s, o) => s + (o.subtotal || o.total), 0);
                  shiftBeingClosed.cashSales = ordersForShift.filter((o) => o.paymentMethod === 'CASH' || !o.paymentMethod).reduce((s, o) => s + o.total, 0);
                  shiftBeingClosed.nonCashSales = ordersForShift.filter((o) => o.paymentMethod === 'QRIS' || o.paymentMethod === 'DEBIT').reduce((s, o) => s + o.total, 0);
                }

                // Recalculate expense/income from records if shift object shows 0
                const expForShift = expenseRecords.filter((r) => r.shiftId === shiftBeingClosed.id);
                if (expForShift.length > 0 && shiftBeingClosed.totalExpense === 0 && shiftBeingClosed.totalIncome === 0) {
                  shiftBeingClosed.totalExpense = expForShift.filter((r) => r.type === 'EXPENSE').reduce((s, r) => s + r.amount, 0);
                  shiftBeingClosed.totalIncome = expForShift.filter((r) => r.type === 'INCOME').reduce((s, r) => s + r.amount, 0);
                }

                // Block cloud sync during close window to prevent race condition
                isClosingShiftRef.current = true;
                try {
                  if (cloudReadiness.supabase) {
                    await closeCloudShift({
                      branchId: currentBranch.id,
                      shiftId: shiftBeingClosed.id,
                      notes,
                      actualCash,
                      expectedCash,
                      varianceAmount: actualCash - expectedCash,
                    });
                  }
                  const closed = cloudReadiness.supabase
                    ? {
                      ...shiftBeingClosed,
                      status: 'CLOSED' as const,
                      endTime: new Date().toISOString(),
                      notes,
                      actualCash,
                      expectedCash,
                      varianceAmount: actualCash - expectedCash,
                    }
                    : DBStorage.closeShift(notes, shiftBeingClosed);
                  setShiftHistory((current) => [closed, ...current.filter((shift) => shift.id !== closed.id)]);
                  setCurrentShift(closed);

                  if (!cloudReadiness.supabase) {
                    DBStorage.clearAllOrders();
                    setOrders([]);
                    setExpenseRecords([]);
                  }

                  showPushToast('Shift Ditutup', 'Shift telah ditutup. Riwayat & laporan tersimpan.');
                  if (shouldPrintZReport) await printZReport(closed, orders);
                } catch (error) {
                  showPushToast(
                    'Shift Belum Ditutup',
                    error instanceof Error ? error.message : 'Server belum mengonfirmasi penutupan shift.',
                  );
                  throw error;
                } finally {
                  // Release the closing lock after a safe delay so any lingering realtime
                  // events from the close operation are suppressed
                  window.setTimeout(() => {
                    isClosingShiftRef.current = false;
                  }, 3000);
                }
              }}
              onOpenNewShift={async (name, role, cash) => {
                const matchingStaff = staffAccounts.find((staff) => staff.name === name);
                try {
                  let nextShift: Shift;
                  if (cloudReadiness.supabase) {
                    const res = await openCloudShift({
                      branchId: currentBranch.id,
                      staffId: matchingStaff?.id,
                      staffName: name,
                      staffRole: role,
                      initialCash: cash,
                    });
                    nextShift = res.shift;
                    showPushToast(
                      res.alreadyOpen ? 'Shift Sudah Aktif' : 'Shift Baru Dibuka',
                      res.alreadyOpen
                        ? `Terhubung ke shift aktif ${res.shift.staffName} pada outlet ${currentBranch.name}.`
                        : `Shift kasir aktif untuk ${res.shift.staffName} (Modal Awal: Rp ${cash.toLocaleString('id-ID')}).`,
                    );
                  } else {
                    nextShift = DBStorage.openNewShift(
                      name,
                      role,
                      cash,
                      currentBranch,
                      matchingStaff?.id,
                      matchingStaff?.shiftStart,
                      matchingStaff?.shiftEnd,
                    );
                    showPushToast('Shift Baru Dibuka', `Shift kasir aktif untuk ${name}.`);
                  }
                  setCurrentShift(nextShift);
                  if (!cloudReadiness.supabase && orders.length > 0) {
                    DBStorage.clearAllOrders();
                    setOrders([]);
                  }
                  if (cloudReadiness.supabase) {
                    const records = await listCloudExpenseRecords(currentBranch.id, nextShift.id);
                    setExpenseRecords(records);
                  } else {
                    setExpenseRecords(DBStorage.getExpenseRecords().filter((record) => record.shiftId === nextShift.id));
                  }
                } catch (error) {
                  showPushToast(
                    'Shift Belum Dibuka',
                    error instanceof Error ? error.message : 'Server belum mengonfirmasi pembukaan shift.',
                  );
                  throw error;
                }
              }}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceView
              attendanceRecords={branchAttendanceRecords}
              onSaveAttendance={async (rec) => {
                if (cloudReadiness.supabase) {
                  const saved = await saveCloudAttendance(rec);
                  setAttendanceRecords((current) => [...current, saved]);
                } else {
                  DBStorage.saveAttendance(rec);
                  setAttendanceRecords(DBStorage.getAttendanceRecords());
                }
              }}
              activeUser={activeUser}
              staffAccounts={operationalStaffAccounts}
              profile={profile}
              currentBranch={currentBranch}
              onShowToast={showPushToast}
            />
          )}

          {activeTab === 'payroll' && (
            <div className="ui-surface flex-1 overflow-y-auto p-4 md:p-6">
              <div className="mx-auto max-w-7xl">
                <div className="mb-5 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--primary-hover)]">Owner Finance</p>
                  <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Payroll & Penggajian Staff</h1>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Atur gaji pokok, tunjangan, lembur, dan potongan keterlambatan per outlet.</p>
                </div>
                <AttendanceHrPanel activeUser={activeUser} staffAccounts={operationalStaffAccounts} currentBranch={currentBranch} attendanceRecords={branchAttendanceRecords} terminalMode={false} initialTab="PAYROLL" onShowToast={showPushToast} />
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <InventoryHppView
              rawMaterials={rawMaterials}
              menuItems={menuItems}
              branches={accessibleBranches}
              currentBranch={currentBranch}
              onUpdateRawMaterial={(mat) => {
                if (cloudReadiness.supabase) {
                  void saveCloudRawMaterial(mat, currentBranch.id).then(() => refreshCloudCatalog(currentBranch.id, currentBranch.name)).then(() => showPushToast('Stok Diperbarui', `Bahan baku ${mat.name} tersimpan ke cloud.`)).catch((error) => showPushToast('Stok Gagal Disimpan', error instanceof Error ? error.message : 'Perubahan stok gagal.'));
                } else {
                  DBStorage.updateRawMaterial(mat);
                  setRawMaterials(DBStorage.getRawMaterials());
                  showPushToast('Stok Diperbarui', `Bahan baku ${mat.name} berhasil diperbarui.`);
                }
              }}
              onDeleteRawMaterial={(id) => {
                if (cloudReadiness.supabase) {
                  void deleteCloudRawMaterial(id, currentBranch.id)
                    .then(() => refreshCloudCatalog(currentBranch.id, currentBranch.name))
                    .then(() => showPushToast('Bahan Baku Dihapus', 'Bahan baku berhasil dihapus dari cloud.'))
                    .catch((error) => showPushToast('Hapus Gagal', error instanceof Error ? error.message : 'Bahan baku gagal dihapus.'));
                } else {
                  DBStorage.deleteRawMaterial(id);
                  setRawMaterials(DBStorage.getRawMaterials());
                  showPushToast('Bahan Baku Dihapus', 'Bahan baku berhasil dihapus dari sistem.');
                }
              }}
              onSaveMenuItem={(menu) => {
                if (cloudReadiness.supabase) {
                  void saveCloudMenuItem(menu, currentBranch.id).then(() => refreshCloudCatalog(currentBranch.id, currentBranch.name)).then(() => showPushToast('Produk Menu Disimpan', `Produk menu ${menu.name} tersimpan ke cloud.`)).catch((error) => showPushToast('Menu Gagal Disimpan', error instanceof Error ? error.message : 'Produk gagal disimpan.'));
                } else {
                  DBStorage.saveMenuItem(menu);
                  setMenuItems(DBStorage.getMenuItems());
                  showPushToast('Produk Menu Disimpan', `Produk menu ${menu.name} berhasil disimpan.`);
                }
              }}
              onDeleteMenuItem={(id) => {
                if (cloudReadiness.supabase) {
                  void deleteCloudMenuItem(id, currentBranch.id)
                    .then(() => refreshCloudCatalog(currentBranch.id, currentBranch.name))
                    .then(() => showPushToast('Produk Dihapus', 'Produk menu berhasil dihapus dari cloud.'))
                    .catch((error) => showPushToast('Hapus Gagal', error instanceof Error ? error.message : 'Produk menu gagal dihapus.'));
                } else {
                  DBStorage.deleteMenuItem(id);
                  setMenuItems(DBStorage.getMenuItems());
                  showPushToast('Produk Dihapus', 'Produk menu berhasil dihapus dari sistem.');
                }
              }}
              onResetCatalogDefaults={() => {
                if (cloudReadiness.supabase) {
                  void refreshCloudCatalog().then(() => showPushToast('Katalog Disinkronkan', 'Master data dimuat ulang dari cloud.')).catch((error) => showPushToast('Sinkronisasi Gagal', error instanceof Error ? error.message : 'Katalog cloud gagal dimuat.'));
                } else {
                  const res = DBStorage.resetCatalogDefaults();
                  setMenuItems(res.menuItems);
                  setRawMaterials(res.rawMaterials);
                  showPushToast('Katalog Direset', 'Katalog menu & bahan baku berhasil dikembalikan ke standar resto.');
                }
              }}
              onShowToast={showPushToast}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsExportView
              orders={orders}
              menuItems={menuItems}
              rawMaterials={ownerMonitorData.rawMaterials.length > 0 ? ownerMonitorData.rawMaterials : rawMaterials}
              currentShift={currentShift}
              allShifts={shiftHistory}
              attendanceRecords={attendanceRecords}
              expenseRecords={expenseRecords}
              profile={profile}
              branches={accessibleBranches}
              currentBranchId={currentBranch.id}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              profile={profile}
              onSaveProfile={saveScopedRestaurantProfile}
              staffAccounts={staffAccounts}
              branches={accessibleBranches}
              currentBranch={currentBranch}
              activeUserRole={activeUser.role}
              activeUserId={activeUser.id}
              onSaveStaff={saveStaff}
              onDeleteStaff={removeStaff}
              accessControl={accessControl}
              onSaveAccessControl={saveAccessRules}
              condimentGroups={condimentGroups}
              menuItems={menuItems}
              onSaveCondimentGroup={handleSaveCondimentGroup}
              onDeleteCondimentGroup={handleDeleteCondimentGroup}
              onToggleGroupActive={handleToggleGroupActive}
              onToggleOptionAvailable={handleToggleOptionAvailable}
              tables={branchTables}
              onToggleTableSelfOrder={handleToggleTableById}
              onToggleAllTables={handleToggleAllTables}
              onEnsureTables={handleEnsureCustomerOrderTables}
              cloudMode={cloudReadiness.supabase}
              onClearTransactions={() => {
                if (cloudReadiness.supabase) {
                  showPushToast('Pembersihan Cloud Dibatasi', 'Data transaksi cloud tidak dapat dihapus melalui pembersihan cache perangkat.');
                  return;
                }
                DBStorage.purgeDummyTrialData();
                setOrders(DBStorage.getOrders());
                setExpenseRecords(DBStorage.getExpenseRecords());
                setAttendanceRecords(DBStorage.getAttendanceRecords());
                setTables(DBStorage.getTables());
                setCurrentShift(DBStorage.getCurrentShift());
                setPendingSyncCount(0);
                showPushToast('Data Dummy Dibersihkan!', 'Seluruh riwayat transaksi, presensi, & shift telah dibersihkan. Siap untuk trial real-time!');
              }}
              onFactoryReset={() => {
                if (cloudReadiness.supabase) {
                  showPushToast('Reset Perangkat Dibatasi', 'Gunakan logout dan hapus konfigurasi printer secara terpisah; data cloud tidak terpengaruh cache browser.');
                  return;
                }
                localStorage.clear();
                window.location.reload();
              }}
              onShowToast={showPushToast}
            />
          )}
          </Suspense>
        </main>
      </div>

      {/* Global Modals */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        order={activeCheckoutOrder}
        profile={profile}
        onProcessPayment={handleProcessPayment}
      />

      {isSelfOrderModalOpen && (
        <Suspense fallback={null}>
          <CustomerSelfOrderModal
            isOpen
            onClose={() => setIsSelfOrderModalOpen(false)}
            tableNumber={selectedSelfOrderTable}
            tables={branchTables}
            menuItems={menuItems}
            profile={profile}
            condimentGroups={condimentGroups}
            isSelfOrderSystemEnabled={isSelfOrderSystemEnabled}
            orders={branchOrders}
            onSubmitCustomerOrder={handleSubmitCustomerOrder}
            currentBranch={currentBranch}
            isShiftActive={currentShift?.status === 'OPEN'}
          />
        </Suspense>
      )}

      <CustomerTableManagementModal
        isOpen={isTableManagementOpen}
        onClose={() => setIsTableManagementOpen(false)}
        tables={branchTables}
        targetTableNumbers={branchTargetTableNumbers}
        onEnsureTables={canManageTableInventory ? handleEnsureCustomerOrderTables : undefined}
        onToggleTableSelfOrder={handleToggleTableById}
        onToggleAllTables={handleToggleAllTables}
      />

      <QuickTableModal
        isOpen={isQuickTableModalOpen}
        onClose={() => setIsQuickTableModalOpen(false)}
        tables={branchTables}
        orders={branchOrders}
        branchId={currentBranch.id}
        onTableUpdated={handleTableSessionUpdated}
        onToggleSelfOrder={handleToggleTableSelfOrder}
        onClearTableStatus={handleClearTableStatus}
        onSetTableOccupied={handleSetTableOccupied}
        onSelectTableForOrder={(tableNumber) => {
          setTableSelectionRequest({ tableNumber, requestId: Date.now() });
          setActiveTab('pos');
        }}
        onToggleAllSelfOrder={handleToggleAllTables}
        onResetAllTablesToFree={handleResetAllTablesToFree}
        onAddNewTable={handleAddNewTable}
        onOpenQrPrint={() => setIsQrPrintOpen(true)}
        onShowToast={showPushToast}
      />

      <QrLabelPrintModal
        isOpen={isQrPrintOpen}
        onClose={() => setIsQrPrintOpen(false)}
        tables={branchTables}
        currentBranch={currentBranch}
        profile={profile}
        selfOrderBaseUrl={branchOperationalConfig.selfOrderBaseUrl}
        tenantId={branchOperationalConfig.tenantId}
        publicOrderSlug={branchOperationalConfig.publicOrderSlug}
      />

      <ThermalReceiptModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        config={printerConfig}
        onSaveConfig={(cfg) => {
          DBStorage.savePrinterConfig(cfg);
          setPrinterConfig(cfg);
        }}
      />
    </div>
  );
}
