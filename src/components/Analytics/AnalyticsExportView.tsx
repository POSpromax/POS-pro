import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Download,
  Printer,
  PieChart,
  BarChart3,
  ArrowUpRight,
  Ban,
  Receipt,
  History,
  UserCheck,
  Flame,
  AlertTriangle,
  Layers,
  Search,
  Calendar,
  Percent,
  Utensils,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  ShoppingBag,
  WalletCards
} from 'lucide-react';
import { Order, MenuItem, Shift, AttendanceRecord, ExpenseIncomeRecord, RestaurantProfile, Branch, RawMaterial } from '../../types/pos';
import { DBStorage } from '../../services/dbStorage';
import { listStockMovements, STOCK_MOVEMENT_LABELS, type StockMovement } from '../../services/stockLedgerService';
import { ReportPeriod, REPORT_PERIODS, formatPeriodRange, getPeriodRange, isWithinPeriod } from '../../utils/reportPeriod';

interface AnalyticsExportViewProps {
  orders: Order[];
  menuItems: MenuItem[];
  rawMaterials?: RawMaterial[];
  currentShift: Shift;
  allShifts?: Shift[];
  attendanceRecords?: AttendanceRecord[];
  expenseRecords?: ExpenseIncomeRecord[];
  profile?: RestaurantProfile;
  branches?: Branch[];
  currentBranchId?: string;
  onPeriodRangeChange?: (from: string, to: string, branchId?: string) => void | Promise<void>;
}

type AnalyticsTab = 'OVERVIEW' | 'TOP_ITEMS' | 'VOID' | 'TAX_DISCOUNT' | 'SHIFT_HISTORY' | 'ATTENDANCE_HISTORY' | 'INVENTORY';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

interface PaginatedResult<T> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  visibleItems: T[];
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
}

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel: string;
}

const addCalendarDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addCalendarMonths = (date: Date, months: number): Date => new Date(date.getFullYear(), date.getMonth() + months, 1);

const startOfLocalDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const toLocalDateInput = (date: Date): string => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const isStaffEatingOrder = (order: Order): boolean => {
  const subtotal = Number(order.subtotal || 0);
  return subtotal > 0 && Number(order.discount || 0) >= subtotal;
};

const usePaginatedList = <T,>(items: T[], resetKey: string): PaginatedResult<T> => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const visibleItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page, pageSize]);

  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    startItem,
    endItem,
    visibleItems,
    setPage,
    setPageSize,
  };
};

const PaginationControls: React.FC<PaginationControlsProps> = ({
  page,
  pageSize,
  totalItems,
  totalPages,
  startItem,
  endItem,
  onPageChange,
  onPageSizeChange,
  itemLabel,
}) => (
  <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between"
    style={{ borderColor: 'var(--panel-border-light)' }}>
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
      <span>
        Menampilkan {startItem}-{endItem} dari {totalItems} {itemLabel}
      </span>
      <label className="flex items-center gap-2 rounded-full border px-3 py-1"
        style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)' }}>
        <span>Baris</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="bg-transparent text-[11px] font-bold outline-none"
          style={{ color: 'var(--text-primary)' }}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    </div>

    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
      >
        Sebelumnya
      </button>
      <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
        Halaman {page} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
      >
        Berikutnya
      </button>
    </div>
  </div>
);

