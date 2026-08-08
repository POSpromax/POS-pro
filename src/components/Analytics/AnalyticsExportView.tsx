import React from 'react';
import { TrendingUp, Download, Printer, DollarSign, CreditCard, PieChart, BarChart3, ArrowUpRight } from 'lucide-react';
import { Order, MenuItem, Shift } from '../../types/pos';

interface AnalyticsExportViewProps {
  orders: Order[];
  menuItems: MenuItem[];
  currentShift: Shift;
}

export const AnalyticsExportView: React.FC<AnalyticsExportViewProps> = ({
  orders,
  menuItems,
  currentShift
}) => {
  const totalRevenue = orders.reduce((acc, curr) => acc + curr.total, 0);
  const totalTransactions = orders.length;

  const cashTotal = orders.filter((o) => o.paymentMethod === 'CASH').reduce((a, b) => a + b.total, 0);
  const qrisTotal = orders.filter((o) => o.paymentMethod === 'QRIS').reduce((a, b) => a + b.total, 0);
  const debitTotal = orders.filter((o) => o.paymentMethod === 'DEBIT').reduce((a, b) => a + b.total, 0);

  // Download CSV Financial Report
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'No Order,Tanggal,Customer,Meja,Tipe,Metode,Total,Status\n';

    orders.forEach((o) => {
      const row = `${o.orderNumber},"${new Date(o.createdAt).toLocaleString('id-ID')}",${o.customerName},${o.tableNumber},${o.type},${o.paymentMethod || 'CASH'},${o.total},${o.paymentStatus}`;
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

  // Print PDF Financial Report
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="flex-1 bg-slate-100/70 p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-600" />
            Dashboard Analitik & Ekspor Laporan Keuangan
          </h1>
          <p className="text-xs text-[#9C9590] font-bold mt-1">
            Pantau performa penjualan harian, breakdown metode pembayaran, dan ekspor laporan keuangan dalam format CSV / PDF.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4" /> Ekspor CSV
          </button>

          <button
            onClick={handlePrintPDF}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4" /> Cetak / PDF
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-[#E8E0D8]/80 shadow-xs">
          <p className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider">TOTAL OMSET HARI INI</p>
          <p className="text-2xl font-bold text-[#1A1714] mt-1">Rp {totalRevenue.toLocaleString('id-ID')}</p>
          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 mt-1">
            <ArrowUpRight className="w-3 h-3" /> +18.4% dari kemarin
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E8E0D8]/80 shadow-xs">
          <p className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider">TOTAL STRUK TRANSAKSI</p>
          <p className="text-2xl font-bold text-[#1A1714] mt-1">{totalTransactions} <span className="text-xs font-bold text-[#B8B0A8]">Order</span></p>
          <span className="text-[10px] font-bold text-blue-600 mt-1 block">Rata-rata Rp {totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions).toLocaleString('id-ID') : 0} / Order</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E8E0D8]/80 shadow-xs">
          <p className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider">METODE CASH (TUNAI)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">Rp {cashTotal.toLocaleString('id-ID')}</p>
          <span className="text-[10px] font-bold text-[#B8B0A8] mt-1 block">{totalRevenue > 0 ? Math.round((cashTotal / totalRevenue) * 100) : 0}% dari Total Omset</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E8E0D8]/80 shadow-xs">
          <p className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider">METODE NON-TUNAI (QRIS/DEBIT)</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">Rp {(qrisTotal + debitTotal).toLocaleString('id-ID')}</p>
          <span className="text-[10px] font-bold text-[#B8B0A8] mt-1 block">QRIS: Rp {qrisTotal.toLocaleString('id-ID')} • Debit: Rp {debitTotal.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Visual Chart Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payment Breakdown Bar Chart */}
        <div className="bg-white rounded-2xl p-6 border border-[#E8E0D8]/80 shadow-xs">
          <h2 className="font-bold text-[#1A1714] text-sm mb-4">Distribusi Metode Pembayaran</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold text-[#6B6560] mb-1">
                <span>CASH (TUNAI)</span>
                <span>Rp {cashTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalRevenue > 0 ? (cashTotal / totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-[#6B6560] mb-1">
                <span>QRIS (E-WALLET & M-BANKING)</span>
                <span>Rp {qrisTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalRevenue > 0 ? (qrisTotal / totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-[#6B6560] mb-1">
                <span>DEBIT / KREDIT EDC</span>
                <span>Rp {debitTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalRevenue > 0 ? (debitTotal / totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white rounded-2xl p-6 border border-[#E8E0D8]/80 shadow-xs">
          <h2 className="font-bold text-[#1A1714] text-sm mb-4">Menu Terlaris Hari Ini</h2>
          <div className="space-y-3">
            {menuItems.slice(0, 4).map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-2xl border border-[#E8E0D8]/80">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-xs text-[#1A1714]">{item.name}</p>
                    <p className="text-[10px] text-[#B8B0A8] font-bold">{item.category}</p>
                  </div>
                </div>
                <span className="font-bold text-xs text-emerald-600">
                  Rp {item.price.toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
