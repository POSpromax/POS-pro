/**
 * @license
 * Apache-2.0
 * Nusantara POS & Resto Full-Stack System
 */

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
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
import { BluetoothPrinterService } from './services/bluetoothPrinter';

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
  AccessControlRule
} from './types/pos';
import { DBStorage, STORAGE_KEYS } from './services/dbStorage';
import { INITIAL_BRANCHES } from './data/initialData';
import { cloudReadiness } from './lib/runtimeEnv';
import { PWAUpdatePrompt } from './components/System/PWAUpdatePrompt';
import { cloudSignOut } from './services/authService';
import {
  createCloudStaff,
  deactivateCloudStaff,
  listCloudStaff,
  updateCloudStaff,
} from './services/staffService';
import { listCloudAttendance, saveCloudAttendance } from './services/attendanceService';
import { deleteCloudMenuItem, deleteCloudRawMaterial, listCloudCatalog, saveCloudMenuItem, saveCloudRawMaterial } from './services/catalogService';
import { listCloudCondiments, saveCloudCondimentGroup } from './services/condimentService';
import { listCloudOrders, submitCloudOrder, subscribeCloudOrders, updateCloudOrderStatus, RealtimeConnectionState } from './services/orderService';
import { getCloudActiveShift, openCloudShift, closeCloudShift, ShiftServiceError, subscribeCloudShift } from './services/shiftService';
import { getPublicCatalogContext } from './services/publicCatalogService';
import { formatOrderLabel } from './utils/orderNumber';

const KitchenDisplayView = lazy(() => import('./components/KDS/KitchenDisplayView').then((m) => ({ default: m.KitchenDisplayView })));
const CashierView = lazy(() => import('./components/POS/CashierView').then((m) => ({ default: m.CashierView })));
const AttendanceHrPanel = lazy(() => import('./components/Attendance/AttendanceHrPanel').then((m) => ({ default: m.AttendanceHrPanel })));
const CustomerSelfOrderModal = lazy(() => import('./components/SelfOrder/CustomerSelfOrderModal').then((m) => ({ default: m.CustomerSelfOrderModal })));
const TableManagementView = lazy(() => import('./components/Tables/TableManagementView').then((m) => ({ default: m.TableManagementView })));
const SelfOrderLandingPage = lazy(() => import('./components/SelfOrder/SelfOrderLandingPage').then((m) => ({ default: m.SelfOrderLandingPage })));
const ShiftMonitorView = lazy(() => import('./components/Shift/ShiftMonitorView').then((m) => ({ default: m.ShiftMonitorView })));
const AttendanceView = lazy(() => import('./components/Attendance/AttendanceView').then((m) => ({ default: m.AttendanceView })));
const InventoryHppView = lazy(() => import('./components/Inventory/InventoryHppView').then((m) => ({ default: m.InventoryHppView })));
const AnalyticsExportView = lazy(() => import('./components/Analytics/AnalyticsExportView').then((m) => ({ default: m.AnalyticsExportView })));
const SettingsView = lazy(() => import('./components/Settings/SettingsView').then((m) => ({ default: m.SettingsView })));
const SuperOwnerDashboardView = lazy(() => import('./components/Analytics/SuperOwnerDashboardView').then((m) => ({ default: m.SuperOwnerDashboardView })));
const BlueprintArchitectureView = lazy(() => import('./components/Owner/BlueprintArchitectureView').then((m) => ({ default: m.BlueprintArchitectureView })));

const TERMINAL_SESSION_KEY = 'omnipos_terminal_session_v2';
const TERMINAL_BRANCH_KEY = 'omnipos_terminal_branch';
const TERMINAL_MODE_KEY = 'omnipos_terminal_mode';
const condimentCloudSaveTimers = new Map<string, number>();

// Server hanya menerima id order berupa UUID cloud. Order yang masih memakai id
// lokal (mis. `ord-123456`) belum pernah sampai ke database, sehingga PATCH
// status ke cloud pasti ditolak 400. Guard ini memisahkan keduanya.
const CLOUD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isCloudOrderId = (id: string): boolean => CLOUD_ID_PATTERN.test(String(id || ''));

interface SyncHealth {
  connectionState: RealtimeConnectionState;
  lastSuccessfulSync: number | null;
  lastRealtimeEvent: number | null;
}

