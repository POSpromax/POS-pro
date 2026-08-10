import {
  Order,
  MenuItem,
  RawMaterial,
  RestaurantTable,
  Shift,
  ExpenseIncomeRecord,
  AttendanceRecord,
  PrinterConfig,
  RestaurantProfile,
  UserAccount,
  CondimentGroup,
  Branch,
  PinVerificationResult,
  AccessControlRule
} from '../types/pos';
import {
  INITIAL_MENU_ITEMS,
  INITIAL_RAW_MATERIALS,
  INITIAL_TABLES,
  INITIAL_RESTAURANT_PROFILE,
  INITIAL_CURRENT_SHIFT,
  INITIAL_STAFF,
  INITIAL_CONDIMENT_GROUPS,
  INITIAL_BRANCHES,
  INITIAL_ACCESS_CONTROL
} from '../data/initialData';
import { cloudReadiness } from '../lib/runtimeEnv';

export const STORAGE_KEYS = {
  ORDERS: 'nusantara_pos_orders',
  MENU: 'nusantara_pos_menu',
  RAW_MATERIALS: 'nusantara_pos_raw_materials',
  TABLES: 'nusantara_pos_tables',
  CURRENT_SHIFT: 'nusantara_pos_current_shift',
  SHIFT_HISTORY: 'nusantara_pos_shift_history',
  EXPENSES: 'nusantara_pos_expenses',
  ATTENDANCE: 'nusantara_pos_attendance',
  PRINTER: 'nusantara_pos_printer',
  PROFILE: 'nusantara_pos_profile',
  OFFLINE_QUEUE: 'nusantara_pos_offline_queue',
  ACTIVE_USER: 'nusantara_pos_active_user',
  CONDIMENTS: 'nusantara_pos_condiments',
  BRANCHES: 'nusantara_pos_branches',
  STAFF: 'nusantara_pos_staff',
  AUTH_SECURITY: 'nusantara_pos_auth_security',
  ACCESS_CONTROL: 'nusantara_pos_access_control',
  DATA_VERSION: 'nusantara_pos_data_version'
};

const CURRENT_DATA_VERSION = 6;
const DEMO_ORDER_IDS = new Set(['ord-038', 'ord-037', 'ord-036', 'ord-035']);
const LEGACY_BRANCH_ID_MAP: Record<string, string> = {
  'br-1': '00000000-0000-4000-a000-000000000010',
  'br-2': '00000000-0000-4000-a000-000000000020'
};

const migrateBranchId = (branchId?: string): string | undefined =>
  branchId ? (LEGACY_BRANCH_ID_MAP[branchId] || branchId) : branchId;

const createEmptyShift = (): Shift => ({
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
  status: 'CLOSED'
});

const posBroadcastChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('pos_pro_sync_channel')
    : null;

let supabaseSyncChannel: any = null;

if (typeof window !== 'undefined' && cloudReadiness.supabase) {
  import('../lib/supabase')
    .then(({ getSupabase }) => {
      try {
        const supabase = getSupabase();
        supabaseSyncChannel = supabase.channel('pos_cloud_sync_realtime');
        supabaseSyncChannel
          .on('broadcast', { event: 'pos_sync' }, (payload: any) => {
            if (payload.payload?.key && payload.payload?.value !== undefined) {
              const { key, value } = payload.payload;
              try {
                localStorage.setItem(key, JSON.stringify(value));
                window.dispatchEvent(new CustomEvent('pos_data_changed', { detail: { key, value } }));
              } catch {
                // Ignore parse errors
              }
            }
          })
          .subscribe();
      } catch {
        // Fallback silently if Supabase client fails to connect
      }
    })
    .catch(() => {});
}

// Helper to get item from localStorage or default
function getStoredItem<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.warn(`Error reading localStorage key "${key}":`, e);
    return defaultValue;
  }
}

