/**
 * @license
 * Apache-2.0
 * Nusantara POS & Resto Full-Stack System
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Sidebar } from './components/Navigation/Sidebar';
import { HeaderBar } from './components/Navigation/HeaderBar';
import { PinAuthModal } from './components/Auth/PinAuthModal';
import { CashierView } from './components/POS/CashierView';
import { PaymentModal } from './components/POS/PaymentModal';
import { ThermalReceiptModal } from './components/Printer/ThermalReceiptModal';
import { CustomerTableManagementModal } from './components/SelfOrder/CustomerTableManagementModal';
import { QuickTableModal } from './components/Tables/QuickTableModal';
import { playNewOrderSound } from './utils/audioNotification';

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
import { DBStorage } from './services/dbStorage';
import { INITIAL_BRANCHES } from './data/initialData';
import { isSupabaseConfigured } from './lib/supabase';
import { PWAUpdatePrompt } from './components/System/PWAUpdatePrompt';

const KitchenDisplayView = lazy(() => import('./components/KDS/KitchenDisplayView').then((m) => ({ default: m.KitchenDisplayView })));
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
  if (['settings', 'blueprint', 'tables', 'attendance', 'selforder'].includes(tab)) return rule.canAccessSettings;
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
  // 1. Initialize local DB defaults
  useEffect(() => {
    DBStorage.initDefaults();
  }, []);

  // 2. Navigation State & System Portals ('KASIR' | 'OWNER')
  const [systemPortal, setSystemPortal] = useState<'KASIR' | 'OWNER'>('KASIR');
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Explicit Portal Switcher (Kasir Terminal vs Owner Portal)
  const handleSwitchPortal = (targetPortal: 'KASIR' | 'OWNER') => {
    const rule = DBStorage.getAccessControl().find((item) => item.role === activeUser.role);
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
    const ownerTabs = ['superowner', 'blueprint', 'analytics', 'inventory', 'tables', 'attendance', 'selforder', 'settings'];
    const rule = DBStorage.getAccessControl().find((item) => item.role === activeUser.role);

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

  // 3. System Data State
  const [activeUser, setActiveUser] = useState<UserAccount>(() => DBStorage.getActiveUser());
  const [isTerminalUnlocked, setIsTerminalUnlocked] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(true);

  const lockTerminal = () => {
    setIsTerminalUnlocked(false);
    setIsPinModalOpen(true);
  };

  const [branches, setBranches] = useState<Branch[]>(() => DBStorage.getBranches());
  const [currentBranch, setCurrentBranch] = useState<Branch>(() => {
    const list = DBStorage.getBranches();
    return list[0] || INITIAL_BRANCHES[0];
  });

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
  const [currentShift, setCurrentShift] = useState<Shift>(() => DBStorage.getCurrentShift());
  const [expenseRecords, setExpenseRecords] = useState<ExpenseIncomeRecord[]>(() => DBStorage.getExpenseRecords());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => DBStorage.getAttendanceRecords());
  const [profile, setProfile] = useState<RestaurantProfile>(() => DBStorage.getProfile());
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => DBStorage.getPrinterConfig());
  const [staffAccounts, setStaffAccounts] = useState<UserAccount[]>(() => DBStorage.getStaff());
  const [accessControl, setAccessControl] = useState<AccessControlRule[]>(() => DBStorage.getAccessControl());
  const activeAccessRule = accessControl.find((rule) => rule.role === activeUser.role);

  useEffect(() => {
    if (!activeAccessRule || canAccessTab(activeAccessRule, activeTab)) return;
    const destination = getDefaultAccessDestination(activeAccessRule);
    if (!destination.tab) {
      setIsPinModalOpen(true);
      return;
    }
    setSystemPortal(destination.portal);
    setActiveTab(destination.tab);
  }, [accessControl, activeUser.role]);

  // System Self Order restriction toggle state & Global Condiment Topping Toggle state
  const [isSelfOrderSystemEnabled, setIsSelfOrderSystemEnabled] = useState<boolean>(() => DBStorage.getProfile().isSelfOrderEnabled !== false);
  const [globalCondimentActive, setGlobalCondimentActive] = useState<boolean>(true);

  // 4. Online/Offline & Sync Queue State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => DBStorage.getOfflineQueue().length);

  // 5. Toast Push Notifications State
  const [toastNotification, setToastNotification] = useState<{ title: string; message: string } | null>(null);

  // 6. Modals State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [activeCheckoutOrder, setActiveCheckoutOrder] = useState<Partial<Order> | null>(null);

  const [isSelfOrderModalOpen, setIsSelfOrderModalOpen] = useState<boolean>(false);
  const [isTableManagementOpen, setIsTableManagementOpen] = useState<boolean>(false);
  const [isQuickTableModalOpen, setIsQuickTableModalOpen] = useState<boolean>(false);
  const [selectedSelfOrderTable, setSelectedSelfOrderTable] = useState<string>('01');

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
    setToastNotification({ title, message });
    setTimeout(() => setToastNotification(null), 4000);
  };

  // Sync Offline Queue
  const handleManualSync = () => {
    if (!isSupabaseConfigured()) {
      showPushToast('Sinkronisasi Belum Aktif', 'Konfigurasi publik Supabase belum tersedia pada build ini. Antrean lokal tetap disimpan.');
      return;
    }
    showPushToast('Sinkronisasi Belum Diaktifkan', 'Adapter transaksi Supabase belum menjalankan proses upload. Antrean lokal tidak dihapus untuk mencegah kehilangan data.');
  };

  // Order Handlers
  const handleSaveHoldOrder = (draftOrder: Order) => {
    const saved = DBStorage.saveOrder(draftOrder, isOnline);
    setOrders(DBStorage.getOrders());
    setRawMaterials(DBStorage.getRawMaterials());
    setTables(DBStorage.getTables());
    setCurrentShift(DBStorage.getCurrentShift());
    if (!isOnline) setPendingSyncCount(DBStorage.getOfflineQueue().length);

    showPushToast('Pesanan Disimpan', `Order ${saved.orderNumber} berhasil disimpan ke antrean.`);
  };

  const handleOpenCheckoutModal = (draftOrder: Partial<Order>) => {
    setActiveCheckoutOrder(draftOrder);
    setIsPaymentModalOpen(true);
  };

  const handleProcessPayment = (paymentMethod: PaymentMethod, cashPaid: number, shouldPrint: boolean) => {
    if (!activeCheckoutOrder) return;

    const fullOrder: Order = {
      ...(activeCheckoutOrder as Order),
      paymentMethod,
      paymentStatus: 'PAID',
      cashPaid,
      change: Math.max(0, cashPaid - (activeCheckoutOrder.total || 0)),
      status: 'NEW'
    };

    const saved = DBStorage.saveOrder(fullOrder, isOnline);
    setOrders(DBStorage.getOrders());
    setRawMaterials(DBStorage.getRawMaterials());
    setTables(DBStorage.getTables());
    setCurrentShift(DBStorage.getCurrentShift());
    if (!isOnline) setPendingSyncCount(DBStorage.getOfflineQueue().length);

    setIsPaymentModalOpen(false);
    setActiveCheckoutOrder(null);

    showPushToast('Pembayaran Lunas!', `Order ${saved.orderNumber} telah dibayar (${paymentMethod}). Disampaikan ke Dapur.`);

    if (shouldPrint) {
      alert(`[PRINTER BT] Mencetak Struk ${saved.orderNumber} via Bluetooth Thermal Printer 58mm...`);
    }
  };

  // Pre-Bill Print
  const handlePrintPreBill = (order: Order) => {
    alert(`[PRE-BILL] Mencetak Tagihan Sementara Order ${order.orderNumber} untuk Meja ${order.tableNumber}...`);
  };

  // Kitchen Status Update
  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    DBStorage.updateOrderStatus(orderId, newStatus);
    setOrders(DBStorage.getOrders());
    showPushToast('Update Status Dapur', `Status order ${orderId} diperbarui menjadi ${newStatus}.`);
  };

  // Customer Self-Order Submission from Meja QR Code
  const handleSubmitCustomerOrder = (newOrder: Order) => {
    DBStorage.saveOrder(newOrder, isOnline);
    DBStorage.updateTableStatus(newOrder.tableNumber, 'OCCUPIED', newOrder.id, newOrder.branchId);
    setOrders(DBStorage.getOrders());
    setTables(DBStorage.getTables());
    setRawMaterials(DBStorage.getRawMaterials());
    
    // Play cashier audio notification chime for new order arrival!
    playNewOrderSound();

    showPushToast('Order Baru dari HP Customer!', `Meja ${newOrder.tableNumber} memesan order ${newOrder.orderNumber}. Meja dikunci (RED).`);
  };

  // Condiments Management
  const handleSaveCondimentGroup = (group: CondimentGroup) => {
    DBStorage.saveCondimentGroup(group);
    setCondimentGroups(DBStorage.getCondimentGroups());
  };

  const handleToggleGroupActive = (groupId: string, isActive: boolean) => {
    DBStorage.toggleCondimentGroupActive(groupId, isActive);
    setCondimentGroups(DBStorage.getCondimentGroups());
  };

  const handleToggleOptionAvailable = (groupId: string, optionId: string, isAvailable: boolean) => {
    DBStorage.toggleCondimentOptionAvailable(groupId, optionId, isAvailable);
    setCondimentGroups(DBStorage.getCondimentGroups());
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

  const handleClearTableStatus = (tableNumber: string) => {
    DBStorage.updateTableStatus(tableNumber, 'FREE', undefined, currentBranch.id);
    setTables(DBStorage.getTables());
    showPushToast('Status Meja', `Meja ${tableNumber} di ${currentBranch.name} dikosongkan.`);
  };

  const handleSetTableOccupied = (tableNumber: string) => {
    DBStorage.updateTableStatus(tableNumber, 'OCCUPIED', undefined, currentBranch.id);
    setTables(DBStorage.getTables());
    showPushToast('Status Meja', `Meja ${tableNumber} di ${currentBranch.name} ditandai terisi.`);
  };

  const handleResetAllTablesToFree = () => {
    const updated = tables.map((t) =>
      !t.branchId || t.branchId === currentBranch.id
        ? { ...t, status: 'FREE' as const, activeOrderId: undefined }
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
      status: 'FREE',
      isSelfOrderEnabled: true,
      branchId: currentBranch.id
    };
    const updated = [...tables, created];
    DBStorage.setTables(updated);
    setTables(updated);
    showPushToast('Meja Baru Ditambahkan', `Meja ${tableNumber} (Kapasitas ${capacity} orang) berhasil dibuat.`);
  };

  // URL Search Parameter check for isolated Self Order URL
  const isSelfOrderUrlParam = typeof window !== 'undefined' && (
    window.location.search.includes('selforder') ||
    window.location.search.includes('table=')
  );

  const branchOrders = orders.filter((order) => !order.branchId || order.branchId === currentBranch.id);
  const branchTables = tables.filter((table) => !table.branchId || table.branchId === currentBranch.id);
  const branchRawMaterials = rawMaterials.filter((material) => material.branchId === currentBranch.id);
  const branchAttendanceRecords = attendanceRecords.filter(
    (record) => !record.branchId || record.branchId === currentBranch.id
  );

  // If isolated self order tab or URL param is active, render native standalone mobile self-order
  if (activeTab === 'selforder' || isSelfOrderUrlParam) {
    const selfOrderParams = new URLSearchParams(window.location.search);
    const tableFromUrl = selfOrderParams.get('table') || '01';
    const requestedBranchId = selfOrderParams.get('branch');
    const selfOrderBranch = branches.find((branch) => branch.id === requestedBranchId) || currentBranch;
    const selfOrderTables = tables.filter((table) => !table.branchId || table.branchId === selfOrderBranch.id);
    const selfOrderOrders = orders.filter((order) => !order.branchId || order.branchId === selfOrderBranch.id);
    return (
      <div className="w-screen h-screen overflow-hidden bg-slate-950 flex flex-col relative">
        {/* Cashier return floating bar if logged in as cashier */}
        {!isSelfOrderUrlParam && (
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-300 z-50">
            <span className="font-bold text-orange-400">📱 Mode Tampilan Customer Self-Order QR</span>
            <button
              type="button"
              onClick={() => setActiveTab('pos')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-xl font-bold transition-all cursor-pointer"
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
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans antialiased text-[#181715]" style={{ background: 'linear-gradient(145deg, #F7F7F7 0%, #EEEEEE 52%, #F5F5F5 100%)' }}>
      <PWAUpdatePrompt />
      {toastNotification && (
        <div className="fixed top-4 right-4 z-50 bg-[#1A1714] text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10 animate-fadeIn flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#EA580C] animate-pulse" />
          <div>
            <p className="font-semibold text-xs text-orange-300">{toastNotification.title}</p>
            <p className="text-[11px] text-white/60 font-medium">{toastNotification.message}</p>
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
        onLockPin={lockTerminal}
        pendingSyncCount={pendingSyncCount}
        accessRule={activeAccessRule}
      />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header for non-POS pages */}
        {activeTab !== 'pos' && (
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
              setSelectedSelfOrderTable('01');
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
            globalCondimentActive={globalCondimentActive}
            onToggleGlobalCondiment={() => setGlobalCondimentActive((prev) => !prev)}
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
                    setSelectedSelfOrderTable('01');
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
                  globalCondimentActive={globalCondimentActive}
                  onToggleGlobalCondiment={() => setGlobalCondimentActive((prev) => !prev)}
                />
              }
              menuItems={menuItems}
              orders={branchOrders}
              tables={branchTables}
              activeUser={activeUser}
              currentBranch={currentBranch}
              currentShift={currentShift}
              searchTerm={searchTerm}
              condimentGroups={condimentGroups}
              globalCondimentActive={globalCondimentActive}
              onToggleGlobalCondiment={() => setGlobalCondimentActive((prev) => !prev)}
              onOpenCheckoutModal={handleOpenCheckoutModal}
              onSaveHoldOrder={handleSaveHoldOrder}
              onPrintPreBill={handlePrintPreBill}
              onSelectExistingOrderToEdit={(ord) => {
                showPushToast('Order Loaded', `Order ${ord.orderNumber} dimuat ke Kasir.`);
              }}
              onOpenTableModal={() => setIsQuickTableModalOpen(true)}
            />
          )}

          {activeTab === 'kds' && (
            <KitchenDisplayView
              orders={branchOrders}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onPrintKitchenTicket={(ord) => alert(`[PRINTER TIKET DAPUR] Cetak tiket dapur #${ord.orderNumber}...`)}
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
            />
          )}

          {activeTab === 'tables' && (
            <TableManagementView
              tables={branchTables}
              onToggleSelfOrder={handleToggleTableSelfOrder}
              onClearTableStatus={handleClearTableStatus}
              onOpenCustomerSelfOrderModal={(tblNum) => {
                setSelectedSelfOrderTable(tblNum);
                setIsSelfOrderModalOpen(true);
              }}
            />
          )}

          {activeTab === 'shift' && (
            <ShiftMonitorView
              currentShift={currentShift}
              orders={branchOrders}
              expenseRecords={expenseRecords}
              onAddExpenseIncome={(rec) => {
                DBStorage.addExpenseOrIncome(rec);
                setExpenseRecords(DBStorage.getExpenseRecords());
                setCurrentShift(DBStorage.getCurrentShift());
              }}
              onCloseShift={(notes) => {
                DBStorage.closeShift(notes);
                setCurrentShift(DBStorage.getCurrentShift());
              }}
              onOpenNewShift={(name, role, cash) => {
                const matchingStaff = staffAccounts.find((staff) => staff.name === name);
                const ns = DBStorage.openNewShift(
                  name,
                  role,
                  cash,
                  currentBranch,
                  matchingStaff?.id,
                  matchingStaff?.shiftStart,
                  matchingStaff?.shiftEnd
                );
                setCurrentShift(ns);
              }}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceView
              attendanceRecords={branchAttendanceRecords}
              onSaveAttendance={(rec) => {
                DBStorage.saveAttendance(rec);
                setAttendanceRecords(DBStorage.getAttendanceRecords());
              }}
              activeUser={activeUser}
              staffAccounts={staffAccounts}
              profile={profile}
              currentBranch={currentBranch}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryHppView
              rawMaterials={branchRawMaterials}
              menuItems={menuItems}
              branches={branches}
              onUpdateRawMaterial={(mat) => {
                DBStorage.updateRawMaterial(mat);
                setRawMaterials(DBStorage.getRawMaterials());
              }}
              onUpdateMenuItem={(menu) => {
                DBStorage.saveMenuItem(menu);
                setMenuItems(DBStorage.getMenuItems());
              }}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsExportView
              orders={branchOrders}
              menuItems={menuItems}
              currentShift={currentShift}
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
              onSaveStaff={(staff) => {
                const updated = DBStorage.saveStaff(staff);
                setStaffAccounts(updated);
              }}
              accessControl={accessControl}
              onSaveAccessControl={(rules) => {
                DBStorage.saveAccessControl(rules);
                setAccessControl(rules);
              }}
              condimentGroups={condimentGroups}
              onSaveCondimentGroup={handleSaveCondimentGroup}
              onToggleGroupActive={handleToggleGroupActive}
              onToggleOptionAvailable={handleToggleOptionAvailable}
              onClearTransactions={() => {
                DBStorage.saveOrders([]);
                setOrders([]);
              }}
              onFactoryReset={() => {
                localStorage.clear();
                window.location.reload();
              }}
            />
          )}
          </Suspense>
        </main>
      </div>

      {/* Global Modals */}
      <PinAuthModal
        isOpen={isPinModalOpen}
        onClose={() => {
          if (isTerminalUnlocked) setIsPinModalOpen(false);
        }}
        canClose={isTerminalUnlocked}
        onSuccessLogin={(user, selectedBranch) => {
          setIsTerminalUnlocked(true);
          setActiveUser(user);
          DBStorage.setActiveUser(user);
          if (selectedBranch) {
            setCurrentBranch(selectedBranch);
          }

          const rule = accessControl.find((item) => item.role === user.role);
          if (!rule) {
            showPushToast('Akses Belum Diatur', `Role ${user.role} belum memiliki matriks akses.`);
            return;
          }
          const destination = getDefaultAccessDestination(rule);
          if (!destination.tab) {
            showPushToast('Akses Ditolak', `Role ${user.role} belum diberi akses ke modul apa pun.`);
            setIsPinModalOpen(true);
            return;
          }
          setSystemPortal(destination.portal);
          setActiveTab(destination.tab);
          showPushToast('Akses Berhasil', `${user.name} masuk sebagai ${user.role}. Hak menu diterapkan otomatis.`);
        }}
        activeUser={activeUser}
        branches={branches}
        currentBranch={currentBranch}
        onSelectBranch={(b) => setCurrentBranch(b)}
        onOpenSelfOrderDemo={() => setIsSelfOrderModalOpen(true)}
        staffAccounts={staffAccounts}
      />

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
        onToggleSelfOrder={handleToggleTableSelfOrder}
        onClearTableStatus={handleClearTableStatus}
        onSetTableOccupied={handleSetTableOccupied}
        onToggleAllSelfOrder={handleToggleAllTables}
        onResetAllTablesToFree={handleResetAllTablesToFree}
        onAddNewTable={handleAddNewTable}
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
