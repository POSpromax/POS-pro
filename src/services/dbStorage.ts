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
import { resolveMaterialGroup } from '../utils/materialGroup';
import { normalizeBranchId } from '../utils/branchId';

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
const migrateBranchId = (branchId?: string): string | undefined =>
  branchId ? normalizeBranchId(branchId) : branchId;

const createEmptyShift = (branchId?: string): Shift => ({
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
  branchId
});

// Data lintas perangkat tidak pernah disinkronkan melalui localStorage.
// Supabase/database adalah sumber kebenaran untuk data operasional cloud.

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

function setStoredItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
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

    const existingTables = this.getTables();
    const migratedTables = existingTables.map((table) => ({
      ...table,
      branchId: table.branchId || '00000000-0000-4000-a000-000000000010'
    }));
    const existingIds = new Set(migratedTables.map((t) => t.id));
    const newTables = INITIAL_TABLES.filter((t) => !existingIds.has(t.id));
    setStoredItem(STORAGE_KEYS.TABLES, [...migratedTables, ...newTables]);

    const existingMaterials = this.getRawMaterials().map((material) => ({
      ...material,
      group: material.group || resolveMaterialGroup(material)
    }));
    const existingMaterialIds = new Set(existingMaterials.map((m) => m.id));
    const newMaterials = INITIAL_RAW_MATERIALS.filter((m) => !existingMaterialIds.has(m.id));
    setStoredItem(STORAGE_KEYS.RAW_MATERIALS, [...existingMaterials, ...newMaterials]);

    // One-time cleanup for prototype records that must never appear as live sales.
    const dataVersion = Number(localStorage.getItem(STORAGE_KEYS.DATA_VERSION) || 0);
    if (dataVersion < CURRENT_DATA_VERSION) {
      setStoredItem(STORAGE_KEYS.ORDERS, []);
      setStoredItem(STORAGE_KEYS.EXPENSES, []);
      setStoredItem(STORAGE_KEYS.ATTENDANCE, []);
      setStoredItem(STORAGE_KEYS.OFFLINE_QUEUE, []);
      // Preserve active open shift during migration — only reset if no shift exists or shift is already closed
      const existingShift = getStoredItem<Shift>(STORAGE_KEYS.CURRENT_SHIFT, createEmptyShift());
      if (existingShift.status !== 'OPEN') {
        setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, createEmptyShift());
      }

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
      const branches = getStoredItem<Branch[]>(STORAGE_KEYS.BRANCHES, INITIAL_BRANCHES);
      const migrated = branches.map((branch) => ({ ...branch, id: normalizeBranchId(branch.id) }));
      if (migrated.some((branch, index) => branch.id !== branches[index]?.id)) {
        setStoredItem(STORAGE_KEYS.BRANCHES, migrated);
      }
      return migrated;
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
      if (g.id === 'cg-2' && g.allSelectedLabel === undefined) {
        g.allSelectedLabel = 'CAMPUR';
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

  static clearTerminalLockout(branchId?: string): void {
    const security = getStoredItem<Record<string, { failedAttempts: number; lockedUntil?: string }>>(
      STORAGE_KEYS.AUTH_SECURITY,
      {}
    );
    if (branchId) {
      delete security[`branch-gate:${branchId}`];
    } else {
      Object.keys(security).forEach((k) => delete security[k]);
    }
    setStoredItem(STORAGE_KEYS.AUTH_SECURITY, security);
  }

  static saveStaff(user: UserAccount): UserAccount[] {
    const staff = this.getStaff();
    const index = staff.findIndex((item) => item.id === user.id);
    if (index >= 0) staff[index] = user;
    else staff.push(user);
    setStoredItem(STORAGE_KEYS.STAFF, staff);
    this.clearTerminalLockout();
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
    const eligible = this.getStaff().filter(
      (user) => user.isActive !== false && (!user.branchIds?.length || user.branchIds.includes(branchId))
    );
    const matched = eligible.find((user) => user.pin === pin);
    if (!matched) {
      return {
        success: false,
        message: 'PIN tidak valid atau tidak memiliki akses ke outlet ini.'
      };
    }
    return {
      success: true,
      user: matched,
      message: 'Verifikasi berhasil.'
    };
  }

  static authenticateUser(userId: string, pin: string): PinVerificationResult {
    const user = this.getStaff().find((item) => item.id === userId && item.isActive !== false);
    if (!user) return { success: false, message: 'Akun tidak aktif atau tidak ditemukan.' };
    if (user.pin !== pin) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' };
    }
    return { success: true, user, message: 'Verifikasi berhasil.' };
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
    const existingIndex = orders.findIndex(
      (o) => o.id === newOrder.id || (o.orderNumber && newOrder.orderNumber && o.orderNumber === newOrder.orderNumber)
    );

    // Deduct once only when an order crosses from unpaid to paid.
    if (newOrder.paymentStatus === 'PAID' && orders[existingIndex]?.paymentStatus !== 'PAID') {
      this.deductInventoryForOrder(newOrder);
    }

    // Keep table occupancy aligned with the latest operational order state.
    if (newOrder.tableNumber && newOrder.tableNumber !== '-') {
      const isFinished = newOrder.status === 'COMPLETED' || newOrder.status === 'CANCELLED';
      const nextTableStatus: RestaurantTable['status'] = isFinished ? 'DISABLED' : 'OCCUPIED';
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

    if (order.type === 'TAKE_AWAY') {
      const totalItemQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
      rawMaterials
        .filter((raw) => raw.branchId === order.branchId && resolveMaterialGroup(raw) === 'KEMASAN')
        .forEach((raw) => {
          const usage = (raw.takeAwayUsagePerItem ?? 1) * totalItemQty;
          raw.stockQuantity = Math.max(0, raw.stockQuantity - usage);
        });
    }

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
      if (status === 'FREE' || status === 'DISABLED') table.activeOrderId = undefined;
      setStoredItem(STORAGE_KEYS.TABLES, tables);
    }
  }

  static toggleTableSelfOrder(tableNumber: string, enabled: boolean, branchId?: string): void {
    const tables = this.getTables();
    const table = tables.find(
      (t) => t.number === tableNumber && (!branchId || !t.branchId || t.branchId === branchId)
    );
    if (table) {
      // Keep demo/local mode on the same invariant as cloud mode. An active bill
      // owns the table and cannot be disabled from the self-order switch.
      if (table.activeOrderId && !enabled) return;
      table.isSelfOrderEnabled = enabled;
      if (!table.activeOrderId) table.status = enabled ? 'READY' : 'DISABLED';
      setStoredItem(STORAGE_KEYS.TABLES, tables);
    }
  }

  // Shift & Cash Accounting
  static getCurrentShift(branchId?: string): Shift {
    const shift = getStoredItem<Shift>(STORAGE_KEYS.CURRENT_SHIFT, createEmptyShift(branchId));
    if (branchId && shift.branchId !== branchId) return createEmptyShift(branchId);
    return shift;
  }

  static setCurrentShift(shift: Shift): Shift {
    setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, shift);
    return shift;
  }

  static clearCurrentShift(branchId?: string): Shift {
    const emptyShift = createEmptyShift(branchId);
    setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, emptyShift);
    return emptyShift;
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

  static closeShift(closingNotes: string, shiftToClose?: Shift): Shift {
    const shift = { ...(shiftToClose || this.getCurrentShift()) };
    shift.status = 'CLOSED';
    shift.endTime = new Date().toISOString();
    shift.notes = closingNotes;

    // Recalculate metrics from raw order data as a safety net in case
    // cloud-sync race conditions have already zeroed the shift counters.
    const allOrders = this.getOrders();
    const shiftOrders = allOrders.filter(
      (o) => o.shiftId === shift.id && o.paymentStatus === 'PAID' && o.status !== 'CANCELLED'
    );
    if (shiftOrders.length > 0) {
      const calcGross = shiftOrders.reduce((s, o) => s + (o.subtotal || o.total), 0);
      const calcCash  = shiftOrders.filter((o) => o.paymentMethod === 'CASH' || !o.paymentMethod).reduce((s, o) => s + o.total, 0);
      const calcNonCash = shiftOrders.filter((o) => o.paymentMethod === 'QRIS' || o.paymentMethod === 'DEBIT').reduce((s, o) => s + o.total, 0);
      // Use calculated value if shift counter is zero but we have real orders
      if (shift.grossOmset === 0 && calcGross > 0)   shift.grossOmset   = calcGross;
      if (shift.cashSales === 0 && calcCash > 0)     shift.cashSales    = calcCash;
      if (shift.nonCashSales === 0 && calcNonCash > 0) shift.nonCashSales = calcNonCash;
    }

    // Recalculate expense/income from records if shift object shows 0
    const shiftExpenses = this.getExpenseRecords().filter((r) => r.shiftId === shift.id);
    if (shiftExpenses.length > 0) {
      const calcExp = shiftExpenses.filter((r) => r.type === 'EXPENSE').reduce((s, r) => s + r.amount, 0);
      const calcInc = shiftExpenses.filter((r) => r.type === 'INCOME').reduce((s, r) => s + r.amount, 0);
      if (shift.totalExpense === 0 && calcExp > 0) shift.totalExpense = calcExp;
      if (shift.totalIncome === 0 && calcInc > 0)  shift.totalIncome  = calcInc;
    }

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
    const stored = getStoredItem<PrinterConfig>(STORAGE_KEYS.PRINTER, {
      deviceName: 'Thermal Printer BT-58',
      paperSize: '58mm',
      autoPrintOnPayment: true,
      isConnected: false,
      transport: 'AUTO',
      chunkSize: 128,
      autoPrintKitchenOnNewOrder: false,
    });
    // Status koneksi GATT/SPP adalah state runtime dan selalu hilang ketika
    // browser/APK ditutup. Jangan menampilkan status hijau hanya karena nilai
    // tersebut pernah tersimpan pada sesi sebelumnya.
    return {
      ...stored,
      isConnected: false,
      transport: stored.transport || 'AUTO',
      chunkSize: stored.chunkSize || 128,
      autoPrintKitchenOnNewOrder: stored.autoPrintKitchenOnNewOrder ?? false,
    };
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
  }

  // Purge all prototype dummy transactions & test records for real-time trial
  static purgeDummyTrialData(): void {
    setStoredItem(STORAGE_KEYS.ORDERS, []);
    setStoredItem(STORAGE_KEYS.EXPENSES, []);
    setStoredItem(STORAGE_KEYS.ATTENDANCE, []);
    setStoredItem(STORAGE_KEYS.OFFLINE_QUEUE, []);

    const cleanTables = this.getTables().map((t) => ({
      ...t,
      status: 'DISABLED' as const,
      activeOrderId: undefined,
      isSelfOrderEnabled: true
    }));
    setStoredItem(STORAGE_KEYS.TABLES, cleanTables);

    setStoredItem(STORAGE_KEYS.CURRENT_SHIFT, createEmptyShift());
  }

}
