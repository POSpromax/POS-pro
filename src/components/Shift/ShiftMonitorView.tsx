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
  Ban,
  Tag,
  Calendar,
  ChevronRight,
  FileText
} from 'lucide-react';
import { Shift, ExpenseIncomeRecord, Order, UserAccount } from '../../types/pos';

interface ShiftMonitorViewProps {
  currentShift: Shift;
  orders: Order[];
  expenseRecords: ExpenseIncomeRecord[];
  shiftHistory?: Shift[];
  activeUser?: UserAccount;
  onAddExpenseIncome: (record: ExpenseIncomeRecord) => void;
  onCloseShift: (notes: string, actualCash: number, expectedCash: number) => Promise<void>;
  onOpenNewShift: (staffName: string, role: any, initialCash: number) => Promise<void>;
  onRefreshShift?: () => Promise<void>;
  onShowToast?: (title: string, message: string) => void;
}

export const ShiftMonitorView: React.FC<ShiftMonitorViewProps> = ({
  currentShift,
  orders,
  expenseRecords,
  shiftHistory = [],
  activeUser,
  onAddExpenseIncome,
  onCloseShift,
  onOpenNewShift,
  onRefreshShift,
  onShowToast
}) => {
  const toast = (title: string, msg: string) => onShowToast?.(title, msg);
  const [recordType, setRecordType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState<boolean>(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState<boolean>(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState<boolean>(false);
  const [isShiftHistoryModalOpen, setIsShiftHistoryModalOpen] = useState<boolean>(false);
  const [selectedHistoryShift, setSelectedHistoryShift] = useState<Shift | null>(null);
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [actualCashInput, setActualCashInput] = useState<number | ''>('');
  const [handoverStaffName, setHandoverStaffName] = useState<string>('');
  const [isShiftMutationPending, setIsShiftMutationPending] = useState(false);

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || Number(amount) <= 0) {
      toast('Input Tidak Lengkap', 'Silakan lengkapi deskripsi dan nominal.');
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

  const [openShiftStaffName, setOpenShiftStaffName] = useState<string>(activeUser?.name || currentShift.staffName || 'Kasir 01');
  const [openShiftRole, setOpenShiftRole] = useState<string>(activeUser?.role || 'KASIR');
  const [openShiftCashInput, setOpenShiftCashInput] = useState<number>(500000);

  if (currentShift.status !== 'OPEN') {
    return (
      <div className="ui-surface flex-1 p-4 md:p-8 overflow-y-auto font-sans select-none flex items-center justify-center text-[var(--text-primary)] min-h-0">
        <div className="max-w-md w-full ui-card p-8 md:p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-[var(--primary-solid)] rounded-2xl flex items-center justify-center text-[var(--text-inverse)] mx-auto shadow-[var(--shadow-md)]">
            <Store className="w-10 h-10" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Buka Shift Baru
            </h2>
            <p className="text-[11px] font-bold text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
              Masukkan modal awal untuk memulai operasional hari ini dengan semangat!
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[11px] font-bold text-[var(--primary-hover)] tracking-wider uppercase block mb-1.5">
                MODAL AWAL (CASH)
              </label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                // Kosong saat nol, bukan menampilkan "0": kalau angkanya dicetak,
                // kasir tidak bisa menghapusnya dan nominal jadi "050000".
                value={openShiftCashInput || ''}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setOpenShiftCashInput(Number.isFinite(next) && next > 0 ? next : 0);
                }}
                className="ui-input w-full p-4 text-center font-bold text-2xl"
                placeholder="0"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const name = openShiftStaffName.trim() || activeUser?.name || 'Kasir 01';
                setIsShiftMutationPending(true);
                void onOpenNewShift(name, openShiftRole, openShiftCashInput)
                  .catch(() => undefined)
                  .finally(() => setIsShiftMutationPending(false));
              }}
              disabled={isShiftMutationPending}
              className="ui-button ui-button-primary w-full py-4 text-[11px] uppercase tracking-wider"
            >
              {isShiftMutationPending ? 'MENGONFIRMASI SERVER...' : 'MULAI SHIFT'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Filter semua data hanya untuk shift yang sedang aktif ─────────────────
  // Ini memastikan statistik tidak mencampur data dari shift sebelumnya
  // dalam kasus edge di mana orders belum ter-clear saat shift dibuka ulang.
  const shiftOrders = orders.filter((o) => o.shiftId === currentShift.id);
  const activeOrders = shiftOrders.filter((o) => o.status !== 'CANCELLED' && o.paymentStatus === 'PAID');
  const voidOrders = shiftOrders.filter((o) => o.status === 'CANCELLED');
  const discountedOrders = shiftOrders.filter((o) => (o.discount ?? 0) > 0);

  // Fallback: kalkulasi dari orders jika shift counter belum terupdate
  const grossOmset = currentShift.grossOmset > 0
    ? currentShift.grossOmset
    : activeOrders.reduce((sum, o) => sum + (o.subtotal || o.total), 0);

  const tunaiSales = currentShift.cashSales > 0
    ? currentShift.cashSales
    : activeOrders.filter((o) => o.paymentMethod === 'CASH' || !o.paymentMethod).reduce((sum, o) => sum + o.total, 0);

  const qrisSales  = activeOrders.filter((o) => o.paymentMethod === 'QRIS').reduce((sum, o) => sum + o.total, 0);
  const debitSales = activeOrders.filter((o) => o.paymentMethod === 'DEBIT').reduce((sum, o) => sum + o.total, 0);
  const nonTunaiSales = currentShift.nonCashSales > 0
    ? currentShift.nonCashSales
    : qrisSales + debitSales;

  const totalDiscount = activeOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const totalTax      = activeOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
  const netOmset      = activeOrders.reduce((sum, o) => sum + o.total, 0);

  // Fallback: kalkulasi pengeluaran/pemasukan dari expenseRecords
  // jika shift object sudah 0 (misal karena race condition)
  const pengeluaranFromRecords = expenseRecords
    .filter((r) => r.type === 'EXPENSE')
    .reduce((s, r) => s + r.amount, 0);
  const pemasukanFromRecords = expenseRecords
    .filter((r) => r.type === 'INCOME')
    .reduce((s, r) => s + r.amount, 0);

  const pengeluaranTotal = currentShift.totalExpense > 0
    ? currentShift.totalExpense
    : pengeluaranFromRecords;
  const pemasukanTotal = currentShift.totalIncome > 0
    ? currentShift.totalIncome
    : pemasukanFromRecords;

  const cashInDrawer = currentShift.initialCash + tunaiSales + pemasukanTotal - pengeluaranTotal;
  const avgTransactionValue = activeOrders.length > 0 ? Math.round(grossOmset / activeOrders.length) : 0;

  const shiftFormattedTime = new Date(currentShift.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const handleForceSync = async () => {
    if (isShiftMutationPending) return;
    setIsShiftMutationPending(true);
    try {
      if (onRefreshShift) await onRefreshShift();
      toast('Sinkronisasi Berhasil', 'Status shift terbaru telah dibaca dari server pusat.');
    } catch (error) {
      toast('Sinkronisasi Gagal', error instanceof Error ? error.message : 'Server pusat belum dapat dihubungi.');
    } finally {
      setIsShiftMutationPending(false);
    }
  };

  return (
    <div className="ui-surface flex-1 p-4 md:p-6 overflow-y-auto font-sans select-none text-[var(--text-primary)] min-h-0">
      {/* Top Bar matching Reference Image */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[var(--primary-solid)] rounded-2xl flex items-center justify-center text-[var(--text-inverse)] shadow-[var(--shadow-sm)]">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">Shift Monitor</h1>
            <p className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5">
              <span className="text-[var(--primary-hover)] font-bold uppercase">{currentShift.staffName || 'SUPER ADMIN'}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-[var(--primary-hover)]" /> {shiftFormattedTime}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { void handleForceSync(); }}
            disabled={isShiftMutationPending}
            className="px-3 py-2 bg-[var(--success-soft)] border border-[var(--accent-green)] rounded-full text-[11px] font-bold text-[var(--accent-green)] shadow-[var(--shadow-sm)] flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Klik untuk sinkronkan status shift secara realtime"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] animate-pulse" />
            <span>SINKRONIZASI SHIFT</span>
          </button>

          <button
            type="button"
            onClick={() => setIsVoidModalOpen(true)}
            className="ui-button ui-button-secondary px-3.5 py-2 text-[11px] shadow-[var(--shadow-sm)] gap-1.5"
          >
            <Ban className="w-3.5 h-3.5 text-[var(--accent-red)]" />
            <span>RIWAYAT VOID ({voidOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDiscountModalOpen(true)}
            className="ui-button ui-button-secondary px-3.5 py-2 text-[11px] shadow-[var(--shadow-sm)] gap-1.5"
          >
            <Tag className="w-3.5 h-3.5 text-[var(--accent-amber)]" />
            <span>RIWAYAT DISKON ({discountedOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsShiftHistoryModalOpen(true)}
            className="ui-button ui-button-secondary px-3.5 py-2 text-[11px] shadow-[var(--shadow-sm)] gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--primary-hover)]" />
            <span>RIWAYAT SHIFT PERHARI</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCloseModalOpen(true)}
            className="ui-button ui-button-danger px-4 py-2 text-[11px] shadow-[var(--shadow-sm)] gap-1.5"
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
            <div className="ui-card p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-[var(--primary-soft)] border border-[var(--primary-border)] rounded-lg flex items-center justify-center text-[var(--primary-hover)]">
                  <Coins className="w-6 h-6" />
                </div>
                <span className="bg-[var(--primary-soft)] border border-[var(--primary-border)] text-[var(--primary-hover)] text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  GROSS
                </span>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">TOTAL OMSET</p>
                <p className="text-3xl lg:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight mt-1 font-mono">
                  Rp {grossOmset.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            {/* UANG FISIK (LACI) (Hero Dark Navy Card) */}
            <div className="bg-[var(--primary)] text-[var(--text-inverse)] rounded-2xl p-6 shadow-[var(--shadow-sm)] flex flex-col justify-between relative overflow-hidden border border-[var(--primary-border)]">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-[var(--primary-hover)] border border-white/15 rounded-lg flex items-center justify-center text-[var(--text-inverse)]">
                  <Wallet className="w-6 h-6" />
                </div>
                <span className="bg-[var(--primary-hover)] border border-white/15 text-[var(--text-inverse)] text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  TARGET
                </span>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-inverse)]/70">UANG FISIK (LACI)</p>
                <p className="text-3xl lg:text-4xl font-extrabold text-[var(--text-inverse)] tracking-tight mt-1 font-mono">
                  Rp {cashInDrawer.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>

          {/* Row 2: 4 Small Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="ui-card-compact p-4">
              <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">TRANSAKSI</p>
              <p className="text-xl font-bold text-[var(--text-primary)] mt-1">
                {activeOrders.length} <span className="text-[11px] font-bold text-[var(--text-tertiary)]">Struk</span>
              </p>
            </div>

            <div className="ui-card-compact p-4">
              <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">TUNAI</p>
              <p className="text-base font-bold text-[var(--accent-green)] mt-1 font-mono">
                Rp {tunaiSales.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="ui-card-compact p-4">
              <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">NON-TUNAI</p>
              <p className="text-base font-bold text-[var(--primary-hover)] mt-1 font-mono">
                Rp {nonTunaiSales.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="ui-card-compact p-4">
              <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">PENGELUARAN</p>
              <p className="text-base font-bold text-[var(--accent-red)] mt-1 font-mono">
                Rp {pengeluaranTotal.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          {/* Row 3: RIWAYAT TRANSAKSI Box */}
          <div className="ui-card p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--panel-border-light)]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" />
                <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">RIWAYAT TRANSAKSI</h3>
              </div>
              <span className="bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--panel-border)] text-[11px] font-bold px-3 py-1 rounded-full">
                {orders.length} Item
              </span>
            </div>

            {orders.length === 0 ? (
              <div className="py-12 text-center text-[11px] font-bold text-[var(--text-tertiary)]">
                Belum ada transaksi
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                <div className="grid grid-cols-12 text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider pb-2 border-b border-[var(--panel-border-light)] px-3">
                  <span className="col-span-3">WAKTU</span>
                  <span className="col-span-6">INFO</span>
                  <span className="col-span-3 text-right">TOTAL</span>
                </div>
                {orders.map((ord) => (
                  <div key={ord.id} className="grid grid-cols-12 items-center p-3 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--panel-border-light)] hover:bg-[var(--panel-border)]/50 transition-colors">
                    <span className="col-span-3 text-[11px] font-bold text-[var(--text-secondary)] font-mono">
                      {new Date(ord.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="col-span-6 space-y-0.5">
                      <p className="font-bold text-[11px] text-[var(--text-primary)]">{ord.customerName || 'Pelanggan'} #{ord.orderNumber}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] bg-[var(--panel-border-strong)] text-[var(--text-primary)] font-bold px-2 py-0.5 rounded-lg uppercase font-mono">
                          {ord.paymentMethod || 'CASH'}
                        </span>
                        <span className="text-[11px] bg-[var(--primary-soft)] text-[var(--primary-text)] border border-[var(--primary-border)] font-bold px-2 py-0.5 rounded-lg uppercase">
                          {ord.type === 'DINE_IN' ? 'DINE IN' : 'TAKE AWAY'}
                        </span>
                        {ord.status === 'CANCELLED' && (
                          <span className="text-[11px] bg-[var(--danger-soft)] text-[var(--accent-red)] font-bold px-2 py-0.5 rounded-lg uppercase">
                            VOID
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="col-span-3 text-right font-bold text-[11px] text-[var(--text-primary)] font-mono">
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
          <div className="ui-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-red)]" />
              <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">CATAT BIAYA / PEMASUKAN</h3>
            </div>

            <div className="flex bg-[var(--surface-secondary)] p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setRecordType('EXPENSE')}
                className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                  recordType === 'EXPENSE'
                    ? 'bg-[var(--danger-soft)] border border-[var(--accent-red)] text-[var(--accent-red)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                PENGELUARAN
              </button>
              <button
                type="button"
                onClick={() => setRecordType('INCOME')}
                className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                  recordType === 'INCOME'
                    ? 'bg-[var(--success-soft)] border border-[var(--accent-green)] text-[var(--accent-green)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                className="ui-input w-full p-3 text-[11px]"
              />

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[var(--text-tertiary)]">Rp</span>
                <input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="ui-input w-full pl-10 pr-3.5 py-3 text-[11px]"
                />
              </div>

              <button
                type="submit"
                className="ui-button ui-button-primary w-full py-3.5 text-[11px] uppercase tracking-wider"
              >
                SIMPAN
              </button>
            </form>
          </div>

          {/* Card 2: RIWAYAT BIAYA / PEMASUKAN */}
          <div className="ui-card p-6 space-y-3">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">RIWAYAT BIAYA / PEMASUKAN</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {/* Entry Modal Awal */}
              <div className="p-3 bg-[var(--primary-soft)] border border-[var(--primary-border)] rounded-2xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-[11px] text-[var(--primary-hover)] uppercase">MODAL AWAL (PETTY CASH)</p>
                  <p className="text-[11px] text-[var(--primary-hover)] font-bold">{shiftFormattedTime} • {currentShift.staffName}</p>
                </div>
                <span className="font-bold text-[11px] text-[var(--primary-hover)] font-mono">
                  +Rp {currentShift.initialCash.toLocaleString('id-ID')}
                </span>
              </div>

              {expenseRecords.map((rec) => (
                <div key={rec.id} className="p-3 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--panel-border-light)] flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[11px] text-[var(--text-primary)] uppercase">{rec.description}</p>
                    <p className="text-[11px] text-[var(--text-secondary)] font-bold">{new Date(rec.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {rec.recordedBy}</p>
                  </div>
                  <span className={`font-bold text-[11px] font-mono ${rec.type === 'EXPENSE' ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
                    {rec.type === 'EXPENSE' ? '-' : '+'}Rp {rec.amount.toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: RATA-RATA TRANSAKSI (Daily Realtime Performance) */}
          <div className="ui-card p-6 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">RATA-RATA TRANSAKSI</p>
              <span className="text-[11px] font-bold text-[var(--accent-green)] bg-[var(--success-soft)] border border-[var(--accent-green)] px-2.5 py-0.5 rounded-full">
                DAILY REALTIME
              </span>
            </div>
            <p className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight font-mono">
              Rp {avgTransactionValue.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Per pelanggan (Estimasi)</p>
          </div>
        </div>
      </div>

      {/* TUTUP SHIFT & FINALISASI SHIFT MODAL */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'rgba(24,24,27,0.45)' }}>
          <div className="ui-card w-full max-w-4xl flex flex-col md:flex-row max-h-[92vh] overflow-hidden p-0">
            
            {/* LEFT SIDE: Finalisasi Shift Form (Screen Match) */}
            <div className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
              <div>
                <h2 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">Finalisasi Shift</h2>
                <p className="text-[11px] font-semibold text-[var(--text-secondary)] mt-1">
                  Pastikan uang fisik di laci sesuai dengan perhitungan sistem.
                </p>
              </div>

              {/* HITUNG UANG FISIK Card */}
              <div className="bg-[var(--surface-card)] rounded-2xl p-6 border border-[var(--panel-border)] space-y-3">
                <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest block">
                  HITUNG UANG FISIK
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    value={actualCashInput}
                    onChange={(e) => setActualCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                    className="ui-input w-full px-5 py-4 text-3xl font-bold font-mono tracking-tight"
                  />
                </div>

                {/* Selisih Indicator */}
                {(() => {
                  const actualVal = actualCashInput !== '' ? Number(actualCashInput) : 0;
                  const diff = actualVal - cashInDrawer;
                  if (actualCashInput === '') {
                    return (
                      <p className="text-[11px] font-bold text-[var(--accent-red)] flex items-center gap-1.5 pt-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--accent-red)] inline-block" />
                        <span>🔴 Selisih: -Rp {cashInDrawer.toLocaleString('id-ID')}</span>
                      </p>
                    );
                  }
                  if (diff === 0) {
                    return (
                      <p className="text-[11px] font-bold text-[var(--accent-green)] flex items-center gap-1.5 pt-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] inline-block" />
                        <span>✓ Kas Sesuai (Selisih Rp 0)</span>
                      </p>
                    );
                  }
                  if (diff > 0) {
                    return (
                      <p className="text-[11px] font-bold text-[var(--primary-hover)] flex items-center gap-1.5 pt-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] inline-block" />
                        <span>+ Surplus Kas: Rp {diff.toLocaleString('id-ID')}</span>
                      </p>
                    );
                  }
                  return (
                    <p className="text-[11px] font-bold text-[var(--accent-red)] flex items-center gap-1.5 pt-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-red)] inline-block" />
                      <span>🔴 Selisih: -Rp {Math.abs(diff).toLocaleString('id-ID')}</span>
                    </p>
                  );
                })()}
              </div>

              {/* Catatan Field */}
              <div>
                <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">
                  Catatan Selisih / Closing:
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Keterangan tambahan selisih kas..."
                  className="ui-input w-full p-3.5"
                  rows={2}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  className="ui-button ui-button-secondary flex-1 py-4 text-[11px] uppercase tracking-wider"
                >
                  BATAL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const actualVal = actualCashInput !== '' ? Number(actualCashInput) : 0;
                    const diff = actualVal - cashInDrawer;
                    const selisihNote = ` [Uang Fisik: Rp ${actualVal.toLocaleString('id-ID')}, Selisih: Rp ${diff.toLocaleString('id-ID')}]`;
                    setIsShiftMutationPending(true);
                    void onCloseShift((closeNotes + selisihNote).trim(), actualVal, cashInDrawer)
                      .then(() => setIsCloseModalOpen(false))
                      .catch(() => undefined)
                      .finally(() => setIsShiftMutationPending(false));
                  }}
                  disabled={isShiftMutationPending}
                  className="ui-button ui-button-primary flex-1 py-4 text-[11px] uppercase tracking-wider shadow-[var(--shadow-md)]"
                >
                  {isShiftMutationPending ? 'MENGONFIRMASI SERVER...' : 'TUTUP SHIFT & CETAK LAPORAN'}
                </button>
              </div>
            </div>

            {/* RIGHT SIDE: Thermal Receipt Preview (Z-REPORT Match) */}
            <div className="w-full md:w-84 bg-[var(--surface-secondary)] p-6 border-t md:border-t-0 md:border-l border-[var(--panel-border)] overflow-y-auto space-y-4 text-[var(--text-primary)] font-mono text-[11px]">
              {/* Receipt Paper Container */}
              <div className="ui-card p-5 space-y-4 rounded-none md:rounded-xl">
                <div className="text-center border-b border-dashed border-[var(--panel-border-strong)] pb-3 space-y-1">
                  <h3 className="text-base font-extrabold tracking-widest uppercase">Z-REPORT</h3>
                  <p className="text-[11px] text-[var(--text-secondary)] font-bold">Bakso Ujo OmniPOS</p>
                </div>

                <div className="space-y-1 text-[11px] font-bold text-[var(--text-secondary)] border-b border-dashed border-[var(--panel-border-strong)] pb-3">
                  <div className="flex justify-between"><span>Tanggal:</span><span>{new Date().toLocaleDateString('id-ID')}</span></div>
                  <div className="flex justify-between"><span>Start:</span><span>{shiftFormattedTime}</span></div>
                  <div className="flex justify-between"><span>End:</span><span>Now</span></div>
                  <div className="flex justify-between"><span>Cashier:</span><span className="uppercase">{currentShift.staffName || 'SUPER ADMIN'}</span></div>
                  <div className="flex justify-between"><span>ID:</span><span>{currentShift.id}</span></div>
                </div>

                <div className="space-y-1 text-[11px] font-bold text-[var(--text-secondary)] border-b border-dashed border-[var(--panel-border-strong)] pb-3">
                  <div className="flex justify-between"><span>Modal Awal</span><span>Rp {currentShift.initialCash.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between"><span>Pemasukan (Petty Cash)</span><span>Rp {pemasukanTotal.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between"><span>Pengeluaran</span><span>Rp {pengeluaranTotal.toLocaleString('id-ID')}</span></div>
                </div>

                <div className="space-y-1.5 text-[11px] border-b border-dashed border-[var(--panel-border-strong)] pb-3">
                  <div className="flex justify-between font-bold text-[var(--text-primary)]"><span>PENJUALAN KOTOR</span><span>Rp {grossOmset.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between text-[var(--text-secondary)] pl-2"><span>Cash</span><span>Rp {tunaiSales.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between text-[var(--text-secondary)] pl-2"><span>QRIS</span><span>Rp {qrisSales.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between text-[var(--text-secondary)] pl-2"><span>DEBIT</span><span>Rp {debitSales.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between text-[var(--accent-red)] font-bold pl-2"><span>Diskon</span><span>- Rp {totalDiscount.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between text-[var(--text-secondary)] pl-2"><span>Pajak</span><span>Rp {totalTax.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between font-bold text-[var(--text-primary)] pt-1 border-t border-[var(--panel-border)]"><span>PENJUALAN BERSIH</span><span>Rp {netOmset.toLocaleString('id-ID')}</span></div>
                </div>

                {/* CASH SUMMARY Box matching Screenshot */}
                <div className="bg-[var(--surface-secondary)] border border-[var(--panel-border)] p-3.5 rounded-xl space-y-1.5 text-[11px] font-mono">
                  <p className="text-[11px] font-bold text-center text-[var(--text-tertiary)] uppercase tracking-widest mb-1.5">CASH SUMMARY</p>
                  <div className="flex justify-between text-[var(--text-secondary)]"><span>Modal Awal</span><span>Rp {currentShift.initialCash.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between text-[var(--text-secondary)]"><span>Pemasukan</span><span>Rp {pemasukanTotal.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between text-[var(--text-secondary)]"><span>Pengeluaran</span><span>- Rp {pengeluaranTotal.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between font-bold text-[var(--text-primary)] pt-1 border-t border-[var(--panel-border)]"><span>Expected</span><span>Rp {cashInDrawer.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between font-bold text-[var(--text-primary)]"><span>Actual</span><span>Rp {(actualCashInput !== '' ? Number(actualCashInput) : 0).toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between font-bold text-[11px] pt-1 border-t border-[var(--panel-border)]">
                    <span>Selisih</span>
                    <span className={(actualCashInput !== '' ? Number(actualCashInput) : 0) - cashInDrawer < 0 ? 'text-[var(--accent-red)] font-bold' : 'text-[var(--accent-green)] font-bold'}>
                      Rp {((actualCashInput !== '' ? Number(actualCashInput) : 0) - cashInDrawer).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Handover Shift Modal */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'rgba(24,24,27,0.45)' }}>
          <div className="ui-card w-full max-w-md p-6 space-y-4 font-sans text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--panel-border-light)] pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[var(--primary-text)]" />
                <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Serah Terima Shift (Handover)</h2>
              </div>
              <button onClick={() => setIsHandoverModalOpen(false)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[var(--surface-secondary)] p-4 rounded-2xl space-y-2 text-[11px] font-bold text-[var(--text-secondary)] border border-[var(--panel-border)]">
              <div className="flex justify-between"><span>Kasir Asal:</span><span className="font-bold text-[var(--text-primary)]">{currentShift.staffName}</span></div>
              <div className="flex justify-between"><span>Target Laci Tunai:</span><span className="font-bold text-[var(--primary-text)] font-mono">Rp {cashInDrawer.toLocaleString('id-ID')}</span></div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">Kasir Penerima Shift Handover:</label>
              <input
                type="text"
                placeholder="Nama kasir pengganti..."
                value={handoverStaffName}
                onChange={(e) => setHandoverStaffName(e.target.value)}
                className="ui-input w-full p-3 text-[11px]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">Jumlah Uang Fisik Diserahterimakan (Rp):</label>
              <input
                type="number"
                placeholder={`Contoh: ${cashInDrawer}`}
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                className="ui-input w-full p-3 text-[11px]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setIsHandoverModalOpen(false)} className="ui-button ui-button-secondary flex-1 py-3 text-[11px]">
                Batal
              </button>
              <button
                onClick={() => {
                  if (!handoverStaffName.trim()) {
                    toast('Input Tidak Lengkap', 'Mohon isi nama kasir penerima handover.');
                    return;
                  }
                  const actualVal = Number(actualCashInput || cashInDrawer);
                  const handoverNotes = `[HANDOVER] Serah terima shift ke ${handoverStaffName}. Uang fisik: Rp ${Number(actualCashInput || cashInDrawer).toLocaleString('id-ID')}`;
                  setIsShiftMutationPending(true);
                  void onCloseShift(handoverNotes, actualVal, cashInDrawer)
                    .then(() => setIsHandoverModalOpen(false))
                    .catch(() => undefined)
                    .finally(() => setIsShiftMutationPending(false));
                }}
                disabled={isShiftMutationPending}
                className="ui-button ui-button-primary flex-1 py-3 text-[11px] shadow-[var(--shadow-md)]"
              >
                Proses Handover Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void History Modal */}
      {isVoidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'rgba(24,24,27,0.45)' }}>
          <div className="ui-card w-full max-w-lg p-6 md:p-8 space-y-4 font-sans text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--panel-border-light)] pb-3">
              <div className="flex items-center gap-2 text-[var(--accent-red)] font-bold text-sm">
                <Ban className="w-5 h-5 text-[var(--accent-red)]" />
                <span>RIWAYAT VOID TRANSAKSI SHIFT ({voidOrders.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="w-7 h-7 bg-[var(--surface-secondary)] hover:bg-[var(--panel-border)] rounded-full flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {voidOrders.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Ban className="w-12 h-12 text-[var(--panel-border-strong)] mx-auto" />
                  <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Belum ada riwayat void (pembatalan transaksi) pada shift ini.</p>
                </div>
              ) : (
                voidOrders.map((ord) => (
                  <div key={ord.id} className="p-3.5 bg-[var(--danger-soft)] border border-[var(--accent-red)]/20 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[11px] text-[var(--accent-red)]">{ord.customerName || 'Pelanggan'} #{ord.orderNumber}</p>
                      <p className="text-[11px] text-[var(--accent-red)]/70 font-mono font-bold mt-0.5">
                        Waktu: {new Date(ord.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • Meja: {ord.tableNumber || '-'}
                      </p>
                    </div>
                    <span className="font-bold text-[11px] text-[var(--accent-red)] font-mono">
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
                className="ui-button ui-button-primary px-5 py-2.5 text-[11px] uppercase tracking-wider"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount History Modal */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'rgba(24,24,27,0.45)' }}>
          <div className="ui-card w-full max-w-lg p-6 md:p-8 space-y-4 font-sans text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--panel-border-light)] pb-3">
              <div className="flex items-center gap-2 text-[var(--accent-amber)] font-bold text-sm">
                <Tag className="w-5 h-5 text-[var(--accent-amber)]" />
                <span>RIWAYAT DISKON TRANSAKSI SHIFT ({discountedOrders.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="w-7 h-7 bg-[var(--surface-secondary)] hover:bg-[var(--panel-border)] rounded-full flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {discountedOrders.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Tag className="w-12 h-12 text-[var(--panel-border-strong)] mx-auto" />
                  <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Belum ada transaksi dengan pemberian diskon pada shift ini.</p>
                </div>
              ) : (
                discountedOrders.map((ord) => (
                  <div key={ord.id} className="p-3.5 bg-[var(--warning-soft)] border border-[var(--accent-amber)]/20 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[11px] text-[var(--accent-amber)]">{ord.customerName || 'Pelanggan'} #{ord.orderNumber}</p>
                      <p className="text-[11px] text-[var(--accent-amber)]/80 font-mono font-bold mt-0.5">
                        Waktu: {new Date(ord.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • Kasir: {ord.cashierName}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[11px] text-[var(--accent-red)] font-mono block">
                        - Rp {ord.discount.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)] font-mono font-bold">
                        Net: Rp {ord.total.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="ui-button ui-button-primary px-5 py-2.5 text-[11px] uppercase tracking-wider"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift History Perhari Archive Modal */}
      {isShiftHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'rgba(24,24,27,0.45)' }}>
          <div className="ui-card w-full max-w-2xl p-0 font-sans text-[var(--text-primary)] max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 shrink-0"
              style={{ borderColor: 'var(--panel-border-light)' }}>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary-hover)' }}>
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Arsip Riwayat Shift</h2>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {shiftHistory.length} shift terdokumentasi
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setIsShiftHistoryModalOpen(false)}
                className="ui-icon-button h-8 w-8" aria-label="Tutup">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary banner */}
            {shiftHistory.length > 0 && (
              <div className="shrink-0 grid grid-cols-3 gap-0 border-b"
                style={{ borderColor: 'var(--panel-border-light)', background: 'var(--surface-secondary)' }}>
                {[
                  {
                    label: 'Total Omzet',
                    value: `Rp ${shiftHistory.reduce((s, sh) => s + (sh.grossOmset || 0), 0).toLocaleString('id-ID')}`,
                    color: 'var(--primary-solid)'
                  },
                  {
                    label: 'Total Shift',
                    value: `${shiftHistory.length} shift`,
                    color: 'var(--text-primary)'
                  },
                  {
                    label: 'Rata-rata / Shift',
                    value: `Rp ${Math.round(shiftHistory.reduce((s, sh) => s + (sh.grossOmset || 0), 0) / shiftHistory.length).toLocaleString('id-ID')}`,
                    color: 'var(--accent-green)'
                  }
                ].map((stat) => (
                  <div key={stat.label} className="px-4 py-3 text-center border-r last:border-r-0"
                    style={{ borderColor: 'var(--panel-border-light)' }}>
                    <p className="ui-stat-label">{stat.label}</p>
                    <p className="mt-1 text-[14px] font-extrabold tabular-nums leading-none"
                      style={{ color: stat.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Shift list */}
            <div className="flex-1 overflow-y-auto space-y-2 p-4">
              {shiftHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                    <Calendar className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                      Belum ada riwayat shift
                    </p>
                    <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      Shift yang sudah ditutup akan muncul di sini secara otomatis.
                    </p>
                  </div>
                </div>
              ) : (
                shiftHistory.map((shf, idx) => {
                  const isExpanded = selectedHistoryShift?.id === shf.id;
                  const shiftDuration = shf.endTime
                    ? Math.round((new Date(shf.endTime).getTime() - new Date(shf.startTime).getTime()) / 60000)
                    : null;
                  return (
                    <div key={shf.id}
                      className="overflow-hidden rounded-2xl border transition-all cursor-pointer"
                      style={{
                        borderColor: isExpanded ? 'var(--primary-border)' : 'var(--panel-border)',
                        background: isExpanded ? 'var(--primary-soft)' : 'var(--surface-card)'
                      }}
                      onClick={() => setSelectedHistoryShift(isExpanded ? null : shf)}>

                      {/* Row header */}
                      <div className="flex items-center justify-between gap-3 p-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Rank badge */}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                            style={{ background: idx === 0 ? 'var(--primary-solid)' : 'var(--surface-inverse)' }}>
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold leading-tight truncate"
                              style={{ color: 'var(--text-primary)' }}>
                              {shf.staffName}
                              <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-lg"
                                style={{ background: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>
                                {shf.staffRole}
                              </span>
                            </p>
                            <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                              {new Date(shf.startTime).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                              {' · '}
                              {new Date(shf.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              {shf.endTime && ` → ${new Date(shf.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`}
                              {shiftDuration !== null && ` (${shiftDuration} mnt)`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-[14px] font-extrabold tabular-nums"
                              style={{ color: 'var(--primary-solid)' }}>
                              Rp {(shf.grossOmset || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-[10px] font-bold uppercase"
                              style={{ color: 'var(--text-tertiary)' }}>gross omzet</p>
                          </div>
                          <div className="flex h-5 w-5 items-center justify-center rounded-full transition-transform"
                            style={{
                              background: 'var(--surface-secondary)',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                            }}>
                            <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                          </div>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t px-4 pb-4 pt-3 space-y-3"
                          style={{ borderColor: 'var(--primary-border)' }}
                          onClick={(e) => e.stopPropagation()}>

                          {/* Stats grid 2×3 */}
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: 'Modal Awal', value: `Rp ${(shf.initialCash || 0).toLocaleString('id-ID')}`, color: 'var(--text-primary)' },
                              { label: 'Tunai', value: `Rp ${(shf.cashSales || 0).toLocaleString('id-ID')}`, color: 'var(--accent-green)' },
                              { label: 'Non-Tunai', value: `Rp ${(shf.nonCashSales || 0).toLocaleString('id-ID')}`, color: 'var(--primary-text)' },
                              { label: 'Pengeluaran', value: `Rp ${(shf.totalExpense || 0).toLocaleString('id-ID')}`, color: 'var(--accent-red)' },
                              { label: 'Pemasukan', value: `Rp ${(shf.totalIncome || 0).toLocaleString('id-ID')}`, color: 'var(--accent-green)' },
                              {
                                label: 'Kas Bersih',
                                value: `Rp ${((shf.initialCash || 0) + (shf.cashSales || 0) + (shf.totalIncome || 0) - (shf.totalExpense || 0)).toLocaleString('id-ID')}`,
                                color: 'var(--primary-solid)'
                              },
                            ].map((s) => (
                              <div key={s.label} className="rounded-xl p-2.5"
                                style={{ background: 'var(--surface-card)', border: '1px solid var(--panel-border)' }}>
                                <p className="ui-stat-label">{s.label}</p>
                                <p className="mt-1 text-[12px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Notes */}
                          {shf.notes && (
                            <div className="rounded-xl p-3 text-[11px] font-medium"
                              style={{ background: 'var(--surface-card)', border: '1px solid var(--panel-border)', color: 'var(--text-secondary)' }}>
                              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Catatan: </span>
                              {shf.notes}
                            </div>
                          )}

                          {/* Shift ID */}
                          <p className="text-[10px] font-mono text-right" style={{ color: 'var(--text-tertiary)' }}>
                            ID: {shf.id} · Branch: {shf.branchName || shf.branchId || '-'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="shrink-0 flex justify-end border-t px-6 py-4"
              style={{ borderColor: 'var(--panel-border-light)' }}>
              <button type="button" onClick={() => setIsShiftHistoryModalOpen(false)}
                className="ui-button ui-button-primary px-6 text-[12px]">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