export const AnalyticsExportView: React.FC<AnalyticsExportViewProps> = ({
  orders,
  menuItems,
  rawMaterials = [],
  currentShift,
  allShifts: propShifts,
  attendanceRecords: propAttendance,
  expenseRecords: propExpenses,
  profile: propProfile,
  branches = [],
  currentBranchId,
  onPeriodRangeChange,
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('OVERVIEW');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [inventoryMovementPage, setInventoryMovementPage] = useState(1);
  const [inventoryMovementPageSize, setInventoryMovementPageSize] = useState(50);
  const [inventoryMovements, setInventoryMovements] = useState<StockMovement[]>([]);
  const [inventoryMovementTotal, setInventoryMovementTotal] = useState(0);
  const [inventoryMovementLoading, setInventoryMovementLoading] = useState(false);
  const [inventoryMovementError, setInventoryMovementError] = useState('');
  const [reportRangeLoading, setReportRangeLoading] = useState(false);
  const [reportRefreshNonce, setReportRefreshNonce] = useState(0);
  const [lastReportLoadedAt, setLastReportLoadedAt] = useState<Date | null>(null);

  const [period, setPeriod] = useState<ReportPeriod>('TODAY');
  const todayInput = toLocalDateInput(new Date());
  const [customStartDate, setCustomStartDate] = useState(todayInput);
  const [customEndDate, setCustomEndDate] = useState(todayInput);
  // Filter cabang: default cabang aktif; 'ALL' = gabungan semua cabang.
  const [branchFilter, setBranchFilter] = useState<string>(currentBranchId || 'ALL');

  const allShifts = useMemo(() => propShifts || DBStorage.getShiftHistory(), [propShifts]);
  const allAttendances = useMemo(() => propAttendance || DBStorage.getAttendanceRecords(), [propAttendance]);
  const allExpenses = useMemo(() => propExpenses || DBStorage.getExpenseRecords(), [propExpenses]);
  const profile = useMemo(() => propProfile || DBStorage.getProfile(), [propProfile]);

  // Semua metrik di bawah membaca data yang sudah dipotong rentang waktu terpilih
  // dan cabang terpilih (atau gabungan semua cabang bila 'ALL').
  const periodRange = useMemo(() => {
    if (period !== 'CUSTOM') return getPeriodRange(period);
    const start = new Date(`${customStartDate}T00:00:00`);
    const endBase = new Date(`${customEndDate || customStartDate}T00:00:00`);
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(endBase.getTime()) ? safeStart : endBase;
    const orderedStart = safeStart <= safeEnd ? safeStart : safeEnd;
    const orderedEnd = safeStart <= safeEnd ? safeEnd : safeStart;
    return { start: orderedStart, end: addCalendarDays(orderedEnd, 1) };
  }, [customEndDate, customStartDate, period]);
  const branchScopedOrders = useMemo(
    () => (branchFilter === 'ALL' ? orders : orders.filter((o) => (o.branchId || currentBranchId) === branchFilter)),
    [orders, branchFilter, currentBranchId],
  );

  useEffect(() => {
    if (!onPeriodRangeChange) return;
    let active = true;
    setReportRangeLoading(true);
    void Promise.resolve(onPeriodRangeChange(periodRange.start.toISOString(), periodRange.end.toISOString(), branchFilter))
      .finally(() => {
        if (!active) return;
        setReportRangeLoading(false);
        setLastReportLoadedAt(new Date());
      });
    return () => { active = false; };
  }, [branchFilter, onPeriodRangeChange, periodRange.end, periodRange.start, reportRefreshNonce]);
  const scopedOrders = useMemo(() => branchScopedOrders.filter((o) => isWithinPeriod(o.createdAt, periodRange)), [branchScopedOrders, periodRange]);
  const shifts = useMemo(() => allShifts.filter((shift) => (
    isWithinPeriod(shift.startTime, periodRange)
    && (branchFilter === 'ALL' || (shift.branchId || currentBranchId) === branchFilter)
  )), [allShifts, branchFilter, currentBranchId, periodRange]);
  const attendances = useMemo(() => allAttendances.filter((attendance) => (
    isWithinPeriod(attendance.timestamp, periodRange)
    && (branchFilter === 'ALL' || (attendance.branchId || currentBranchId) === branchFilter)
  )), [allAttendances, branchFilter, currentBranchId, periodRange]);
  const expenses = useMemo(() => {
    const shiftBranch = new Map(allShifts.map((shift) => [shift.id, shift.branchId || currentBranchId]));
    return allExpenses.filter((expense) => (
      isWithinPeriod(expense.timestamp, periodRange)
      && (branchFilter === 'ALL' || shiftBranch.get(expense.shiftId) === branchFilter)
    ));
  }, [allExpenses, allShifts, branchFilter, currentBranchId, periodRange]);

  const settledOrders = useMemo(() => scopedOrders.filter((o) => o.paymentStatus === 'PAID' && o.status !== 'CANCELLED'), [scopedOrders]);
  const staffMealOrders = useMemo(() => settledOrders.filter(isStaffEatingOrder), [settledOrders]);
  // Staff eating adalah konsumsi internal, bukan transaksi penjualan. Pisahkan
  // agar struk, AOV, metode bayar, tren, dan peringkat menu tidak bias.
  const paidOrders = useMemo(() => settledOrders.filter((o) => !isStaffEatingOrder(o)), [settledOrders]);
  const unpaidOrders = useMemo(() => scopedOrders.filter((o) => o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED'), [scopedOrders]);
  const voidOrders = useMemo(() => scopedOrders.filter((o) => o.status === 'CANCELLED'), [scopedOrders]);

  const grossOmset = useMemo(() => paidOrders.reduce((acc, o) => acc + o.total, 0), [paidOrders]);
  const totalSubtotal = useMemo(() => paidOrders.reduce((acc, o) => acc + (o.subtotal || o.total), 0), [paidOrders]);
  const totalTax = useMemo(() => paidOrders.reduce((acc, o) => acc + (o.tax || 0), 0), [paidOrders]);
  const totalDiscount = useMemo(() => paidOrders.reduce((acc, o) => acc + (o.discount || 0), 0), [paidOrders]);

  // MAKAN STAFF: transaksi berdiskon 100% (potongan menutup seluruh subtotal).
  // Dikelompokkan per nama & per hari agar jatah harian (1 makanan + 1 minuman)
  // bisa dikontrol dari histori, sesuai cara kerja outlet.
  const STAFF_MEAL_FOOD_LIMIT = 1;
  const STAFF_MEAL_DRINK_LIMIT = 1;
  const staffMeals = useMemo(() => {
    const map = new Map<string, { name: string; date: string; food: number; drink: number; value: number; count: number }>();
    staffMealOrders.forEach((o) => {
      const date = new Date(o.createdAt).toISOString().slice(0, 10);
      const name = (o.customerName || 'Tanpa Nama').trim() || 'Tanpa Nama';
      const key = `${date}::${name.toLowerCase()}`;
      const bucket = map.get(key) || { name, date, food: 0, drink: 0, value: 0, count: 0 };
      (o.items || []).forEach((item) => {
        const qty = Number(item.quantity || 0);
        if (String(item.category || '').toUpperCase() === 'MINUMAN') bucket.drink += qty;
        else bucket.food += qty;
      });
      bucket.value += Number(o.subtotal || 0);
      bucket.count += 1;
      map.set(key, bucket);
    });
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  }, [staffMealOrders]);
  const staffMealTotalValue = useMemo(() => staffMeals.reduce((sum, r) => sum + r.value, 0), [staffMeals]);
  const staffMealOverLimit = useMemo(
    () => staffMeals.filter((r) => r.food > STAFF_MEAL_FOOD_LIMIT || r.drink > STAFF_MEAL_DRINK_LIMIT).length,
    [staffMeals],
  );
  const netOmset = grossOmset - totalTax;

  const totalTransactions = paidOrders.length;
  const avgOrderValue = totalTransactions > 0 ? Math.round(grossOmset / totalTransactions) : 0;
  const totalItemsSold = useMemo(() => paidOrders.reduce(
    (total, order) => total + (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    0,
  ), [paidOrders]);
  const unpaidNominal = useMemo(() => unpaidOrders.reduce((total, order) => total + Number(order.total || 0), 0), [unpaidOrders]);

  const cashTotal = useMemo(() => paidOrders.filter((o) => o.paymentMethod === 'CASH').reduce((acc, o) => acc + o.total, 0), [paidOrders]);
  const qrisTotal = useMemo(() => paidOrders.filter((o) => o.paymentMethod === 'QRIS').reduce((acc, o) => acc + o.total, 0), [paidOrders]);
  const debitTotal = useMemo(() => paidOrders.filter((o) => o.paymentMethod === 'DEBIT').reduce((acc, o) => acc + o.total, 0), [paidOrders]);

  const totalVoidNominal = useMemo(() => voidOrders.reduce((acc, o) => acc + (o.total || o.subtotal || 0), 0), [voidOrders]);
  const voidCount = voidOrders.length;

  const topSellingList = useMemo(() => {
    const map: Record<string, { name: string; category: string; qty: number; revenue: number; hppCost: number }> = {};
    paidOrders.forEach((o) => {
      o.items.forEach((item) => {
        const menuItem = menuItems.find((m) => m.id === item.menuId || m.name === item.menuName);
        const hpp = menuItem ? (menuItem.hppCost || 0) * item.quantity : 0;
        const cat = item.category || menuItem?.category || 'MAKANAN';

        if (!map[item.menuName]) {
          map[item.menuName] = {
            name: item.menuName,
            category: cat,
            qty: item.quantity,
            revenue: item.price * item.quantity,
            hppCost: hpp
          };
        } else {
          map[item.menuName].qty += item.quantity;
          map[item.menuName].revenue += item.price * item.quantity;
          map[item.menuName].hppCost += hpp;
        }
      });
    });

    let list = Object.values(map);
    if (categoryFilter !== 'ALL') {
      list = list.filter((item) => item.category === categoryFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((item) => item.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.qty - a.qty);
  }, [paidOrders, menuItems, categoryFilter, searchTerm]);

  const topSellingPagination = usePaginatedList(
    topSellingList,
    JSON.stringify([activeTab, period, branchFilter, categoryFilter, searchTerm, topSellingList.length]),
  );

  const voidPagination = usePaginatedList(
    voidOrders,
    JSON.stringify([activeTab, period, branchFilter, voidOrders.length]),
  );

  const taxPagination = usePaginatedList(
    settledOrders,
    JSON.stringify([activeTab, period, branchFilter, settledOrders.length]),
  );

  const shiftPagination = usePaginatedList(
    shifts,
    JSON.stringify([activeTab, period, branchFilter, shifts.length]),
  );

  const attendancePagination = usePaginatedList(
    attendances,
    JSON.stringify([activeTab, period, branchFilter, attendances.length]),
  );

  const hourlyPeakData = useMemo(() => {
    const hours: { hourLabel: string; count: number; revenue: number }[] = [];
    for (let h = 7; h <= 22; h++) {
      const hourStr = h.toString().padStart(2, '0') + ':00';
      const ordersInHour = paidOrders.filter((o) => {
        const d = new Date(o.createdAt);
        return d.getHours() === h;
      });
      const rev = ordersInHour.reduce((acc, o) => acc + o.total, 0);
      hours.push({ hourLabel: hourStr, count: ordersInHour.length, revenue: rev });
    }
    return hours;
  }, [paidOrders]);

  // Grafik tren utama MENYESUAIKAN periode dan selalu mengisi seluruh bucket
  // periode, termasuk hari/bulan tanpa penjualan.
  const trendChart = useMemo(() => {
    const customRangeDays = Math.max(1, Math.ceil((periodRange.end.getTime() - periodRange.start.getTime()) / 86400000));
    const useMonthlyBuckets = period === 'YEAR' || period === 'ALL' || (period === 'CUSTOM' && customRangeDays > 62);
    const aggregate = <T extends { key: string; label: string; axisLabel: string }>(seed: T[]) => {
      const bucketMap = new Map(seed.map((item) => [item.key, { ...item, revenue: 0, count: 0 }]));
      paidOrders.forEach((order) => {
        const orderDate = new Date(order.createdAt);
        if (Number.isNaN(orderDate.getTime())) return;
        const key = useMonthlyBuckets
          ? `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`
          : `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
        const bucket = bucketMap.get(key);
        if (!bucket) return;
        bucket.revenue += order.total;
        bucket.count += 1;
      });
      return [...bucketMap.values()];
    };

    if (period === 'TODAY' || period === 'YESTERDAY') {
      return {
        title: 'Tren Omset per Jam',
        data: hourlyPeakData.map((hour) => ({
          label: hour.hourLabel,
          axisLabel: `${hour.hourLabel.slice(0, 2)}h`,
          revenue: hour.revenue,
          count: hour.count,
        })),
      };
    }

    if (period === 'WEEK') {
      const weekSeed = Array.from({ length: 7 }, (_, index) => {
        const bucketDate = addCalendarDays(periodRange.start, index);
        return {
          key: `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}-${String(bucketDate.getDate()).padStart(2, '0')}`,
          label: bucketDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }),
          axisLabel: bucketDate.toLocaleDateString('id-ID', { weekday: 'short' }),
        };
      });
      return { title: 'Tren Omset 7 Hari Minggu Ini', data: aggregate(weekSeed) };
    }

    if (period === 'MONTH') {
      const monthStart = new Date(periodRange.start.getFullYear(), periodRange.start.getMonth(), 1);
      const monthEnd = new Date(periodRange.start.getFullYear(), periodRange.start.getMonth() + 1, 1);
      const totalDays = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000);
      const monthSeed = Array.from({ length: totalDays }, (_, index) => {
        const bucketDate = addCalendarDays(monthStart, index);
        return {
          key: `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}-${String(bucketDate.getDate()).padStart(2, '0')}`,
          label: bucketDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          axisLabel: bucketDate.toLocaleDateString('id-ID', { day: 'numeric' }),
        };
      });
      return { title: 'Tren Omset Harian Bulan Ini', data: aggregate(monthSeed) };
    }

    if (period === 'YEAR' || period === 'ALL') {
      const monthStart = period === 'YEAR'
        ? new Date(periodRange.start.getFullYear(), 0, 1)
        : new Date(
          paidOrders.length > 0 ? new Date(paidOrders[paidOrders.length - 1].createdAt).getFullYear() : new Date().getFullYear(),
          paidOrders.length > 0 ? new Date(paidOrders[paidOrders.length - 1].createdAt).getMonth() : new Date().getMonth(),
          1,
        );
      const totalMonths = period === 'YEAR'
        ? 12
        : Math.max(
          1,
          ((new Date().getFullYear() - monthStart.getFullYear()) * 12)
            + (new Date().getMonth() - monthStart.getMonth())
            + 1,
        );
      const monthSeed = Array.from({ length: totalMonths }, (_, index) => {
        const bucketDate = addCalendarMonths(monthStart, index);
        return {
          key: `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`,
          label: bucketDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
          axisLabel: bucketDate.toLocaleDateString('id-ID', { month: 'short' }),
        };
      });
      return { title: period === 'YEAR' ? 'Tren Omset 12 Bulan Tahun Ini' : 'Tren Omset per Bulan', data: aggregate(monthSeed) };
    }

    if (period === 'CUSTOM') {
      if (useMonthlyBuckets) {
        const firstMonth = new Date(periodRange.start.getFullYear(), periodRange.start.getMonth(), 1);
        const lastIncluded = new Date(periodRange.end.getTime() - 1);
        const monthCount = ((lastIncluded.getFullYear() - firstMonth.getFullYear()) * 12)
          + (lastIncluded.getMonth() - firstMonth.getMonth()) + 1;
        const seed = Array.from({ length: monthCount }, (_, index) => {
          const bucketDate = addCalendarMonths(firstMonth, index);
          return {
            key: `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`,
            label: bucketDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
            axisLabel: bucketDate.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
          };
        });
        return { title: 'Tren Omset Bulanan Periode Pilihan', data: aggregate(seed) };
      }
      const seed = Array.from({ length: customRangeDays }, (_, index) => {
        const bucketDate = addCalendarDays(periodRange.start, index);
        return {
          key: `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}-${String(bucketDate.getDate()).padStart(2, '0')}`,
          label: bucketDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          axisLabel: bucketDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        };
      });
      return { title: 'Tren Omset Harian Periode Pilihan', data: aggregate(seed) };
    }

    const fallbackDate = startOfLocalDay(periodRange.start);
    return {
      title: 'Tren Omset per Tanggal',
      data: aggregate([{
        key: `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, '0')}-${String(fallbackDate.getDate()).padStart(2, '0')}`,
        label: fallbackDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        axisLabel: fallbackDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      }]),
    };
  }, [hourlyPeakData, paidOrders, period, periodRange]);
  const maxTrendRevenue = useMemo(() => Math.max(...trendChart.data.map((d) => d.revenue), 1), [trendChart]);
  const bestTrendPoint = useMemo(
    () => trendChart.data.reduce<(typeof trendChart.data)[number] | null>(
      (best, point) => (!best || point.revenue > best.revenue ? point : best),
      null,
    ),
    [trendChart],
  );
  const overviewTopItems = useMemo(() => topSellingList.slice(0, 5), [topSellingList]);

  const shiftPreviewMap = useMemo(() => {
    const paidOrdersByShift = new Map<string, Order[]>();
    const voidOrdersByShift = new Map<string, Order[]>();
    const expenseRecordsByShift = new Map<string, ExpenseIncomeRecord[]>();

    orders.forEach((order) => {
      if (order.paidShiftId && order.paymentStatus === 'PAID' && order.status !== 'CANCELLED') {
        const rows = paidOrdersByShift.get(order.paidShiftId) || [];
        rows.push(order);
        paidOrdersByShift.set(order.paidShiftId, rows);
      }
      if (order.completedShiftId && order.status === 'CANCELLED') {
        const rows = voidOrdersByShift.get(order.completedShiftId) || [];
        rows.push(order);
        voidOrdersByShift.set(order.completedShiftId, rows);
      }
    });

    allExpenses.forEach((record) => {
      const rows = expenseRecordsByShift.get(record.shiftId) || [];
      rows.push(record);
      expenseRecordsByShift.set(record.shiftId, rows);
    });

    return shifts.reduce<Record<string, {
      orderCount: number;
      grossSales: number;
      cashSales: number;
      qrisSales: number;
      debitSales: number;
      nonCashSales: number;
      totalDiscount: number;
      totalTax: number;
      totalIncome: number;
      totalExpense: number;
      expectedCash: number;
      actualCash: number;
      varianceAmount: number;
      voidCount: number;
      voidAmount: number;
    }>>((acc, shift) => {
      const paidShiftOrders = paidOrdersByShift.get(shift.id) || [];
      const voidShiftOrders = voidOrdersByShift.get(shift.id) || [];
      const shiftRecords = expenseRecordsByShift.get(shift.id) || [];
      const hasPaidOrders = paidShiftOrders.length > 0;
      const qrisSales = paidShiftOrders
        .filter((order) => order.paymentMethod === 'QRIS')
        .reduce((total, order) => total + order.total, 0);
      const debitSales = paidShiftOrders
        .filter((order) => order.paymentMethod === 'DEBIT')
        .reduce((total, order) => total + order.total, 0);
      const cashSales = hasPaidOrders
        ? paidShiftOrders
          .filter((order) => order.paymentMethod === 'CASH')
          .reduce((total, order) => total + order.total, 0)
        : shift.cashSales;
      const totalExpense = shift.totalExpense > 0
        ? shift.totalExpense
        : shiftRecords
          .filter((record) => record.type === 'EXPENSE')
          .reduce((total, record) => total + record.amount, 0);
      const totalIncome = shift.totalIncome > 0
        ? shift.totalIncome
        : shiftRecords
          .filter((record) => record.type === 'INCOME')
          .reduce((total, record) => total + record.amount, 0);
      const grossSales = hasPaidOrders
        ? paidShiftOrders.reduce((total, order) => total + order.total, 0)
        : shift.grossOmset;
      const nonCashSales = hasPaidOrders ? qrisSales + debitSales : shift.nonCashSales;
      const expectedCash = shift.expectedCash ?? (shift.initialCash + cashSales + totalIncome - totalExpense);
      const actualCash = shift.actualCash ?? expectedCash;

      acc[shift.id] = {
        orderCount: paidShiftOrders.length,
        grossSales,
        cashSales,
        qrisSales,
        debitSales,
        nonCashSales,
        totalDiscount: paidShiftOrders.reduce((total, order) => total + (order.discount || 0), 0),
        totalTax: paidShiftOrders.reduce((total, order) => total + (order.tax || 0), 0),
        totalIncome,
        totalExpense,
        expectedCash,
        actualCash,
        varianceAmount: shift.varianceAmount ?? actualCash - expectedCash,
        voidCount: voidShiftOrders.length,
        voidAmount: voidShiftOrders.reduce((total, order) => total + (order.total || 0), 0),
      };
      return acc;
    }, {});
  }, [allExpenses, orders, shifts]);

  const inventoryMaterials = useMemo(() => {
    const scopedMaterials = branchFilter === 'ALL'
      ? rawMaterials
      : rawMaterials.filter((material) => material.branchId === branchFilter);
    const query = inventorySearchTerm.trim().toLowerCase();
    return scopedMaterials
      .filter((material) => (
        !query
        || material.name.toLowerCase().includes(query)
        || material.unit.toLowerCase().includes(query)
        || (material.branchName || '').toLowerCase().includes(query)
      ))
      .sort((left, right) => {
        const leftLow = left.stockQuantity <= left.minStockThreshold ? 1 : 0;
        const rightLow = right.stockQuantity <= right.minStockThreshold ? 1 : 0;
        if (leftLow !== rightLow) return rightLow - leftLow;
        return left.name.localeCompare(right.name, 'id-ID');
      });
  }, [branchFilter, inventorySearchTerm, rawMaterials]);

  const inventoryUsageByMaterial = useMemo(() => {
    const usage = new Map<string, number>();
    paidOrders.forEach((order) => {
      order.items.forEach((item) => {
        const menu = menuItems.find((menuItem) => menuItem.id === item.menuId || menuItem.name === item.menuName);
        menu?.ingredients?.forEach((ingredient) => {
          usage.set(
            ingredient.rawMaterialId,
            (usage.get(ingredient.rawMaterialId) || 0) + (ingredient.amountNeeded * item.quantity),
          );
        });
      });
    });
    return usage;
  }, [menuItems, paidOrders]);

  const inventoryTotals = useMemo(() => {
    return inventoryMaterials.reduce((acc, material) => {
      const usage = inventoryUsageByMaterial.get(material.id) || 0;
      const value = material.stockQuantity * material.costPerUnit;
      acc.totalValue += value;
      acc.totalUsage += usage;
      if (material.stockQuantity <= material.minStockThreshold) acc.lowStockCount += 1;
      return acc;
    }, { totalValue: 0, totalUsage: 0, lowStockCount: 0 });
  }, [inventoryMaterials, inventoryUsageByMaterial]);

  const inventoryPagination = usePaginatedList(
    inventoryMaterials,
    JSON.stringify([activeTab, branchFilter, inventorySearchTerm, inventoryMaterials.length]),
  );

  useEffect(() => {
    if (activeTab !== 'INVENTORY') return;
    let cancelled = false;
    const loadStockMovements = async () => {
      const scopedBranchIds = branchFilter === 'ALL'
        ? Array.from(new Set((branches.length > 0 ? branches.map((branch) => branch.id) : rawMaterials.map((material) => material.branchId)).filter(Boolean)))
        : [branchFilter];

      if (scopedBranchIds.length === 0) {
        setInventoryMovements([]);
        setInventoryMovementTotal(0);
        setInventoryMovementError('');
        return;
      }

      setInventoryMovementLoading(true);
      setInventoryMovementError('');

      try {
        const requestedRows = inventoryMovementPage * inventoryMovementPageSize;
        const results = await Promise.all(
          scopedBranchIds.map((branchId) => listStockMovements({
            branchId,
            limit: requestedRows,
            offset: 0,
            from: periodRange.start.toISOString(),
            to: periodRange.end.toISOString(),
          })),
        );

        if (cancelled) return;

        const mergedRows = results
          .flatMap((result) => result.rows)
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
        const offset = (inventoryMovementPage - 1) * inventoryMovementPageSize;
        setInventoryMovements(mergedRows.slice(offset, offset + inventoryMovementPageSize));
        setInventoryMovementTotal(results.reduce((total, result) => total + result.total, 0));
      } catch (error) {
        if (cancelled) return;
        setInventoryMovements([]);
        setInventoryMovementTotal(0);
        setInventoryMovementError(error instanceof Error ? error.message : 'Riwayat mutasi stok gagal dimuat.');
      } finally {
        if (!cancelled) setInventoryMovementLoading(false);
      }
    };

    void loadStockMovements();
    return () => { cancelled = true; };
  }, [
    activeTab,
    branchFilter,
    branches,
    inventoryMovementPage,
    inventoryMovementPageSize,
    periodRange.end,
    periodRange.start,
    rawMaterials,
  ]);

  useEffect(() => {
    setInventoryMovementPage(1);
  }, [branchFilter, inventoryMovementPageSize, period, inventorySearchTerm]);

  const inventoryMovementTotalPages = Math.max(1, Math.ceil(inventoryMovementTotal / inventoryMovementPageSize));
  const inventoryMovementStartItem = inventoryMovementTotal === 0 ? 0 : (inventoryMovementPage - 1) * inventoryMovementPageSize + 1;
  const inventoryMovementEndItem = inventoryMovementTotal === 0 ? 0 : Math.min(inventoryMovementPage * inventoryMovementPageSize, inventoryMovementTotal);

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'No Order,Tanggal,Customer,Meja,Tipe,Metode,Subtotal,Diskon,Klasifikasi Diskon,Pajak,Total,Status\n';

    scopedOrders.forEach((o) => {
      const discountLabel = isStaffEatingOrder(o) ? 'STAFF EATING' : o.discount > 0 ? 'PROMO / DISKON' : 'NORMAL';
      const row = `"${o.orderNumber}","${new Date(o.createdAt).toLocaleString('id-ID')}","${o.customerName}","${o.tableNumber}","${o.type}","${o.paymentMethod || 'CASH'}",${o.subtotal || 0},${o.discount || 0},"${discountLabel}",${o.tax || 0},${o.total},"${o.status}"`;
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Penjualan_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportShiftCSV = () => {
    let csv = 'data:text/csv;charset=utf-8,ID Shift,Kasir,Role,Mulai,Selesai,Modal Awal,Omset Tunai,Omset Non-Tunai,Pengeluaran,Pemasukan,Status\n';
    shifts.forEach((s) => {
      csv += `"${s.id}","${s.staffName}","${s.staffRole}","${new Date(s.startTime).toLocaleString('id-ID')}","${s.endTime ? new Date(s.endTime).toLocaleString('id-ID') : '-'}",${s.initialCash},${s.cashSales},${s.nonCashSales},${s.totalExpense},${s.totalIncome},"${s.status}"\n`;
    });
    const encoded = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `Riwayat_Shift_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="ui-surface flex-1 p-4 md:p-6 overflow-y-auto font-sans select-none space-y-6 text-[var(--text-primary)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4"
        style={{ borderColor: 'var(--panel-border)' }}>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}>
            <TrendingUp className="h-7 w-7" style={{ color: 'var(--primary-hover)' }} />
            Dashboard Monitoring & Analitik Laporan
          </h1>
          <p className="mt-1 text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Snapshot keputusan sesuai periode. Data hanya dimuat saat laporan dibuka, filter berubah, atau dimuat ulang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReportRefreshNonce((value) => value + 1)}
            disabled={reportRangeLoading}
            className="ui-button ui-button-secondary gap-1.5 disabled:cursor-wait disabled:opacity-60"
            title="Ambil snapshot terbaru dari cloud"
          >
            <RefreshCw className={`h-4 w-4 ${reportRangeLoading ? 'animate-spin' : ''}`} />
            {reportRangeLoading ? 'Memuat' : 'Muat Ulang'}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="ui-button ui-button-secondary gap-1.5"
          >
            <Download className="h-4 w-4" /> Export CSV Transaksi
          </button>

          <button
            type="button"
            onClick={handlePrintPDF}
            className="ui-button ui-button-primary gap-1.5"
          >
            <Printer className="h-4 w-4" /> Cetak Laporan PDF
          </button>
        </div>
      </div>

      {/* Rentang waktu — memotong seluruh metrik, tabel, dan export di halaman ini */}
      <div className="flex flex-col gap-2 -mt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}>
            <Calendar className="w-3.5 h-3.5" /> Periode
          </span>

          <div className="flex flex-wrap items-center gap-1 bg-[var(--surface-secondary)] border border-[var(--panel-border)] p-1 rounded-full">
            {REPORT_PERIODS.map(({ key, label, hint }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                title={hint}
                aria-pressed={period === key}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                  period === key
                    ? 'bg-[var(--primary)] text-[var(--text-inverse)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
            {formatPeriodRange(period, periodRange)}
            <span style={{ color: 'var(--text-tertiary)' }}>
              {' · '}{reportRangeLoading
                ? 'Memuat snapshot…'
                : `${totalTransactions} penjualan · ${unpaidOrders.length} belum bayar · ${staffMealOrders.length} staff eating`}
            </span>
          </span>
        </div>

        {period === 'CUSTOM' && (
          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-3 shadow-sm">
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
              Dari tanggal
              <input
                type="date"
                value={customStartDate}
                max={customEndDate || undefined}
                onChange={(event) => setCustomStartDate(event.target.value)}
                className="ui-input min-h-10 px-3 text-[12px] normal-case tracking-normal"
              />
            </label>
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
              Sampai tanggal
              <input
                type="date"
                value={customEndDate}
                min={customStartDate || undefined}
                onChange={(event) => setCustomEndDate(event.target.value)}
                className="ui-input min-h-10 px-3 text-[12px] normal-case tracking-normal"
              />
            </label>
            <p className="pb-2 text-[11px] font-semibold text-[var(--text-secondary)]">
              Seluruh kartu, grafik, tabel, CSV, dan PDF mengikuti rentang ini.
            </p>
          </div>
        )}

        {/* Filter cabang — memotong seluruh metrik & tabel di halaman ini */}
        {branches.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}>
              <ShieldCheck className="w-3.5 h-3.5" /> Cabang
            </span>
            <div className="flex flex-wrap items-center gap-1 bg-[var(--surface-secondary)] border border-[var(--panel-border)] p-1 rounded-full">
              <button
                type="button"
                onClick={() => setBranchFilter('ALL')}
                aria-pressed={branchFilter === 'ALL'}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                  branchFilter === 'ALL'
                    ? 'bg-[var(--primary)] text-[var(--text-inverse)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Semua Cabang
              </button>
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBranchFilter(b.id)}
                  aria-pressed={branchFilter === b.id}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                    branchFilter === b.id
                      ? 'bg-[var(--primary)] text-[var(--text-inverse)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-[10px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
          {lastReportLoadedAt
            ? `Snapshot terakhir ${lastReportLoadedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}. Tidak ada polling atau subscription saat halaman laporan terbuka.`
            : 'Snapshot akan dimuat sesuai filter. Tidak ada polling atau subscription laporan.'}
        </p>
      </div>

      <div className="ui-tabs ui-tabs-orange border-b border-[var(--panel-border)] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`ui-tab ${activeTab === 'OVERVIEW' ? 'ui-tab-active' : ''}`}
        >
          <BarChart3 className="w-4 h-4" />
          Ringkasan & Grafik
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TOP_ITEMS')}
          className={`ui-tab ${activeTab === 'TOP_ITEMS' ? 'ui-tab-active' : ''}`}
        >
          <Flame className="w-4 h-4" />
          Menu Terlaris ({topSellingList.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('VOID')}
          className={`ui-tab ${activeTab === 'VOID' ? 'ui-tab-active' : ''}`}
        >
          <Ban className="w-4 h-4" />
          Riwayat Void ({voidCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TAX_DISCOUNT')}
          className={`ui-tab ${activeTab === 'TAX_DISCOUNT' ? 'ui-tab-active' : ''}`}
        >
          <Receipt className="w-4 h-4" />
          Pajak & Diskon
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SHIFT_HISTORY')}
          className={`ui-tab ${activeTab === 'SHIFT_HISTORY' ? 'ui-tab-active' : ''}`}
        >
          <History className="w-4 h-4" />
          Histori Shift ({shifts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ATTENDANCE_HISTORY')}
          className={`ui-tab ${activeTab === 'ATTENDANCE_HISTORY' ? 'ui-tab-active' : ''}`}
        >
          <UserCheck className="w-4 h-4" />
          Histori Presensi ({attendances.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('INVENTORY')}
          className={`ui-tab ${activeTab === 'INVENTORY' ? 'ui-tab-active' : ''}`}
        >
          <Layers className="w-4 h-4" />
          Laporan Stok ({inventoryMaterials.length})
        </button>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="ui-card ui-card-feature p-5 space-y-1 sm:col-span-2 xl:col-span-1">
              <p className="ui-stat-label text-[var(--primary-soft)] opacity-90">OMSET PENJUALAN</p>
              <p className="ui-stat-value text-white">Rp {grossOmset.toLocaleString('id-ID')}</p>
              <span className="text-[11px] font-bold text-white/80 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> Ex. pajak Rp {netOmset.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">PENJUALAN LUNAS</p>
              <p className="ui-stat-value text-[var(--text-primary)]">{totalTransactions} <span className="text-xs font-bold text-[var(--text-tertiary)]">struk</span></p>
              <span className="text-[11px] font-bold text-[var(--primary-text)] block">{totalItemsSold} porsi / item terjual</span>
            </div>

            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">RATA-RATA STRUK</p>
              <p className="ui-stat-value text-[var(--accent-green)]">Rp {avgOrderValue.toLocaleString('id-ID')}</p>
              <span className="text-[11px] font-bold text-[var(--text-tertiary)] block">Hanya transaksi penjualan</span>
            </div>

            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">BELUM DIBAYAR</p>
              <p className="ui-stat-value text-[var(--accent-amber)]">{unpaidOrders.length} <span className="text-xs font-bold text-[var(--text-tertiary)]">order</span></p>
              <span className="text-[11px] font-bold text-[var(--text-tertiary)] block">Potensi Rp {unpaidNominal.toLocaleString('id-ID')}</span>
            </div>

            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">PENGECUALIAN</p>
              <p className="ui-stat-value text-[var(--text-primary)]">{voidCount + staffMealOrders.length}</p>
              <span className="text-[11px] font-bold text-[var(--text-tertiary)] block">{voidCount} void · {staffMealOrders.length} staff eating</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="ui-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[var(--primary-text)]" />
                  Distribusi Metode Pembayaran
                </h2>
                <span className="text-[11px] font-bold uppercase"
                  style={{ color: 'var(--text-tertiary)' }}>Snapshot</span>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-[12px] font-bold mb-1.5"
                    style={{ color: 'var(--text-primary)' }}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent-green)' }} />
                      TUNAI (CASH)
                    </span>
                    <span>Rp {cashTotal.toLocaleString('id-ID')} ({grossOmset > 0 ? Math.round((cashTotal / grossOmset) * 100) : 0}%)</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full border"
                    style={{ background: 'var(--surface-secondary)', borderColor: 'var(--panel-border)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${grossOmset > 0 ? (cashTotal / grossOmset) * 100 : 0}%`, background: 'var(--accent-green)' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[12px] font-bold mb-1.5"
                    style={{ color: 'var(--text-primary)' }}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--primary)' }} />
                      QRIS (E-WALLET &amp; M-BANKING)
                    </span>
                    <span>Rp {qrisTotal.toLocaleString('id-ID')} ({grossOmset > 0 ? Math.round((qrisTotal / grossOmset) * 100) : 0}%)</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full border"
                    style={{ background: 'var(--surface-secondary)', borderColor: 'var(--panel-border)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${grossOmset > 0 ? (qrisTotal / grossOmset) * 100 : 0}%`, background: 'var(--primary)' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[12px] font-bold mb-1.5"
                    style={{ color: 'var(--text-primary)' }}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent-amber)' }} />
                      DEBIT / KREDIT EDC
                    </span>
                    <span>Rp {debitTotal.toLocaleString('id-ID')} ({grossOmset > 0 ? Math.round((debitTotal / grossOmset) * 100) : 0}%)</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full border"
                    style={{ background: 'var(--surface-secondary)', borderColor: 'var(--panel-border)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${grossOmset > 0 ? (debitTotal / grossOmset) * 100 : 0}%`, background: 'var(--accent-amber)' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="ui-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[var(--primary-text)]" />
                  Lima Menu Utama
                </h2>
                <button type="button" onClick={() => setActiveTab('TOP_ITEMS')}
                  className="text-[11px] font-bold text-[var(--primary-text)] hover:underline">
                  Lihat rincian
                </button>
              </div>

              {overviewTopItems.length === 0 ? (
                <p className="py-8 text-center text-[12px] font-medium text-[var(--text-tertiary)]">Belum ada menu terjual.</p>
              ) : (
                <div className="space-y-2">
                  {overviewTopItems.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-3 rounded-xl border border-[var(--panel-border-light)] bg-[var(--surface-secondary)] px-3 py-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--brand-100)] text-[11px] font-black text-[var(--primary-text)]">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-bold" title={item.name}>{item.name}</p>
                        <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">{item.qty} porsi</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-[var(--primary-text)]">Rp {item.revenue.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tren omset adaptif: per jam / tanggal / bulan mengikuti periode */}
            <div className="ui-card p-6 space-y-4 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--primary-text)]" />
                  {trendChart.title}
                </h2>
                <span className="text-[11px] font-bold"
                  style={{ color: 'var(--text-tertiary)' }}>{formatPeriodRange(period, periodRange)}</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-[var(--surface-secondary)] px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Titik tertinggi</p>
                  <p className="truncate text-[12px] font-bold" title={bestTrendPoint?.label || '-'}>{bestTrendPoint?.label || '-'}</p>
                </div>
                <div className="rounded-xl bg-[var(--surface-secondary)] px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Omset titik tertinggi</p>
                  <p className="text-[12px] font-bold text-[var(--primary-text)]">Rp {(bestTrendPoint?.revenue || 0).toLocaleString('id-ID')}</p>
                </div>
                <div className="rounded-xl bg-[var(--surface-secondary)] px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Volume</p>
                  <p className="text-[12px] font-bold">{bestTrendPoint?.count || 0} transaksi</p>
                </div>
              </div>

              {trendChart.data.length === 0 ? (
                <p className="py-8 text-center text-[12px] font-medium"
                  style={{ color: 'var(--text-tertiary)' }}>Belum ada transaksi lunas pada periode ini.</p>
              ) : (
                <>
                  <div className="overflow-x-auto pb-1">
                    <div className="flex items-end gap-2 h-44 pt-3 px-1 border-b min-w-full"
                      style={{ borderColor: 'var(--panel-border-light)', minWidth: `${trendChart.data.length * 46}px` }}>
                      {trendChart.data.map((point, idx) => {
                        const pct = Math.round((point.revenue / maxTrendRevenue) * 100);
                        const isBest = point.revenue === maxTrendRevenue && point.revenue > 0;
                        return (
                          <div key={`${point.label}-${idx}`} className="flex min-w-[38px] flex-1 flex-col items-center gap-1"
                            title={`${point.label}: Rp ${point.revenue.toLocaleString('id-ID')} (${point.count} transaksi)`}
                            aria-label={`${point.label}, omzet Rp ${point.revenue.toLocaleString('id-ID')}, ${point.count} transaksi`}>
                            <div className="flex h-32 w-full items-end overflow-hidden rounded-t-md"
                              style={{ background: 'var(--surface-secondary)' }}>
                              <div
                                className="w-full rounded-t-md transition-all duration-500"
                                style={{
                                  height: `${pct > 0 ? pct : 4}%`,
                                  background: isBest ? 'var(--primary-solid)' : 'var(--primary-hover)'
                                }}
                              />
                            </div>
                            <span className="max-w-[64px] truncate whitespace-nowrap text-[10px] font-bold"
                              title={point.label}
                              style={{ color: 'var(--text-tertiary)' }}>{point.axisLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-center text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Satu grafik adaptif: per jam untuk harian, per tanggal untuk mingguan/bulanan, dan per bulan untuk periode panjang.
                  </p>
                </>
              )}
            </div>

            <div className="ui-card p-6 space-y-4 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <AlertTriangle className="h-4 w-4 text-[var(--accent-amber)]" />
                  Monitor Operasional
                </h2>
                <span className="rounded-full bg-[var(--surface-secondary)] px-2.5 py-1 text-[10px] font-bold text-[var(--text-tertiary)]">
                  Perlu tindakan, bukan grafik tambahan
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <button type="button" onClick={() => setActiveTab('TAX_DISCOUNT')}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-4 text-left transition hover:border-[var(--brand-300)]">
                  <WalletCards className="mb-3 h-5 w-5 text-[var(--accent-amber)]" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Belum dibayar</p>
                  <p className="mt-1 text-lg font-black">{unpaidOrders.length} order</p>
                  <p className="truncate text-[11px] font-semibold text-[var(--text-secondary)]" title={`Rp ${unpaidNominal.toLocaleString('id-ID')}`}>Rp {unpaidNominal.toLocaleString('id-ID')}</p>
                </button>
                <button type="button" onClick={() => setActiveTab('VOID')}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-4 text-left transition hover:border-red-300">
                  <Ban className="mb-3 h-5 w-5 text-red-500" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Void / batal</p>
                  <p className="mt-1 text-lg font-black">{voidCount} order</p>
                  <p className="truncate text-[11px] font-semibold text-[var(--text-secondary)]" title={`Rp ${totalVoidNominal.toLocaleString('id-ID')}`}>Rp {totalVoidNominal.toLocaleString('id-ID')}</p>
                </button>
                <button type="button" onClick={() => setActiveTab('TAX_DISCOUNT')}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-4 text-left transition hover:border-[var(--brand-300)]">
                  <Utensils className="mb-3 h-5 w-5 text-[var(--primary-text)]" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Staff eating</p>
                  <p className="mt-1 text-lg font-black">{staffMealOrders.length} order</p>
                  <p className="truncate text-[11px] font-semibold text-[var(--text-secondary)]" title={`Nilai menu Rp ${staffMealTotalValue.toLocaleString('id-ID')}`}>Nilai Rp {staffMealTotalValue.toLocaleString('id-ID')}</p>
                </button>
                <button type="button" onClick={() => setActiveTab('TOP_ITEMS')}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-4 text-left transition hover:border-[var(--brand-300)]">
                  <ShoppingBag className="mb-3 h-5 w-5 text-[var(--accent-green)]" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Produk terjual</p>
                  <p className="mt-1 text-lg font-black">{totalItemsSold} item</p>
                  <p className="truncate text-[11px] font-semibold text-[var(--text-secondary)]" title={overviewTopItems[0]?.name || 'Belum ada penjualan'}>{overviewTopItems[0]?.name || 'Belum ada penjualan'}</p>
                </button>
              </div>
              <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">
                Staff eating terpisah dari omzet, jumlah struk, rata-rata transaksi, metode pembayaran, tren, dan peringkat menu.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'TOP_ITEMS' && (
        <div className="ui-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                Peringkat Menu Terlaris & Margin Profit
              </h2>
              <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>Diurutkan berdasarkan jumlah porsi terjual dan kontribusi omset.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold"
                style={{ background: 'var(--surface-secondary)', borderColor: 'var(--panel-border)' }}>
                <Search className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  placeholder="Cari nama menu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-32 bg-transparent text-[12px] font-bold outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>

              {['ALL', 'BAKSO', 'MIE AYAM', 'MINUMAN', 'TAMBAHAN'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all ${
                    categoryFilter === cat ? 'bg-[var(--primary-solid)] text-white shadow-sm' : ''
                  }`}
                  style={categoryFilter !== cat ? { background: 'var(--surface-secondary)', color: 'var(--text-secondary)' } : {}}
                >
                  {cat === 'ALL' ? 'Semua' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead>
                <tr className="border-b text-[11px] font-bold uppercase tracking-wider"
                  style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                  <th className="py-3 px-3">Peringkat</th>
                  <th className="py-3 px-3">Nama Menu</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3 text-center">Porsi Terjual</th>
                  <th className="py-3 px-3 text-right">Total Omset</th>
                  <th className="py-3 px-3 text-right">HPP Cost</th>
                  <th className="py-3 px-3 text-right">Estimasi Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--panel-border-light)' }}>
                {topSellingList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center font-bold" style={{ color: 'var(--text-tertiary)' }}>Tidak ada data penjualan menu</td>
                  </tr>
                ) : (
                  topSellingPagination.visibleItems.map((item, idx) => {
                    const profit = item.revenue - item.hppCost;
                    const marginPct = item.revenue > 0 ? Math.round((profit / item.revenue) * 100) : 0;
                    const ranking = topSellingPagination.startItem + idx;
                    return (
                      <tr key={item.name} className="hover:bg-[var(--brand-100)]/40 transition-colors">
                        <td className="py-3 px-3 font-bold">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold text-white ${
                            ranking === 1 ? 'bg-[var(--accent-amber)]'
                            : ranking === 2 ? 'bg-[var(--text-tertiary)]'
                            : ranking === 3 ? 'bg-[var(--primary-hover)]'
                            : 'bg-[var(--surface-secondary)] !text-[var(--text-secondary)]'
                          }`}>#{ranking}</span>
                        </td>
                        <td className="py-3 px-3 font-bold" style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                        <td className="py-3 px-3">
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>{item.category}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold" style={{ color: 'var(--text-primary)' }}>{item.qty} porsi</td>
                        <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--accent-green)' }}>Rp {item.revenue.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--text-secondary)' }}>Rp {item.hppCost.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-bold text-[var(--primary-text)] block">Rp {profit.toLocaleString('id-ID')}</span>
                          <span className="text-[11px] font-bold" style={{ color: 'var(--accent-green)' }}>Margin {marginPct}%</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={topSellingPagination.page}
            pageSize={topSellingPagination.pageSize}
            totalItems={topSellingPagination.totalItems}
            totalPages={topSellingPagination.totalPages}
            startItem={topSellingPagination.startItem}
            endItem={topSellingPagination.endItem}
            onPageChange={topSellingPagination.setPage}
            onPageSizeChange={topSellingPagination.setPageSize}
            itemLabel="menu"
          />
        </div>
      )}

      {activeTab === 'VOID' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="ui-card bg-[var(--danger-soft)] border-[var(--accent-red)] p-5 space-y-1">
              <p className="ui-stat-label text-[var(--accent-red)]">TOTAL NOMINAL VOID</p>
              <p className="ui-stat-value text-[var(--accent-red)]">Rp {totalVoidNominal.toLocaleString('id-ID')}</p>
              <p className="text-[11px] font-bold text-[var(--accent-red)] opacity-80">Total nilai pesanan yang dibatalkan</p>
            </div>
            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">JUMLAH TRANSAKSI VOID</p>
              <p className="ui-stat-value">{voidCount} <span className="text-xs text-[var(--text-tertiary)] font-bold">Struk</span></p>
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Frekuensi pembatalan pesanan</p>
            </div>
            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">RASIO VOID vs TOTAL OMSET</p>
              <p className="ui-stat-value text-[var(--accent-amber)]">{grossOmset > 0 ? ((totalVoidNominal / grossOmset) * 100).toFixed(1) : 0}%</p>
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Toleransi VOID ideal &lt; 2%</p>
            </div>
          </div>

          <div className="ui-card p-6 space-y-4">
            <h2 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
              <Ban className="h-5 w-5" style={{ color: 'var(--accent-red)' }} />
              Daftar Rincian Pesanan Dibatalkan (Void)
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b text-[11px] font-bold uppercase tracking-wider"
                    style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                    <th className="py-3 px-3">No Order</th>
                    <th className="py-3 px-3">Tanggal / Waktu</th>
                    <th className="py-3 px-3">Customer / Meja</th>
                    <th className="py-3 px-3">Item Dibatalkan</th>
                    <th className="py-3 px-3">Kasir Penanggung Jawab</th>
                    <th className="py-3 px-3 text-right">Nominal Void</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--panel-border-light)' }}>
                  {voidOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center font-bold" style={{ color: 'var(--text-tertiary)' }}>Tidak ada catatan pembatalan (Void) hari ini</td>
                    </tr>
                  ) : (
                    voidPagination.visibleItems.map((o) => (
                      <tr key={o.id} className="transition-colors"
                        style={{ '--hover-bg': 'var(--danger-soft)' } as React.CSSProperties}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--danger-soft)'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}>
                        <td className="py-3 px-3 font-bold font-mono" style={{ color: 'var(--accent-red)' }}>{o.orderNumber}</td>
                        <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{new Date(o.createdAt).toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3" style={{ color: 'var(--text-primary)' }}>{o.customerName} (Meja {o.tableNumber})</td>
                        <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>
                          {o.items.map((it) => `${it.quantity}x ${it.menuName}`).join(', ')}
                        </td>
                        <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{o.cashierName || 'Kasir'}</td>
                        <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--accent-red)' }}>Rp {o.total.toLocaleString('id-ID')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={voidPagination.page}
              pageSize={voidPagination.pageSize}
              totalItems={voidPagination.totalItems}
              totalPages={voidPagination.totalPages}
              startItem={voidPagination.startItem}
              endItem={voidPagination.endItem}
              onPageChange={voidPagination.setPage}
              onPageSizeChange={voidPagination.setPageSize}
              itemLabel="void"
            />
          </div>
        </div>
      )}

      {activeTab === 'TAX_DISCOUNT' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="ui-card bg-[var(--primary-soft)] border-[var(--primary-border)] p-5 space-y-1">
              <p className="ui-stat-label text-[var(--primary-text)]">TOTAL PAJAK RESTO (PB1)</p>
              <p className="ui-stat-value text-[var(--primary-text)]">Rp {totalTax.toLocaleString('id-ID')}</p>
              <p className="text-[11px] font-bold text-[var(--primary-text)] opacity-80">Pajak restoran yang terkumpul</p>
            </div>
            <div className="ui-card bg-[var(--warning-soft)] border-amber-200 p-5 space-y-1">
              <p className="ui-stat-label text-amber-700">DISKON PELANGGAN / PROMO</p>
              <p className="ui-stat-value text-amber-700">Rp {totalDiscount.toLocaleString('id-ID')}</p>
              <p className="text-[11px] font-bold text-amber-700 opacity-80">Tidak termasuk konsumsi staff</p>
            </div>
            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">SUBTOTAL KOTOR (GROSS)</p>
              <p className="ui-stat-value text-[var(--text-primary)]">Rp {totalSubtotal.toLocaleString('id-ID')}</p>
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Subtotal murni sebelum diskon & pajak</p>
            </div>
          </div>

          {/* ── MAKAN STAFF (diskon 100%) — kontrol jatah harian ── */}
          <div className="ui-card p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[var(--primary-hover)]" />
                  Staff Eating
                  <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--primary-text)]">
                    Diskon 100%
                  </span>
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-[var(--text-tertiary)]">
                  Jatah harian: {STAFF_MEAL_FOOD_LIMIT} makanan + {STAFF_MEAL_DRINK_LIMIT} minuman per orang.
                  Status transaksi dilabeli STAFF EATING. Baris merah = melebihi jatah. Nama diambil dari kolom pelanggan saat input.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="rounded-xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
                  Nilai: Rp {staffMealTotalValue.toLocaleString('id-ID')}
                </span>
                {staffMealOverLimit > 0 && (
                  <span className="rounded-xl bg-[var(--danger-soft)] px-3 py-1.5 text-[11px] font-black text-[var(--accent-red)]">
                    {staffMealOverLimit} melebihi jatah
                  </span>
                )}
              </div>
            </div>

            {staffMeals.length === 0 ? (
              <p className="py-8 text-center text-xs font-bold text-[var(--text-tertiary)]">
                Belum ada transaksi diskon 100% pada periode ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr className="border-b text-[11px] font-bold uppercase tracking-wider"
                      style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Nama</th>
                      <th className="p-3 text-center">Makanan</th>
                      <th className="p-3 text-center">Minuman</th>
                      <th className="p-3 text-center">Struk</th>
                      <th className="p-3 text-right">Nilai</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffMeals.map((row) => {
                      const over = row.food > STAFF_MEAL_FOOD_LIMIT || row.drink > STAFF_MEAL_DRINK_LIMIT;
                      return (
                        <tr key={`${row.date}-${row.name}`} className="border-b" style={{ borderColor: 'var(--panel-border-light)' }}>
                          <td className="p-3 font-mono text-[var(--text-secondary)]">
                            {new Date(`${row.date}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="p-3 text-[var(--text-primary)]">{row.name}</td>
                          <td className={`p-3 text-center ${row.food > STAFF_MEAL_FOOD_LIMIT ? 'text-[var(--accent-red)]' : 'text-[var(--text-secondary)]'}`}>{row.food}</td>
                          <td className={`p-3 text-center ${row.drink > STAFF_MEAL_DRINK_LIMIT ? 'text-[var(--accent-red)]' : 'text-[var(--text-secondary)]'}`}>{row.drink}</td>
                          <td className="p-3 text-center text-[var(--text-secondary)]">{row.count}</td>
                          <td className="p-3 text-right font-mono text-[var(--text-primary)]">Rp {row.value.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${over ? 'bg-[var(--danger-soft)] text-[var(--accent-red)]' : 'bg-[var(--primary-soft)] text-[var(--primary-text)]'}`}>
                              {over ? 'Lebih' : 'Sesuai'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="ui-card p-6 space-y-4">
            <h2 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[var(--primary-hover)]" />
              Audit Rincian Pajak & Diskon Per Struk
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b text-[11px] font-bold uppercase tracking-wider"
                    style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                    <th className="py-3 px-3">No Order</th>
                    <th className="py-3 px-3">Waktu</th>
                    <th className="py-3 px-3">Klasifikasi</th>
                    <th className="py-3 px-3 text-right">Subtotal</th>
                    <th className="py-3 px-3 text-right">Diskon</th>
                    <th className="py-3 px-3 text-right">Pajak (PB1)</th>
                    <th className="py-3 px-3 text-right">Total Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--panel-border-light)' }}>
                  {paidOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center font-bold" style={{ color: 'var(--text-tertiary)' }}>Belum ada transaksi lunas</td>
                    </tr>
                  ) : (
                    taxPagination.visibleItems.map((o) => (
                      <tr key={o.id} className="transition-colors"
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-secondary)'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}>
                        <td className="py-3 px-3 font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{o.orderNumber}</td>
                        <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{new Date(o.createdAt).toLocaleTimeString('id-ID')}</td>
                        <td className="py-3 px-3">
                          {isStaffEatingOrder(o) ? (
                            <span className="whitespace-nowrap rounded-full bg-[var(--primary-soft)] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[var(--primary-text)]">
                              Staff Eating
                            </span>
                          ) : o.discount > 0 ? (
                            <span className="whitespace-nowrap rounded-full bg-[var(--warning-soft)] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-700">
                              Promo / Diskon
                            </span>
                          ) : (
                            <span className="whitespace-nowrap rounded-full bg-[var(--surface-secondary)] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--text-primary)' }}>Rp {(o.subtotal || o.total).toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--accent-red)' }}>-Rp {(o.discount || 0).toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--primary-hover)' }}>+Rp {(o.tax || 0).toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--accent-green)' }}>Rp {o.total.toLocaleString('id-ID')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={taxPagination.page}
              pageSize={taxPagination.pageSize}
              totalItems={taxPagination.totalItems}
              totalPages={taxPagination.totalPages}
              startItem={taxPagination.startItem}
              endItem={taxPagination.endItem}
              onPageChange={taxPagination.setPage}
              onPageSizeChange={taxPagination.setPageSize}
              itemLabel="struk"
            />
          </div>
        </div>
      )}

      {activeTab === 'SHIFT_HISTORY' && (
        <div className="ui-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
                <History className="w-5 h-5 text-[var(--primary-hover)]" />
                Histori Shift Operasional & Rekonsiliasi Kas Laci
              </h2>
              <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>Log lengkap modal awal, pemasukan kasir, pengeluaran petty cash, &amp; status shift.</p>
            </div>
            <button
              type="button"
              onClick={handleExportShiftCSV}
              className="px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export Shift CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead>
                <tr className="border-b text-[11px] font-bold uppercase tracking-wider"
                  style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                  <th className="py-3 px-3 text-center">Detail</th>
                  <th className="py-3 px-3">ID Shift</th>
                  <th className="py-3 px-3">Kasir / Staf</th>
                  <th className="py-3 px-3">Mulai Shift</th>
                  <th className="py-3 px-3">Tutup Shift</th>
                  <th className="py-3 px-3 text-right">Modal Awal</th>
                  <th className="py-3 px-3 text-right">Omset Tunai</th>
                  <th className="py-3 px-3 text-right">Non-Tunai</th>
                  <th className="py-3 px-3 text-right">Pengeluaran</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--panel-border-light)' }}>
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center font-bold" style={{ color: 'var(--text-tertiary)' }}>Belum ada riwayat shift recorded</td>
                  </tr>
                ) : (
                  shiftPagination.visibleItems.map((s) => {
                    const details = shiftPreviewMap[s.id];
                    const isExpanded = expandedShiftId === s.id;
                    return (
                      <React.Fragment key={s.id}>
                        <tr className="transition-colors"
                          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-secondary)'}
                          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setExpandedShiftId((current) => current === s.id ? null : s.id)}
                              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors"
                              style={{ borderColor: 'var(--panel-border)', background: isExpanded ? 'var(--brand-100)' : 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                            >
                              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              {isExpanded ? 'Tutup' : 'Lihat'}
                            </button>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{s.id}</td>
                          <td className="py-3 px-3 font-bold" style={{ color: 'var(--text-primary)' }}>{s.staffName} <span className="text-[11px] font-bold" style={{ color: 'var(--primary-text)' }}>({s.staffRole})</span></td>
                          <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{new Date(s.startTime).toLocaleString('id-ID')}</td>
                          <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{s.endTime ? new Date(s.endTime).toLocaleString('id-ID') : '-'}</td>
                          <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--text-primary)' }}>Rp {s.initialCash.toLocaleString('id-ID')}</td>
                          <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--accent-green)' }}>Rp {details?.cashSales.toLocaleString('id-ID') || s.cashSales.toLocaleString('id-ID')}</td>
                          <td className="py-3 px-3 text-right font-bold text-[var(--primary-hover)]">Rp {details?.nonCashSales.toLocaleString('id-ID') || s.nonCashSales.toLocaleString('id-ID')}</td>
                          <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--accent-red)' }}>Rp {details?.totalExpense.toLocaleString('id-ID') || s.totalExpense.toLocaleString('id-ID')}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              s.status === 'OPEN'
                                ? 'bg-[var(--success-soft)] text-[var(--accent-green)] border border-[#bbf7d0]'
                                : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                            }`}>
                              {s.status === 'OPEN' ? 'OPEN (AKTIF)' : 'CLOSED'}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && details && (
                          <tr>
                            <td colSpan={10} className="px-3 pb-4">
                              <div className="rounded-2xl border p-4 space-y-4"
                                style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)' }}>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                                  {[
                                    ['Order lunas', `${details.orderCount} struk`],
                                    ['Void transaksi', `${details.voidCount} struk`],
                                    ['Diskon', `Rp ${details.totalDiscount.toLocaleString('id-ID')}`],
                                    ['Pajak PB1', `Rp ${details.totalTax.toLocaleString('id-ID')}`],
                                    ['Omset bruto', `Rp ${details.grossSales.toLocaleString('id-ID')}`],
                                    ['Tunai', `Rp ${details.cashSales.toLocaleString('id-ID')}`],
                                    ['QRIS', `Rp ${details.qrisSales.toLocaleString('id-ID')}`],
                                    ['Debit', `Rp ${details.debitSales.toLocaleString('id-ID')}`],
                                    ['Pemasukan', `Rp ${details.totalIncome.toLocaleString('id-ID')}`],
                                    ['Pengeluaran', `Rp ${details.totalExpense.toLocaleString('id-ID')}`],
                                  ].map(([label, value]) => (
                                    <div key={label} className="rounded-xl border px-3 py-2.5"
                                      style={{ borderColor: 'var(--panel-border-light)', background: 'var(--surface-primary)' }}>
                                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                                      <p className="mt-1 text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                                    </div>
                                  ))}
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                  <div className="rounded-xl border px-3 py-3"
                                    style={{ borderColor: 'var(--panel-border-light)', background: 'var(--surface-primary)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Expected Cash</p>
                                    <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Rp {details.expectedCash.toLocaleString('id-ID')}</p>
                                  </div>
                                  <div className="rounded-xl border px-3 py-3"
                                    style={{ borderColor: 'var(--panel-border-light)', background: 'var(--surface-primary)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Actual Cash</p>
                                    <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Rp {details.actualCash.toLocaleString('id-ID')}</p>
                                  </div>
                                  <div className="rounded-xl border px-3 py-3"
                                    style={{ borderColor: 'var(--panel-border-light)', background: 'var(--surface-primary)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Selisih Kas</p>
                                    <p className="mt-1 text-sm font-bold" style={{ color: details.varianceAmount < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                                      Rp {details.varianceAmount.toLocaleString('id-ID')}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                                  <span>Void nominal: Rp {details.voidAmount.toLocaleString('id-ID')}</span>
                                  {s.notes && <span>Catatan: {s.notes}</span>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={shiftPagination.page}
            pageSize={shiftPagination.pageSize}
            totalItems={shiftPagination.totalItems}
            totalPages={shiftPagination.totalPages}
            startItem={shiftPagination.startItem}
            endItem={shiftPagination.endItem}
            onPageChange={shiftPagination.setPage}
            onPageSizeChange={shiftPagination.setPageSize}
            itemLabel="shift"
          />
        </div>
      )}

      {activeTab === 'ATTENDANCE_HISTORY' && (
        <div className="ui-card p-6 space-y-4">
          <div>
            <h2 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
              <UserCheck className="h-5 w-5" style={{ color: 'var(--accent-green)' }} />
              Histori Presensi & Kehadiran Karyawan
            </h2>
              <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>Rekapitulasi waktu masuk/keluar kerja, ketepatan waktu, dan validasi lokasi GPS.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead>
                <tr className="border-b text-[11px] font-bold uppercase tracking-wider"
                  style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                  <th className="py-3 px-3">Bukti Selfie</th>
                  <th className="py-3 px-3">Nama Karyawan</th>
                  <th className="py-3 px-3">Role / Jabatan</th>
                  <th className="py-3 px-3">Aksi Presensi</th>
                  <th className="py-3 px-3">Waktu Presensi</th>
                  <th className="py-3 px-3">Ketepatan Waktu</th>
                  <th className="py-3 px-3">Lokasi / GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--panel-border-light)' }}>
                {attendances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center font-bold" style={{ color: 'var(--text-tertiary)' }}>Belum ada catatan presensi karyawan</td>
                  </tr>
                ) : (
                  attendancePagination.visibleItems.map((att) => (
                    <tr key={att.id} className="transition-colors"
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-secondary)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}>
                      <td className="py-3 px-3">
                        <div className="h-9 w-9 overflow-hidden rounded-full border"
                          style={{ borderColor: 'var(--panel-border)' }}>
                          {att.photoUrl ? <img src={att.photoUrl} alt={att.staffName} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white" style={{ background: 'var(--primary)' }}>{att.staffName.slice(0, 2).toUpperCase()}</div>}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold" style={{ color: 'var(--text-primary)' }}>{att.staffName}</td>
                      <td className="py-3 px-3">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={{ background: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>{att.role}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          att.type === 'CLOCK_IN' ? 'bg-[var(--brand-100)] text-[var(--primary-text)] border border-[var(--brand-200)]' : 'bg-[var(--primary-hover)] text-white'
                        }`}>
                          {att.type === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{new Date(att.timestamp).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3">
                        {att.status === 'LATE' ? (
                          <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: 'var(--danger-soft)', color: 'var(--accent-red)', borderColor: '#fecaca' }}>
                            Terlambat ({att.minutesLate || 0} m)
                          </span>
                        ) : (
                          <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: 'var(--success-soft)', color: 'var(--accent-green)', borderColor: '#bbf7d0' }}>
                            Tepat Waktu
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {att.location}
                        {att.gpsValidated && <span className="mt-0.5 block text-[11px] font-bold" style={{ color: 'var(--accent-green)' }}>📍 GPS Valid</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={attendancePagination.page}
            pageSize={attendancePagination.pageSize}
            totalItems={attendancePagination.totalItems}
            totalPages={attendancePagination.totalPages}
            startItem={attendancePagination.startItem}
            endItem={attendancePagination.endItem}
            onPageChange={attendancePagination.setPage}
            onPageSizeChange={attendancePagination.setPageSize}
            itemLabel="presensi"
          />
        </div>
      )}

      {activeTab === 'INVENTORY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">TOTAL BAHAN</p>
              <p className="ui-stat-value text-[var(--text-primary)]">{inventoryMaterials.length}</p>
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Bahan baku sesuai filter cabang</p>
            </div>
            <div className="ui-card bg-[var(--warning-soft)] border-amber-200 p-5 space-y-1">
              <p className="ui-stat-label text-amber-700">STOK MENIPIS</p>
              <p className="ui-stat-value text-amber-700">{inventoryTotals.lowStockCount}</p>
              <p className="text-[11px] font-bold text-amber-700/80">Perlu restock segera</p>
            </div>
            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">NILAI PERSEDIAAN</p>
              <p className="ui-stat-value text-[var(--primary-text)]">Rp {inventoryTotals.totalValue.toLocaleString('id-ID')}</p>
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Stok saat ini × biaya/unit</p>
            </div>
            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">PEMAKAIAN PERIODE</p>
              <p className="ui-stat-value text-[var(--accent-green)]">{inventoryTotals.totalUsage.toLocaleString('id-ID')}</p>
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Estimasi resep dari order lunas</p>
            </div>
          </div>

          <div className="ui-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[var(--primary-hover)]" />
                  Ringkasan Persediaan Bahan
                </h2>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Pantau stok aktif, kebutuhan restock, nilai persediaan, dan estimasi pemakaian bahan pada periode ini.
                </p>
              </div>

              <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold"
                style={{ background: 'var(--surface-secondary)', borderColor: 'var(--panel-border)' }}>
                <Search className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  placeholder="Cari bahan / cabang..."
                  value={inventorySearchTerm}
                  onChange={(event) => setInventorySearchTerm(event.target.value)}
                  className="w-44 bg-transparent text-[12px] font-bold outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b text-[11px] font-bold uppercase tracking-wider"
                    style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                    <th className="py-3 px-3">Bahan Baku</th>
                    {branchFilter === 'ALL' && <th className="py-3 px-3">Cabang</th>}
                    <th className="py-3 px-3">Unit</th>
                    <th className="py-3 px-3 text-right">Stok Saat Ini</th>
                    <th className="py-3 px-3 text-right">Min. Stok</th>
                    <th className="py-3 px-3 text-right">Terpakai</th>
                    <th className="py-3 px-3 text-right">Nilai Stok</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--panel-border-light)' }}>
                  {inventoryMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={branchFilter === 'ALL' ? 8 : 7} className="py-8 text-center font-bold" style={{ color: 'var(--text-tertiary)' }}>
                        Tidak ada bahan baku yang cocok dengan filter ini.
                      </td>
                    </tr>
                  ) : (
                    inventoryPagination.visibleItems.map((material) => {
                      const isLow = material.stockQuantity <= material.minStockThreshold;
                      const usage = inventoryUsageByMaterial.get(material.id) || 0;
                      const stockValue = material.stockQuantity * material.costPerUnit;
                      return (
                        <tr key={material.id} className="transition-colors"
                          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-secondary)'}
                          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}>
                          <td className="py-3 px-3">
                            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{material.name}</div>
                            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                              Biaya / {material.unit}: Rp {material.costPerUnit.toLocaleString('id-ID')}
                            </div>
                          </td>
                          {branchFilter === 'ALL' && (
                            <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{material.branchName || '-'}</td>
                          )}
                          <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{material.unit}</td>
                          <td className="py-3 px-3 text-right font-bold" style={{ color: isLow ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                            {material.stockQuantity.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3 text-right" style={{ color: 'var(--text-secondary)' }}>{material.minStockThreshold.toLocaleString('id-ID')}</td>
                          <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--primary-text)' }}>{usage.toLocaleString('id-ID')}</td>
                          <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--accent-green)' }}>Rp {stockValue.toLocaleString('id-ID')}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                              isLow
                                ? 'bg-[var(--warning-soft)] text-amber-700 border-amber-200'
                                : 'bg-[var(--success-soft)] text-[var(--accent-green)] border-[#bbf7d0]'
                            }`}>
                              {isLow ? 'Restock' : 'Aman'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <PaginationControls
              page={inventoryPagination.page}
              pageSize={inventoryPagination.pageSize}
              totalItems={inventoryPagination.totalItems}
              totalPages={inventoryPagination.totalPages}
              startItem={inventoryPagination.startItem}
              endItem={inventoryPagination.endItem}
              onPageChange={inventoryPagination.setPage}
              onPageSizeChange={inventoryPagination.setPageSize}
              itemLabel="bahan"
            />
          </div>

          <div className="ui-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-[var(--primary-hover)]" />
                  Log Mutasi Stok
                </h2>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Riwayat keluar-masuk stok pada periode terpilih, lengkap dengan alasan dan saldo akhir bahan.
                </p>
              </div>
              <span className="text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>
                {formatPeriodRange(period, periodRange)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b text-[11px] font-bold uppercase tracking-wider"
                    style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                    <th className="py-3 px-3">Tanggal</th>
                    {branchFilter === 'ALL' && <th className="py-3 px-3">Cabang</th>}
                    <th className="py-3 px-3">Bahan</th>
                    <th className="py-3 px-3">Jenis Mutasi</th>
                    <th className="py-3 px-3 text-right">Perubahan</th>
                    <th className="py-3 px-3 text-right">Saldo Akhir</th>
                    <th className="py-3 px-3">Referensi / Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--panel-border-light)' }}>
                  {inventoryMovementLoading ? (
                    <tr>
                      <td colSpan={branchFilter === 'ALL' ? 7 : 6} className="py-8 text-center font-bold" style={{ color: 'var(--text-tertiary)' }}>
                        Memuat log mutasi stok...
                      </td>
                    </tr>
                  ) : inventoryMovementError ? (
                    <tr>
                      <td colSpan={branchFilter === 'ALL' ? 7 : 6} className="py-8 text-center font-bold" style={{ color: 'var(--accent-red)' }}>
                        {inventoryMovementError}
                      </td>
                    </tr>
                  ) : inventoryMovements.length === 0 ? (
                    <tr>
                      <td colSpan={branchFilter === 'ALL' ? 7 : 6} className="py-8 text-center font-bold" style={{ color: 'var(--text-tertiary)' }}>
                        Belum ada mutasi stok pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    inventoryMovements.map((movement) => {
                      const delta = movement.stockAfter - movement.stockBefore;
                      const branchName = rawMaterials.find((material) => material.branchId === movement.branchId)?.branchName
                        || branches.find((branch) => branch.id === movement.branchId)?.name
                        || '-';
                      return (
                        <tr key={movement.id} className="transition-colors"
                          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-secondary)'}
                          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}>
                          <td className="py-3 px-3 font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {new Date(movement.createdAt).toLocaleString('id-ID')}
                          </td>
                          {branchFilter === 'ALL' && (
                            <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{branchName}</td>
                          )}
                          <td className="py-3 px-3 font-bold" style={{ color: 'var(--text-primary)' }}>{movement.rawMaterialName || movement.rawMaterialId}</td>
                          <td className="py-3 px-3">
                            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                              style={{ background: 'var(--surface-secondary)', color: 'var(--text-primary)' }}>
                              {STOCK_MOVEMENT_LABELS[movement.type]}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold" style={{ color: delta < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                            {delta > 0 ? '+' : ''}{delta.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--text-primary)' }}>
                            {movement.stockAfter.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>
                            {movement.reason || movement.orderId || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <PaginationControls
              page={inventoryMovementPage}
              pageSize={inventoryMovementPageSize}
              totalItems={inventoryMovementTotal}
              totalPages={inventoryMovementTotalPages}
              startItem={inventoryMovementStartItem}
              endItem={inventoryMovementEndItem}
              onPageChange={setInventoryMovementPage}
              onPageSizeChange={(pageSize) => {
                setInventoryMovementPageSize(pageSize);
                setInventoryMovementPage(1);
              }}
              itemLabel="mutasi"
            />
          </div>
        </div>
      )}
    </div>
  );
};
