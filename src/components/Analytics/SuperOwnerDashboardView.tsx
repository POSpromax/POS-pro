import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Compass,
  DollarSign,
  ExternalLink,
  Grid2X2,
  MapPin,
  Phone,
  Plus,
  Receipt,
  Search,
  Settings,
  Store,
  Users,
  X,
  BarChart3,
  Layers,
} from 'lucide-react';
import { Branch, Order, RestaurantTable, RawMaterial } from '../../types/pos';

interface SuperOwnerDashboardViewProps {
  branches: Branch[];
  orders: Order[];
  tables: RestaurantTable[];
  rawMaterials: RawMaterial[];
  currentBranch: Branch;
  onSelectBranch: (branch: Branch) => void;
  onAddBranch: (newBranch: Branch) => void;
  onNavigateTab: (tab: string) => void;
  onShowToast?: (title: string, message: string) => void;
}

export const SuperOwnerDashboardView: React.FC<SuperOwnerDashboardViewProps> = ({
  branches,
  orders,
  tables,
  rawMaterials,
  currentBranch,
  onSelectBranch,
  onAddBranch,
  onNavigateTab,
  onShowToast
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'COMBINED' | 'PER_OUTLET'>('COMBINED');
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);

  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [isMainBranchCheck, setIsMainBranchCheck] = useState(false);

  const filteredBranches = useMemo(
    () =>
      branches.filter(
        (b) =>
          b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.address.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [branches, searchTerm],
  );

  const getOrdersForScope = (branchId?: string) => {
    if (!branchId) return orders;
    return orders.filter((o) => o.branchId === branchId || (!o.branchId && branches.find(b => b.id === branchId)?.isMainBranch));
  };

  const getTablesForScope = (branchId?: string) => {
    if (!branchId) return tables;
    return tables.filter((t) => !t.branchId || t.branchId === branchId);
  };

  const getMaterialsForScope = (branchId?: string) => {
    if (!branchId) return rawMaterials;
    return rawMaterials.filter((m) => !m.branchId || m.branchId === branchId);
  };

  const scopeBranchId = viewMode === 'PER_OUTLET' ? (selectedOutletId || currentBranch.id) : undefined;
  const scopeOrders = getOrdersForScope(scopeBranchId);
  const scopeTables = getTablesForScope(scopeBranchId);
  const scopeMaterials = getMaterialsForScope(scopeBranchId);

  const totalOmset = scopeOrders.filter((o) => o.paymentStatus === 'PAID').reduce((sum, o) => sum + o.total, 0);
  const totalOrdersCount = scopeOrders.length;
  const occupiedTablesCount = scopeTables.filter((t) => t.status === 'OCCUPIED').length;
  const totalTablesCount = scopeTables.length;
  const lowStockItemsCount = scopeMaterials.filter((m) => m.stockQuantity <= m.minStockThreshold).length;

  const activeScopeBranch = viewMode === 'PER_OUTLET'
    ? branches.find(b => b.id === (selectedOutletId || currentBranch.id)) || currentBranch
    : null;

  const summaryCards = [
    {
      title: 'Omset Terkonfirmasi',
      value: `Rp ${totalOmset.toLocaleString('id-ID')}`,
      note: viewMode === 'COMBINED' ? 'Akumulasi seluruh outlet' : `Outlet: ${activeScopeBranch?.name || ''}`,
      icon: DollarSign,
      tone: 'accent',
    },
    {
      title: 'Total Transaksi',
      value: `${totalOrdersCount} order`,
      note: 'Semua transaksi tersimpan hari ini',
      icon: Receipt,
      tone: 'neutral',
    },
    {
      title: 'Okupansi Meja',
      value: `${occupiedTablesCount} / ${totalTablesCount || 0}`,
      note: totalTablesCount > 0 ? `${Math.round((occupiedTablesCount / totalTablesCount) * 100)}% meja aktif` : 'Belum ada data meja',
      icon: Grid2X2,
      tone: 'neutral',
    },
    {
      title: 'Stok Kritis',
      value: `${lowStockItemsCount} item`,
      note: lowStockItemsCount > 0 ? 'Butuh restock atau koreksi stok minimum' : 'Belum ada bahan di ambang minimum',
      icon: AlertTriangle,
      tone: lowStockItemsCount > 0 ? 'warning' : 'neutral',
    },
  ] as const;

  const actionCards = [
    { title: 'Konfigurasi Operasional', description: 'Pajak, katalog, staff, hak akses, dan pengaturan outlet', icon: Settings, onClick: () => onNavigateTab('settings') },
    { title: 'Rancang Bangun Workflow', description: 'Audit workflow, denah, blueprint implementasi, dan checklist', icon: Compass, onClick: () => onNavigateTab('blueprint') },
    { title: 'Laporan Dan Ringkasan', description: 'Ekspor omzet, histori transaksi, dan status readiness outlet', icon: BookOpen, onClick: () => onNavigateTab('analytics') },
    { title: 'Tambah Outlet Baru', description: 'Daftarkan cabang baru dengan identitas dan kontak operasional', icon: Building2, onClick: () => setIsAddModalOpen(true) },
  ] as const;

  const handleCreateBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) {
      if (onShowToast) onShowToast('Validasi', 'Mohon isi nama outlet / cabang!');
      return;
    }

    const created: Branch = {
      id: 'br-' + Date.now().toString().slice(-4),
      name: newBranchName.trim(),
      address: newBranchAddress.trim() || 'Jl. Raya Utama No. 12',
      phone: newBranchPhone.trim() || '08123456789',
      isMainBranch: isMainBranchCheck
    };

    onAddBranch(created);
    setIsAddModalOpen(false);

    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setIsMainBranchCheck(false);
  };

  return (
    <div className="ui-surface flex-1 overflow-y-auto px-3 py-4 text-[var(--text-primary)] md:px-6 md:py-5 font-sans select-none">
      {/* Hero Section */}
      <section className="mb-5 md:mb-6 rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--primary-hover)]">
                <Store className="h-3.5 w-3.5" />
                Portal Multi-Cabang Owner
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--panel-border)] bg-[var(--surface-secondary)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--primary-hover)]" />
                {branches.length} Outlet
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-primary)] xl:text-[28px]">
              Ringkasan Kesiapan & Operasional
            </h1>
            <p className="mt-1.5 max-w-2xl text-[11px] md:text-xs font-bold leading-relaxed text-slate-500">
              Pantau omzet, kesiapan outlet, dan navigasi kontrol owner dalam satu layar.
            </p>
          </div>

          <div className="grid gap-2 grid-cols-3 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateTab('blueprint')}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] px-3 md:px-4 py-2.5 md:py-3 text-[11px] md:text-[11px] font-bold text-white transition shadow-sm cursor-pointer active:scale-95"
            >
              <Compass className="h-3 w-3 md:h-3.5 md:w-3.5 text-[var(--primary-text)]" />
              <span className="hidden sm:inline">Studio</span> Workflow
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--panel-border)] bg-[var(--surface-secondary)] hover:bg-white px-3 md:px-4 py-2.5 md:py-3 text-[11px] md:text-[11px] font-bold text-slate-800 transition cursor-pointer active:scale-95"
            >
              <Settings className="h-3 w-3 md:h-3.5 md:w-3.5 text-[var(--primary-hover)]" />
              Pengaturan
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] hover:from-[var(--primary-solid)] hover:to-[var(--primary-light)] px-3 md:px-4 py-2.5 md:py-3 text-[11px] md:text-[11px] font-bold text-white shadow-md shadow-orange-500/20 transition cursor-pointer active:scale-95"
            >
              <Plus className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span className="hidden sm:inline">Tambah</span> Outlet
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="bg-slate-100 border border-slate-200/80 p-1 rounded-full flex items-center gap-0.5 shadow-sm">
            <button
              onClick={() => setViewMode('COMBINED')}
              className={`px-3 md:px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'COMBINED'
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3 h-3 md:w-3.5 md:h-3.5" /> Gabungan
            </button>
            <button
              onClick={() => { setViewMode('PER_OUTLET'); if (!selectedOutletId) setSelectedOutletId(currentBranch.id); }}
              className={`px-3 md:px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'PER_OUTLET'
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" /> Per Outlet
            </button>
          </div>

          {viewMode === 'PER_OUTLET' && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedOutletId(b.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] md:text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    selectedOutletId === b.id
                      ? 'bg-[var(--primary-soft)] border-[var(--primary-border)] text-[var(--primary-hover)]'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {b.name.replace('Bakso Ujo - ', '')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="mt-4 md:mt-5 grid gap-2.5 md:gap-3 grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            const toneClass =
              card.tone === 'accent'
                ? 'border-[var(--brand-200)] bg-[var(--brand-50)]'
                : card.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-slate-200 bg-slate-50';
            const iconClass =
              card.tone === 'accent'
                ? 'bg-[var(--primary-solid)] text-white shadow-sm'
                : card.tone === 'warning'
                  ? 'bg-amber-500 text-white'
                  : 'bg-[var(--primary)] text-white';

            return (
              <div key={card.title} className={`rounded-xl md:rounded-2xl border p-3 md:p-4 shadow-sm ${toneClass}`}>
                <div className="mb-2 md:mb-3 flex items-center justify-between">
                  <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-400">{card.title}</span>
                  <div className={`flex h-7 w-7 md:h-9 md:w-9 items-center justify-center rounded-lg md:rounded-xl ${iconClass}`}>
                    <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                </div>
                <p className="text-base md:text-xl font-bold tracking-tight text-slate-900">{card.value}</p>
                <p className="mt-0.5 md:mt-1 text-[10px] md:text-[11px] font-bold leading-relaxed text-slate-500">{card.note}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Per-Outlet Comparison Table (PER_OUTLET mode) */}
      {viewMode === 'PER_OUTLET' && (
        <section className="mb-5 md:mb-6 rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <h2 className="text-sm md:text-base font-bold text-[var(--text-primary)] mb-3">Perbandingan Outlet</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-[11px] font-bold text-slate-400 uppercase">Outlet</th>
                  <th className="text-right py-2 px-2 text-[11px] font-bold text-slate-400 uppercase">Omset</th>
                  <th className="text-right py-2 px-2 text-[11px] font-bold text-slate-400 uppercase">Order</th>
                  <th className="text-right py-2 px-2 text-[11px] font-bold text-slate-400 uppercase">Meja</th>
                  <th className="text-right py-2 px-2 text-[11px] font-bold text-slate-400 uppercase">Stok Kritis</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => {
                  const bOrders = getOrdersForScope(branch.id);
                  const bOmset = bOrders.filter((o) => o.paymentStatus === 'PAID').reduce((sum, o) => sum + o.total, 0);
                  const bTables = getTablesForScope(branch.id);
                  const bOccupied = bTables.filter((t) => t.status === 'OCCUPIED').length;
                  const bLowStock = getMaterialsForScope(branch.id).filter((m) => m.stockQuantity <= m.minStockThreshold).length;
                  const isActive = selectedOutletId === branch.id;

                  return (
                    <tr
                      key={branch.id}
                      onClick={() => setSelectedOutletId(branch.id)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors ${
                        isActive ? 'bg-[var(--brand-50)]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />}
                          <span className="font-bold text-[11px] text-[var(--text-primary)]">{branch.name.replace('Bakso Ujo - ', '')}</span>
                          {branch.isMainBranch && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">PUSAT</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-[11px] text-slate-700">
                        Rp {bOmset.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-[11px] text-slate-700">
                        {bOrders.length}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-[11px] text-slate-700">
                        {bOccupied}/{bTables.length}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={`font-bold text-[11px] ${bLowStock > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {bLowStock}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Action Cards + Filter Section */}
      <section className="mb-5 md:mb-6 grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <div className="mb-3 md:mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kontrol Utama</p>
              <h2 className="mt-1 text-base md:text-lg font-bold text-slate-900">Navigasi Owner</h2>
            </div>
            <span className="rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary-text)]">
              Super-App
            </span>
          </div>

          <div className="space-y-2 md:space-y-2.5">
            {actionCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.title}
                  type="button"
                  onClick={card.onClick}
                  className="group flex w-full items-start gap-2.5 md:gap-3 rounded-xl md:rounded-2xl border border-slate-200 bg-slate-50 p-3 md:p-4 text-left transition hover:border-[var(--primary)] hover:bg-white shadow-sm cursor-pointer"
                >
                  <div className="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg md:rounded-xl bg-[var(--primary)] text-white shadow-sm">
                    <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] md:text-xs font-bold text-slate-900">{card.title}</p>
                    <p className="mt-0.5 text-[10px] md:text-[11px] font-bold leading-relaxed text-slate-500">{card.description}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-slate-900" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-4 md:p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Filter & Status Cabang</p>
              <h2 className="mt-1 text-base md:text-lg font-bold text-[var(--text-primary)]">Status Kesiapan Outlet</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--surface-secondary)] px-3 py-1.5 text-[11px] md:text-[11px] font-bold text-slate-800">
              <Store className="h-3 w-3 md:h-3.5 md:w-3.5 text-[var(--primary-hover)]" />
              Aktif: {currentBranch.name.replace('Bakso Ujo - ', '')}
            </div>
          </div>

          <div className="relative mt-3 md:mt-4">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari outlet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl md:rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] py-2.5 md:py-3 pl-9 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:bg-white"
            />
          </div>

          <div className="mt-3 md:mt-4 grid gap-3 grid-cols-2">
            <div className="rounded-xl md:rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-3 md:p-4 shadow-sm">
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Outlet</p>
              <p className="mt-1.5 md:mt-2 text-xl md:text-2xl font-bold text-[var(--text-primary)]">{branches.length}</p>
              <p className="mt-0.5 text-[10px] md:text-[11px] font-bold text-slate-500">Cabang terdaftar.</p>
            </div>
            <div className="rounded-xl md:rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-3 md:p-4 shadow-sm">
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-400">Hasil Filter</p>
              <p className="mt-1.5 md:mt-2 text-xl md:text-2xl font-bold text-[var(--text-primary)]">{filteredBranches.length}</p>
              <p className="mt-0.5 text-[10px] md:text-[11px] font-bold text-slate-500">Outlet sesuai pencarian.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Branch Cards Grid */}
      <section className="grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredBranches.map((branch) => {
          const isSelected = branch.id === currentBranch.id;
          const branchOrders = orders.filter((o) => o.branchId === branch.id || (!o.branchId && branch.isMainBranch));
          const branchOmset = branchOrders.filter((o) => o.paymentStatus === 'PAID').reduce((sum, o) => sum + o.total, 0);
          const branchOccupied = tables.filter((table) => (!table.branchId || table.branchId === branch.id) && table.status === 'OCCUPIED').length;
          const branchTotalTables = tables.filter((table) => !table.branchId || table.branchId === branch.id).length;
          const branchSelfOrderTables = tables.filter((table) => (!table.branchId || table.branchId === branch.id) && table.isSelfOrderEnabled).length;

          return (
            <div
              key={branch.id}
              className={`flex flex-col justify-between rounded-xl md:rounded-2xl border p-4 md:p-5 transition shadow-sm ${
                isSelected
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] ring-2 ring-[var(--primary)]/10'
                  : 'border-[var(--panel-border)] bg-white hover:border-[var(--primary)]'
              }`}
            >
              <div>
                <div className="mb-3 md:mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1.5 md:mb-2 flex flex-wrap items-center gap-1.5">
                      {branch.isMainBranch ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] md:text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          Pusat
                        </span>
                      ) : (
                        <span className="rounded-full border border-[var(--panel-border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] md:text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          Cabang
                        </span>
                      )}
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] md:text-[10px] font-bold uppercase tracking-wider text-[var(--primary-hover)]">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Aktif
                        </span>
                      )}
                    </div>
                    <h3 className="text-base md:text-lg font-bold leading-tight text-[var(--text-primary)]">{branch.name}</h3>
                    <p className="mt-0.5 text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {branch.code || 'OUTLET'}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl md:rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-light)] text-white shadow-sm">
                    <Store className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                </div>

                <div className="mb-3 md:mb-4 space-y-1.5 text-[11px] md:text-xs font-bold text-slate-600">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3 w-3 md:h-3.5 md:w-3.5 shrink-0 text-[var(--primary-hover)]" />
                    <span className="line-clamp-2">{branch.address}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0 text-[var(--primary-hover)]" />
                    <span>{branch.phone}</span>
                  </p>
                </div>

                {/* Readiness Checklist */}
                <div className="mb-3 md:mb-4 rounded-xl md:rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-2.5 md:p-3 text-[10px] md:text-[11px] font-bold space-y-1">
                  <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px] md:text-[10px] border-b border-slate-200 pb-1">
                    Checklist Readiness:
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="flex items-center gap-1 text-emerald-700 font-bold">
                      ✓ {branchTotalTables} Meja ({branchSelfOrderTables} QR)
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700 font-bold">
                      ✓ GPS: {branch.gpsLatitude ? 'Valid' : 'Standard'}
                    </span>
                    <span className="flex items-center gap-1 text-slate-700 font-bold">
                      • Printer: Ready
                    </span>
                    <span className="flex items-center gap-1 text-slate-700 font-bold">
                      • Pay: Cash/QRIS
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 md:gap-3 rounded-xl md:rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-3 md:p-4">
                  <div className="space-y-0.5">
                    <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-400">Omset</p>
                    <p className="text-sm md:text-base font-bold text-[var(--text-primary)]">Rp {branchOmset.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-400">Order</p>
                    <p className="text-sm md:text-base font-bold text-[var(--text-primary)]">{branchOrders.length}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-400">Meja Terisi</p>
                    <p className="text-[11px] md:text-xs font-bold text-slate-700">{branchOccupied} / {branchTotalTables || 0}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-400">Monitor</p>
                    <p className="text-[11px] md:text-xs font-bold text-slate-700">{isSelected ? 'Dipantau' : 'Tersedia'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 md:mt-4 space-y-2 border-t border-slate-100 pt-3 md:pt-4">
                <button
                  type="button"
                  onClick={() => {
                    onSelectBranch(branch);
                    onNavigateTab('pos');
                  }}
                  className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 md:py-3 text-[11px] md:text-[11px] font-bold transition cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white shadow-md shadow-orange-500/20 hover:from-[var(--primary-solid)] hover:to-[var(--primary-light)]'
                      : 'border border-[var(--panel-border)] bg-[var(--surface-secondary)] text-slate-800 hover:bg-white'
                  }`}
                >
                  <span>{isSelected ? 'Buka Terminal POS' : 'Pilih & Buka POS'}</span>
                  <ArrowRight className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </button>

                <a
                  href={`?selforder=true&branch=${encodeURIComponent(branch.id)}&table=${encodeURIComponent(tables.find((table) => (!table.branchId || table.branchId === branch.id) && table.isSelfOrderEnabled)?.number || '1')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 md:py-2.5 text-[10px] md:text-[11px] font-bold text-[var(--primary-hover)] transition hover:bg-[#FFE9DE] cursor-pointer"
                >
                  <ExternalLink className="h-2.5 w-2.5 md:h-3 md:w-3" />
                  <span>Pratinjau Self-Order</span>
                </a>
              </div>
            </div>
          );
        })}
      </section>

      {filteredBranches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#D8D2CC] bg-white p-8 md:p-12 text-center">
          <div className="mx-auto flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl md:rounded-2xl bg-[#FFF4EE] text-[var(--primary-hover)]">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="mt-3 md:mt-4 text-base md:text-lg font-bold text-[var(--text-primary)]">Outlet tidak ditemukan</h3>
          <p className="mt-1.5 md:mt-2 text-xs md:text-sm font-medium text-[#7A746F]">
            Ubah kata kunci pencarian atau tambahkan outlet baru.
          </p>
        </div>
      )}

      {/* Add Outlet Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-600/30 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4 animate-fadeIn">
          <div className="bg-white border border-[var(--panel-border)] w-full max-w-lg rounded-2xl p-4 md:p-5 relative overflow-hidden" style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.12)' }}>
            <div className="flex items-center justify-between border-b border-[#F0E8E0] pb-3 md:pb-4 mb-3 md:mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-[#FFF4EE] border border-[#F1C7B5] flex items-center justify-center text-[var(--primary-hover)]">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-bold text-[var(--text-primary)]">Tambah Outlet Baru</h3>
                  <p className="text-[10px] md:text-[11px] text-[var(--text-tertiary)] font-medium">Daftarkan cabang baru ke sistem</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[var(--surface-card)] hover:bg-[#F0E8E0] text-[var(--text-tertiary)] flex items-center justify-center transition-colors cursor-pointer border border-[var(--panel-border)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranchSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] md:text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Nama Outlet / Cabang *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bakso Ujo - Cabang Depok"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-xl px-3.5 py-2.5 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] md:text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Jl. Margonda Raya No. 120, Depok"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-xl px-3.5 py-2.5 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all font-medium resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] md:text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Nomor Telepon / WhatsApp</label>
                <input
                  type="text"
                  placeholder="Contoh: 081298765432"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-xl px-3.5 py-2.5 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-main-branch"
                  checked={isMainBranchCheck}
                  onChange={(e) => setIsMainBranchCheck(e.target.checked)}
                  className="w-4 h-4 rounded bg-[var(--surface-card)] border-[var(--panel-border)] text-[var(--primary-hover)] focus:ring-0 cursor-pointer accent-[var(--primary-solid)]"
                />
                <label htmlFor="chk-main-branch" className="text-xs text-[var(--text-secondary)] font-medium cursor-pointer">
                  Jadikan Cabang Utama / Pusat
                </label>
              </div>

              <div className="pt-2 md:pt-3 flex items-center justify-end gap-2.5 border-t border-[#F0E8E0]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--surface-card)] hover:bg-[#F0E8E0] text-[var(--text-secondary)] text-xs font-semibold transition-all cursor-pointer border border-[var(--panel-border)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] hover:from-[var(--primary-solid)] hover:to-[var(--primary-light)] text-white text-xs font-semibold transition-all cursor-pointer"
                  style={{ boxShadow: '0 2px 8px rgba(234,88,12,0.25)' }}
                >
                  Simpan Outlet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
