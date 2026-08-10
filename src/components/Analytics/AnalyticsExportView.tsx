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
import { Order, MenuItem, Shift, AttendanceRecord, ExpenseIncomeRecord, RestaurantProfile } from '../../types/pos';
import { DBStorage } from '../../services/dbStorage';

interface AnalyticsExportViewProps {
  orders: Order[];
  menuItems: MenuItem[];
  currentShift: Shift;
  allShifts?: Shift[];
  attendanceRecords?: AttendanceRecord[];
  expenseRecords?: ExpenseIncomeRecord[];
  profile?: RestaurantProfile;
}

type AnalyticsTab = 'OVERVIEW' | 'TOP_ITEMS' | 'VOID' | 'TAX_DISCOUNT' | 'SHIFT_HISTORY' | 'ATTENDANCE_HISTORY';

export const AnalyticsExportView: React.FC<AnalyticsExportViewProps> = ({
  orders,
  menuItems,
  currentShift,
  allShifts: propShifts,
  attendanceRecords: propAttendance,
  expenseRecords: propExpenses,
  profile: propProfile
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('OVERVIEW');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const shifts = useMemo(() => propShifts || DBStorage.getShiftHistory(), [propShifts]);
  const attendances = useMemo(() => propAttendance || DBStorage.getAttendanceRecords(), [propAttendance]);
  const expenses = useMemo(() => propExpenses || DBStorage.getExpenseRecords(), [propExpenses]);
  const profile = useMemo(() => propProfile || DBStorage.getProfile(), [propProfile]);

  const paidOrders = useMemo(() => orders.filter((o) => o.paymentStatus === 'PAID' && o.status !== 'CANCELLED'), [orders]);
  const voidOrders = useMemo(() => orders.filter((o) => o.status === 'CANCELLED'), [orders]);

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

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'No Order,Tanggal,Customer,Meja,Tipe,Metode,Subtotal,Diskon,Pajak,Total,Status\n';

    orders.forEach((o) => {
      const row = `"${o.orderNumber}","${new Date(o.createdAt).toLocaleString('id-ID')}","${o.customerName}","${o.tableNumber}","${o.type}","${o.paymentMethod || 'CASH'}",${o.subtotal || 0},${o.discount || 0},${o.tax || 0},${o.total},"${o.status}"`;
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Penjualan_NusantaraPOS_${new Date().toISOString().slice(0, 10)}.csv`);
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
    link.setAttribute('download', `Riwayat_Shift_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="flex-1 bg-[#F8FAFC] p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col gap-6 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1714] tracking-tight flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-[#EA580C]" />
            Dashboard Monitoring & Analitik Laporan
          </h1>
          <p className="text-xs text-slate-500 font-bold mt-1">
            Pantau real-time grafik omset, menu terlaris, riwayat void, pajak PB1, histori shift, & presensi karyawan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" /> Export CSV Transaksi
          </button>

          <button
            type="button"
            onClick={handlePrintPDF}
            className="px-4 py-2.5 bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 text-white rounded-full text-xs font-black shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" /> Cetak Laporan PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-[#1A1714] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-orange-400" />
          Ringkasan & Grafik
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TOP_ITEMS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'TOP_ITEMS'
              ? 'bg-[#1A1714] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-400" />
          Menu Terlaris ({topSellingList.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('VOID')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'VOID'
              ? 'bg-[#1A1714] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Ban className="w-4 h-4 text-rose-500" />
          Riwayat Void ({voidCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TAX_DISCOUNT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'TAX_DISCOUNT'
              ? 'bg-[#1A1714] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Receipt className="w-4 h-4 text-purple-400" />
          Pajak & Diskon
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SHIFT_HISTORY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'SHIFT_HISTORY'
              ? 'bg-[#1A1714] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <History className="w-4 h-4 text-blue-400" />
          Histori Shift ({shifts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ATTENDANCE_HISTORY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'ATTENDANCE_HISTORY'
              ? 'bg-[#1A1714] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4 text-emerald-400" />
          Histori Presensi ({attendances.length})
        </button>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-[#EAE3DB] shadow-2xs space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">TOTAL OMSET HARI INI</p>
              <p className="text-2xl font-black text-[#EA580C]">Rp {grossOmset.toLocaleString('id-ID')}</p>
              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> Bersih (ex. tax): Rp {netOmset.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#EAE3DB] shadow-2xs space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">STRUK TRANSAKSI LUNAS</p>
              <p className="text-2xl font-black text-slate-900">{totalTransactions} <span className="text-xs font-bold text-slate-400">Order</span></p>
              <span className="text-[10px] font-bold text-[#EA580C] block">Rata-rata Rp {avgOrderValue.toLocaleString('id-ID')} / Order</span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#EAE3DB] shadow-2xs space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">METODE TUNAI (CASH)</p>
              <p className="text-2xl font-black text-emerald-600">Rp {cashTotal.toLocaleString('id-ID')}</p>
              <span className="text-[10px] font-bold text-slate-400 block">{grossOmset > 0 ? Math.round((cashTotal / grossOmset) * 100) : 0}% dari Total Omset</span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#EAE3DB] shadow-2xs space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">METODE NON-TUNAI (QRIS/DEBIT)</p>
              <p className="text-2xl font-black text-purple-600">Rp {(qrisTotal + debitTotal).toLocaleString('id-ID')}</p>
              <span className="text-[10px] font-bold text-slate-400 block">QRIS: Rp {qrisTotal.toLocaleString('id-ID')} • Debit: Rp {debitTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-[#EAE3DB] shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-[#1A1714] text-sm flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-orange-500" />
                  Distribusi Metode Pembayaran
                </h2>
                <span className="text-[10px] font-black text-slate-400 uppercase">Real-time</span>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-black text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> TUNAI (CASH)</span>
                    <span>Rp {cashTotal.toLocaleString('id-ID')} ({grossOmset > 0 ? Math.round((cashTotal / grossOmset) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${grossOmset > 0 ? (cashTotal / grossOmset) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-black text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"/> QRIS (E-WALLET & M-BANKING)</span>
                    <span>Rp {qrisTotal.toLocaleString('id-ID')} ({grossOmset > 0 ? Math.round((qrisTotal / grossOmset) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                    <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: `${grossOmset > 0 ? (qrisTotal / grossOmset) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-black text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"/> DEBIT / KREDIT EDC</span>
                    <span>Rp {debitTotal.toLocaleString('id-ID')} ({grossOmset > 0 ? Math.round((debitTotal / grossOmset) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                    <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${grossOmset > 0 ? (debitTotal / grossOmset) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-[#EAE3DB] shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-[#1A1714] text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Grafik Analisis Jam Sibuk Penjualan (Peak Hours)
                </h2>
                <span className="text-[10px] font-black text-slate-400">07:00 - 22:00</span>
              </div>

              <div className="flex items-end gap-1.5 h-36 pt-4 px-2 border-b border-slate-100">
                {hourlyPeakData.map((item) => {
                  const pct = Math.round((item.revenue / maxHourlyRevenue) * 100);
                  return (
                    <div key={item.hourLabel} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] font-bold p-1 rounded-lg pointer-events-none whitespace-nowrap shadow-md z-10">
                        {item.hourLabel}: Rp {item.revenue.toLocaleString('id-ID')} ({item.count} order)
                      </div>
                      <div className="w-full bg-slate-100 rounded-t-md overflow-hidden flex items-end h-28">
                        <div
                          className="w-full bg-gradient-to-t from-orange-600 to-amber-400 rounded-t-md transition-all duration-500 group-hover:from-orange-500 group-hover:to-amber-300"
                          style={{ height: `${pct > 0 ? pct : 4}%` }}
                        />
                      </div>
                      <span className="text-[8px] font-black text-slate-400 transform -rotate-45 origin-top-left mt-1">{item.hourLabel.slice(0, 2)}h</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] font-bold text-slate-400 text-center">Tinggi grafik menunjukkan omset penjualan pada setiap jam operasional.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'TOP_ITEMS' && (
        <div className="bg-white rounded-3xl p-6 border border-[#EAE3DB] shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-[#1A1714] text-base flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                Peringkat Menu Terlaris & Margin Profit
              </h2>
              <p className="text-xs font-bold text-slate-500">Diurutkan berdasarkan jumlah porsi terjual dan kontribusi omset.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama menu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent outline-none text-xs font-black text-slate-900 w-32"
                />
              </div>

              {['ALL', 'BAKSO', 'MIE AYAM', 'MINUMAN', 'TAMBAHAN'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-black cursor-pointer transition-all ${
                    categoryFilter === cat ? 'bg-orange-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? 'Semua' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-3">Peringkat</th>
                  <th className="py-3 px-3">Nama Menu</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3 text-center">Porsi Terjual</th>
                  <th className="py-3 px-3 text-right">Total Omset</th>
                  <th className="py-3 px-3 text-right">HPP Cost</th>
                  <th className="py-3 px-3 text-right">Estimasi Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topSellingList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">Tidak ada data penjualan menu</td>
                  </tr>
                ) : (
                  topSellingList.map((item, idx) => {
                    const profit = item.revenue - item.hppCost;
                    const marginPct = item.revenue > 0 ? Math.round((profit / item.revenue) * 100) : 0;
                    return (
                      <tr key={item.name} className="hover:bg-orange-50/40 transition-colors">
                        <td className="py-3 px-3 font-black">
                          <span className={`w-6 h-6 rounded-lg text-white font-black text-xs inline-flex items-center justify-center ${
                            idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-800'
                          }`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-black text-slate-900">{item.name}</td>
                        <td className="py-3 px-3">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-black">{item.category}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-black text-slate-900">{item.qty} porsi</td>
                        <td className="py-3 px-3 text-right font-black text-emerald-600">Rp {item.revenue.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-500">Rp {item.hppCost.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-black text-orange-600 block">Rp {profit.toLocaleString('id-ID')}</span>
                          <span className="text-[9px] font-bold text-emerald-600">Margin {marginPct}%</span>
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
            <div className="bg-white p-5 rounded-3xl border border-rose-200 bg-rose-50/40 shadow-2xs space-y-1">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider">TOTAL NOMINAL VOID</p>
              <p className="text-2xl font-black text-rose-600">Rp {totalVoidNominal.toLocaleString('id-ID')}</p>
              <p className="text-[10px] font-bold text-slate-400">Total nilai pesanan yang dibatalkan</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-2xs space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">JUMLAH TRANSAKSI VOID</p>
              <p className="text-2xl font-black text-slate-900">{voidCount} <span className="text-xs text-slate-400 font-bold">Struk</span></p>
              <p className="text-[10px] font-bold text-slate-400">Frekuensi pembatalan pesanan</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">RASIO VOID vs TOTAL OMSET</p>
              <p className="text-2xl font-black text-amber-600">{grossOmset > 0 ? ((totalVoidNominal / grossOmset) * 100).toFixed(1) : 0}%</p>
              <p className="text-[10px] font-bold text-slate-400">Toleransi VOID ideal &lt; 2%</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#EAE3DB] shadow-2xs space-y-4">
            <h2 className="font-black text-[#1A1714] text-base flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-500" />
              Daftar Rincian Pesanan Dibatalkan (Void)
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-3">No Order</th>
                    <th className="py-3 px-3">Tanggal / Waktu</th>
                    <th className="py-3 px-3">Customer / Meja</th>
                    <th className="py-3 px-3">Item Dibatalkan</th>
                    <th className="py-3 px-3">Kasir Penanggung Jawab</th>
                    <th className="py-3 px-3 text-right">Nominal Void</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {voidOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">Tidak ada catatan pembatalan (Void) hari ini</td>
                    </tr>
                  ) : (
                    voidOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="py-3 px-3 font-black text-rose-600 font-mono">{o.orderNumber}</td>
                        <td className="py-3 px-3 text-slate-600">{new Date(o.createdAt).toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-slate-900">{o.customerName} (Meja {o.tableNumber})</td>
                        <td className="py-3 px-3 text-slate-600">
                          {o.items.map((it) => `${it.quantity}x ${it.menuName}`).join(', ')}
                        </td>
                        <td className="py-3 px-3 text-slate-700">{o.cashierName || 'Kasir'}</td>
                        <td className="py-3 px-3 text-right font-black text-rose-600">Rp {o.total.toLocaleString('id-ID')}</td>
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
            <div className="bg-white p-5 rounded-3xl border border-purple-200 bg-purple-50/40 shadow-2xs space-y-1">
              <p className="text-[10px] font-black text-purple-600 uppercase tracking-wider">TOTAL PAJAK RESTO (PB1)</p>
              <p className="text-2xl font-black text-purple-700">Rp {totalTax.toLocaleString('id-ID')}</p>
              <p className="text-[10px] font-bold text-slate-400">Pajak restoran yang terkumpul</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-amber-200 bg-amber-50/40 shadow-2xs space-y-1">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">TOTAL DISKON DIBERIKAN</p>
              <p className="text-2xl font-black text-amber-700">Rp {totalDiscount.toLocaleString('id-ID')}</p>
              <p className="text-[10px] font-bold text-slate-400">Potongan harga promo & voucher</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">SUBTOTAL KOTOR (GROSS)</p>
              <p className="text-2xl font-black text-slate-900">Rp {totalSubtotal.toLocaleString('id-ID')}</p>
              <p className="text-[10px] font-bold text-slate-400">Subtotal murni sebelum diskon & pajak</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#EAE3DB] shadow-2xs space-y-4">
            <h2 className="font-black text-[#1A1714] text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-600" />
              Audit Rincian Pajak & Diskon Per Struk
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-3">No Order</th>
                    <th className="py-3 px-3">Waktu</th>
                    <th className="py-3 px-3 text-right">Subtotal</th>
                    <th className="py-3 px-3 text-right">Diskon</th>
                    <th className="py-3 px-3 text-right">Pajak (PB1)</th>
                    <th className="py-3 px-3 text-right">Total Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paidOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">Belum ada transaksi lunas</td>
                    </tr>
                  ) : (
                    paidOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-black font-mono text-slate-900">{o.orderNumber}</td>
                        <td className="py-3 px-3 text-slate-600">{new Date(o.createdAt).toLocaleTimeString('id-ID')}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-700">Rp {(o.subtotal || o.total).toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right font-bold text-rose-600">-Rp {(o.discount || 0).toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right font-bold text-purple-600">+Rp {(o.tax || 0).toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right font-black text-emerald-600">Rp {o.total.toLocaleString('id-ID')}</td>
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
        <div className="bg-white rounded-3xl p-6 border border-[#EAE3DB] shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-[#1A1714] text-base flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                Histori Shift Operasional & Rekonsiliasi Kas Laci
              </h2>
              <p className="text-xs font-bold text-slate-500">Log lengkap modal awal, pemasukan kasir, pengeluaran petty cash, & status shift.</p>
            </div>
            <button
              type="button"
              onClick={handleExportShiftCSV}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export Shift CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
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
              <tbody className="divide-y divide-slate-100">
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-bold">Belum ada riwayat shift recorded</td>
                  </tr>
                ) : (
                  shifts.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-black text-slate-900">{s.id}</td>
                      <td className="py-3 px-3 font-black text-slate-900">{s.staffName} <span className="text-[10px] font-bold text-orange-600">({s.staffRole})</span></td>
                      <td className="py-3 px-3 text-slate-600">{new Date(s.startTime).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-slate-600">{s.endTime ? new Date(s.endTime).toLocaleString('id-ID') : '-'}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-700">Rp {s.initialCash.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">Rp {s.cashSales.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-right font-bold text-purple-600">Rp {s.nonCashSales.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-right font-bold text-rose-600">Rp {s.totalExpense.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-100 text-slate-600'
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
        <div className="bg-white rounded-3xl p-6 border border-[#EAE3DB] shadow-2xs space-y-4">
          <div>
            <h2 className="font-black text-[#1A1714] text-base flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-500" />
              Histori Presensi & Kehadiran Karyawan
            </h2>
            <p className="text-xs font-bold text-slate-500">Rekapitulasi waktu masuk/keluar kerja, ketepatan waktu, dan validasi lokasi GPS.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-3">Bukti Selfie</th>
                  <th className="py-3 px-3">Nama Karyawan</th>
                  <th className="py-3 px-3">Role / Jabatan</th>
                  <th className="py-3 px-3">Aksi Presensi</th>
                  <th className="py-3 px-3">Waktu Presensi</th>
                  <th className="py-3 px-3">Ketepatan Waktu</th>
                  <th className="py-3 px-3">Lokasi / GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">Belum ada catatan presensi karyawan</td>
                  </tr>
                ) : (
                  attendances.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200">
                          {att.photoUrl ? <img src={att.photoUrl} alt={att.staffName} className="w-full h-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-[#1A1917] text-[9px] font-black text-white">{att.staffName.slice(0, 2).toUpperCase()}</div>}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-black text-slate-900">{att.staffName}</td>
                      <td className="py-3 px-3"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-black">{att.role}</span></td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          att.type === 'CLOCK_IN' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-800 text-white'
                        }`}>
                          {att.type === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-mono">{new Date(att.timestamp).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3">
                        {att.status === 'LATE' ? (
                          <span className="text-rose-600 font-black text-[10px] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            Terlambat ({att.minutesLate || 0} m)
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-black text-[10px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Tepat Waktu
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px]">
                        {att.location}
                        {att.gpsValidated && <span className="text-emerald-600 font-bold block text-[9px]">📍 GPS Valid</span>}
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
