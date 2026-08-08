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
  CheckCircle2
} from 'lucide-react';
import { Shift, ExpenseIncomeRecord, Order } from '../../types/pos';

interface ShiftMonitorViewProps {
  currentShift: Shift;
  orders: Order[];
  expenseRecords: ExpenseIncomeRecord[];
  onAddExpenseIncome: (record: ExpenseIncomeRecord) => void;
  onCloseShift: (notes: string) => void;
  onOpenNewShift: (staffName: string, role: any, initialCash: number) => void;
}

export const ShiftMonitorView: React.FC<ShiftMonitorViewProps> = ({
  currentShift,
  orders,
  expenseRecords,
  onAddExpenseIncome,
  onCloseShift,
  onOpenNewShift
}) => {
  const [recordType, setRecordType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [closeNotes, setCloseNotes] = useState<string>('');

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

  const cashInDrawer = currentShift.initialCash + currentShift.cashSales + currentShift.totalIncome - currentShift.totalExpense;

  return (
    <div className="flex-1 bg-slate-100/70 p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between">
      {/* Shift Header matching Image 3 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#F05A1F] rounded-2xl flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">Shift Monitor</h1>
            <p className="text-xs text-[#9C9590] font-bold mt-0.5">
              KASIR: <span className="text-[#D94B15]">{currentShift.staffName}</span> • AWAL SHIFT: {new Date(currentShift.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => alert('Riwayat Void Transaksi Kosong (0 Void)')}
            className="px-4 py-2 bg-white border border-[#E8E0D8] hover:bg-[#FAFAF8] rounded-2xl text-xs font-bold text-[#6B6560] shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <History className="w-4 h-4 text-[#9C9590]" /> VOID HISTORY
          </button>

          <button
            onClick={() => setIsCloseModalOpen(true)}
            className="px-4 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-2xl text-xs font-bold text-rose-600 shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Power className="w-4 h-4" /> TUTUP SHIFT
          </button>
        </div>
      </div>

      {/* Top Metric Cards Grid matching Image 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {/* Total Omset */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#E8E0D8]/80 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider">TOTAL OMSET</span>
            <span className="bg-[#FFF4EE] text-[#C94716] border border-[#F1C7B5] text-[10px] font-bold px-2.5 py-0.5 rounded-full">GROSS</span>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-[#1A1714] tracking-tight">
            Rp {currentShift.grossOmset.toLocaleString('id-ID')}
          </p>
        </div>

        {/* Cash in Drawer (Uang Fisik Laci) */}
        <div className="lg:col-span-2 bg-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider">UANG FISIK (LACI)</span>
            <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">TARGET</span>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-[#FF7040] tracking-tight">
            Rp {cashInDrawer.toLocaleString('id-ID')}
          </p>
        </div>

        {/* Small Metrics */}
        <div className="bg-white rounded-2xl p-4 border border-[#E8E0D8]/80 shadow-xs">
          <p className="text-[10px] font-bold text-[#B8B0A8] uppercase">TRANSAKSI</p>
          <p className="text-xl font-bold text-[#1A1714] mt-1">{orders.length} <span className="text-xs font-bold text-[#B8B0A8]">Struk</span></p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E8E0D8]/80 shadow-xs">
          <p className="text-[10px] font-bold text-[#B8B0A8] uppercase">TUNAI</p>
          <p className="text-base font-bold text-[#D94B15] mt-1">Rp {currentShift.cashSales.toLocaleString('id-ID')}</p>
        </div>
      </div>

      {/* Middle Grid: Record Expense / Income + Expenses History (Matches Image 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Form: Catat Biaya / Pemasukan */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8E0D8]/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-[#1A1714] text-sm mb-3">CATAT BIAYA / PEMASUKAN</h3>
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-3">
              <button
                type="button"
                onClick={() => setRecordType('EXPENSE')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  recordType === 'EXPENSE'
                    ? 'bg-rose-100 text-rose-700 shadow-xs'
                    : 'text-[#9C9590]'
                }`}
              >
                PENGELUARAN
              </button>
              <button
                type="button"
                onClick={() => setRecordType('INCOME')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  recordType === 'INCOME'
                    ? 'bg-[#FFF4EE] text-[#C94716] shadow-xs'
                    : 'text-[#9C9590]'
                }`}
              >
                PEMASUKAN (PETTY CASH)
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-3">
              <input
                type="text"
                placeholder="Keterangan (Contoh: Beli Gas, Es Batu)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#B8B0A8]">Rp</span>
                <input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs"
              >
                SIMPAN
              </button>
            </form>
          </div>
        </div>

        {/* Expenses List */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#E8E0D8]/80 shadow-xs">
          <h3 className="font-bold text-[#1A1714] text-sm mb-3">RIWAYAT BIAYA / PEMASUKAN</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {expenseRecords.length === 0 ? (
              <p className="text-xs text-[#B8B0A8] font-bold py-6 text-center">Belum ada pengeluaran / petty cash dicatat pada shift ini</p>
            ) : (
              expenseRecords.map((rec) => (
                <div key={rec.id} className="p-3 bg-[#FAFAF8] rounded-2xl border border-[#E8E0D8]/80 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-xs text-slate-800 uppercase">{rec.description}</p>
                    <p className="text-[10px] text-[#B8B0A8] font-semibold">{new Date(rec.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {rec.recordedBy}</p>
                  </div>
                  <span className={`font-bold text-sm ${rec.type === 'EXPENSE' ? 'text-rose-600' : 'text-[#D94B15]'}`}>
                    {rec.type === 'EXPENSE' ? '-' : '+'}Rp {rec.amount.toLocaleString('id-ID')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Table: Transactions List matching Image 3 */}
      <div className="bg-white rounded-2xl p-5 border border-[#E8E0D8]/80 shadow-xs">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-[#1A1714] text-sm">RIWAYAT TRANSAKSI SHIFT</h3>
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">{orders.length} Item</span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {orders.map((ord) => (
            <div key={ord.id} className="p-3 bg-[#FAFAF8] rounded-2xl border border-[#E8E0D8]/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#B8B0A8] font-mono">
                  {new Date(ord.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div>
                  <p className="font-bold text-xs text-slate-800">{ord.customerName} {ord.orderNumber}</p>
                  <div className="flex gap-1.5 mt-0.5">
                    <span className="text-[9px] bg-[#F2F2F2] text-[#444444] font-semibold px-1.5 py-0.5 rounded">
                      {ord.paymentMethod || 'CASH'}
                    </span>
                    <span className="text-[9px] bg-[#FFF4EE] text-[#C94716] font-bold px-1.5 py-0.5 rounded">
                      {ord.type === 'DINE_IN' ? 'dine in' : 'take away'}
                    </span>
                  </div>
                </div>
              </div>
              <span className="font-bold text-sm text-[#1A1714]">
                Rp {ord.total.toLocaleString('id-ID')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Close Shift Modal */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-[#1A1714]">Konfirmasi Tutup Shift Kasir</h2>
            <div className="bg-[#FAFAF8] p-4 rounded-2xl space-y-2 text-xs font-bold text-[#6B6560]">
              <div className="flex justify-between"><span>Awal Modal:</span><span>Rp {currentShift.initialCash.toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between"><span>Penjualan Cash:</span><span>Rp {currentShift.cashSales.toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between border-t pt-1"><span>Target Fisik Laci:</span><span className="font-bold text-[#D94B15]">Rp {cashInDrawer.toLocaleString('id-ID')}</span></div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#9C9590] uppercase tracking-wider block mb-1">Catatan Closing Kasir:</label>
              <textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Catatan selisih kas / petty cash..."
                className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl p-3 text-xs font-bold outline-none focus:border-blue-500"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setIsCloseModalOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-[#6B6560] font-bold text-xs rounded-2xl">
                Batal
              </button>
              <button
                onClick={() => {
                  onCloseShift(closeNotes);
                  setIsCloseModalOpen(false);
                  alert('Shift Berhasil Ditutup!');
                }}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl shadow-md"
              >
                Tutup Shift Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