// Keys that require cloud real-time broadcast across different devices/origins
const CRITICAL_CLOUD_SYNC_KEYS = new Set([
  STORAGE_KEYS.CURRENT_SHIFT,
  STORAGE_KEYS.ORDERS,
  STORAGE_KEYS.EXPENSES,
  STORAGE_KEYS.TABLES,
  STORAGE_KEYS.STAFF,
  STORAGE_KEYS.MENU,
  STORAGE_KEYS.RAW_MATERIALS
]);

const cloudBroadcastDebounceMap = new Map<string, number>();

function setStoredItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));

    if (typeof window !== 'undefined') {
      // 1. Instant Local Tab/Window Sync (100% Free - 0 Supabase CPU)
      window.dispatchEvent(new CustomEvent('pos_data_changed', { detail: { key, value } }));
      posBroadcastChannel?.postMessage({ key, value, timestamp: Date.now() });

      // 2. Selective Cloud Broadcast (Only for Critical Events with 1.5s Throttling to protect Free Tier Quota)
      if (supabaseSyncChannel && cloudReadiness.supabase && CRITICAL_CLOUD_SYNC_KEYS.has(key)) {
        const lastSent = cloudBroadcastDebounceMap.get(key) || 0;
        const now = Date.now();
        if (now - lastSent > 1500) {
          cloudBroadcastDebounceMap.set(key, now);
          supabaseSyncChannel
            .send({
              type: 'broadcast',
              event: 'pos_sync',
              payload: { key, value, timestamp: now }
            })
            .catch(() => {});
        }
      }
    }
  } catch (e) {
    console.error(`Error saving localStorage key "${key}":`, e);
  }
}

