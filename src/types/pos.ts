/**
 * Nusantara POS & Resto Types
 */

export type UserRole = 'SUPER_OWNER' | 'OWNER' | 'MANAGER' | 'KASIR' | 'ADMIN' | 'KITCHEN';

export interface UserAccount {
  id: string;
  name: string;
  pin: string;
  role: UserRole;
  avatar?: string;
  branchIds?: string[];
  isActive?: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  workDays?: number[];
  permissions?: Partial<AccessControlRule>;
  // ── Data Karyawan Lengkap ────────────────────────────────
  phone?: string;           // No. HP/WhatsApp (format Indonesia, misal: 08123456789)
  fullNameKtp?: string;     // Nama lengkap sesuai KTP
  nik?: string;             // NIK 16 digit
  birthPlace?: string;      // Tempat lahir
  birthDate?: string;       // Tanggal lahir (ISO date: YYYY-MM-DD)
  address?: string;         // Alamat sesuai KTP
  joinDate?: string;        // Tanggal mulai bekerja (ISO date: YYYY-MM-DD)
}

export interface PinVerificationResult {
  success: boolean;
  user?: UserAccount;
  message: string;
  remainingAttempts?: number;
  lockedUntil?: string;
}

export type CategoryType = 'ALL' | 'BAKSO' | 'MIE AYAM' | 'MAKANAN' | 'TAMBAHAN' | 'KRIUK' | 'MINUMAN' | 'BUNDLING';

export interface RecipeIngredient {
  rawMaterialId: string;
  rawMaterialName: string;
  amountNeeded: number; // e.g. 150 (grams) or 1 (pcs)
  unit: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: CategoryType;
  price: number;
  image: string;
  description?: string;
  hppCost: number; // Cost of goods sold calculated from recipe
  ingredients: RecipeIngredient[];
  isAvailable: boolean;
  stockCount?: number; // Calculated or manual
  isAutoStock?: boolean; // Gunakan Resep (Auto-Stock)
  trackStock?: boolean; // false untuk item jasa/manual yang tidak memotong stok
  isManualPrice?: boolean; // POS meminta nama, harga, dan keterangan saat item dipilih
  isSticky?: boolean; // Item permanen/sistem yang tidak bisa dihapus dari inventori
}

export type MaterialGroup = 'MENU' | 'DAPUR' | 'KEMASAN';

export interface RawMaterial {
  id: string;
  name: string;
  unit: 'kg' | 'gram' | 'pcs' | 'liter' | 'pack';
  stockQuantity: number;
  minStockThreshold: number;
  costPerUnit: number; // In IDR
  branchId: string;
  branchName: string;
  group?: MaterialGroup;
  // KEMASAN only: dipotong otomatis sejumlah ini per item pesanan take-away.
  takeAwayUsagePerItem?: number;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  isMainBranch?: boolean;
  code?: string;
  isHeadquarters?: boolean;
  managerName?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsRadiusMeters?: number;
}

export interface BranchOperationalConfig {
  branchId: string;
  tenantId?: string;
  selfOrderEnabled: boolean;
  selfOrderBaseUrl: string;
  publicOrderSlug?: string;
  profileOverrides?: Partial<RestaurantProfile>;
}

// FREE dipertahankan untuk membaca cache/data lama. Alur baru memakai
// DISABLED -> READY -> OCCUPIED -> DISABLED.
export type TableStatus = 'FREE' | 'DISABLED' | 'READY' | 'OCCUPIED' | 'RESERVED';

export interface RestaurantTable {
  id: string;
  number: string; // e.g. "1", "2", "VIP-1"
  capacity: number;
  status: TableStatus;
  isSelfOrderEnabled: boolean; // Turn on/off customer QR order per table
  activeOrderId?: string;
  branchId?: string;
}

export interface CondimentOption {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean; // Toggle Aktif / Non-Aktif
}

export interface CondimentGroup {
  id: string;
  name: string; // e.g., "Kuah", "ISIAN", "TEH MANIS", "AIR MINERAL", "Tambahan"
  mode: 'ADD_ON' | 'PAKET';
  required?: boolean; // e.g. *WAJIB
  isRequired?: boolean;
  minSelect?: number;
  maxSelect?: number;
  targetCategory?: CategoryType;
  targetCategories?: CategoryType[];
  targetProductIds?: string[];
  targetProductNames?: string[];
  options: CondimentOption[];
  isActive: boolean; // Toggle Aktif / Non-Aktif
  // Label ringkas di KDS saat semua opsi dipilih, mis. "CAMPUR". Kosong = tampilkan daftar penuh.
  allSelectedLabel?: string;
}

export interface SelectedCondimentGroup {
  groupName: string;
  options: string[];
}

