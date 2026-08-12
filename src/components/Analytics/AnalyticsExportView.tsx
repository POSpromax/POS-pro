import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Download,
  Printer,
  DollarSign,
  CreditCard,
  PieChart,
  BarChart3,
  ArrowUpRight,
  Ban,
  Receipt,
  History,
  UserCheck,
  Clock,
  Flame,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Search,
  Calendar,
  Sparkles,
  Percent,
  FileText,
  MapPin,
  Utensils,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Order, MenuItem, Shift, AttendanceRecord, ExpenseIncomeRecord, RestaurantProfile, Branch } from '../../types/pos';
import { DBStorage } from '../../services/dbStorage';
import { ReportPeriod, REPORT_PERIODS, formatPeriodRange, getPeriodRange, isWithinPeriod } from '../../utils/reportPeriod';

interface AnalyticsExportViewProps {
  orders: Order[];
  menuItems: MenuItem[];
  currentShift: Shift;
  allShifts?: Shift[];
  attendanceRecords?: AttendanceRecord[];
  expenseRecords?: ExpenseIncomeRecord[];
  profile?: RestaurantProfile;
  branches?: Branch[];
  currentBranchId?: string;
}

type AnalyticsTab = 'OVERVIEW' | 'TOP_ITEMS' | 'VOID' | 'TAX_DISCOUNT' | 'SHIFT_HISTORY' | 'ATTENDANCE_HISTORY';