export class DBStorage {
  // Initialize default data if empty
  static initDefaults(): void {
    if (!localStorage.getItem(STORAGE_KEYS.MENU)) {
      setStoredItem(STORAGE_KEYS.MENU, INITIAL_MENU_ITEMS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.RAW_MATERIALS)) {
      setStoredItem(STORAGE_KEYS.RAW_MATERIALS, INITIAL_RAW_MATERIALS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TABLES)) {
      setStoredItem(STORAGE_KEYS.TABLES, INITIAL_TABLES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_SHIFT)) {
      setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, createEmptyShift());
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      setStoredItem(STORAGE_KEYS.ORDERS, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROFILE)) {
      setStoredItem(STORAGE_KEYS.PROFILE, INITIAL_RESTAURANT_PROFILE);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_USER)) {
      setStoredItem(STORAGE_KEYS.ACTIVE_USER, INITIAL_STAFF[1]); // Default to Citra (Kasir)
    }
    if (!localStorage.getItem(STORAGE_KEYS.CONDIMENTS)) {
      setStoredItem(STORAGE_KEYS.CONDIMENTS, INITIAL_CONDIMENT_GROUPS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.BRANCHES)) {
      setStoredItem(STORAGE_KEYS.BRANCHES, INITIAL_BRANCHES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACCESS_CONTROL)) {
      setStoredItem(STORAGE_KEYS.ACCESS_CONTROL, INITIAL_ACCESS_CONTROL);
    }
    const storedStaff = getStoredItem<UserAccount[]>(STORAGE_KEYS.STAFF, INITIAL_STAFF);
    const migratedStaff = storedStaff.map((staff) => ({
      ...staff,
      branchIds: staff.branchIds?.length ? staff.branchIds : ['00000000-0000-4000-a000-000000000010'],
      isActive: staff.isActive !== false
    }));
    setStoredItem(STORAGE_KEYS.STAFF, migratedStaff);

    const migratedTables = this.getTables().map((table) => ({
      ...table,
      branchId: table.branchId || '00000000-0000-4000-a000-000000000010'
    }));
    setStoredItem(STORAGE_KEYS.TABLES, migratedTables);

    // One-time cleanup for prototype records that must never appear as live sales.
    const dataVersion = Number(localStorage.getItem(STORAGE_KEYS.DATA_VERSION) || 0);
    if (dataVersion < CURRENT_DATA_VERSION) {
      setStoredItem(STORAGE_KEYS.ORDERS, []);
      setStoredItem(STORAGE_KEYS.EXPENSES, []);
      setStoredItem(STORAGE_KEYS.ATTENDANCE, []);
      setStoredItem(STORAGE_KEYS.OFFLINE_QUEUE, []);
      setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, createEmptyShift());

      const cleanTables = getStoredItem<RestaurantTable[]>(STORAGE_KEYS.TABLES, INITIAL_TABLES).map((table) => ({
        ...table,
        branchId: migrateBranchId(table.branchId) || '00000000-0000-4000-a000-000000000010',
        status: 'FREE' as const,
        activeOrderId: undefined,
        isSelfOrderEnabled: true
      }));
      setStoredItem(STORAGE_KEYS.TABLES, cleanTables);

      const migratedMaterials = getStoredItem<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, INITIAL_RAW_MATERIALS)
        .map((material) => ({ ...material, branchId: migrateBranchId(material.branchId) || material.branchId }));
      setStoredItem(STORAGE_KEYS.RAW_MATERIALS, migratedMaterials);

      const migratedStaff = getStoredItem<UserAccount[]>(STORAGE_KEYS.STAFF, INITIAL_STAFF).map((staff) => ({
        ...staff,
        branchIds: (staff.branchIds || []).map((branchId) => migrateBranchId(branchId) || branchId)
      }));
      setStoredItem(STORAGE_KEYS.STAFF, migratedStaff);

      const customBranches = getStoredItem<Branch[]>(STORAGE_KEYS.BRANCHES, [])
        .filter((branch) => !['br-1', 'br-2', 'br-3'].includes(branch.id))
        .filter((branch) => !INITIAL_BRANCHES.some((initial) => initial.id === branch.id));
      setStoredItem(STORAGE_KEYS.BRANCHES, [...INITIAL_BRANCHES, ...customBranches]);

      localStorage.setItem(STORAGE_KEYS.DATA_VERSION, String(CURRENT_DATA_VERSION));
    }
  }

  // Branches / Outlets
  static getBranches(): Branch[] {
    return getStoredItem<Branch[]>(STORAGE_KEYS.BRANCHES, INITIAL_BRANCHES);
  }

  static saveBranch(branch: Branch): Branch[] {
    const branches = this.getBranches();
    const idx = branches.findIndex((b) => b.id === branch.id);
    if (idx >= 0) {
      branches[idx] = branch;
    } else {
      branches.push(branch);
    }
    setStoredItem(STORAGE_KEYS.BRANCHES, branches);
    return branches;
  }

  static getCondimentGroups(): CondimentGroup[] {
    const groups = getStoredItem<CondimentGroup[]>(STORAGE_KEYS.CONDIMENTS, INITIAL_CONDIMENT_GROUPS);
    let updated = false;
    groups.forEach((g) => {
      if (g.id === 'cg-3' && (!g.targetProductNames || g.targetCategories?.includes('MINUMAN'))) {
        g.targetProductNames = ['Teh Manis', 'Teh'];
        g.targetCategories = ['BUNDLING'];
        updated = true;
      }
      if (g.id === 'cg-4' && !g.targetProductNames) {
        g.targetProductNames = ['Air Mineral'];
        g.targetCategories = undefined;
        updated = true;
      }
      if (g.id === 'cg-5' && g.targetCategories?.includes('ALL')) {
        g.targetCategories = ['BAKSO', 'MIE AYAM', 'MAKANAN', 'TAMBAHAN'];
        updated = true;
      }
    });
    if (updated) {
      setStoredItem(STORAGE_KEYS.CONDIMENTS, groups);
    }
    return groups;
  }

  static saveCondimentGroup(group: CondimentGroup): void {
    const groups = this.getCondimentGroups();
    const idx = groups.findIndex((g) => g.id === group.id);
    if (idx >= 0) groups[idx] = group;
    else groups.push(group);
    setStoredItem(STORAGE_KEYS.CONDIMENTS, groups);
  }

  static setCondimentGroups(groups: CondimentGroup[]): void {
    setStoredItem(STORAGE_KEYS.CONDIMENTS, groups);
  }

  static toggleCondimentGroupActive(groupId: string, isActive: boolean): void {
    const groups = this.getCondimentGroups();
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      group.isActive = isActive;
      setStoredItem(STORAGE_KEYS.CONDIMENTS, groups);
    }
  }

  static toggleCondimentOptionAvailable(groupId: string, optionId: string, isAvailable: boolean): void {
    const groups = this.getCondimentGroups();
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      const opt = group.options.find((o) => o.id === optionId);
      if (opt) {
        opt.isAvailable = isAvailable;
        setStoredItem(STORAGE_KEYS.CONDIMENTS, groups);
      }
    }
  }

  // Active User
  static getActiveUser(): UserAccount {
    return getStoredItem<UserAccount>(STORAGE_KEYS.ACTIVE_USER, INITIAL_STAFF[1]);
  }

  static setActiveUser(user: UserAccount): void {
    setStoredItem(STORAGE_KEYS.ACTIVE_USER, user);
  }

  static getStaff(): UserAccount[] {
    return getStoredItem<UserAccount[]>(STORAGE_KEYS.STAFF, INITIAL_STAFF);
  }

  static saveStaff(user: UserAccount): UserAccount[] {
    const staff = this.getStaff();
    const index = staff.findIndex((item) => item.id === user.id);
    if (index >= 0) staff[index] = user;
    else staff.push(user);
    setStoredItem(STORAGE_KEYS.STAFF, staff);
    return staff;
  }

  static deleteStaff(id: string): UserAccount[] {
    const staff = this.getStaff().filter((item) => item.id !== id);
    setStoredItem(STORAGE_KEYS.STAFF, staff);
    return staff;
  }

  static getAccessControl(): AccessControlRule[] {
    const stored = getStoredItem<AccessControlRule[]>(STORAGE_KEYS.ACCESS_CONTROL, INITIAL_ACCESS_CONTROL);
    return INITIAL_ACCESS_CONTROL.map((fallback) => stored.find((rule) => rule.role === fallback.role) || fallback);
  }

  static saveAccessControl(rules: AccessControlRule[]): void {
    setStoredItem(STORAGE_KEYS.ACCESS_CONTROL, rules);
  }

  static authenticateByPin(branchId: string, pin: string): PinVerificationResult {
    const profile = this.getProfile();
    const maxAttempts = profile.maxPinAttempts || 5;
    const lockoutMinutes = profile.pinLockoutMinutes || 5;
    const security = getStoredItem<Record<string, { failedAttempts: number; lockedUntil?: string }>>(
      STORAGE_KEYS.AUTH_SECURITY,
      {}
    );
    const gateKey = `branch-gate:${branchId}`;
    const gateState = security[gateKey] || { failedAttempts: 0 };
    if (gateState.lockedUntil && new Date(gateState.lockedUntil).getTime() > Date.now()) {
      return {
        success: false,
        message: 'Terminal dikunci sementara karena terlalu banyak percobaan.',
        lockedUntil: gateState.lockedUntil,
        remainingAttempts: 0
      };
    }

    const eligible = this.getStaff().filter(
      (user) => user.isActive !== false && (!user.branchIds?.length || user.branchIds.includes(branchId))
    );
    const matched = eligible.find((user) => user.pin === pin);
    if (!matched) {
      const failedAttempts = gateState.failedAttempts + 1;
      if (failedAttempts >= maxAttempts) {
        const lockedUntil = new Date(Date.now() + lockoutMinutes * 60_000).toISOString();
        security[gateKey] = { failedAttempts, lockedUntil };
        setStoredItem(STORAGE_KEYS.AUTH_SECURITY, security);
        return { success: false, message: `Terminal dikunci selama ${lockoutMinutes} menit.`, lockedUntil, remainingAttempts: 0 };
      }
      security[gateKey] = { failedAttempts };
      setStoredItem(STORAGE_KEYS.AUTH_SECURITY, security);
      return {
        success: false,
        message: 'PIN tidak valid atau tidak memiliki akses ke outlet ini.',
        remainingAttempts: maxAttempts - failedAttempts
      };
    }
    const result = this.authenticateUser(matched.id, pin);
    if (result.success) {
      security[gateKey] = { failedAttempts: 0 };
      setStoredItem(STORAGE_KEYS.AUTH_SECURITY, security);
    }
    return result;
  }

  static authenticateUser(userId: string, pin: string): PinVerificationResult {
    const profile = this.getProfile();
    const maxAttempts = profile.maxPinAttempts || 5;
    const lockoutMinutes = profile.pinLockoutMinutes || 5;
    const security = getStoredItem<Record<string, { failedAttempts: number; lockedUntil?: string }>>(
      STORAGE_KEYS.AUTH_SECURITY,
      {}
    );
    const user = this.getStaff().find((item) => item.id === userId && item.isActive !== false);
    if (!user) return { success: false, message: 'Akun tidak aktif atau tidak ditemukan.' };

    const state = security[userId] || { failedAttempts: 0 };
    if (state.lockedUntil && new Date(state.lockedUntil).getTime() > Date.now()) {
      return {
        success: false,
        message: 'Akun dikunci sementara karena terlalu banyak percobaan.',
        lockedUntil: state.lockedUntil,
        remainingAttempts: 0
      };
    }

    if (user.pin === pin) {
      security[userId] = { failedAttempts: 0 };
      setStoredItem(STORAGE_KEYS.AUTH_SECURITY, security);
      return { success: true, user, message: 'Verifikasi berhasil.' };
    }

    const failedAttempts = state.failedAttempts + 1;
    if (failedAttempts >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockoutMinutes * 60_000).toISOString();
      security[userId] = { failedAttempts, lockedUntil };
      setStoredItem(STORAGE_KEYS.AUTH_SECURITY, security);
      return {
        success: false,
        message: `Akun dikunci selama ${lockoutMinutes} menit.`,
        lockedUntil,
        remainingAttempts: 0
      };
    }

    security[userId] = { failedAttempts };
    setStoredItem(STORAGE_KEYS.AUTH_SECURITY, security);
    return {
      success: false,
      message: 'PIN tidak sesuai.',
      remainingAttempts: Math.max(0, maxAttempts - failedAttempts)
    };
  }

  // Orders
  static getOrders(): Order[] {
    return getStoredItem<Order[]>(STORAGE_KEYS.ORDERS, []);
  }

  static clearAllOrders(): void {
    setStoredItem(STORAGE_KEYS.ORDERS, []);
  }

  static saveOrders(orders: Order[]): void {
    setStoredItem(STORAGE_KEYS.ORDERS, orders);
  }

  static saveOrder(newOrder: Order, isOnline: boolean = true): Order {
    const orders = this.getOrders();
    const existingIndex = orders.findIndex((o) => o.id === newOrder.id);

    // Auto deduct inventory recipe upon payment/new order
    if (newOrder.paymentStatus === 'PAID') {
      this.deductInventoryForOrder(newOrder);
    }

    // Keep table occupancy aligned with the latest operational order state.
    if (newOrder.tableNumber && newOrder.tableNumber !== '-') {
      const isFinished = newOrder.paymentStatus === 'PAID' || newOrder.status === 'COMPLETED' || newOrder.status === 'CANCELLED';
      const nextTableStatus: RestaurantTable['status'] = isFinished ? 'FREE' : 'OCCUPIED';
      this.updateTableStatus(
        newOrder.tableNumber,
        nextTableStatus,
        isFinished ? undefined : newOrder.id,
        newOrder.branchId
      );
    }

    if (!isOnline) {
      newOrder.isOfflineCreated = true;
      newOrder.syncStatus = 'PENDING';
      this.addToOfflineQueue({ type: 'SAVE_ORDER', payload: newOrder, timestamp: Date.now() });
    } else {
      newOrder.syncStatus = 'SYNCED';
    }

    if (existingIndex >= 0) {
      orders[existingIndex] = newOrder;
    } else {
      orders.unshift(newOrder);
    }

    setStoredItem(STORAGE_KEYS.ORDERS, orders);

    // Update Shift sales metrics
    this.updateShiftMetricsForOrder(newOrder);

    return newOrder;
  }

  static updateOrderStatus(orderId: string, status: Order['status']): Order | null {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      order.status = status;
      setStoredItem(STORAGE_KEYS.ORDERS, orders);
      return order;
    }
    return null;
  }

  // Inventory Auto Deduction for Recipe HPP
  static deductInventoryForOrder(order: Order): void {
    const rawMaterials = this.getRawMaterials();
    const menuItems = this.getMenuItems();

    order.items.forEach((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuId);
      if (menuItem && menuItem.ingredients) {
        menuItem.ingredients.forEach((ing) => {
          const raw = rawMaterials.find((r) => r.id === ing.rawMaterialId);
          if (raw) {
            const totalDeduction = ing.amountNeeded * item.quantity;
            raw.stockQuantity = Math.max(0, raw.stockQuantity - totalDeduction);
          }
        });
      }
    });

    setStoredItem(STORAGE_KEYS.RAW_MATERIALS, rawMaterials);
  }

  // Raw Materials
  static getRawMaterials(): RawMaterial[] {
    return getStoredItem<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, INITIAL_RAW_MATERIALS);
  }

  static updateRawMaterial(updated: RawMaterial): void {
    const list = this.getRawMaterials();
    const idx = list.findIndex((r) => r.id === updated.id);
    if (idx >= 0) list[idx] = updated;
    else list.push(updated);
    setStoredItem(STORAGE_KEYS.RAW_MATERIALS, list);
  }

  static deleteRawMaterial(id: string): void {
    const list = this.getRawMaterials().filter((r) => r.id !== id);
    setStoredItem(STORAGE_KEYS.RAW_MATERIALS, list);
  }

  // Menu Items
  static getMenuItems(): MenuItem[] {
    return getStoredItem<MenuItem[]>(STORAGE_KEYS.MENU, INITIAL_MENU_ITEMS);
  }

  static saveMenuItem(item: MenuItem): void {
    const list = this.getMenuItems();
    const idx = list.findIndex((m) => m.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    setStoredItem(STORAGE_KEYS.MENU, list);
  }

  static deleteMenuItem(id: string): void {
    const list = this.getMenuItems().filter((m) => m.id !== id);
    setStoredItem(STORAGE_KEYS.MENU, list);
  }

  static resetCatalogDefaults(): { menuItems: MenuItem[]; rawMaterials: RawMaterial[] } {
    setStoredItem(STORAGE_KEYS.MENU, INITIAL_MENU_ITEMS);
    setStoredItem(STORAGE_KEYS.RAW_MATERIALS, INITIAL_RAW_MATERIALS);
    return {
      menuItems: INITIAL_MENU_ITEMS,
      rawMaterials: INITIAL_RAW_MATERIALS
    };
  }

  // Tables
  static getTables(): RestaurantTable[] {
    const list = getStoredItem<RestaurantTable[]>(STORAGE_KEYS.TABLES, INITIAL_TABLES);
    return list.map((tbl) => ({
      ...tbl,
      number: (tbl.number || '').toString().trim().replace(/^0+(?=\d)/, '') || tbl.number
    }));
  }

  static setTables(tables: RestaurantTable[]): void {
    setStoredItem(STORAGE_KEYS.TABLES, tables);
  }

  static updateTableStatus(
    tableNumber: string,
    status: RestaurantTable['status'],
    activeOrderId?: string,
    branchId?: string
  ): void {
    const tables = this.getTables();
    const table = tables.find(
      (t) => t.number === tableNumber && (!branchId || !t.branchId || t.branchId === branchId)
    );
    if (table) {
      table.status = status;
      if (activeOrderId) table.activeOrderId = activeOrderId;
      if (status === 'FREE') table.activeOrderId = undefined;
      setStoredItem(STORAGE_KEYS.TABLES, tables);
    }
  }

  static toggleTableSelfOrder(tableNumber: string, enabled: boolean, branchId?: string): void {
    const tables = this.getTables();
    const table = tables.find(
      (t) => t.number === tableNumber && (!branchId || !t.branchId || t.branchId === branchId)
    );
    if (table) {
      table.isSelfOrderEnabled = enabled;
      setStoredItem(STORAGE_KEYS.TABLES, tables);
    }
  }

  // Shift & Cash Accounting
  static getCurrentShift(): Shift {
    return getStoredItem<Shift>(STORAGE_KEYS.CURRENT_SHIFT, createEmptyShift());
  }

  static updateShiftMetricsForOrder(order: Order): void {
    const shift = this.getCurrentShift();
    if (shift.status === 'OPEN') {
      shift.grossOmset += order.total;
      if (order.paymentMethod === 'CASH') {
        shift.cashSales += order.total;
      } else {
        shift.nonCashSales += order.total;
      }
      setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, shift);
    }
  }

  static addExpenseOrIncome(record: ExpenseIncomeRecord): void {
    const records = getStoredItem<ExpenseIncomeRecord[]>(STORAGE_KEYS.EXPENSES, []);
    records.unshift(record);
    setStoredItem(STORAGE_KEYS.EXPENSES, records);

    const shift = this.getCurrentShift();
    if (shift && shift.status === 'OPEN') {
      if (record.type === 'EXPENSE') {
        shift.totalExpense += record.amount;
      } else {
        shift.totalIncome += record.amount;
      }
      setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, shift);
    }
  }

  static getExpenseRecords(): ExpenseIncomeRecord[] {
    return getStoredItem<ExpenseIncomeRecord[]>(STORAGE_KEYS.EXPENSES, []);
  }

  static closeShift(closingNotes: string): Shift {
    const shift = this.getCurrentShift();
    shift.status = 'CLOSED';
    shift.endTime = new Date().toISOString();
    shift.notes = closingNotes;
    setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, shift);

    const history = getStoredItem<Shift[]>(STORAGE_KEYS.SHIFT_HISTORY, []);
    const updatedHistory = [shift, ...history.filter((s) => s.id !== shift.id)];
    setStoredItem(STORAGE_KEYS.SHIFT_HISTORY, updatedHistory);

    return shift;
  }

  static getShiftHistory(): Shift[] {
    return getStoredItem<Shift[]>(STORAGE_KEYS.SHIFT_HISTORY, []);
  }

  static openNewShift(
    staffName: string,
    staffRole: any,
    initialCash: number,
    branch?: Branch,
    staffId?: string,
    scheduledStart?: string,
    scheduledEnd?: string
  ): Shift {
    const newShift: Shift = {
      id: 'shf-' + Date.now().toString().slice(-4),
      staffId: staffId || 'usr-' + Date.now().toString().slice(-3),
      staffName,
      staffRole,
      branchId: branch?.id,
      branchName: branch?.name,
      scheduledStart,
      scheduledEnd,
      startTime: new Date().toISOString(),
      initialCash,
      grossOmset: 0,
      cashSales: 0,
      nonCashSales: 0,
      totalExpense: 0,
      totalIncome: 0,
      status: 'OPEN'
    };
    setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, newShift);
    return newShift;
  }

  // Attendance
  static getAttendanceRecords(branchId?: string): AttendanceRecord[] {
    const records = getStoredItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    return branchId ? records.filter((record) => !record.branchId || record.branchId === branchId) : records;
  }

  static saveAttendance(record: AttendanceRecord): void {
    const records = this.getAttendanceRecords();
    records.unshift(record);
    setStoredItem(STORAGE_KEYS.ATTENDANCE, records);
  }

  // Restaurant Profile & Printer Config
  static getProfile(): RestaurantProfile {
    return {
      ...INITIAL_RESTAURANT_PROFILE,
      ...getStoredItem<RestaurantProfile>(STORAGE_KEYS.PROFILE, INITIAL_RESTAURANT_PROFILE)
    };
  }

  static saveProfile(profile: RestaurantProfile): void {
    setStoredItem(STORAGE_KEYS.PROFILE, profile);
  }

  static getPrinterConfig(): PrinterConfig {
    return getStoredItem<PrinterConfig>(STORAGE_KEYS.PRINTER, {
      deviceName: 'Thermal Printer BT-58',
      paperSize: '58mm',
      autoPrintOnPayment: true,
      isConnected: false
    });
  }

  static savePrinterConfig(config: PrinterConfig): void {
    setStoredItem(STORAGE_KEYS.PRINTER, config);
  }

  // Offline Sync Queue
  static addToOfflineQueue(item: { type: string; payload: any; timestamp: number }): void {
    const queue = getStoredItem<any[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
    queue.push(item);
    setStoredItem(STORAGE_KEYS.OFFLINE_QUEUE, queue);
  }

  static getOfflineQueue(): any[] {
    return getStoredItem<any[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
  }

  static clearOfflineQueue(): void {
    setStoredItem(STORAGE_KEYS.OFFLINE_QUEUE, []);
    // Mark pending orders as synced
    const orders = this.getOrders();
    orders.forEach((o) => {
      o.syncStatus = 'SYNCED';
    });
    setStoredItem(STORAGE_KEYS.ORDERS, orders);
  }

  // Purge all prototype dummy transactions & test records for real-time trial
  static purgeDummyTrialData(): void {
    setStoredItem(STORAGE_KEYS.ORDERS, []);
    setStoredItem(STORAGE_KEYS.EXPENSES, []);
    setStoredItem(STORAGE_KEYS.ATTENDANCE, []);
    setStoredItem(STORAGE_KEYS.OFFLINE_QUEUE, []);

    const cleanTables = this.getTables().map((t) => ({
      ...t,
      status: 'FREE' as const,
      activeOrderId: undefined,
      isSelfOrderEnabled: true
    }));
    setStoredItem(STORAGE_KEYS.TABLES, cleanTables);

    setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, createEmptyShift());
  }

  // Real-time Event Subscription & Cross-Origin Broadcast
  static subscribeToSync(callback: (key: string, value: any) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleCustomEvent = (e: any) => {
      if (e.detail?.key) {
        callback(e.detail.key, e.detail.value);
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key) {
        try {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          callback(e.key, val);
        } catch {
          // ignore parse error
        }
      }
    };

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.key) {
        callback(e.data.key, e.data.value);
      }
    };

    window.addEventListener('pos_data_changed', handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);
    posBroadcastChannel?.addEventListener('message', handleBroadcast);

    return () => {
      window.removeEventListener('pos_data_changed', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
      posBroadcastChannel?.removeEventListener('message', handleBroadcast);
    };
  }

  static syncAllDataWithCloud(): void {
    if (typeof window === 'undefined') return;
    setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, this.getCurrentShift());
    setStoredItem(STORAGE_KEYS.ORDERS, this.getOrders());
    setStoredItem(STORAGE_KEYS.EXPENSES, this.getExpenseRecords());
    setStoredItem(STORAGE_KEYS.TABLES, this.getTables());
  }
}