export interface OrderItem {
  id: string;
  menuId: string;
  menuName: string;
  price: number;
  quantity: number;
  category: CategoryType;
  notes?: string;
  status?: 'PENDING' | 'PREPARING' | 'DONE';
  selectedCondiments?: SelectedCondimentGroup[];
}

export type OrderType = 'DINE_IN' | 'TAKE_AWAY';
export type PaymentMethod = 'CASH' | 'QRIS' | 'DEBIT';
export type OrderStatus = 'NEW' | 'COOKING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface Order {
  id: string;
  orderNumber: string; // Identitas unik penuh, mis. "POS-MSNWCM6VFDL"
  dailyNumber?: number; // Nomor antrean harian per cabang, untuk ditampilkan
  customerName: string;
  notes?: string;
  tableNumber: string;
  type: OrderType;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod?: PaymentMethod;
  paymentStatus: 'UNPAID' | 'PAID';
  cashPaid?: number;
  change?: number;
  status: OrderStatus;
  createdAt: string; // ISO String
  shiftId: string;
  createdShiftId?: string;
  paidShiftId?: string;
  completedShiftId?: string;
  branchId: string;
  cashierName: string;
  isOfflineCreated?: boolean;
  syncStatus?: 'SYNCED' | 'PENDING';
  source?: 'POS' | 'SELF_ORDER';
  parentOrderId?: string;
}

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: UserRole;
  startTime: string;
  endTime?: string;
  initialCash: number;
  grossOmset: number;
  cashSales: number;
  nonCashSales: number;
  totalExpense: number;
  totalIncome: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  branchId?: string;
  branchName?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface ExpenseIncomeRecord {
  id: string;
  shiftId: string;
  type: 'EXPENSE' | 'INCOME';
  amount: number;
  description: string;
  timestamp: string;
  recordedBy: string;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  role: UserRole;
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  timestamp: string;
  photoUrl?: string;
  photoPublicId?: string;
  requestId?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  distanceMeters?: number;
  location: string;
  status: 'ON_TIME' | 'LATE';
  branchId?: string;
  branchName?: string;
  scheduledStart?: string;
  minutesLate?: number;
  verificationMethod?: 'PIN' | 'PIN_GPS' | 'PIN_GPS_SELFIE';
  gpsValidated?: boolean;
  selfieValidated?: boolean;
}

export interface PrinterConfig {
  deviceName: string;
  paperSize: '58mm' | '80mm';
  autoPrintOnPayment: boolean;
  isConnected: boolean;
  bluetoothAddress?: string;
}

export interface RestaurantProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  instagram: string;
  tiktok: string;
  logoUrl: string;
  
  // Landing Page Config
  promoBannerTitle?: string;
  promoBannerDescription?: string;
  wallpaperBackgroundUrl?: string;
  googleReviewUrl?: string;
  googleReviewText?: string;

  // Dapur & KDS Config
  orderTimeLimitMinutes?: number;
  soundNotificationsEnabled?: boolean;
  soundOrderBaru?: string;
  soundPesananMasuk?: string;
  soundPembayaranSukses?: string;
  soundWarning?: string;
  soundHighAlarm?: string;
  soundCustomerOrder?: string;
  runningText?: string;

  // Karyawan & Shift Config
  shiftScheduleKitchen?: string;
  shiftScheduleCashier?: string;
  shiftScheduleStaff?: string;
  shiftScheduleAdmin?: string;
  latenessToleranceMinutes?: number;

  // GPS & Absensi Config
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsRadiusMeters?: number;
  requireSelfiePhoto?: boolean;
  requireGpsActive?: boolean;
  isAttendanceEnabled?: boolean;
  isSelfOrderEnabled?: boolean;
  weeklyOffDays?: number[];
  weeklyOffNotice?: string;
  maxPinAttempts?: number;
  pinLockoutMinutes?: number;
  allowedSelfOrderTables?: string;

  // Terminal Kasir Config
  confirmBeforeSaveOrder?: boolean;
  confirmBeforePayment?: boolean;

  // Keuangan Config
  taxRatePercent: number;
  isTaxEnabled?: boolean;
  serviceChargePercent: number;
  isServiceChargeEnabled?: boolean;
  isManualDiscountEnabled?: boolean;
  roundingMode?: 'TERDEKAT' | 'KEATAS' | 'KEBAWAH';
  isRoundingEnabled?: boolean;
}

export interface AccessControlRule {
  role: UserRole;
  canAccessPOS: boolean;
  canAccessKDS: boolean;
  canAccessShift: boolean;
  canAccessInventory: boolean;
  canAccessAnalytics: boolean;
  canAccessSettings: boolean;
  canVoidOrder: boolean;
  canAccessAttendance?: boolean;
  canGiveDiscount?: boolean;
  canOpenDrawer?: boolean;
}
