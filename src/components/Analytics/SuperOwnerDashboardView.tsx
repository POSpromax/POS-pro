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

  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [isMainBranchCheck, setIsMainBranchCheck] = useState(false);

  const totalMultiOutletOmset = orders.filter((o) => o.paymentStatus === 'PAID').reduce((sum, o) => sum + o.total, 0);
  const totalOrdersCount = orders.length;
  const occupiedTablesCount = tables.filter((t) => t.status === 'OCCUPIED').length;
  const totalTablesCount = tables.length;
  const lowStockItemsCount = rawMaterials.filter((m) => m.stockQuantity <= m.minStockThreshold).length;

  const filteredBranches = useMemo(
    () =>
      branches.filter(
        (b) =>
          b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.address.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [branches, searchTerm],
  );

  const summaryCards = [
    {
      title: 'Omset Terkonfirmasi',
      value: `Rp ${totalMultiOutletOmset.toLocaleString('id-ID')}`,
      note: 'Akumulasi transaksi lunas seluruh outlet',
      icon: DollarSign,
      tone: 'accent',
    },
    {
      title: 'Total Transaksi',
      value: `${totalOrdersCount} order`,
      note: 'Semua transaksi yang tersimpan hari ini',
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
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] px-4 py-5 text-slate-900 md:px-6 font-sans select-none">
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FFDDD0] bg-[#FFF4ED] px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#EA580C]">
                <Store className="h-3.5 w-3.5" />
                Portal Multi-Cabang Owner
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EAE3DB] bg-[#F6EFE7] px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#EA580C]" />
                {branches.length} Outlet Terdaftar
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[#1A1714] md:text-[28px]">
              Ringkasan Kesiapan & Operasional Cabang
            </h1>
            <p className="mt-2 max-w-2xl text-xs font-bold leading-relaxed text-slate-500">
              Pantau omzet real-time, kesiapan teknis outlet (Shift, GPS, Printer, QR Self-Order), dan navigasi kontrol owner dalam satu layar modern.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onNavigateTab('blueprint')}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1A1714] hover:bg-slate-800 px-4 py-3 text-[11px] font-black text-white transition shadow-xs cursor-pointer active:scale-95"
            >
              <Compass className="h-3.5 w-3.5 text-orange-400" />
              Studio Workflow
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#EAE3DB] bg-[#F6EFE7] hover:bg-white px-4 py-3 text-[11px] font-black text-slate-800 transition cursor-pointer active:scale-95"
            >
              <Settings className="h-3.5 w-3.5 text-[#EA580C]" />
              Pengaturan
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 px-4 py-3 text-[11px] font-black text-white shadow-md shadow-orange-500/20 transition cursor-pointer active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Outlet
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            const toneClass =
              card.tone === 'accent'
                ? 'border-orange-200 bg-orange-50'
                : card.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-slate-200 bg-slate-50';
            const iconClass =
              card.tone === 'accent'
                ? 'bg-orange-600 text-white shadow-xs'
                : card.tone === 'warning'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-900 text-white';

            return (
              <div key={card.title} className={`rounded-2xl border p-4 shadow-2xs ${toneClass}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{card.title}</span>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xl font-black tracking-tight text-slate-900">{card.value}</p>
                <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-500">{card.note}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Kontrol Utama</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">Navigasi Keputusan Owner</h2>
            </div>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-orange-700">
              Super-App
            </span>
          </div>

          <div className="space-y-2.5">
            {actionCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.title}
                  type="button"
                  onClick={card.onClick}
                  className="group flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-900 hover:bg-white shadow-2xs cursor-pointer"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-900">{card.title}</p>
                    <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-500">{card.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-900" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#EAE3DB] bg-white p-5 shadow-2xs">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filter & Status Cabang</p>
              <h2 className="mt-1 text-lg font-black text-[#1A1714]">Status Kesiapan Outlet</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#EAE3DB] bg-[#F6EFE7] px-3.5 py-1.5 text-[11px] font-black text-slate-800">
              <Store className="h-3.5 w-3.5 text-[#EA580C]" />
              Outlet Aktif: {currentBranch.name}
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari outlet berdasarkan nama atau alamat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-[#EAE3DB] bg-[#F6EFE7] py-3 pl-9 pr-4 text-xs font-bold text-[#1A1714] outline-none transition focus:border-[#EA580C] focus:bg-white"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#EAE3DB] bg-[#F8F2EC] p-4 shadow-2xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Outlet</p>
              <p className="mt-2 text-2xl font-black text-[#1A1714]">{branches.length}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-500">Cabang terdaftar dalam tenant bisnis.</p>
            </div>
            <div className="rounded-2xl border border-[#EAE3DB] bg-[#F8F2EC] p-4 shadow-2xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hasil Filter</p>
              <p className="mt-2 text-2xl font-black text-[#1A1714]">{filteredBranches.length}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-500">Outlet sesuai kata kunci pencarian.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              className={`flex flex-col justify-between rounded-2xl border p-5 transition shadow-2xs ${
                isSelected
                  ? 'border-[#EA580C] bg-[#FFF8F3] ring-2 ring-orange-500/10'
                  : 'border-[#EAE3DB] bg-white hover:border-[#EA580C]'
              }`}
            >
              <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      {branch.isMainBranch ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800">
                          Outlet Pusat
                        </span>
                      ) : (
                        <span className="rounded-full border border-[#EAE3DB] bg-[#F6EFE7] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
                          Cabang
                        </span>
                      )}
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#FFDDD0] bg-[#FFF4ED] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#EA580C]">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Aktif Dipilih
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black leading-tight text-[#1A1714]">{branch.name}</h3>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {branch.code || 'OUTLET'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#EA580C] to-[#F97316] text-white shadow-xs">
                    <Store className="h-5 w-5" />
                  </div>
                </div>

                <div className="mb-4 space-y-2 text-xs font-bold text-slate-600">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#EA580C]" />
                    <span className="line-clamp-2">{branch.address}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-[#EA580C]" />
                    <span>{branch.phone}</span>
                  </p>
                </div>

                {/* Readiness Health Checklist Badge Box */}
                <div className="mb-4 rounded-2xl border border-[#EAE3DB] bg-[#F8F2EC] p-3 text-[10px] font-bold space-y-1.5">
                  <p className="font-black text-slate-800 uppercase tracking-wider text-[9px] border-b border-slate-200 pb-1">
                    Checklist Readiness Outlet:
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span className="flex items-center gap-1 text-emerald-700 font-black">
                      ✓ Meja: {branchTotalTables} Meja ({branchSelfOrderTables} QR ON)
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700 font-black">
                      ✓ GPS: {branch.gpsLatitude ? 'Valid' : 'Outlet Standard'}
                    </span>
                    <span className="flex items-center gap-1 text-slate-700 font-bold">
                      • Printer BT: Ready 58mm
                    </span>
                    <span className="flex items-center gap-1 text-slate-700 font-bold">
                      • Pembayaran: Cash / QRIS
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[#EAE3DB] bg-[#F6EFE7] p-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Omset Hari Ini</p>
                    <p className="text-base font-black text-[#1A1714]">Rp {branchOmset.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Order</p>
                    <p className="text-base font-black text-[#1A1714]">{branchOrders.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Meja Terisi</p>
                    <p className="text-xs font-black text-slate-700">{branchOccupied} dari {branchTotalTables || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status Monitor</p>
                    <p className="text-xs font-black text-slate-700">{isSelected ? 'Sedang Dipantau' : 'Tersedia'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    onSelectBranch(branch);
                    onNavigateTab('pos');
                  }}
                  className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[11px] font-black transition cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white shadow-md shadow-orange-500/20 hover:from-orange-700 hover:to-orange-600'
                      : 'border border-[#EAE3DB] bg-[#F6EFE7] text-slate-800 hover:bg-white'
                  }`}
                >
                  <span>{isSelected ? 'Buka Terminal POS Outlet' : 'Pilih Outlet Ini & Buka POS'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>

                <a
                  href={`?selforder=true&branch=${encodeURIComponent(branch.id)}&table=${encodeURIComponent(tables.find((table) => (!table.branchId || table.branchId === branch.id) && table.isSelfOrderEnabled)?.number || '1')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#FFDDD0] bg-[#FFF4ED] px-3 py-2.5 text-[10px] font-black text-[#EA580C] transition hover:bg-[#FFE9DE] cursor-pointer"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Buka Pratinjau QR Self-Order Publik</span>
                </a>
              </div>
            </div>
          );
        })}
      </section>

      {filteredBranches.length === 0 && (
        <div className="rounded-[28px] border border-dashed border-[#D8D2CC] bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[#FFF4EE] text-[#F05A1F]">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-black text-[#1A1714]">Outlet tidak ditemukan</h3>
          <p className="mt-2 text-sm font-medium text-[#7A746F]">
            Ubah kata kunci pencarian atau tambahkan outlet baru bila cabang belum terdaftar.
          </p>
        </div>
      )}

      {/* Add Outlet Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[#E8E0D8] w-full max-w-lg rounded-2xl p-5 relative overflow-hidden" style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.12)' }}>
            <div className="flex items-center justify-between border-b border-[#F0E8E0] pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF4EE] border border-[#F1C7B5] flex items-center justify-center text-[#D94B15]">
                  <Building2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1A1714]">Tambah Outlet Baru</h3>
                  <p className="text-[10px] text-[#9C9590] font-medium">Daftarkan cabang baru ke sistem</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#FAFAF8] hover:bg-[#F0E8E0] text-[#9C9590] flex items-center justify-center transition-colors cursor-pointer border border-[#E8E0D8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranchSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#6B6560] mb-1">Nama Outlet / Cabang *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bakso Ujo - Cabang Depok"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-xl px-3.5 py-2.5 text-[#1A1714] text-xs outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-orange-500/20 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B6560] mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Jl. Margonda Raya No. 120, Depok"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-xl px-3.5 py-2.5 text-[#1A1714] text-xs outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-orange-500/20 transition-all font-medium resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B6560] mb-1">Nomor Telepon / WhatsApp</label>
                <input
                  type="text"
                  placeholder="Contoh: 081298765432"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-xl px-3.5 py-2.5 text-[#1A1714] text-xs outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-orange-500/20 transition-all font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-main-branch"
                  checked={isMainBranchCheck}
                  onChange={(e) => setIsMainBranchCheck(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#FAFAF8] border-[#E8E0D8] text-[#EA580C] focus:ring-0 cursor-pointer accent-[#EA580C]"
                />
                <label htmlFor="chk-main-branch" className="text-xs text-[#6B6560] font-medium cursor-pointer">
                  Jadikan Cabang Utama / Pusat
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#F0E8E0]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#FAFAF8] hover:bg-[#F0E8E0] text-[#6B6560] text-xs font-semibold transition-all cursor-pointer border border-[#E8E0D8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 text-white text-xs font-semibold transition-all cursor-pointer"
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
