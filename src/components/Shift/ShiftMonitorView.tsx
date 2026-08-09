import React, { useState } from 'react';
import {
  Clock,
  Wallet,
  DollarSign,
  Receipt,
  PlusCircle,
  MinusCircle,
  History,
  Power,
  X,
  CheckCircle2,
  Store,
  Coins,
  Ban
} from 'lucide-react';
import { Shift, ExpenseIncomeRecord, Order, UserAccount } from '../../types/pos';

interface ShiftMonitorViewProps {
  currentShift: Shift;
  orders: Order[];
  expenseRecords: ExpenseIncomeRecord[];
  activeUser?: UserAccount;
  onAddExpenseIncome: (record: ExpenseIncomeRecord) => void;
  onCloseShift: (notes: string) => void;
  onOpenNewShift: (staffName: string, role: any, initialCash: number) => void;
}

export const ShiftMonitorView: React.FC<ShiftMonitorViewProps> = ({
  currentShift,
  orders,
  expenseRecords,
  activeUser,
  onAddExpenseIncome,
  onCloseShift,
  onOpenNewShift
}) => {
  const [recordType, setRecordType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState<boolean>(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState<boolean>(false);
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [actualCashInput, setActualCashInput] = useState<number | ''>('');
  const [handoverStaffName, setHandoverStaffName] = useState<string>('');

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || Number(amount) <= 0) {
      alert('Silakan lengkapi deskripsi dan nominal!');
      return;
    }

    const record: ExpenseIncomeRecord = {
      id: 'rec-' + Date.now().toString().slice(-4),
      shiftId: currentShift.id,
      type: recordType,
      amount: Number(amount),
      description: description.trim(),
      timestamp: new Date().toISOString(),
      recordedBy: currentShift.staffName
    };

    onAddExpenseIncome(record);
    setDescription('');
    setAmount('');
  };

  const [openShiftStaffName, setOpenShiftStaffName] = useState<string>(currentShift.staffName || activeUser?.name || 'Kasir 01');
  const [openShiftRole, setOpenShiftRole] = useState<string>('KASIR');
  const [openShiftCashInput, setOpenShiftCashInput] = useState<number>(500000);

  const cashInDrawer = currentShift.initialCash + currentShift.cashSales + currentShift.totalIncome - currentShift.totalExpense;

  if (currentShift.status !== 'OPEN') {
    return (
      <div className="flex-1 bg-gradient-to-tr from-[#EBF3FA] via-[#F3EBF9] to-[#FAF3FB] p-4 md:p-8 overflow-y-auto font-sans select-none flex items-center justify-center text-slate-900 min-h-0">
        <div className="max-w-md w-full bg-white rounded-[32px] p-8 md:p-10 shadow-2xl shadow-purple-500/10 border border-purple-100 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-[#7C3AED] to-[#A855F7] rounded-3xl flex items-center justify-center text-white mx-auto shadow-lg shadow-purple-500/30">
            <Store className="w-10 h-10" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl md:text-3xl font-black text-[#1E1B4B] tracking-tight">
              Buka Shift Baru
            </h2>
            <p className="text-xs font-bold text-slate-500 max-w-xs mx-auto leading-relaxed">
              Masukkan modal awal untuk memulai operasional hari ini dengan semangat!
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[10px] font-black text-[#6366F1] tracking-wider uppercase block mb-1.5">
                MODAL AWAL (CASH)
              </label>
              <input
                type="number"
                value={openShiftCashInput}
                onChange={(e) => setOpenShiftCashInput(Number(e.target.value))}
                className="w-full bg-[#F8FAFC] border-2 border-orange-500 focus:border-orange-600 rounded-2xl p-4 text-center font-black text-2xl text-slate-900 outline-none shadow-2xs"
                placeholder="0"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const name = openShiftStaffName.trim() || activeUser?.name || 'Kasir 01';
                onOpenNewShift(name, openShiftRole, openShiftCashInput);
              }}
              className="w-full py-4 bg-gradient-to-r from-[#6366F1] via-[#7C3AED] to-[#A855F7] hover:opacity-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-purple-500/25 active:scale-95 transition-all cursor-pointer"
            >
              MULAI SHIFT
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeOrders = orders.filter((o) => o.status !== 'CANCELLED');
  const voidOrders = orders.filter((o) => o.status === 'CANCELLED');
  const grossOmset = currentShift.grossOmset || activeOrders.reduce((sum, o) => sum + o.total, 0);
  const tunaiSales = currentShift.cashSales || activeOrders.filter((o) => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.total, 0);
  const nonTunaiSales = activeOrders.filter((o) => o.paymentMethod !== 'CASH').reduce((sum, o) => sum + o.total, 0);
  const pengeluaranTotal = currentShift.totalExpense;
  const avgTransactionValue = activeOrders.length > 0 ? Math.round(grossOmset / activeOrders.length) : 0;

  const shiftFormattedTime = new Date(currentShift.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex-1 bg-[#F8FAFC] p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between text-slate-900 min-h-0">
      {/* Top Bar matching Reference Image */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-[#6366F1] via-[#7C3AED] to-[#A855F7] rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shift Monitor</h1>
            <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span className="text-indigo-600 font-black uppercase">{currentShift.staffName || 'SUPER ADMIN'}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-500" /> {shiftFormattedTime}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsVoidModalOpen(true)}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-full text-xs font-black text-slate-700 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Ban className="w-3.5 h-3.5 text-rose-500" />
            <span>VOID HISTORY</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCloseModalOpen(true)}
            className="px-4 py-2 bg-white border border-rose-200 hover:bg-rose-50 rounded-full text-xs font-black text-rose-600 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Power className="w-3.5 h-3.5" />
            <span>TUTUP SHIFT</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Dashboard Grid matching Reference Image */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* LEFT COLUMN (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Row 1: Two Big Hero Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TOTAL OMSET (Hero White Card) */}
            <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                  <Coins className="w-6 h-6" />
                </div>
                <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  GROSS
                </span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">TOTAL OMSET</p>
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mt-1 font-mono">
                  Rp {grossOmset.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            {/* UANG FISIK (LACI) (Hero Dark Navy Card) */}
            <div className="bg-[#151D2A] text-white rounded-[28px] p-6 shadow-md flex flex-col justify-between relative overflow-hidden border border-slate-800">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center text-slate-300">
                  <Wallet className="w-6 h-6" />
                </div>
                <span className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  TARGET
                </span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">UANG FISIK (LACI)</p>
                <p className="text-3xl lg:text-4xl font-black text-white tracking-tight mt-1 font-mono">
                  Rp {cashInDrawer.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>

          {/* Row 2: 4 Small Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">TRANSAKSI</p>
              <p className="text-xl font-black text-slate-900 mt-1">
                {activeOrders.length} <span className="text-xs font-bold text-slate-400">Struk</span>
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">TUNAI</p>
              <p className="text-base font-black text-emerald-600 mt-1 font-mono">
                Rp {tunaiSales.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">NON-TUNAI</p>
              <p className="text-base font-black text-blue-600 mt-1 font-mono">
                Rp {nonTunaiSales.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">PENGELUARAN</p>
              <p className="text-base font-black text-rose-600 mt-1 font-mono">
                Rp {pengeluaranTotal.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          {/* Row 3: RIWAYAT TRANSAKSI Box */}
          <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">RIWAYAT TRANSAKSI</h3>
              </div>
              <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black px-3 py-1 rounded-full">
                {orders.length} Item
              </span>
            </div>

            {orders.length === 0 ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400">
                Belum ada transaksi
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                <div className="grid grid-cols-12 text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 px-3">
                  <span className="col-span-3">WAKTU</span>
                  <span className="col-span-6">INFO</span>
                  <span className="col-span-3 text-right">TOTAL</span>
                </div>
                {orders.map((ord) => (
                  <div key={ord.id} className="grid grid-cols-12 items-center p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100/80 transition-colors">
                    <span className="col-span-3 text-xs font-bold text-slate-500 font-mono">
                      {new Date(ord.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="col-span-6 space-y-0.5">
                      <p className="font-black text-xs text-slate-900">{ord.customerName || 'Pelanggan'} #{ord.orderNumber}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md uppercase font-mono">
                          {ord.paymentMethod || 'CASH'}
                        </span>
                        <span className="text-[9px] bg-orange-50 text-orange-700 border border-orange-200 font-bold px-2 py-0.5 rounded-md uppercase">
                          {ord.type === 'DINE_IN' ? 'DINE IN' : 'TAKE AWAY'}
                        </span>
                        {ord.status === 'CANCELLED' && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-md uppercase">
                            VOID
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="col-span-3 text-right font-black text-xs text-slate-900 font-mono">
                      Rp {ord.total.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (Span 1) */}
        <div className="space-y-6">
          {/* Card 1: CATAT BIAYA / PEMASUKAN */}
          <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">CATAT BIAYA / PEMASUKAN</h3>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setRecordType('EXPENSE')}
                className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer ${
                  recordType === 'EXPENSE'
                    ? 'bg-rose-50 border border-rose-200 text-rose-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                PENGELUARAN
              </button>
              <button
                type="button"
                onClick={() => setRecordType('INCOME')}
                className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer ${
                  recordType === 'INCOME'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                PEMASUKAN (PETTY CASH)
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-3">
              <input
                type="text"
                placeholder="Keterangan..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
              />

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">Rp</span>
                <input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3.5 py-3 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#151D2A] hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm cursor-pointer transition-all active:scale-95"
              >
                SIMPAN
              </button>
            </form>
          </div>

          {/* Card 2: RIWAYAT BIAYA / PEMASUKAN */}
          <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">RIWAYAT BIAYA / PEMASUKAN</h3>
            {expenseRecords.length === 0 ? (
              <div className="py-10 text-center text-xs font-bold text-slate-400">
                Tidak ada data biaya
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {expenseRecords.map((rec) => (
                  <div key={rec.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-black text-xs text-slate-900 uppercase">{rec.description}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{new Date(rec.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {rec.recordedBy}</p>
                    </div>
                    <span className={`font-black text-xs font-mono ${rec.type === 'EXPENSE' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {rec.type === 'EXPENSE' ? '-' : '+'}Rp {rec.amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: RATA-RATA TRANSAKSI (Daily Realtime Performance) */}
          <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-xs space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">RATA-RATA TRANSAKSI</p>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                DAILY REALTIME
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              Rp {avgTransactionValue.toLocaleString('id-ID')}
            </p>
            <p className="text-[10px] font-bold text-slate-400">Per pelanggan (Estimasi)</p>
          </div>
        </div>
      </div>

      {/* Close Shift Modal */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 font-sans text-slate-900 border border-[#EAE3DB]">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Konfirmasi Tutup Shift Kasir</h2>
            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs font-bold text-slate-700 border border-slate-200">
              <div className="flex justify-between"><span>Awal Modal Laci:</span><span className="font-mono">Rp {currentShift.initialCash.toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between"><span>Penjualan Tunai:</span><span className="font-mono">Rp {currentShift.cashSales.toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-black text-sm">
                <span>Target Uang Fisik Laci:</span>
                <span className="text-orange-600 font-mono font-black">Rp {cashInDrawer.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Kas Aktual Fisik Laci (Rp):</label>
              <input
                type="number"
                placeholder={`Contoh: ${cashInDrawer}`}
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
              />
              {actualCashInput !== '' && (
                <div className={`mt-1.5 text-xs font-black p-2.5 rounded-xl border ${
                  Number(actualCashInput) - cashInDrawer === 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : Number(actualCashInput) - cashInDrawer > 0
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {Number(actualCashInput) - cashInDrawer === 0
                    ? '✓ Kas sesuai (Selisih Rp 0)'
                    : Number(actualCashInput) - cashInDrawer > 0
                    ? `+ Surplus Kas: Rp ${(Number(actualCashInput) - cashInDrawer).toLocaleString('id-ID')}`
                    : `- Selisih Kas (Minus): Rp ${Math.abs(Number(actualCashInput) - cashInDrawer).toLocaleString('id-ID')}`}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Catatan Closing / Selisih:</label>
              <textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Catatan selisih kas / petty cash..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setIsCloseModalOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer">
                Batal
              </button>
              <button
                onClick={() => {
                  const selisihNote = actualCashInput !== '' ? ` [Kas Fisik: Rp ${Number(actualCashInput).toLocaleString('id-ID')}, Selisih: Rp ${(Number(actualCashInput) - cashInDrawer).toLocaleString('id-ID')}]` : '';
                  onCloseShift(closeNotes + selisihNote);
                  setIsCloseModalOpen(false);
                  alert('Shift Berhasil Ditutup!');
                }}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer transition-all"
              >
                Tutup Shift Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Handover Shift Modal */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 font-sans text-slate-900 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Serah Terima Shift (Handover)</h2>
              </div>
              <button onClick={() => setIsHandoverModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs font-bold text-slate-700 border border-slate-200">
              <div className="flex justify-between"><span>Kasir Asal:</span><span className="font-black text-slate-900">{currentShift.staffName}</span></div>
              <div className="flex justify-between"><span>Target Laci Tunai:</span><span className="font-black text-orange-600 font-mono">Rp {cashInDrawer.toLocaleString('id-ID')}</span></div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Kasir Penerima Shift Handover:</label>
              <input
                type="text"
                placeholder="Nama kasir pengganti..."
                value={handoverStaffName}
                onChange={(e) => setHandoverStaffName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Jumlah Uang Fisik Diserahterimakan (Rp):</label>
              <input
                type="number"
                placeholder={`Contoh: ${cashInDrawer}`}
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setIsHandoverModalOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer">
                Batal
              </button>
              <button
                onClick={() => {
                  if (!handoverStaffName.trim()) {
                    alert('Mohon isi nama kasir penerima handover!');
                    return;
                  }
                  const handoverNotes = `[HANDOVER] Serah terima shift ke ${handoverStaffName}. Uang fisik: Rp ${Number(actualCashInput || cashInDrawer).toLocaleString('id-ID')}`;
                  onCloseShift(handoverNotes);
                  setIsHandoverModalOpen(false);
                  alert(`Serah terima shift ke ${handoverStaffName} berhasil diproses!`);
                }}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer transition-all"
              >
                Proses Handover Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void History Modal */}
      {isVoidModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl space-y-4 font-sans text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-black text-sm">
                <Ban className="w-5 h-5 text-rose-600" />
                <span>RIWAYAT VOID TRANSAKSI SHIFT</span>
              </div>
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {voidOrders.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Ban className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">Belum ada riwayat void (pembatalan transaksi) pada shift ini.</p>
                </div>
              ) : (
                voidOrders.map((ord) => (
                  <div key={ord.id} className="p-3 bg-rose-50/60 border border-rose-100 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-black text-xs text-rose-900">{ord.customerName || 'Pelanggan'} #{ord.orderNumber}</p>
                      <p className="text-[10px] text-rose-600 font-mono font-bold">
                        Waktu: {new Date(ord.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • Mode: {ord.type}
                      </p>
                    </div>
                    <span className="font-black text-xs text-rose-700 font-mono">
                      Rp {ord.total.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