export const AnalyticsExportView: React.FC<AnalyticsExportViewProps> = ({
  orders,
  menuItems,
  currentShift,
  allShifts: propShifts,
  attendanceRecords: propAttendance,
  expenseRecords: propExpenses,
  profile: propProfile,
  branches = [],
  currentBranchId
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('OVERVIEW');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const [period, setPeriod] = useState<ReportPeriod>('TODAY');
  // Filter cabang: default cabang aktif; 'ALL' = gabungan semua cabang.
  const [branchFilter, setBranchFilter] = useState<string>(currentBranchId || 'ALL');

  const allShifts = useMemo(() => propShifts || DBStorage.getShiftHistory(), [propShifts]);
  const allAttendances = useMemo(() => propAttendance || DBStorage.getAttendanceRecords(), [propAttendance]);
  const allExpenses = useMemo(() => propExpenses || DBStorage.getExpenseRecords(), [propExpenses]);
  const profile = useMemo(() => propProfile || DBStorage.getProfile(), [propProfile]);

  // Semua metrik di bawah membaca data yang sudah dipotong rentang waktu terpilih
  // dan cabang terpilih (atau gabungan semua cabang bila 'ALL').
  const periodRange = useMemo(() => getPeriodRange(period), [period]);
  const branchScopedOrders = useMemo(
    () => (branchFilter === 'ALL' ? orders : orders.filter((o) => (o.branchId || currentBranchId) === branchFilter)),
    [orders, branchFilter, currentBranchId],
  );
  const scopedOrders = useMemo(() => branchScopedOrders.filter((o) => isWithinPeriod(o.createdAt, periodRange)), [branchScopedOrders, periodRange]);
  const shifts = useMemo(() => allShifts.filter((s) => isWithinPeriod(s.startTime, periodRange)), [allShifts, periodRange]);
  const attendances = useMemo(() => allAttendances.filter((a) => isWithinPeriod(a.timestamp, periodRange)), [allAttendances, periodRange]);
  const expenses = useMemo(() => allExpenses.filter((e) => isWithinPeriod(e.timestamp, periodRange)), [allExpenses, periodRange]);

  const paidOrders = useMemo(() => scopedOrders.filter((o) => o.paymentStatus === 'PAID' && o.status !== 'CANCELLED'), [scopedOrders]);
  const voidOrders = useMemo(() => scopedOrders.filter((o) => o.status === 'CANCELLED'), [scopedOrders]);

  const grossOmset = useMemo(() => paidOrders.reduce((acc, o) => acc + o.total, 0), [paidOrders]);
  const totalSubtotal = useMemo(() => paidOrders.reduce((acc, o) => acc + (o.subtotal || o.total), 0), [paidOrders]);
  const totalTax = useMemo(() => paidOrders.reduce((acc, o) => acc + (o.tax || 0), 0), [paidOrders]);
  const totalDiscount = useMemo(() => paidOrders.reduce((acc, o) => acc + (o.discount || 0), 0), [paidOrders]);
  const netOmset = grossOmset - totalTax;

  const totalTransactions = paidOrders.length;
  const avgOrderValue = totalTransactions > 0 ? Math.round(grossOmset / totalTransactions) : 0;

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
            revenue: item.totalPrice,
            hppCost: hpp
          };
        } else {
          map[item.menuName].qty += item.quantity;
          map[item.menuName].revenue += item.totalPrice;
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

  const maxHourlyRevenue = useMemo(() => Math.max(...hourlyPeakData.map((h) => h.revenue), 1), [hourlyPeakData]);

  // Tren per tanggal dalam periode terpilih — melihat naik-turun omset harian.
  const dailyTrendData = useMemo(() => {
    const buckets = new Map<string, { key: string; label: string; revenue: number; count: number }>();
    paidOrders.forEach((order) => {
      const date = new Date(order.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const bucket = buckets.get(key) || {
        key,
        label: date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        revenue: 0,
        count: 0
      };
      bucket.revenue += order.total;
      bucket.count += 1;
      buckets.set(key, bucket);
    });
    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [paidOrders]);

  const maxDailyRevenue = useMemo(() => Math.max(...dailyTrendData.map((d) => d.revenue), 1), [dailyTrendData]);

  // Tren per BULAN — untuk periode Tahun.
  const monthlyTrendData = useMemo(() => {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const buckets = new Map<string, { key: string; label: string; revenue: number; count: number }>();
    paidOrders.forEach((order) => {
      const date = new Date(order.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key) || { key, label: names[date.getMonth()], revenue: 0, count: 0 };
      bucket.revenue += order.total;
      bucket.count += 1;
      buckets.set(key, bucket);
    });
    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [paidOrders]);

  // Grafik tren utama MENYESUAIKAN periode: Hari ini/Kemarin→per jam,
  // Minggu/Bulan→per tanggal, Tahun/Semua→per bulan.
  const trendChart = useMemo(() => {
    if (period === 'TODAY' || period === 'YESTERDAY') {
      return { title: 'Tren Omset per Jam', data: hourlyPeakData.map((h) => ({ label: h.hourLabel, revenue: h.revenue, count: h.count })) };
    }
    if (period === 'YEAR' || period === 'ALL') {
      return { title: 'Tren Omset per Bulan', data: monthlyTrendData.map((m) => ({ label: m.label, revenue: m.revenue, count: m.count })) };
    }
    return { title: 'Tren Omset per Tanggal', data: dailyTrendData.map((d) => ({ label: d.label, revenue: d.revenue, count: d.count })) };
  }, [period, hourlyPeakData, dailyTrendData, monthlyTrendData]);
  const maxTrendRevenue = useMemo(() => Math.max(...trendChart.data.map((d) => d.revenue), 1), [trendChart]);

  // Hari apa yang paling laris — dirata-rata supaya periode yang memuat lebih
  // banyak hari Senin daripada Minggu tidak otomatis memenangkan Senin.
  const weekdayPerformance = useMemo(() => {
    const names = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const rows = names.map((name) => ({ name, revenue: 0, count: 0, days: new Set<string>() }));
    paidOrders.forEach((order) => {
      const date = new Date(order.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const row = rows[date.getDay()];
      row.revenue += order.total;
      row.count += 1;
      row.days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    });
    // Urutan tampil Senin dulu, sesuai kebiasaan minggu kerja.
    const ordered = [...rows.slice(1), rows[0]];
    return ordered.map((row) => ({
      name: row.name,
      revenue: row.revenue,
      count: row.count,
      activeDays: row.days.size,
      avgRevenue: row.days.size > 0 ? Math.round(row.revenue / row.days.size) : 0
    }));
  }, [paidOrders]);

  const maxWeekdayAvg = useMemo(() => Math.max(...weekdayPerformance.map((d) => d.avgRevenue), 1), [weekdayPerformance]);
  const bestWeekday = useMemo(
    () => weekdayPerformance.reduce((best, row) => (row.avgRevenue > best.avgRevenue ? row : best), weekdayPerformance[0]),
    [weekdayPerformance]
  );

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'No Order,Tanggal,Customer,Meja,Tipe,Metode,Subtotal,Diskon,Pajak,Total,Status\n';

    scopedOrders.forEach((o) => {
      const row = `"${o.orderNumber}","${new Date(o.createdAt).toLocaleString('id-ID')}","${o.customerName}","${o.tableNumber}","${o.type}","${o.paymentMethod || 'CASH'}",${o.subtotal || 0},${o.discount || 0},${o.tax || 0},${o.total},"${o.status}"`;
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
            Pantau real-time grafik omset, menu terlaris, riwayat void, pajak PB1, histori shift, &amp; presensi karyawan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            <span style={{ color: 'var(--text-tertiary)' }}> · {scopedOrders.length} order</span>
          </span>
        </div>

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
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="ui-card ui-card-feature p-5 space-y-1">
              <p className="ui-stat-label text-[var(--primary-soft)] opacity-90">TOTAL OMSET HARI INI</p>
              <p className="ui-stat-value text-white">Rp {grossOmset.toLocaleString('id-ID')}</p>
              <span className="text-[11px] font-bold text-white/80 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> Bersih (ex. tax): Rp {netOmset.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">STRUK TRANSAKSI LUNAS</p>
              <p className="ui-stat-value text-[var(--text-primary)]">{totalTransactions} <span className="text-xs font-bold text-[var(--text-tertiary)]">Order</span></p>
              <span className="text-[11px] font-bold text-[var(--primary-text)] block">Rata-rata Rp {avgOrderValue.toLocaleString('id-ID')} / Order</span>
            </div>

            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">METODE TUNAI (CASH)</p>
              <p className="ui-stat-value text-[var(--accent-green)]">Rp {cashTotal.toLocaleString('id-ID')}</p>
              <span className="text-[11px] font-bold text-[var(--text-tertiary)] block">{grossOmset > 0 ? Math.round((cashTotal / grossOmset) * 100) : 0}% dari Total Omset</span>
            </div>

            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">METODE NON-TUNAI (QRIS/DEBIT)</p>
              <p className="ui-stat-value text-[var(--primary-text)]">Rp {(qrisTotal + debitTotal).toLocaleString('id-ID')}</p>
              <span className="text-[11px] font-bold text-[var(--text-tertiary)] block">QRIS: Rp {qrisTotal.toLocaleString('id-ID')} • Debit: Rp {debitTotal.toLocaleString('id-ID')}</span>
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
                  style={{ color: 'var(--text-tertiary)' }}>Real-time</span>
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
                  <Clock className="w-4 h-4 text-[var(--primary-text)]" />
                  Grafik Analisis Jam Sibuk Penjualan (Peak Hours)
                </h2>
                <span className="text-[11px] font-bold"
                  style={{ color: 'var(--text-tertiary)' }}>07:00 - 22:00</span>
              </div>

              <div className="flex items-end gap-1.5 h-36 pt-4 px-2 border-b"
                style={{ borderColor: 'var(--panel-border-light)' }}>
                {hourlyPeakData.map((item) => {
                  const pct = Math.round((item.revenue / maxHourlyRevenue) * 100);
                  return (
                    <div key={item.hourLabel} className="relative flex flex-1 flex-col items-center gap-1 group">
                      <div className="absolute -top-10 pointer-events-none z-10 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                        style={{ background: 'var(--primary)' }}>
                        {item.hourLabel}: Rp {item.revenue.toLocaleString('id-ID')} ({item.count} order)
                      </div>
                      <div className="flex h-28 w-full items-end overflow-hidden rounded-t-md"
                        style={{ background: 'var(--surface-secondary)' }}>
                        <div
                          className="w-full rounded-t-md transition-all duration-500"
                          style={{
                            height: `${pct > 0 ? pct : 4}%`,
                            background: 'linear-gradient(to top, var(--primary-solid), var(--primary-light))'
                          }}
                        />
                      </div>
                      <span className="mt-1 origin-top-left -rotate-45 transform text-[10px] font-bold"
                        style={{ color: 'var(--text-tertiary)' }}>{item.hourLabel.slice(0, 2)}h</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-center text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Tinggi grafik menunjukkan omset penjualan pada setiap jam operasional.
              </p>
            </div>

            {/* Tren omset adaptif: per jam / tanggal / bulan mengikuti periode */}
            <div className="ui-card p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--primary-text)]" />
                  {trendChart.title}
                </h2>
                <span className="text-[11px] font-bold"
                  style={{ color: 'var(--text-tertiary)' }}>{formatPeriodRange(period, periodRange)}</span>
              </div>

              {trendChart.data.length === 0 ? (
                <p className="py-8 text-center text-[12px] font-medium"
                  style={{ color: 'var(--text-tertiary)' }}>Belum ada transaksi lunas pada periode ini.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <div className="flex items-end gap-1.5 h-40 pt-4 px-1 border-b min-w-full"
                      style={{ borderColor: 'var(--panel-border-light)', minWidth: `${trendChart.data.length * 34}px` }}>
                      {trendChart.data.map((point, idx) => {
                        const pct = Math.round((point.revenue / maxTrendRevenue) * 100);
                        const isBest = point.revenue === maxTrendRevenue && point.revenue > 0;
                        return (
                          <div key={`${point.label}-${idx}`} className="relative flex min-w-[28px] flex-1 flex-col items-center gap-1 group">
                            <div className="absolute -top-10 pointer-events-none z-10 whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                              style={{ background: 'var(--primary)' }}>
                              {point.label}: Rp {point.revenue.toLocaleString('id-ID')} ({point.count} order)
                            </div>
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
                            <span className="whitespace-nowrap text-[10px] font-bold"
                              style={{ color: 'var(--text-tertiary)' }}>{point.label.split(' ')[0]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-center text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Batang oranye adalah titik dengan omset tertinggi pada periode ini.
                  </p>
                </>
              )}
            </div>

            {/* Hari paling laris dalam seminggu */}
            <div className="ui-card p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[var(--primary-text)]" />
                  Hari Paling Laris
                </h2>
                {bestWeekday && bestWeekday.avgRevenue > 0 && (
                  <span className="text-[11px] font-bold text-[var(--primary-text)] bg-[var(--brand-50)] border border-[var(--brand-200)] px-2.5 py-1 rounded-full">
                    Tertinggi: {bestWeekday.name}
                  </span>
                )}
              </div>

              {paidOrders.length === 0 ? (
                <p className="py-8 text-center text-[12px] font-medium"
                  style={{ color: 'var(--text-tertiary)' }}>Belum ada transaksi lunas pada periode ini.</p>
              ) : (
                <div className="space-y-2">
                  {weekdayPerformance.map((row) => {
                    const pct = Math.round((row.avgRevenue / maxWeekdayAvg) * 100);
                    const isBest = bestWeekday && row.name === bestWeekday.name && row.avgRevenue > 0;
                    return (
                      <div key={row.name} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-[11px] font-bold uppercase"
                          style={{ color: 'var(--text-secondary)' }}>{row.name.slice(0, 3)}</span>
                        <div className="flex-1 h-6 overflow-hidden rounded-full"
                          style={{ background: 'var(--surface-secondary)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct > 0 ? Math.max(pct, 2) : 0}%`,
                              background: isBest ? 'var(--primary-solid)' : 'var(--primary-hover)'
                            }}
                          />
                        </div>
                        <span className="w-32 shrink-0 text-right text-[11px] font-bold tabular-nums"
                          style={{ color: 'var(--text-primary)' }}>
                          Rp {row.avgRevenue.toLocaleString('id-ID')}
                        </span>
                        <span className="w-16 shrink-0 text-right text-[11px] font-medium tabular-nums"
                          style={{ color: 'var(--text-tertiary)' }}>
                          {row.count} order
                        </span>
                      </div>
                    );
                  })}
                  <p className="pt-1 text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Angka adalah rata-rata omset per hari buka, bukan total — supaya hari yang lebih sering muncul dalam periode tidak otomatis terlihat paling laris.
                  </p>
                </div>
              )}
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
                  topSellingList.map((item, idx) => {
                    const profit = item.revenue - item.hppCost;
                    const marginPct = item.revenue > 0 ? Math.round((profit / item.revenue) * 100) : 0;
                    return (
                      <tr key={item.name} className="hover:bg-[var(--brand-100)]/40 transition-colors">
                        <td className="py-3 px-3 font-bold">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold text-white ${
                            idx === 0 ? 'bg-[var(--accent-amber)]'
                            : idx === 1 ? 'bg-[var(--text-tertiary)]'
                            : idx === 2 ? 'bg-[var(--primary-hover)]'
                            : 'bg-[var(--surface-secondary)] !text-[var(--text-secondary)]'
                          }`}>#{idx + 1}</span>
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
                    voidOrders.map((o) => (
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
              <p className="ui-stat-label text-amber-700">TOTAL DISKON DIBERIKAN</p>
              <p className="ui-stat-value text-amber-700">Rp {totalDiscount.toLocaleString('id-ID')}</p>
              <p className="text-[11px] font-bold text-amber-700 opacity-80">Potongan harga promo & voucher</p>
            </div>
            <div className="ui-card p-5 space-y-1">
              <p className="ui-stat-label">SUBTOTAL KOTOR (GROSS)</p>
              <p className="ui-stat-value text-[var(--text-primary)]">Rp {totalSubtotal.toLocaleString('id-ID')}</p>
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Subtotal murni sebelum diskon & pajak</p>
            </div>
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
                    <th className="py-3 px-3 text-right">Subtotal</th>
                    <th className="py-3 px-3 text-right">Diskon</th>
                    <th className="py-3 px-3 text-right">Pajak (PB1)</th>
                    <th className="py-3 px-3 text-right">Total Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--panel-border-light)' }}>
                  {paidOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center font-bold" style={{ color: 'var(--text-tertiary)' }}>Belum ada transaksi lunas</td>
                    </tr>
                  ) : (
                    paidOrders.map((o) => (
                      <tr key={o.id} className="transition-colors"
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-secondary)'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}>
                        <td className="py-3 px-3 font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{o.orderNumber}</td>
                        <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{new Date(o.createdAt).toLocaleTimeString('id-ID')}</td>
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
                    <td colSpan={9} className="py-8 text-center font-bold" style={{ color: 'var(--text-tertiary)' }}>Belum ada riwayat shift recorded</td>
                  </tr>
                ) : (
                  shifts.map((s) => (
                    <tr key={s.id} className="transition-colors"
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-secondary)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}>
                      <td className="py-3 px-3 font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{s.id}</td>
                      <td className="py-3 px-3 font-bold" style={{ color: 'var(--text-primary)' }}>{s.staffName} <span className="text-[11px] font-bold" style={{ color: 'var(--primary-text)' }}>({s.staffRole})</span></td>
                      <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{new Date(s.startTime).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{s.endTime ? new Date(s.endTime).toLocaleString('id-ID') : '-'}</td>
                      <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--text-primary)' }}>Rp {s.initialCash.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--accent-green)' }}>Rp {s.cashSales.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-right font-bold text-[var(--primary-hover)]">Rp {s.nonCashSales.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--accent-red)' }}>Rp {s.totalExpense.toLocaleString('id-ID')}</td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                  attendances.map((att) => (
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
        </div>
      )}
    </div>
  );
};
