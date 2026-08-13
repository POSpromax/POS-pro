import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Compass,
  DollarSign,
  ExternalLink,
  Grid2X2,
  Layers,
  MapPin,
  Phone,
  Plus,
  Receipt,
  Search,
  Settings,
  Store,
  TrendingUp,
  X,
} from 'lucide-react';
import { Branch, Order, RestaurantTable, RawMaterial } from '../../types/pos';
import { buildBranchSelfOrderUrl } from '../../utils/selfOrderUrl';

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
  onShowToast,
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
          b.address.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [branches, searchTerm],
  );

  const getOrdersForScope = (branchId?: string) => {
    if (!branchId) return orders;
    return orders.filter((order) => order.branchId === branchId);
  };

  const getTablesForScope = (branchId?: string) => {
    if (!branchId) return tables;
    return tables.filter((table) => table.branchId === branchId);
  };

  const getMaterialsForScope = (branchId?: string) => {
    if (!branchId) return rawMaterials;
    return rawMaterials.filter((material) => material.branchId === branchId);
  };

  const scopeBranchId =
    viewMode === 'PER_OUTLET' ? selectedOutletId || currentBranch.id : undefined;
  const scopeOrders = getOrdersForScope(scopeBranchId);
  const scopeTables = getTablesForScope(scopeBranchId);
  const scopeMaterials = getMaterialsForScope(scopeBranchId);

  const totalOmset = scopeOrders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + o.total, 0);
  const totalOrdersCount = scopeOrders.length;
  const occupiedTablesCount = scopeTables.filter((t) => t.status === 'OCCUPIED').length;
  const totalTablesCount = scopeTables.length;
  const lowStockItemsCount = scopeMaterials.filter((m) => m.stockQuantity <= m.minStockThreshold).length;

  const activeScopeBranch =
    viewMode === 'PER_OUTLET'
      ? branches.find((b) => b.id === (selectedOutletId || currentBranch.id)) || currentBranch
      : null;

  const handleCreateBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) {
      onShowToast?.('Validasi', 'Mohon isi nama outlet / cabang!');
      return;
    }
    const created: Branch = {
      id: 'br-' + Date.now().toString().slice(-4),
      name: newBranchName.trim(),
      address: newBranchAddress.trim() || 'Jl. Raya Utama No. 12',
      phone: newBranchPhone.trim() || '08123456789',
      isMainBranch: isMainBranchCheck,
    };
    onAddBranch(created);
    setIsAddModalOpen(false);
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setIsMainBranchCheck(false);
  };

  return (
    <div className="ui-surface flex-1 overflow-y-auto font-sans select-none" style={{ padding: '20px 20px 32px' }}>

      {/* ── PAGE HEADER ─────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-stat-label mb-1">Dashboard Overview</p>
          <h1 className="ui-page-header">Ringkasan Operasional</h1>
          <p className="mt-1 text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Pantau omzet, kesiapan outlet, dan navigasi kontrol owner dalam satu layar.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('analytics')}
            className="ui-button ui-button-secondary gap-1.5 text-[12px]"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Laporan
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="ui-button ui-button-primary gap-1.5 text-[12px]"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Outlet
          </button>
        </div>
      </div>

      {/* ── TOP KPI ROW ─────────────────────────────────────── */}
      {/* Hero card (orange gradient) + 3 white stat cards, Salesify-style  */}
      <div className="mb-5 grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {/* Hero: Total Omset */}
        <div className="ui-card-feature sm:col-span-2 xl:col-span-1 flex flex-col justify-between gap-3" style={{ padding: '20px 22px', minHeight: '130px' }}>
          <div className="flex items-center justify-between">
            <p className="ui-stat-label">Total Omset</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </div>
          <div>
            <p className="ui-stat-value" style={{ fontSize: '26px' }}>
              Rp {totalOmset.toLocaleString('id-ID')}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">
                <TrendingUp className="h-3 w-3" />
                {viewMode === 'COMBINED' ? 'Semua Outlet' : activeScopeBranch?.name?.replace('Bakso Ujo - ', '') ?? ''}
              </span>
            </div>
          </div>
        </div>

        {/* Stat: Total Transaksi */}
        <div className="ui-card flex flex-col justify-between gap-3" style={{ padding: '18px 20px', minHeight: '130px' }}>
          <div className="flex items-center justify-between">
            <p className="ui-stat-label">Total Transaksi</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'var(--primary-soft)', color: 'var(--primary-text)' }}>
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="ui-stat-value">{totalOrdersCount}</p>
            <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Order tersimpan hari ini
            </p>
          </div>
        </div>

        {/* Stat: Meja Terisi */}
        <div className="ui-card flex flex-col justify-between gap-3" style={{ padding: '18px 20px', minHeight: '130px' }}>
          <div className="flex items-center justify-between">
            <p className="ui-stat-label">Meja Terisi</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'var(--primary-soft)', color: 'var(--primary-text)' }}>
              <Grid2X2 className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="ui-stat-value">{occupiedTablesCount}<span className="text-[18px] font-semibold" style={{ color: 'var(--text-secondary)' }}>/{totalTablesCount}</span></p>
            <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {totalTablesCount > 0 ? `${Math.round((occupiedTablesCount / totalTablesCount) * 100)}% meja aktif` : 'Belum ada data meja'}
            </p>
          </div>
        </div>

        {/* Stat: Stok Kritis */}
        <div className="ui-card flex flex-col justify-between gap-3" style={{ padding: '18px 20px', minHeight: '130px', borderColor: lowStockItemsCount > 0 ? '#fde68a' : undefined, background: lowStockItemsCount > 0 ? 'var(--warning-soft)' : undefined }}>
          <div className="flex items-center justify-between">
            <p className="ui-stat-label">Stok Kritis</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: lowStockItemsCount > 0 ? '#fef3c7' : 'var(--success-soft)', color: lowStockItemsCount > 0 ? '#b45309' : 'var(--accent-green)' }}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="ui-stat-value" style={{ color: lowStockItemsCount > 0 ? '#b45309' : undefined }}>{lowStockItemsCount}</p>
            <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {lowStockItemsCount > 0 ? 'Butuh restock segera' : 'Semua stok aman'}
            </p>
          </div>
        </div>
      </div>

      {/* ── VIEW MODE TOGGLE + OUTLET FILTER ────────────────── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented tabs — orange variant for dashboard */}
        <div className="ui-tabs ui-tabs-orange">
          <button
            onClick={() => setViewMode('COMBINED')}
            className={`ui-tab flex items-center gap-1.5${viewMode === 'COMBINED' ? ' ui-tab-active' : ''}`}
          >
            <Layers className="h-3 w-3" />
            Gabungan
          </button>
          <button
            onClick={() => { setViewMode('PER_OUTLET'); if (!selectedOutletId) setSelectedOutletId(currentBranch.id); }}
            className={`ui-tab flex items-center gap-1.5${viewMode === 'PER_OUTLET' ? ' ui-tab-active' : ''}`}
          >
            <BarChart3 className="h-3 w-3" />
            Per Outlet
          </button>
        </div>

        {/* Outlet chips — only in PER_OUTLET mode */}
        {viewMode === 'PER_OUTLET' && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedOutletId(b.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                  selectedOutletId === b.id
                    ? 'border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary-text)]'
                    : 'border-[var(--panel-border)] bg-white text-[var(--text-secondary)] hover:border-[var(--panel-border-strong)]'
                }`}
              >
                {b.name.replace('Bakso Ujo - ', '')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── PER-OUTLET COMPARISON TABLE ─────────────────────── */}
      {viewMode === 'PER_OUTLET' && (
        <div className="ui-card mb-5" style={{ padding: '20px 22px' }}>
          <p className="ui-section-title mb-4">Perbandingan Outlet</p>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                  {['Outlet', 'Omset', 'Order', 'Meja', 'Stok Kritis'].map((h, i) => (
                    <th
                      key={h}
                      className="ui-stat-label py-2 px-2"
                      style={{ textAlign: i === 0 ? 'left' : 'right' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => {
                  const bOrders = getOrdersForScope(branch.id);
                  const bOmset = bOrders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + o.total, 0);
                  const bTables = getTablesForScope(branch.id);
                  const bOccupied = bTables.filter((t) => t.status === 'OCCUPIED').length;
                  const bLowStock = getMaterialsForScope(branch.id).filter((m) => m.stockQuantity <= m.minStockThreshold).length;
                  const isActive = selectedOutletId === branch.id;
                  return (
                    <tr
                      key={branch.id}
                      onClick={() => setSelectedOutletId(branch.id)}
                      style={{
                        borderBottom: '1px solid var(--panel-border-light)',
                        cursor: 'pointer',
                        background: isActive ? 'var(--primary-soft)' : undefined,
                      }}
                      className="transition-colors hover:bg-[var(--surface-secondary)]"
                    >
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          {isActive && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />}
                          <span className="font-bold text-[12px]" style={{ color: 'var(--text-primary)' }}>
                            {branch.name.replace('Bakso Ujo - ', '')}
                          </span>
                          {branch.isMainBranch && (
                            <span className="ui-badge ui-badge-warning text-[10px] px-1.5 py-0">PUSAT</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-[12px]" style={{ color: 'var(--text-primary)' }}>
                        Rp {bOmset.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-[12px]" style={{ color: 'var(--text-primary)' }}>{bOrders.length}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-[12px]" style={{ color: 'var(--text-primary)' }}>
                        {bOccupied}/{bTables.length}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={`font-bold text-[12px] ${bLowStock > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {bLowStock}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT GRID: Navigation + Branch Status ───── */}
      <div className="mb-5 grid gap-4 xl:grid-cols-[1fr_1.3fr]">

        {/* LEFT: Owner Navigation */}
        <div className="ui-card" style={{ padding: '20px 22px' }}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="ui-stat-label mb-1">Navigasi Owner</p>
              <h2 className="ui-section-title">Kontrol Utama</h2>
            </div>
            <span className="ui-badge ui-badge-info">Super-App</span>
          </div>
          <div className="space-y-2">
            {[
              { title: 'Konfigurasi Operasional', desc: 'Pajak, katalog, staff, hak akses, dan pengaturan outlet', icon: Settings, tab: 'settings' },
              { title: 'Rancang Bangun Workflow', desc: 'Audit workflow, denah, blueprint implementasi, dan checklist', icon: Compass, tab: 'blueprint' },
              { title: 'Laporan Dan Ringkasan', desc: 'Ekspor omzet, histori transaksi, dan status readiness outlet', icon: BookOpen, tab: 'analytics' },
              { title: 'Tambah Outlet Baru', desc: 'Daftarkan cabang baru dengan identitas dan kontak operasional', icon: Building2, tab: '__add' },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => card.tab === '__add' ? setIsAddModalOpen(true) : onNavigateTab(card.tab)}
                  className="group flex w-full items-start gap-3 rounded-xl border text-left transition cursor-pointer active:scale-[0.99]"
                  style={{ padding: '12px 14px', borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-card)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--panel-border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-secondary)'; }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--primary)', color: '#fff' }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{card.title}</p>
                    <p className="mt-0.5 text-[11px] font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{card.desc}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-30 transition-opacity group-hover:opacity-80" style={{ color: 'var(--text-primary)' }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Branch Status + Search */}
        <div className="ui-card" style={{ padding: '20px 22px' }}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="ui-stat-label mb-1">Filter & Status Cabang</p>
              <h2 className="ui-section-title">Status Kesiapan Outlet</h2>
            </div>
            <span className="ui-badge text-[11px] gap-1.5">
              <Store className="h-3 w-3" style={{ color: 'var(--primary-hover)' }} />
              {currentBranch.name.replace('Bakso Ujo - ', '')}
            </span>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Cari outlet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ui-input pl-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)' }}>
              <p className="ui-stat-label">Total Outlet</p>
              <p className="mt-2 text-[24px] font-extrabold leading-none" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{branches.length}</p>
              <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Cabang terdaftar</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)' }}>
              <p className="ui-stat-label">Hasil Filter</p>
              <p className="mt-2 text-[24px] font-extrabold leading-none" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{filteredBranches.length}</p>
              <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Sesuai pencarian</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── BRANCH CARDS GRID ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredBranches.map((branch) => {
          const isSelected = branch.id === currentBranch.id;
          const branchOrders = orders.filter(
            (o) => o.branchId === branch.id || (!o.branchId && branch.isMainBranch),
          );
          const branchOmset = branchOrders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + o.total, 0);
          const branchOccupied = tables.filter(
            (t) => (!t.branchId || t.branchId === branch.id) && t.status === 'OCCUPIED',
          ).length;
          const branchTotalTables = tables.filter((t) => !t.branchId || t.branchId === branch.id).length;
          const branchSelfOrderTables = tables.filter(
            (t) => (!t.branchId || t.branchId === branch.id) && t.isSelfOrderEnabled,
          ).length;

          return (
            <div
              key={branch.id}
              className="flex flex-col justify-between rounded-2xl border p-4 transition"
              style={{
                borderColor: isSelected ? 'var(--primary)' : 'var(--panel-border)',
                background: isSelected ? 'var(--primary-soft)' : 'var(--surface-card)',
                boxShadow: isSelected ? 'var(--focus-ring)' : 'var(--card-shadow)',
              }}
            >
              {/* Card header */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {branch.isMainBranch ? (
                      <span className="ui-badge ui-badge-warning text-[10px]">Pusat</span>
                    ) : (
                      <span className="ui-badge text-[10px]">Cabang</span>
                    )}
                    {isSelected && (
                      <span className="ui-badge ui-badge-info text-[10px] gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Aktif
                      </span>
                    )}
                  </div>
                  <h3 className="text-[15px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{branch.name}</h3>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    {branch.code || 'OUTLET'}
                  </p>
                </div>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: 'var(--primary-gradient)' }}
                >
                  <Store className="h-5 w-5" />
                </div>
              </div>

              {/* Address & Phone */}
              <div className="mb-3 space-y-1" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--primary-hover)' }} />
                  <span className="line-clamp-2">{branch.address}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--primary-hover)' }} />
                  <span>{branch.phone}</span>
                </p>
              </div>

              {/* Readiness checklist */}
              <div
                className="mb-3 rounded-xl border p-3"
                style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)', fontSize: '11px' }}
              >
                <p className="mb-1.5 font-bold uppercase tracking-wider pb-1 border-b" style={{ color: 'var(--text-primary)', borderColor: 'var(--panel-border)' }}>
                  Checklist Readiness
                </p>
                <div className="grid grid-cols-2 gap-1">
                  <span className="flex items-center gap-1 font-bold text-emerald-700">✓ {branchTotalTables} Meja ({branchSelfOrderTables} QR)</span>
                  <span className="flex items-center gap-1 font-bold text-emerald-700">✓ GPS: {branch.gpsLatitude ? 'Valid' : 'Standard'}</span>
                  <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>• Printer: Ready</span>
                  <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>• Pay: Cash/QRIS</span>
                </div>
              </div>

              {/* Stats grid */}
              <div
                className="mb-3 grid grid-cols-2 gap-2 rounded-xl border p-3"
                style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)' }}
              >
                {[
                  { label: 'Omset', value: `Rp ${branchOmset.toLocaleString('id-ID')}` },
                  { label: 'Order', value: String(branchOrders.length) },
                  { label: 'Meja Terisi', value: `${branchOccupied}/${branchTotalTables}` },
                  { label: 'Monitor', value: isSelected ? 'Dipantau' : 'Tersedia' },
                ].map((s) => (
                  <div key={s.label} className="space-y-0.5">
                    <p className="ui-stat-label">{s.label}</p>
                    <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--panel-border-light)' }}>
                <button
                  type="button"
                  onClick={() => { onSelectBranch(branch); onNavigateTab('pos'); }}
                  className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-bold transition cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'text-white'
                      : 'border text-slate-800'
                  }`}
                  style={isSelected
                    ? { background: 'var(--primary-gradient)', boxShadow: '0 4px 14px rgb(4 120 87 / 22%)' }
                    : { borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)' }
                  }
                >
                  {isSelected ? 'Buka Terminal POS' : 'Pilih & Buka POS'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>

                <a
                  href={buildBranchSelfOrderUrl(window.location.origin, branch.id, undefined, branch.code)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-bold transition cursor-pointer"
                  style={{ borderColor: 'var(--primary-border)', background: 'var(--primary-soft)', color: 'var(--primary-text)' }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Pratinjau Self-Order
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filteredBranches.length === 0 && (
        <div className="ui-empty-state flex-col gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'var(--primary-soft)', color: 'var(--primary-hover)' }}
          >
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>Outlet tidak ditemukan</h3>
            <p className="mt-1 text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Ubah kata kunci pencarian atau tambahkan outlet baru.
            </p>
          </div>
        </div>
      )}

      {/* ── ADD OUTLET MODAL ────────────────────────────────── */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
          style={{ background: 'rgba(26,23,20,0.35)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border bg-white relative overflow-hidden"
            style={{ borderColor: 'var(--panel-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.14)' }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--panel-border-light)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-border)', color: 'var(--primary-hover)' }}
                >
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Tambah Outlet Baru</h3>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Daftarkan cabang baru ke sistem</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="ui-icon-button h-8 w-8"
                aria-label="Tutup modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleCreateBranchSubmit} className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Nama Outlet / Cabang *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bakso Ujo - Cabang Depok"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="ui-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Jl. Margonda Raya No. 120, Depok"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="ui-input resize-none"
                  style={{ paddingTop: '10px', paddingBottom: '10px', height: 'auto' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 081298765432"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  className="ui-input"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-main-branch"
                  checked={isMainBranchCheck}
                  onChange={(e) => setIsMainBranchCheck(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <label htmlFor="chk-main-branch" className="cursor-pointer text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Jadikan Cabang Utama / Pusat
                </label>
              </div>

              <div
                className="flex items-center justify-end gap-2.5 border-t pt-4"
                style={{ borderColor: 'var(--panel-border-light)' }}
              >
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="ui-button ui-button-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="ui-button ui-button-primary">
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
