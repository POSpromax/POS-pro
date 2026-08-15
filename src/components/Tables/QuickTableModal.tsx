import React, { useState } from 'react';
import {
  Grid2X2,
  X,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Plus,
  RotateCcw,
  Utensils,
  ShoppingBag,
  Sparkles,
  Lock,
  Unlock,
  Check,
  RefreshCw,
  QrCode
} from 'lucide-react';
import { RestaurantTable, Order } from '../../types/pos';
import { updateCloudTableSession } from '../../services/tableService';

interface QuickTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  orders: Order[];
  branchId: string;
  onTableUpdated: (table: RestaurantTable) => void;
  onToggleSelfOrder: (tableNumber: string, enabled: boolean) => void;
  onClearTableStatus: (tableNumber: string) => void;
  onSetTableOccupied?: (tableNumber: string) => void;
  onSelectTableForOrder?: (tableNumber: string) => void;
  onToggleAllSelfOrder?: (enabled: boolean) => void;
  onResetAllTablesToFree?: () => void;
  onAddNewTable?: (tableNumber: string, capacity: number) => void;
  onOpenQrPrint?: () => void;
  onShowToast?: (title: string, message: string) => void;
}

export const QuickTableModal: React.FC<QuickTableModalProps> = ({
  isOpen,
  onClose,
  tables,
  orders,
  branchId,
  onTableUpdated,
  onToggleSelfOrder,
  onClearTableStatus,
  onSetTableOccupied,
  onSelectTableForOrder,
  onToggleAllSelfOrder,
  onResetAllTablesToFree,
  onAddNewTable,
  onOpenQrPrint,
  onShowToast
}) => {
  const [busyTable, setBusyTable] = useState<string | null>(null);

  // Aktivasi harus lewat server: tombol yang hanya mengubah localStorage
  // membuat kasir mengira QR menyala padahal pelanggan tetap ditolak.
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  const runSession = async (
    table: RestaurantTable,
    action: 'SET_ENABLED',
    enabled = true,
  ) => {
    setBusyTable(table.id);
    try {
      const result = await updateCloudTableSession({
        action,
        branchId,
        tableNumber: table.number.replace(/^0+(?=\d)/, ''),
        enabled,
      });
      if (result.table) onTableUpdated(result.table);
      if (onShowToast) {
        const off = !enabled;
        onShowToast(
          off ? 'Self-Order Meja Dimatikan' : 'Self-Order Meja Aktif',
          off
            ? `Meja ${table.number} tidak menerima pesanan dari HP pelanggan.`
            : `Meja ${table.number} siap menerima pesanan dari HP pelanggan.`,
        );
      }
    } catch (error) {
      if (onShowToast) {
        onShowToast('Gagal', error instanceof Error ? error.message : 'Status meja gagal diperbarui.');
      }
    } finally {
      setBusyTable(null);
    }
  };

  // Aktifkan / nonaktifkan self-order untuk SEMUA meja cabang sekaligus.
  const runBulk = async (enabled: boolean) => {
    setBulkBusy(true);
    try {
      const result = await updateCloudTableSession({ action: 'SET_ENABLED_ALL', branchId, tableNumber: '', enabled });
      (result.tables || []).forEach((t) => onTableUpdated(t));
      if (onShowToast) {
        onShowToast(
          enabled ? 'Semua Meja Aktif' : 'Semua Meja Dimatikan',
          enabled ? 'Semua meja kini menerima pesanan dari HP pelanggan.' : 'Self-order semua meja dimatikan.',
        );
      }
    } catch (error) {
      if (onShowToast) onShowToast('Gagal', error instanceof Error ? error.message : 'Status meja gagal diperbarui.');
    } finally {
      setBulkBusy(false);
    }
  };

  const [filterMode, setFilterMode] = useState<'ALL' | 'FREE' | 'OCCUPIED'>('ALL');
  const [newTableNum, setNewTableNum] = useState<string>('');
  const [newTableCap, setNewTableCap] = useState<number>(4);
  const [isAddingTable, setIsAddingTable] = useState<boolean>(false);
  const [confirmingReset, setConfirmingReset] = useState<boolean>(false);

  if (!isOpen) return null;

  const activeOrders = orders.filter((o) => o.status !== 'CANCELLED' && !(o.status === 'COMPLETED' && o.paymentStatus === 'PAID'));

  const freeTablesCount = tables.filter((t) => {
    const isOccupiedByOrder = activeOrders.some((o) => o.tableNumber === t.number);
    return t.status !== 'OCCUPIED' && !isOccupiedByOrder;
  }).length;

  const occupiedTablesCount = tables.length - freeTablesCount;

  const handleAddTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;
    if (tables.some((t) => t.number.toLowerCase() === newTableNum.trim().toLowerCase())) {
      if (onShowToast) onShowToast('Meja Duplikat', `Nomor meja ${newTableNum} sudah ada!`);
      return;
    }
    if (onAddNewTable) {
      onAddNewTable(newTableNum.trim(), newTableCap);
    }
    setNewTableNum('');
    setIsAddingTable(false);
  };

  const filteredTables = tables.filter((t) => {
    const isOccupiedByOrder = activeOrders.some((o) => o.tableNumber === t.number);
    const isOccupied = t.status === 'OCCUPIED' || isOccupiedByOrder;
    if (filterMode === 'FREE') return !isOccupied;
    if (filterMode === 'OCCUPIED') return isOccupied;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-600/30 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in font-sans">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white shadow-[0_24px_70px_rgba(26,23,20,0.20)]">
        
        {/* MODAL HEADER */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--panel-border)] bg-white p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-bold shadow-[var(--shadow-md)]">
              <Grid2X2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)] md:text-xl">
                  Pengelolaan & Status Meja Resto
                </h2>
                <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--primary-hover)]">
                  Monitor cepat
                </span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-[var(--text-secondary)]">
                <span className="font-bold text-emerald-600">Hijau = kosong</span> · <span className="font-bold text-rose-600">Merah = terisi</span>. Pilih kartu meja untuk tindakan cepat.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-icon-button h-9 w-9 cursor-pointer rounded-xl"
            aria-label="Tutup pengelolaan meja"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QUICK CONTROL SUMMARY BAR */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border)] bg-[var(--surface-secondary)] px-4 py-3">
          {/* Status Counters */}
          <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
            <div className="flex items-center gap-1.5 rounded-xl border border-[var(--panel-border)] bg-white px-3 py-1.5">
              <span className="text-[var(--text-tertiary)] text-[11px]">Total:</span>
              <span className="font-bold text-[var(--text-primary)]">{tables.length} meja</span>
            </div>

            <button
              type="button"
              onClick={() => setFilterMode('FREE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterMode === 'FREE'
                  ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{freeTablesCount} KOSONG (HIJAU)</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('OCCUPIED')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterMode === 'OCCUPIED'
                  ? 'bg-rose-600 text-white border-rose-500 ring-2 ring-rose-500/30'
                  : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>{occupiedTablesCount} TERISI (MERAH)</span>
            </button>

            {filterMode !== 'ALL' && (
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className="cursor-pointer text-[11px] font-semibold text-[var(--primary-hover)] hover:underline"
              >
                Lihat Semua
              </button>
            )}
          </div>

          {/* Bulk Controls */}
          <div className="flex items-center gap-2">
            {onResetAllTablesToFree && (
              <button
                type="button"
                onClick={() => {
                  if (confirmingReset) {
                    onResetAllTablesToFree();
                    setConfirmingReset(false);
                  } else {
                    setConfirmingReset(true);
                    setTimeout(() => setConfirmingReset(false), 3000);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
                  confirmingReset
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                    : 'bg-white hover:bg-[var(--primary-soft)] text-[var(--text-secondary)] border-[var(--panel-border)]'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>{confirmingReset ? 'Yakin Reset?' : 'Reset Semua Kosong'}</span>
              </button>
            )}

            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void runBulk(true)}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Aktifkan self-order untuk semua meja"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{bulkBusy ? '…' : 'Aktifkan Semua'}</span>
            </button>

            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void runBulk(false)}
              className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Matikan self-order untuk semua meja"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Matikan Semua</span>
            </button>

            {onOpenQrPrint && (
              <button
                type="button"
                onClick={onOpenQrPrint}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Cetak label QR untuk ditempel di meja"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Cetak QR</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAddingTable(!isAddingTable)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Meja</span>
            </button>
          </div>
        </div>

        {/* ADD TABLE FORM COLLAPSIBLE */}
        {isAddingTable && (
          <form
            onSubmit={handleAddTableSubmit}
            className="animate-fade-in flex flex-wrap items-end gap-3 border-b border-[var(--panel-border)] bg-[var(--surface-secondary)] p-4"
          >
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">Nomor / nama meja baru *</label>
              <input
                type="text"
                required
                placeholder="Misal: 09 atau VIP-1"
                value={newTableNum}
                onChange={(e) => setNewTableNum(e.target.value)}
                className="ui-input w-full bg-white px-3 text-xs font-bold"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">Kapasitas</label>
              <input
                type="number"
                min={1}
                max={20}
                value={newTableCap}
                onChange={(e) => setNewTableCap(parseInt(e.target.value) || 4)}
                className="ui-input w-full bg-white px-3 text-center text-xs font-bold"
              />
            </div>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
              style={{ color: '#ffffff' }}
            >
              Simpan Meja Baru
            </button>
            <button
              type="button"
              onClick={() => setIsAddingTable(false)}
              className="ui-button ui-button-secondary min-h-9 cursor-pointer px-3 text-xs"
            >
              Batal
            </button>
          </form>
        )}

        {/* TABLE BOXES GRID CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {filteredTables.map((table) => {
              const activeOrderOnTable = activeOrders.find((o) => o.tableNumber === table.number);
              const isOccupiedByOrder = !!activeOrderOnTable;
              const isOccupied = table.status === 'OCCUPIED' || isOccupiedByOrder;
              // Server menolak meja yang belum diaktifkan kasir, jadi status itu
              // harus terlihat berbeda — bukan ikut hijau seperti meja siap.
              const isArmed = table.status === 'READY';
              const selfOrderOn = table.isSelfOrderEnabled !== false && table.status !== 'DISABLED';
              const isBusy = busyTable === table.id;

              return (
                <div
                  key={table.id}
                  className={`rounded-2xl p-3.5 border transition-all duration-200 flex flex-col justify-between gap-3 relative overflow-hidden group shadow-md ${
                    isOccupied
                      ? 'bg-[var(--danger-soft)] border-[var(--accent-red)] text-[var(--text-primary)] hover:border-rose-400 ring-1 ring-rose-100'
                      : isArmed
                        ? 'bg-[var(--success-soft)] border-[var(--accent-green)] text-[var(--text-primary)] hover:border-emerald-400 ring-1 ring-emerald-100'
                        : 'bg-[var(--surface-secondary)] border-[var(--panel-border)] text-[var(--text-primary)] hover:border-[var(--panel-border-strong)]'
                  }`}
                >
                  {/* Top Header Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                          MEJA {table.number}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                        Kapasitas: {table.capacity} Org
                      </span>
                    </div>

                    {/* Status Pill Indicator */}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm ${
                        isOccupied
                          ? 'bg-rose-600 text-white'
                          : isArmed
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[var(--surface-inverse)] text-white'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full bg-white ${isOccupied ? 'animate-pulse' : ''}`} />
                      {isOccupied ? 'TERISI' : isArmed ? 'SIAP QR' : 'BELUM AKTIF'}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="space-y-1 rounded-xl border border-white/80 bg-white/80 p-2.5 text-[11px]">
                    {isOccupied ? (
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-semibold text-rose-600">
                          <span>ORDER ACTIVE</span>
                          <span className="font-mono">{activeOrderOnTable?.orderNumber || '#ACTIVE'}</span>
                        </div>
                        <p className="mt-0.5 truncate font-bold text-[var(--text-primary)]">
                          {activeOrderOnTable?.customerName || 'Tamu Resto'}
                        </p>
                        <p className="text-[11px] text-[var(--text-tertiary)] font-medium">
                          Total: Rp {(activeOrderOnTable?.total || 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-1">
                        <p className={`text-xs font-bold ${isArmed ? 'text-emerald-700' : 'text-[var(--text-secondary)]'}`}>
                          {isArmed ? 'Siap digunakan' : 'Belum diaktifkan'}
                        </p>
                        <p className="text-[11px] text-[var(--text-tertiary)]">
                          {isArmed ? 'QR meja aktif, pelanggan bisa memesan' : 'Aktifkan dulu agar QR bisa dipakai'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Aktivasi self-order per meja — menembus ke server */}
                  <div className="flex items-center justify-between border-t border-white/80 pt-1 text-[11px] font-bold gap-2">
                    <span className="text-[var(--text-tertiary)] flex items-center gap-1 shrink-0">
                      <Smartphone className="w-3 h-3 text-[var(--primary-text)]" /> Self-Order:
                    </span>
                    <div className="flex items-center gap-1">
                      {selfOrderOn ? (
                        <button
                          type="button"
                          disabled={isBusy || Boolean(table.activeOrderId)}
                          onClick={() => void runSession(table, 'SET_ENABLED', false)}
                          className="px-2.5 py-1 rounded-lg font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white transition-all cursor-pointer"
                          title={table.activeOrderId ? 'Selesaikan bill aktif sebelum mengubah self-order' : 'Matikan self-order untuk meja ini'}
                        >
                          {isBusy ? '…' : 'MATIKAN'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void runSession(table, 'SET_ENABLED', true)}
                          className="px-2.5 py-1 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all cursor-pointer"
                          title="Aktifkan self-order agar bisa dipesan dari HP pelanggan"
                        >
                          {isBusy ? '…' : 'AKTIFKAN'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {isOccupied ? (
                      <>
                        {!table.activeOrderId && <button
                          type="button"
                          onClick={() => onClearTableStatus(table.number)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] py-1.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                          title="Ubah status meja menjadi Kosong (Hijau)"
                        >
                          <Unlock className="w-3 h-3" />
                          <span>KOSONGKAN</span>
                        </button>}

                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectTableForOrder) {
                              onSelectTableForOrder(table.number);
                              onClose();
                            }
                          }}
                          className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] py-1.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                          title="Buka order meja ini di kasir"
                        >
                          <ShoppingBag className="w-3 h-3" />
                          <span>LIHAT ORDER</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSetTableOccupied) {
                              onSetTableOccupied(table.number);
                            } else {
                              onClearTableStatus(table.number);
                            }
                          }}
                          className="w-full bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-semibold text-[11px] py-1.5 rounded-xl transition-all border border-rose-700/50 flex items-center justify-center gap-1 cursor-pointer"
                          title="Tandai meja terisi (Merah)"
                        >
                          <Lock className="w-3 h-3" />
                          <span>TERISI (RED)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectTableForOrder) {
                              onSelectTableForOrder(table.number);
                              onClose();
                            }
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] py-1.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                          title="Pilih meja ini untuk transaksi POS baru"
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>PILIH ORDER</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--panel-border)] bg-white p-3.5 text-xs font-medium text-[var(--text-secondary)] md:p-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Hijau = Kosong</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 ml-2" />
            <span>Merah = Terisi</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-button ui-button-primary cursor-pointer px-6"
          >
            Tutup Modal
          </button>
        </div>

      </div>
    </div>
  );
};
