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
  RefreshCw
} from 'lucide-react';
import { RestaurantTable, Order } from '../../types/pos';

interface QuickTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  orders: Order[];
  onToggleSelfOrder: (tableNumber: string, enabled: boolean) => void;
  onClearTableStatus: (tableNumber: string) => void;
  onSetTableOccupied?: (tableNumber: string) => void;
  onSelectTableForOrder?: (tableNumber: string) => void;
  onToggleAllSelfOrder?: (enabled: boolean) => void;
  onResetAllTablesToFree?: () => void;
  onAddNewTable?: (tableNumber: string, capacity: number) => void;
}

export const QuickTableModal: React.FC<QuickTableModalProps> = ({
  isOpen,
  onClose,
  tables,
  orders,
  onToggleSelfOrder,
  onClearTableStatus,
  onSetTableOccupied,
  onSelectTableForOrder,
  onToggleAllSelfOrder,
  onResetAllTablesToFree,
  onAddNewTable
}) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'FREE' | 'OCCUPIED'>('ALL');
  const [newTableNum, setNewTableNum] = useState<string>('');
  const [newTableCap, setNewTableCap] = useState<number>(4);
  const [isAddingTable, setIsAddingTable] = useState<boolean>(false);

  if (!isOpen) return null;

  const activeOrders = orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

  const freeTablesCount = tables.filter((t) => {
    const isOccupiedByOrder = activeOrders.some((o) => o.tableNumber === t.number);
    return t.status !== 'OCCUPIED' && !isOccupiedByOrder;
  }).length;

  const occupiedTablesCount = tables.length - freeTablesCount;

  const handleAddTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;
    if (tables.some((t) => t.number.toLowerCase() === newTableNum.trim().toLowerCase())) {
      alert(`Nomor meja ${newTableNum} sudah ada!`);
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* MODAL HEADER */}
        <div className="bg-slate-900/90 border-b border-slate-800 p-4 md:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-600/30">
              <Grid2X2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">
                  Pengelolaan & Status Meja Resto
                </h2>
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  MODAL POP-UP
                </span>
              </div>
              <p className="text-[#B8B0A8] text-xs font-medium mt-0.5">
                Indikator visual real-time: <span className="text-emerald-400 font-bold">HIJAU = KOSONG</span> | <span className="text-rose-400 font-bold">MERAH = TERISI</span>. Klik kotak meja untuk ubah status atau pilih order.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 text-[#B8B0A8] hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QUICK CONTROL SUMMARY BAR */}
        <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Status Counters */}
          <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-[#B8B0A8] text-[11px]">Total:</span>
              <span className="text-white font-bold">{tables.length} Meja</span>
            </div>

            <button
              type="button"
              onClick={() => setFilterMode('FREE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterMode === 'FREE'
                  ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40'
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
                  : 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/40'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>{occupiedTablesCount} TERISI (MERAH)</span>
            </button>

            {filterMode !== 'ALL' && (
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className="text-[11px] text-[#B8B0A8] hover:text-white underline cursor-pointer"
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
                  if (confirm('Reset semua status meja menjadi HIJAU (KOSONG)?')) {
                    onResetAllTablesToFree();
                  }
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Reset Semua Kosong</span>
              </button>
            )}

            {onToggleAllSelfOrder && (
              <button
                type="button"
                onClick={() => onToggleAllSelfOrder(true)}
                className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span>Self-Order ON Semua</span>
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
            className="bg-slate-950 p-4 border-b border-slate-800 flex flex-wrap items-end gap-3 animate-fade-in"
          >
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Nomor / Nama Meja Baru *</label>
              <input
                type="text"
                required
                placeholder="Misal: 09 atau VIP-1"
                value={newTableNum}
                onChange={(e) => setNewTableNum(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
              />
            </div>
            <div className="w-28">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Kapasitas (Orang)</label>
              <input
                type="number"
                min={1}
                max={20}
                value={newTableCap}
                onChange={(e) => setNewTableCap(parseInt(e.target.value) || 4)}
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-indigo-500 text-center"
              />
            </div>
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              Simpan Meja Baru
            </button>
            <button
              type="button"
              onClick={() => setIsAddingTable(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"
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

              return (
                <div
                  key={table.id}
                  className={`rounded-2xl p-3.5 border transition-all duration-200 flex flex-col justify-between gap-3 relative overflow-hidden group shadow-lg ${
                    isOccupied
                      ? 'bg-rose-950/40 border-rose-500/80 text-white hover:border-rose-400 ring-1 ring-rose-500/30'
                      : 'bg-emerald-950/40 border-emerald-500/80 text-white hover:border-emerald-400 ring-1 ring-emerald-500/30'
                  }`}
                >
                  {/* Top Header Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold tracking-tight text-white">
                          MEJA {table.number}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#B8B0A8] font-medium">
                        Kapasitas: {table.capacity} Org
                      </span>
                    </div>

                    {/* Status Pill Indicator */}
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs ${
                        isOccupied
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-500 text-slate-950'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-white animate-pulse' : 'bg-slate-950'}`} />
                      {isOccupied ? 'MERAH (TERISI)' : 'HIJAU (KOSONG)'}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 text-[11px] space-y-1">
                    {isOccupied ? (
                      <div>
                        <div className="flex items-center justify-between text-rose-300 font-semibold text-[10px]">
                          <span>ORDER ACTIVE</span>
                          <span className="font-mono">{activeOrderOnTable?.orderNumber || '#ACTIVE'}</span>
                        </div>
                        <p className="font-bold text-white truncate mt-0.5">
                          {activeOrderOnTable?.customerName || 'Tamu Resto'}
                        </p>
                        <p className="text-[9px] text-[#B8B0A8] font-medium">
                          Total: Rp {(activeOrderOnTable?.total || 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-1">
                        <p className="text-emerald-400 font-bold text-xs">SIAP DIGUNAKAN</p>
                        <p className="text-[9px] text-[#B8B0A8]">Meja belum ada pemesan</p>
                      </div>
                    )}
                  </div>

                  {/* Self Order Toggle Button */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] font-bold">
                    <span className="text-[#B8B0A8] flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-indigo-400" /> HP QR:
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleSelfOrder(table.number, !table.isSelfOrderEnabled)}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        table.isSelfOrderEnabled
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-[#B8B0A8] hover:bg-slate-700'
                      }`}
                      title="Toggle Akses Self-Order dari HP Customer"
                    >
                      {table.isSelfOrderEnabled ? 'ON (AKTIF)' : 'OFF'}
                    </button>
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {isOccupied ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onClearTableStatus(table.number)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] py-1.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                          title="Ubah status meja menjadi Kosong (Hijau)"
                        >
                          <Unlock className="w-3 h-3" />
                          <span>KOSONGKAN</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectTableForOrder) {
                              onSelectTableForOrder(table.number);
                              onClose();
                            }
                          }}
                          className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] py-1.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
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
                          className="w-full bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-semibold text-[10px] py-1.5 rounded-xl transition-all border border-rose-700/50 flex items-center justify-center gap-1 cursor-pointer"
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
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] py-1.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
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
        <div className="bg-slate-900 border-t border-slate-800 p-3.5 md:p-4 flex items-center justify-between shrink-0 text-xs font-medium text-[#B8B0A8]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Hijau = Kosong</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 ml-2" />
            <span>Merah = Terisi</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-lg shadow-purple-600/30 cursor-pointer"
          >
            Tutup Modal
          </button>
        </div>

      </div>
    </div>
  );
};