if (typeof window !== 'undefined') {
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
    <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-orange-600" />
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
  const isSelfOrderUrlParam = typeof window !== 'undefined' && (
    window.location.search.includes('selforder') ||
    window.location.search.includes('table=') ||
    window.location.pathname.startsWith('/order') ||
    window.location.pathname.startsWith('/self-order') ||
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
  const [isAttendanceMode, setIsAttendanceMode] = useState<boolean>(false);

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
      ? new URLSearchParams(window.location.search).get('branch')
      : null;
    const sessionBranchId = typeof window !== 'undefined' ? sessionStorage.getItem(TERMINAL_BRANCH_KEY) : null;
    return list.find((branch) => branch.id === (requestedBranchId || sessionBranchId)) || list[0] || INITIAL_BRANCHES[0];
  });

  useEffect(() => {
    if (!isSelfOrderUrlParam || !cloudReadiness.supabase || !currentBranch.id) return;
    let active = true;
    void getPublicCatalogContext(currentBranch.id)
      .then((context) => {
        if (!active) return;
        setCurrentBranch((branch) => ({ ...branch, ...context.branch }));
        setMenuItems(context.menuItems);
        setTables(context.tables);
        setCondimentGroups(context.condimentGroups);
        if (context.profile) setProfile((current) => ({ ...current, ...context.profile }));
      })
      .catch((error) => showPushToast('Self-order Belum Siap', error instanceof Error ? error.message : 'Katalog cabang tidak dapat dimuat.'));
    return () => { active = false; };
  }, [isSelfOrderUrlParam, currentBranch.id]);

  const handleAddBranch = (newBranch: Branch) => {
    const updated = DBStorage.saveBranch(newBranch);
    setBranches(updated);
    showPushToast('Outlet Baru Ditambahkan', `Cabang ${newBranch.name} berhasil didaftarkan ke sistem super owner.`);
  };

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => DBStorage.getMenuItems());
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(() => DBStorage.getRawMaterials());
  const [tables, setTables] = useState<RestaurantTable[]>(() => DBStorage.getTables());
  const [condimentGroups, setCondimentGroups] = useState<CondimentGroup[]>(() => DBStorage.getCondimentGroups());
  const [orders, setOrders] = useState<Order[]>(() => DBStorage.getOrders());
  const [currentShift, setCurrentShift] = useState<Shift>(() => DBStorage.getCurrentShift(currentBranch.id));
  const [shiftHistory, setShiftHistory] = useState<Shift[]>(() => DBStorage.getShiftHistory());
  const [expenseRecords, setExpenseRecords] = useState<ExpenseIncomeRecord[]>(() => DBStorage.getExpenseRecords());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => DBStorage.getAttendanceRecords());
  const [profile, setProfile] = useState<RestaurantProfile>(() => DBStorage.getProfile());
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => DBStorage.getPrinterConfig());
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

  // Real-Time Storage & Broadcast Synchronizer across Tabs, Windows, & Cloud
  useEffect(() => {
    const unsubscribe = DBStorage.subscribeToSync((key, value) => {
      if (key === STORAGE_KEYS.CURRENT_SHIFT && value?.branchId === currentBranch.id) {
        setCurrentShift(value);
      } else if (key === STORAGE_KEYS.ORDERS && value) {
        setOrders(value);
      } else if (key === STORAGE_KEYS.EXPENSES && value) {
        setExpenseRecords(value);
      } else if (key === STORAGE_KEYS.TABLES && value) {
        setTables(value);
      } else if (key === STORAGE_KEYS.BRANCHES && value) {
        setBranches(value);
      } else if (key === STORAGE_KEYS.PROFILE && value) {
        setProfile(value);
      } else if (key === STORAGE_KEYS.STAFF && value) {
        setStaffAccounts(value);
      } else if (key === STORAGE_KEYS.MENU && value) {
        setMenuItems(value);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentBranch.id]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked) return;
    if (!['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(activeUser.role)) return;
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
  }, [isTerminalUnlocked, activeUser.id, activeUser.role]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || !currentBranch.id) return;
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
  }, [isTerminalUnlocked, currentBranch.id, activeUser.id, activeUser.role]);

  const refreshCloudCatalog = async () => {
    const catalog = await listCloudCatalog(currentBranch.id);
    setMenuItems(catalog.menuItems);
    setRawMaterials(catalog.rawMaterials.map((material) => ({ ...material, branchName: currentBranch.name })));
  };

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || !currentBranch.id) return;
    let cancelled = false;
    void listCloudCatalog(currentBranch.id)
      .then((catalog) => {
        if (cancelled) return;
        setMenuItems(catalog.menuItems);
        setRawMaterials(catalog.rawMaterials.map((material) => ({ ...material, branchName: currentBranch.name })));
      })
      .catch((error) => {
        if (!cancelled) showPushToast('Katalog Belum Tersinkron', error instanceof Error ? error.message : 'Master data cloud gagal dibaca.');
      });
    return () => { cancelled = true; };
  }, [isTerminalUnlocked, currentBranch.id]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || !currentBranch.id) return;
    let active = true;
    let knownItemQuantities = new Map<string, number>(orders.map((order) => [
      order.id,
      order.items.reduce((sum, item) => sum + item.quantity, 0),
    ] as [string, number]));
    let isFirstLoad = true;
    let isRefreshing = false;
    let refreshQueued = false;
    let realtimeState: RealtimeConnectionState = 'CONNECTING';
    let lastFallbackAt = 0;
    const refresh = () => {
      if (isRefreshing) { refreshQueued = true; return; }
      isRefreshing = true;
      void listCloudOrders(currentBranch.id)
        .then((cloudOrders) => {
          if (!active) return;
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
              playSelfOrderAlertSound();
              selfOrders.forEach((order) => {
                showPushToast(
                  'Pesanan Self-order Masuk',
                  `Meja ${order.tableNumber} — ${order.orderNumber} menerima item baru.`
                );
              });
            } else {
              playNewOrderSound();
            }
          }
          // Synchronize cloud orders with local storage, preserving tableNumber & local pending orders
          const localOrders = DBStorage.getOrders();
          const mergedOrders = cloudOrders.map((cloudOrder) => {
            const localMatch = localOrders.find((lo) => lo.id === cloudOrder.id);
            const effectiveTableNumber =
              (cloudOrder.tableNumber && cloudOrder.tableNumber !== '-' && cloudOrder.tableNumber !== '')
                ? cloudOrder.tableNumber
                : (localMatch?.tableNumber && localMatch.tableNumber !== '-' && localMatch.tableNumber !== '')
                ? localMatch.tableNumber
                : '-';

            return {
              ...cloudOrder,
              tableNumber: effectiveTableNumber
            };
          });

          // Include any local-only hold orders not yet present in cloud response
          const cloudIds = new Set(cloudOrders.map((o) => o.id));
          const localOnlyOrders = localOrders.filter((lo) => !cloudIds.has(lo.id));
          const finalOrders = [...mergedOrders, ...localOnlyOrders];

          setOrders(finalOrders);
          DBStorage.saveOrders(finalOrders);

          // Update table OCCUPIED statuses in DBStorage & state so Table Management updates immediately
          finalOrders.forEach((o) => {
            if (o.tableNumber && o.tableNumber !== '-' && o.tableNumber !== '' && o.status !== 'COMPLETED' && o.status !== 'CANCELLED') {
              DBStorage.updateTableStatus(o.tableNumber, 'OCCUPIED', o.id, o.branchId);
            }
          });
          setTables(DBStorage.getTables());

          // Update state trackers for next realtime comparison
          knownItemQuantities = nextItemQuantities;
          isFirstLoad = false;

          setOrderSyncHealth((current) => ({ ...current, lastSuccessfulSync: Date.now() }));
        })
        .catch((error) => showPushToast('Sinkronisasi Order Tertunda', error instanceof Error ? error.message : 'Order cloud belum dapat dimuat.'))
        .finally(() => {
          isRefreshing = false;
          if (refreshQueued && active) { refreshQueued = false; refresh(); }
        });
    };
    refresh();
    const unsubscribe = subscribeCloudOrders(
      currentBranch.id,
      () => {
        setOrderSyncHealth((current) => ({ ...current, lastRealtimeEvent: Date.now() }));
        refresh();
      },
      (state) => {
        const recovered = realtimeState === 'DEGRADED' && state === 'HEALTHY';
        realtimeState = state;
        setOrderSyncHealth((current) => ({ ...current, connectionState: state }));
        if (recovered) refresh();
      },
    );
    const fallbackTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const visibleTab = activeTabRef.current;
      const fallbackDelay = visibleTab === 'kds' ? 5_000 : visibleTab === 'pos' ? 8_000 : 15_000;
      if (!fallbackDelay || Date.now() - lastFallbackAt < fallbackDelay) return;
      lastFallbackAt = Date.now();
      refresh();
    }, 4_000);
    const reconcileVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', reconcileVisible);
    window.addEventListener('online', reconcileVisible);
    document.addEventListener('visibilitychange', reconcileVisible);
    return () => {
      active = false;
      window.clearInterval(fallbackTimer);
      window.removeEventListener('focus', reconcileVisible);
      window.removeEventListener('online', reconcileVisible);
      document.removeEventListener('visibilitychange', reconcileVisible);
      unsubscribe();
    };
  }, [isTerminalUnlocked, currentBranch.id]);

  // Database adalah sumber tunggal status shift. Realtime memberi respons
  // cepat; polling/focus menjadi pengaman saat websocket terputus.
  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || !currentBranch.id) return;
    let cancelled = false;
    let requestSequence = 0;
    let syncErrorShown = false;
    let realtimeState: RealtimeConnectionState = 'CONNECTING';

    // Jangan percaya cache shift saat sesi/outlet berubah. POS tetap terkunci
    // sampai server pusat mengonfirmasi apakah ada shift aktif.
    setCurrentShift(DBStorage.clearCurrentShift(currentBranch.id));

    const syncShiftFromCloud = async () => {
      // Block sync during the close-shift window to prevent race condition:
      // after closeCloudShift(), the realtime listener fires and getCloudActiveShift()
      // returns null → clearCurrentShift() would overwrite the just-saved CLOSED shift.
      if (isClosingShiftRef.current) return;
      const sequence = ++requestSequence;
      try {
        const cloudShift = await getCloudActiveShift(currentBranch.id);
        if (cancelled || sequence !== requestSequence) return;
        if (isClosingShiftRef.current) return;
        const nextShift = cloudShift
          ? DBStorage.setCurrentShift(cloudShift)
          : DBStorage.clearCurrentShift(currentBranch.id);
        setCurrentShift(nextShift);
        setShiftSyncHealth((current) => ({ ...current, lastSuccessfulSync: Date.now() }));
        syncErrorShown = false;
      } catch (error) {
        if (cancelled || sequence !== requestSequence || syncErrorShown) return;
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

    void syncShiftFromCloud();
    const unsubscribe = subscribeCloudShift(
      currentBranch.id,
      () => {
        setShiftSyncHealth((current) => ({ ...current, lastRealtimeEvent: Date.now() }));
        void syncShiftFromCloud();
      },
      (state) => {
        const recovered = realtimeState === 'DEGRADED' && state === 'HEALTHY';
        realtimeState = state;
        setShiftSyncHealth((current) => ({ ...current, connectionState: state }));
        if (recovered) void syncShiftFromCloud();
      },
    );
    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncShiftFromCloud();
    }, 60_000);
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
  }, [isTerminalUnlocked, currentBranch.id, activeUser.id]);

  // Siaran data non-shift untuk semua perangkat di cabang yang sama.
  useEffect(() => {
    if (!currentBranch?.id) {
      DBStorage.disconnectBranchSync();
      return;
    }
    DBStorage.connectBranchSync(currentBranch.id);
    return () => DBStorage.disconnectBranchSync();
  }, [currentBranch?.id]);

  useEffect(() => {
    if (!cloudReadiness.supabase || !isTerminalUnlocked || !currentBranch.id) return;
    let cancelled = false;
    void listCloudCondiments(currentBranch.id).then((groups) => {
      if (!cancelled && groups.length) {
        setCondimentGroups(groups);
        DBStorage.setCondimentGroups(groups);
      }
    }).catch((error) => {
      if (!cancelled) showPushToast('Condiment Belum Tersinkron', error instanceof Error ? error.message : 'Konfigurasi condiment cloud gagal dibaca.');
    });
    return () => { cancelled = true; };
  }, [isTerminalUnlocked, currentBranch.id]);

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
    DBStorage.saveAccessControl(rules);
    setAccessControl(rules);
    if (!cloudReadiness.supabase) return;
    try {
      await Promise.all(staffAccounts.map((staff) => {
        const rule = rules.find((item) => item.role === staff.role);
        if (!rule) return Promise.resolve();
        const { role: _role, ...permissions } = rule;
        return updateCloudStaff({ ...staff, permissions });
      }));
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
      const branchId = sessionStorage.getItem(TERMINAL_BRANCH_KEY);
      if (!hasLocalUnlock || !branchId) {
        clearTerminalSessionState();
        setIsSessionValidated(true);
        return;
      }
      try {
        const { getSupabase } = await import('./lib/supabase');
        const supabase = getSupabase();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) throw new Error('No session');
        const [{ data: profile }, { data: membership }] = await Promise.all([
          supabase.from('user_profiles').select('display_name,is_active').eq('user_id', user.id).maybeSingle(),
          supabase.from('branch_members').select('role,permissions,is_active').eq('user_id', user.id).eq('branch_id', branchId).maybeSingle(),
        ]);
        if (!profile?.is_active || !membership?.is_active) throw new Error('Inactive session');
        const branch = branches.find((item) => item.id === branchId);
        if (!branch) throw new Error('Unknown branch');
        const restoredUser: UserAccount = {
          id: user.id,
          name: profile.display_name || 'Staff',
          pin: '',
          role: membership.role as UserAccount['role'],
          branchIds: [branchId],
          permissions: membership.permissions || {},
          isActive: true,
        };
        setActiveUser(restoredUser);
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

  // System Self Order restriction toggle state
  const [isSelfOrderSystemEnabled, setIsSelfOrderSystemEnabled] = useState<boolean>(() => DBStorage.getProfile().isSelfOrderEnabled !== false);

  // 4. Online/Offline & Sync Queue State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => DBStorage.getOfflineQueue().length);
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
  const [selectedSelfOrderToken, setSelectedSelfOrderToken] = useState<string>('');

  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);

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

  // Sync Offline Queue & Realtime Channel
  const handleManualSync = async () => {
    const queue = DBStorage.getOfflineQueue();
    const failed: typeof queue = [];
    if (cloudReadiness.supabase && isOnline) {
      for (const entry of queue) {
        if (entry.type !== 'SAVE_ORDER') {
          failed.push(entry);
          continue;
        }
        try {
          const saved = await submitCloudOrder(entry.payload as Order);
          DBStorage.saveOrders([saved, ...DBStorage.getOrders().filter((order) => order.id !== entry.payload.id && order.id !== saved.id)]);
        } catch {
          failed.push(entry);
        }
      }
      DBStorage.clearOfflineQueue();
      failed.forEach((entry) => DBStorage.addToOfflineQueue(entry));
    }
    DBStorage.syncAllDataWithCloud();
    setCurrentShift(DBStorage.getCurrentShift());
    setOrders(DBStorage.getOrders());
    setExpenseRecords(DBStorage.getExpenseRecords());
    setTables(DBStorage.getTables());
    setBranches(DBStorage.getBranches());
    setProfile(DBStorage.getProfile());
    setPendingSyncCount(failed.length);
    showPushToast(
      failed.length ? 'Sebagian Data Masih Tertunda' : 'Sinkronisasi Realtime Sukses',
      failed.length ? `${failed.length} perubahan masih menunggu koneksi stabil.` : 'Pesanan telah tersimpan dan terminal cabang menerima pembaruan realtime.'
    );
  };

  // Order Handlers
  const handleSaveHoldOrder = async (draftOrder: Order) => {
    if (!ensureOpenShift('menyimpan transaksi')) return;
    let saved = DBStorage.saveOrder(draftOrder, isOnline);
    if (cloudReadiness.supabase && isOnline) {
      try {
        saved = await submitCloudOrder(draftOrder);
        DBStorage.saveOrders([saved, ...DBStorage.getOrders().filter((order) => order.id !== draftOrder.id && order.id !== saved.id)]);
      } catch (error) {
        // POST gagal saat online: jangan tinggalkan order yatim yang tak pernah
        // tersinkron. Masukkan ke antrean supaya dicoba ulang lewat Sinkronisasi.
        DBStorage.addToOfflineQueue({ type: 'SAVE_ORDER', payload: saved, timestamp: Date.now() });
        setPendingSyncCount(DBStorage.getOfflineQueue().length);
        showPushToast('Order Masuk Antrean Offline', error instanceof Error ? error.message : 'Akan disinkronkan saat koneksi pulih.');
      }
    }
    setOrders(DBStorage.getOrders());
    setRawMaterials(DBStorage.getRawMaterials());
    setTables(DBStorage.getTables());
    setCurrentShift(DBStorage.getCurrentShift());
    if (!isOnline) setPendingSyncCount(DBStorage.getOfflineQueue().length);

    showPushToast('Pesanan Disimpan', `Order ${formatOrderLabel(saved)} masuk antrean. Buka lewat Queue POS untuk melanjutkan.`);
  };

  const handleOpenCheckoutModal = (draftOrder: Partial<Order>) => {
    if (!ensureOpenShift('membuka pembayaran')) return;
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
      status: 'NEW'
    };

    let saved = DBStorage.saveOrder(fullOrder, isOnline);
    if (cloudReadiness.supabase && isOnline) {
      try {
        saved = await submitCloudOrder(fullOrder);
        DBStorage.saveOrders([saved, ...DBStorage.getOrders().filter((order) => order.id !== fullOrder.id && order.id !== saved.id)]);
      } catch (error) {
        // Pembayaran gagal terkirim: antrekan untuk retry agar order lunas ini
        // tetap sampai ke cloud dan tersiar ke terminal lain.
        DBStorage.addToOfflineQueue({ type: 'SAVE_ORDER', payload: saved, timestamp: Date.now() });
        setPendingSyncCount(DBStorage.getOfflineQueue().length);
        showPushToast('Pembayaran Tersimpan Lokal', error instanceof Error ? error.message : 'Order akan disinkronkan saat koneksi pulih.');
      }
    }
    if (fullOrder.type === 'DINE_IN' && fullOrder.tableNumber && fullOrder.tableNumber !== '-') {
      DBStorage.updateTableStatus(fullOrder.tableNumber, 'DISABLED', undefined, fullOrder.branchId);
    }
    setOrders(DBStorage.getOrders());
    setRawMaterials(DBStorage.getRawMaterials());
    setTables(DBStorage.getTables());
    setCurrentShift(DBStorage.getCurrentShift());
    if (!isOnline) setPendingSyncCount(DBStorage.getOfflineQueue().length);

    setIsPaymentModalOpen(false);
    setActiveCheckoutOrder(null);

    showPushToast('Pembayaran Lunas!', `Order ${saved.orderNumber} telah dibayar (${paymentMethod}). Disampaikan ke Dapur.`);

    if (shouldPrint) {
      void printOrder(saved);
    }
  };

  const printOrder = async (order: Order) => {
    if (BluetoothPrinterService.isConnected) {
      const result = await BluetoothPrinterService.printReceipt(order, profile, printerConfig);
      if (result.success) {
        showPushToast('Struk Tercetak', `Struk ${order.orderNumber} berhasil dicetak.`);
      } else {
        showPushToast('Cetak Gagal', result.error || 'Gagal mencetak struk.');
      }
    } else {
      showPushToast('Cetak Struk', `Struk ${order.orderNumber} — hubungkan printer Bluetooth untuk cetak otomatis.`);
    }
  };

  const handlePrintPreBill = (order: Order) => {
    void printOrder(order);
  };

  // Kitchen Status Update
  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    DBStorage.updateOrderStatus(orderId, newStatus);
    const localOrders = DBStorage.getOrders();
    setOrders(localOrders);
    const found = localOrders.find((o) => o.id === orderId);
    const label = found ? formatOrderLabel(found, localOrders) : orderId;
    if (cloudReadiness.supabase && isOnline && isCloudOrderId(orderId)) {
      // Hanya order berid cloud (UUID) yang bisa di-PATCH. Perubahannya tersiar
      // realtime ke semua terminal lewat trigger database.
      void updateCloudOrderStatus(currentBranch.id, orderId, newStatus)
        .catch((error) => showPushToast('Update Dapur Tertunda', error instanceof Error ? error.message : 'Status tersimpan lokal.'));
    } else if (isOnline && found && !isCloudOrderId(orderId) && found.source !== 'SELF_ORDER') {
      // Order berid lokal belum ada di cloud — tidak bisa di-PATCH (pasti 400).
      // Antrekan untuk dikirim ulang lewat Sinkronisasi, bukan POST langsung
      // supaya tidak membanjiri error saat order belum valid.
      DBStorage.addToOfflineQueue({ type: 'SAVE_ORDER', payload: found, timestamp: Date.now() });
      setPendingSyncCount(DBStorage.getOfflineQueue().length);
    }
    showPushToast('Update Status Dapur', `Status order ${label} diperbarui menjadi ${newStatus}.`);
  };

  // Customer Self-Order Submission from Meja QR Code
  const handleSubmitCustomerOrder = (newOrder: Order & { qrToken?: string }) => {
    DBStorage.saveOrder(newOrder, isOnline);
    DBStorage.updateTableStatus(newOrder.tableNumber, 'OCCUPIED', newOrder.id, newOrder.branchId);
    setOrders(DBStorage.getOrders());
    setTables(DBStorage.getTables());
    setRawMaterials(DBStorage.getRawMaterials());
    if (cloudReadiness.supabase && isOnline) {
      void submitCloudOrder(newOrder)
        .then((saved) => {
          DBStorage.saveOrders([saved, ...DBStorage.getOrders().filter((order) => order.id !== newOrder.id && order.id !== saved.id)]);
          DBStorage.updateTableStatus(saved.tableNumber, 'OCCUPIED', saved.id, saved.branchId);
          setOrders(DBStorage.getOrders());
          setTables(DBStorage.getTables());
        })
        .catch((error) => showPushToast('Self-order Belum Terkirim', error instanceof Error ? error.message : 'Silakan kirim ulang pesanan.'));
    }
    
    showPushToast('Order Baru dari HP Customer!', `Meja ${newOrder.tableNumber} memesan order ${newOrder.orderNumber}. Meja dikunci (RED).`);
  };

  // Condiments Management
  const handleSaveCondimentGroup = (group: CondimentGroup) => {
    DBStorage.saveCondimentGroup(group);
    setCondimentGroups(DBStorage.getCondimentGroups());
    if (!cloudReadiness.supabase) return;
    const previous = condimentCloudSaveTimers.get(group.id);
    if (previous) window.clearTimeout(previous);
    const timer = window.setTimeout(() => {
      void saveCloudCondimentGroup(group, currentBranch.id)
        .then(() => listCloudCondiments(currentBranch.id))
        .then((groups) => { setCondimentGroups(groups); DBStorage.setCondimentGroups(groups); })
        .catch((error) => showPushToast('Condiment Gagal Disimpan', error instanceof Error ? error.message : 'Konfigurasi condiment gagal.'));
      condimentCloudSaveTimers.delete(group.id);
    }, 450);
    condimentCloudSaveTimers.set(group.id, timer);
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
    const updated = tables.map((t) => (t.id === tableId ? { ...t, isSelfOrderEnabled: enabled } : t));
    DBStorage.setTables(updated);
    setTables(updated);
  };

  const handleToggleAllTables = (enabled: boolean) => {
    const updated = tables.map((t) =>
      !t.branchId || t.branchId === currentBranch.id ? { ...t, isSelfOrderEnabled: enabled } : t
    );
    DBStorage.setTables(updated);
    setTables(updated);
  };

  // Table Control
  const handleToggleTableSelfOrder = (tableNumber: string, enabled: boolean) => {
    DBStorage.toggleTableSelfOrder(tableNumber, enabled, currentBranch.id);
    setTables(DBStorage.getTables());
  };

  const handleTableSessionUpdated = (updatedTable: RestaurantTable) => {
    const normalizedNumber = updatedTable.number.replace(/^0+(?=\d)/, '');
    const nextTables = tables.map((table) => {
      const sameBranch = !table.branchId || !updatedTable.branchId || table.branchId === updatedTable.branchId;
      const sameNumber = table.number.replace(/^0+(?=\d)/, '') === normalizedNumber;
      return table.id === updatedTable.id || (sameBranch && sameNumber) ? { ...table, ...updatedTable } : table;
    });
    DBStorage.setTables(nextTables);
    setTables(nextTables);
  };

  const handleClearTableStatus = (tableNumber: string) => {
    DBStorage.updateTableStatus(tableNumber, 'DISABLED', undefined, currentBranch.id);
    setTables(DBStorage.getTables());
    showPushToast('Status Meja', `Meja ${tableNumber} di ${currentBranch.name} dinonaktifkan.`);
  };

  const handleSetTableOccupied = (tableNumber: string) => {
    DBStorage.updateTableStatus(tableNumber, 'OCCUPIED', undefined, currentBranch.id);
    setTables(DBStorage.getTables());
    showPushToast('Status Meja', `Meja ${tableNumber} di ${currentBranch.name} ditandai terisi.`);
  };

  const handleResetAllTablesToFree = () => {
    const updated = tables.map((t) =>
      !t.branchId || t.branchId === currentBranch.id
        ? { ...t, status: 'DISABLED' as const, activeOrderId: undefined }
        : t
    );
    DBStorage.setTables(updated);
    setTables(updated);
    showPushToast('Reset Status Meja', `Semua meja ${currentBranch.name} dikosongkan.`);
  };

  const handleAddNewTable = (tableNumber: string, capacity: number) => {
    const created: RestaurantTable = {
      id: 'tbl-' + Date.now(),
      number: tableNumber,
      capacity,
      status: 'DISABLED',
      isSelfOrderEnabled: true,
      branchId: currentBranch.id
    };
    const updated = [...tables, created];
    DBStorage.setTables(updated);
    setTables(updated);
    showPushToast('Meja Baru Ditambahkan', `Meja ${tableNumber} (Kapasitas ${capacity} orang) berhasil dibuat.`);
  };

  // URL Search Parameter & Path check for isolated Standalone Self-Order Web Link
  const isAttendanceTerminal = isAttendanceMode || (typeof window !== 'undefined' && (
    window.location.pathname === '/attendance' ||
    new URLSearchParams(window.location.search).get('mode') === 'attendance'
  ));

  const branchOrders = orders.filter((order) => !order.branchId || order.branchId === currentBranch.id);
  // Hanya order dari shift aktif saat ini — untuk CashierView dan KitchenDisplayView
  const shiftOrders = currentShift.status === 'OPEN'
    ? branchOrders.filter((o) => o.shiftId === currentShift.id)
    : [];
  const branchTables = tables.filter((table) => !table.branchId || table.branchId === currentBranch.id);
  const branchRawMaterials = rawMaterials.filter((material) => material.branchId === currentBranch.id);
  const branchAttendanceRecords = attendanceRecords.filter(
    (record) => !record.branchId || record.branchId === currentBranch.id
  );

  // If isolated self order tab or URL param is active, render native standalone mobile self-order
  if (isSelfOrderUrlParam) {
    const selfOrderParams = new URLSearchParams(window.location.search);
    const tableFromUrl = selfOrderParams.get('table') || '1';
    const requestedBranchId = selfOrderParams.get('branch');
    const qrTokenFromUrl = selfOrderParams.get('token') || '';
    const selfOrderBranch = branches.find((branch) => branch.id === requestedBranchId) || currentBranch;
    const selfOrderTables = tables.filter((table) => !table.branchId || table.branchId === selfOrderBranch.id);
    const selfOrderOrders = orders.filter((order) => !order.branchId || order.branchId === selfOrderBranch.id);
    return (
      <div className="w-screen h-screen overflow-hidden bg-[var(--canvas-bg)] flex flex-col relative">
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
              qrToken={qrTokenFromUrl}
              isShiftActive={currentShift?.status === 'OPEN'}
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
    user: { id: string; name: string | null; role: string | null; tenantId?: string | null; branchId?: string; permissions?: Record<string, boolean> },
    selectedBranch: Branch,
    mode: 'SYSTEM' | 'ATTENDANCE',
  ) => {
    const userAccount: UserAccount = {
      id: user.id,
      name: user.name || 'Staff',
      pin: '',
      role: (user.role as UserAccount['role']) || 'KASIR',
      branchIds: [selectedBranch.id],
      permissions: user.permissions || {},
      isActive: true,
    };

    setIsTerminalUnlocked(true);
    setIsPinModalOpen(false);
    sessionStorage.setItem(TERMINAL_SESSION_KEY, 'unlocked');
    sessionStorage.setItem(TERMINAL_BRANCH_KEY, selectedBranch.id);
    sessionStorage.setItem(TERMINAL_MODE_KEY, mode);
    setActiveUser(userAccount);
    DBStorage.setActiveUser(userAccount);
    setCurrentBranch(selectedBranch);

    if (mode === 'ATTENDANCE') {
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
            if (cloudReadiness.supabase) {
              const saved = await saveCloudAttendance(record);
              setAttendanceRecords((current) => [...current, saved]);
            } else {
              DBStorage.saveAttendance(record);
              setAttendanceRecords(DBStorage.getAttendanceRecords());
            }
            window.setTimeout(() => {
              void logoutTerminal();
            }, 400);
          }}
          activeUser={activeUser}
          staffAccounts={staffAccounts}
          profile={profile}
          currentBranch={currentBranch}
          terminalMode
          onShowToast={showPushToast}
        />
      </div>
    );
  }

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
      />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/*
          The owner portal uses dedicated page banners inside each screen.
          Reusing the cashier utility header here creates duplicated chrome and
          a misleading "Terminal POS" strip above owner content.
        */}
        {systemPortal === 'KASIR' && activeTab !== 'pos' && (
          <HeaderBar
            systemPortal={systemPortal}
            onSwitchPortal={handleSwitchPortal}
            activeTab={activeTab}
            branches={branches}
            currentBranch={currentBranch}
            onSelectBranch={setCurrentBranch}
            printerConfig={printerConfig}
            onOpenPrinterSetup={() => setIsPrinterModalOpen(true)}
            onOpenCustomerSelfOrder={() => {
              setSelectedSelfOrderTable('1');
              setSelectedSelfOrderToken('');
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
                  branches={branches}
                  currentBranch={currentBranch}
                  onSelectBranch={setCurrentBranch}
                  printerConfig={printerConfig}
                  onOpenPrinterSetup={() => setIsPrinterModalOpen(true)}
                  onOpenCustomerSelfOrder={() => {
                    setSelectedSelfOrderTable('1');
                    setSelectedSelfOrderToken('');
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
                />
              }
              menuItems={menuItems}
              orders={shiftOrders}
              tables={branchTables}
              activeUser={activeUser}
              currentBranch={currentBranch}
              currentShift={currentShift}
              searchTerm={searchTerm}
              condimentGroups={condimentGroups}
              onOpenCheckoutModal={handleOpenCheckoutModal}
              onSaveHoldOrder={handleSaveHoldOrder}
              onCompleteOrder={(orderId) => handleUpdateOrderStatus(orderId, 'COMPLETED')}
              onPrintPreBill={handlePrintPreBill}
              onSelectExistingOrderToEdit={(ord) => {
                showPushToast('Order Dimuat', `Order ${formatOrderLabel(ord)} dibuka di Kasir.`);
              }}
              onOpenTableModal={() => setIsQuickTableModalOpen(true)}
              onOpenShiftTab={() => handleTabChange('shift')}
              confirmBeforeSaveOrder={profile.confirmBeforeSaveOrder === true}
              confirmBeforePayment={profile.confirmBeforePayment === true}
            />
          )}

          {activeTab === 'kds' && (
            <KitchenDisplayView
              orders={shiftOrders}
              condimentGroups={condimentGroups}
              connectionState={orderSyncHealth.connectionState}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onPrintKitchenTicket={(ord) => showPushToast('Tiket Dapur', `Tiket dapur ${formatOrderLabel(ord)} dicetak.`)}
            />
          )}

          {activeTab === 'superowner' && (
            <SuperOwnerDashboardView
              branches={branches}
              orders={orders}
              tables={tables}
              rawMaterials={rawMaterials}
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
              onSaveProfile={(prof) => {
                DBStorage.saveProfile(prof);
                setProfile(prof);
              }}
              tables={branchTables}
              branches={branches}
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
              onToggleSelfOrder={handleToggleTableSelfOrder}
              onClearTableStatus={handleClearTableStatus}
              onOpenCustomerSelfOrderModal={(tblNum, token) => {
                setSelectedSelfOrderTable(tblNum);
                setSelectedSelfOrderToken(token || '');
                setIsSelfOrderModalOpen(true);
              }}
              onTableUpdated={handleTableSessionUpdated}
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
                  onClick={() => window.open(`/?selforder&branch=${encodeURIComponent(currentBranch.id)}&table=01`, '_blank', 'noopener,noreferrer')}
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
              onAddExpenseIncome={(rec) => {
                DBStorage.addExpenseOrIncome(rec);
                setExpenseRecords(DBStorage.getExpenseRecords());
                setCurrentShift(DBStorage.getCurrentShift());
              }}
              onRefreshShift={async () => {
                if (!cloudReadiness.supabase) {
                  setCurrentShift(DBStorage.getCurrentShift(currentBranch.id));
                  return;
                }
                const cloudShift = await getCloudActiveShift(currentBranch.id);
                const nextShift = cloudShift
                  ? DBStorage.setCurrentShift(cloudShift)
                  : DBStorage.clearCurrentShift(currentBranch.id);
                setCurrentShift(nextShift);
              }}
              onCloseShift={async (notes, actualCash, expectedCash) => {
                // Snapshot shift and all data BEFORE any async operation
                const shiftBeingClosed = { ...currentShift };
                const ordersForShift = orders.filter(
                  (o) => o.shiftId === shiftBeingClosed.id && o.paymentStatus === 'PAID' && o.status !== 'CANCELLED'
                );

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
                  const closed = DBStorage.closeShift(notes, shiftBeingClosed);
                  // Update shift history state reactively
                  const updatedHistory = DBStorage.getShiftHistory();
                  setShiftHistory(updatedHistory);
                  setCurrentShift(closed);

                  // Clear orders and expenses so new shift starts clean
                  DBStorage.clearAllOrders();
                  setOrders([]);
                  // Keep expenses in storage for historical reference but clear from active state
                  setExpenseRecords([]);

                  showPushToast('Shift Ditutup', 'Shift telah ditutup. Riwayat & laporan tersimpan.');
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
                    nextShift = DBStorage.setCurrentShift(res.shift);
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
                  // Clear any leftover orders/expenses from previous shift
                  // (belt-and-suspenders: normally already cleared in onCloseShift)
                  if (orders.length > 0) {
                    DBStorage.clearAllOrders();
                    setOrders([]);
                  }
                  setExpenseRecords(DBStorage.getExpenseRecords().filter((r) => r.shiftId === nextShift.id));
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
              staffAccounts={staffAccounts}
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
                <AttendanceHrPanel activeUser={activeUser} staffAccounts={staffAccounts} currentBranch={currentBranch} attendanceRecords={branchAttendanceRecords} terminalMode={false} initialTab="PAYROLL" onShowToast={showPushToast} />
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <InventoryHppView
              rawMaterials={rawMaterials}
              menuItems={menuItems}
              branches={branches}
              currentBranch={currentBranch}
              onUpdateRawMaterial={(mat) => {
                if (cloudReadiness.supabase) {
                  void saveCloudRawMaterial(mat, currentBranch.id).then(refreshCloudCatalog).then(() => showPushToast('Stok Diperbarui', `Bahan baku ${mat.name} tersimpan ke cloud.`)).catch((error) => showPushToast('Stok Gagal Disimpan', error instanceof Error ? error.message : 'Perubahan stok gagal.'));
                } else {
                  DBStorage.updateRawMaterial(mat);
                  setRawMaterials(DBStorage.getRawMaterials());
                  showPushToast('Stok Diperbarui', `Bahan baku ${mat.name} berhasil diperbarui.`);
                }
              }}
              onDeleteRawMaterial={(id) => {
                DBStorage.deleteRawMaterial(id);
                setRawMaterials(DBStorage.getRawMaterials());
                if (cloudReadiness.supabase) {
                  void deleteCloudRawMaterial(id, currentBranch.id)
                    .then(refreshCloudCatalog)
                    .then(() => showPushToast('Bahan Baku Dihapus', 'Bahan baku berhasil dihapus dari cloud.'))
                    .catch((error) => showPushToast('Hapus Gagal', error instanceof Error ? error.message : 'Bahan baku gagal dihapus.'));
                } else {
                  showPushToast('Bahan Baku Dihapus', 'Bahan baku berhasil dihapus dari sistem.');
                }
              }}
              onSaveMenuItem={(menu) => {
                if (cloudReadiness.supabase) {
                  void saveCloudMenuItem(menu, currentBranch.id).then(refreshCloudCatalog).then(() => showPushToast('Produk Menu Disimpan', `Produk menu ${menu.name} tersimpan ke cloud.`)).catch((error) => showPushToast('Menu Gagal Disimpan', error instanceof Error ? error.message : 'Produk gagal disimpan.'));
                } else {
                  DBStorage.saveMenuItem(menu);
                  setMenuItems(DBStorage.getMenuItems());
                  showPushToast('Produk Menu Disimpan', `Produk menu ${menu.name} berhasil disimpan.`);
                }
              }}
              onDeleteMenuItem={(id) => {
                DBStorage.deleteMenuItem(id);
                setMenuItems(DBStorage.getMenuItems());
                if (cloudReadiness.supabase) {
                  void deleteCloudMenuItem(id, currentBranch.id)
                    .then(refreshCloudCatalog)
                    .then(() => showPushToast('Produk Dihapus', 'Produk menu berhasil dihapus dari cloud.'))
                    .catch((error) => showPushToast('Hapus Gagal', error instanceof Error ? error.message : 'Produk menu gagal dihapus.'));
                } else {
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
              currentShift={currentShift}
              allShifts={shiftHistory}
              attendanceRecords={attendanceRecords}
              expenseRecords={expenseRecords}
              profile={profile}
              branches={branches}
              currentBranchId={currentBranch.id}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              profile={profile}
              onSaveProfile={(prof) => {
                DBStorage.saveProfile(prof);
                setProfile(prof);
                setIsSelfOrderSystemEnabled(prof.isSelfOrderEnabled !== false);
              }}
              staffAccounts={staffAccounts}
              branches={branches}
              currentBranch={currentBranch}
              onSaveStaff={saveStaff}
              onDeleteStaff={removeStaff}
              accessControl={accessControl}
              onSaveAccessControl={saveAccessRules}
              condimentGroups={condimentGroups}
              menuItems={menuItems}
              onSaveCondimentGroup={handleSaveCondimentGroup}
              onToggleGroupActive={handleToggleGroupActive}
              onToggleOptionAvailable={handleToggleOptionAvailable}
              tables={branchTables}
              onToggleTableSelfOrder={handleToggleTableSelfOrder}
              onToggleAllTables={handleToggleAllTables}
              onToggleSystemSelfOrder={(enabled) => {
                setIsSelfOrderSystemEnabled(enabled);
                const updated = { ...profile, isSelfOrderEnabled: enabled };
                DBStorage.saveProfile(updated);
                setProfile(updated);
              }}
              onClearTransactions={() => {
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
            qrToken={selectedSelfOrderToken || undefined}
            isShiftActive={currentShift?.status === 'OPEN'}
          />
        </Suspense>
      )}

      <CustomerTableManagementModal
        isOpen={isTableManagementOpen}
        onClose={() => setIsTableManagementOpen(false)}
        tables={branchTables}
        onToggleTableSelfOrder={handleToggleTableById}
        onToggleAllTables={handleToggleAllTables}
        isSelfOrderSystemEnabled={isSelfOrderSystemEnabled}
        onToggleSystemSelfOrder={(enabled) => {
          setIsSelfOrderSystemEnabled(enabled);
          const updatedProfile = { ...profile, isSelfOrderEnabled: enabled };
          DBStorage.saveProfile(updatedProfile);
          setProfile(updatedProfile);
        }}
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
