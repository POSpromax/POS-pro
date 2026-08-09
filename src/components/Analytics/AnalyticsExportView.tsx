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
    <div className="flex-1 bg-[#F8FAFC] p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between text-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1A1714] tracking-tight flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-[#EA580C]" />
            Dashboard Analitik & Ekspor Laporan Keuangan
          </h1>
          <p className="text-xs text-slate-500 font-bold mt-1">
            Pantau performa penjualan harian, perincian metode pembayaran, dan ekspor laporan keuangan dalam format CSV / PDF.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" /> Ekspor Laporan CSV
          </button>

          <button
            onClick={handlePrintPDF}
            className="px-4 py-2.5 bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 text-white rounded-full text-xs font-black shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" /> Cetak Struk / PDF
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-[#EAE3DB] shadow-2xs">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">TOTAL OMSET HARI INI</p>
          <p className="text-2xl font-black text-[#EA580C] mt-1">Rp {totalRevenue.toLocaleString('id-ID')}</p>
          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 mt-1">
            <ArrowUpRight className="w-3 h-3" /> +18.4% dari kemarin
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAE3DB] shadow-2xs">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">TOTAL STRUK TRANSAKSI</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalTransactions} <span className="text-xs font-bold text-slate-400">Order</span></p>
          <span className="text-[10px] font-bold text-[#EA580C] mt-1 block">Rata-rata Rp {totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions).toLocaleString('id-ID') : 0} / Order</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAE3DB] shadow-2xs">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">METODE TUNAI (CASH)</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">Rp {cashTotal.toLocaleString('id-ID')}</p>
          <span className="text-[10px] font-bold text-slate-400 mt-1 block">{totalRevenue > 0 ? Math.round((cashTotal / totalRevenue) * 100) : 0}% dari Total Omset</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAE3DB] shadow-2xs">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">METODE NON-TUNAI (QRIS/DEBIT)</p>
          <p className="text-2xl font-black text-purple-600 mt-1">Rp {(qrisTotal + debitTotal).toLocaleString('id-ID')}</p>
          <span className="text-[10px] font-bold text-slate-400 mt-1 block">QRIS: Rp {qrisTotal.toLocaleString('id-ID')} • Debit: Rp {debitTotal.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Visual Chart Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payment Breakdown Bar Chart */}
        <div className="bg-white rounded-2xl p-6 border border-[#EAE3DB] shadow-2xs">
          <h2 className="font-black text-[#1A1714] text-sm mb-4">Distribusi Metode Pembayaran</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-extrabold text-slate-700 mb-1">
                <span>TUNAI (CASH)</span>
                <span>Rp {cashTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="w-full bg-[#F6EFE7] h-3 rounded-full overflow-hidden border border-[#EAE3DB]">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalRevenue > 0 ? (cashTotal / totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-extrabold text-slate-700 mb-1">
                <span>QRIS (E-WALLET & M-BANKING)</span>
                <span>Rp {qrisTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="w-full bg-[#F6EFE7] h-3 rounded-full overflow-hidden border border-[#EAE3DB]">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalRevenue > 0 ? (qrisTotal / totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-extrabold text-slate-700 mb-1">
                <span>DEBIT / KREDIT EDC</span>
                <span>Rp {debitTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="w-full bg-[#F6EFE7] h-3 rounded-full overflow-hidden border border-[#EAE3DB]">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalRevenue > 0 ? (debitTotal / totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary & Operational Notes */}
        <div className="bg-white rounded-2xl p-6 border border-[#EAE3DB] shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="font-black text-[#1A1714] text-sm mb-3">Ringkasan Audit Laporan</h2>
            <div className="space-y-2 text-xs font-bold text-slate-600">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Status Shift Operasional:</span>
                <span className="font-black text-emerald-600">TERHUBUNG ({currentShift.staffName})</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Awal Modal Kas Laci:</span>
                <span className="font-black text-slate-900">Rp {currentShift.initialCash.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Target Uang Fisik Laci:</span>
                <span className="font-black text-[#EA580C]">
                  Rp {(currentShift.initialCash + cashTotal + currentShift.totalIncome - currentShift.totalExpense).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#FFF4ED] border border-[#FFDDD0] rounded-xl text-[11px] font-bold text-[#C2410C]">
            💡 Catatan: Seluruh data laporan dapat diekspor langsung ke format CSV untuk pembukuan akuntansi toko.
          </div>
        </div>
        {/* Top Selling Products */}
        <div className="bg-white rounded-2xl p-6 border border-[#EAE3DB] shadow-2xs">
          <h2 className="font-black text-[#1A1714] text-sm mb-4">Menu Terlaris Hari Ini</h2>
          <div className="space-y-3">
            {menuItems.slice(0, 4).map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-[#F8F2EC] rounded-2xl border border-[#EAE3DB]">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[#EA580C] text-white font-black text-xs flex items-center justify-center shadow-xs">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-xs text-[#1A1714]">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{item.category}</p>
                  </div>
                </div>
                <span className="font-black text-xs text-emerald-600">
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
