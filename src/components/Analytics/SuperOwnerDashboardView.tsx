import React, { useState } from 'react';
import {
  Building2,
  Plus,
  TrendingUp,
  Receipt,
  Grid2X2,
  Store,
  MapPin,
  Phone,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Search,
  DollarSign,
  Settings,
  Boxes,
  Users,
  Percent,
  Printer,
  Crown,
  Lock,
  PieChart,
  Compass
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
}

export const SuperOwnerDashboardView: React.FC<SuperOwnerDashboardViewProps> = ({
  branches,
  orders,
  tables,
  rawMaterials,
  currentBranch,
  onSelectBranch,
  onAddBranch,
  onNavigateTab
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [isMainBranchCheck, setIsMainBranchCheck] = useState(false);

  const totalMultiOutletOmset = orders
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + o.total, 0);

  const totalOrdersCount = orders.length;
  const occupiedTablesCount = tables.filter((t) => t.status === 'OCCUPIED').length;
  const totalTablesCount = tables.length;

  const lowStockItemsCount = rawMaterials.filter(
    (m) => m.stockQuantity <= m.minStockThreshold
  ).length;

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) {
      alert('Mohon isi nama outlet / cabang!');
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
    <div className="flex-1 bg-transparent text-[#1A1714] overflow-y-auto p-4 md:p-5 font-sans">
      {/* Header Banner */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-5 mb-5 relative overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 uppercase tracking-wider">
                <Crown className="w-3 h-3 text-violet-500" /> Executive Portal Owner
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2.5 py-1 rounded-lg">
                {branches.length} Outlet Aktif
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-[#1A1714] tracking-tight">
              Dashboard Executive Owner
            </h1>
            <p className="text-[#9C9590] text-xs mt-1 max-w-xl font-medium leading-relaxed">
              Pusat kendali utama: pantau performa omset, margin profit, persediaan stok, serta lakukan konfigurasi sistem usaha.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateTab('blueprint')}
              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-[11px] px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              style={{ boxShadow: '0 2px 8px rgba(99,102,241,0.2)' }}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Studio Rancang Bangun</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#1A1714] hover:bg-[#2A2520] text-white font-semibold text-[11px] px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Outlet</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="bg-white hover:bg-[#F5EFE8] border border-[#E8E0D8] text-[#6B6560] font-semibold text-[11px] px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-violet-500" />
              <span>Pengaturan</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#F0E8E0]">
          <div className="bg-[#FAFAF8] border border-[#E8E0D8] p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-[#9C9590] mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Total Omset</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              </div>
            </div>
            <p className="text-lg md:text-xl font-bold text-emerald-600 tracking-tight">
              Rp {totalMultiOutletOmset.toLocaleString('id-ID')}
            </p>
            <p className="text-[10px] text-[#B8B0A8] font-medium mt-1">Akumulasi seluruh outlet</p>
          </div>

          <div className="bg-[#FAFAF8] border border-[#E8E0D8] p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-[#9C9590] mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Total Transaksi</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
              </div>
            </div>
            <p className="text-lg md:text-xl font-bold text-[#1A1714] tracking-tight">
              {totalOrdersCount} <span className="text-xs font-normal text-[#9C9590]">order</span>
            </p>
            <p className="text-[10px] text-[#B8B0A8] font-medium mt-1">Transaksi hari ini</p>
          </div>

          <div className="bg-[#FAFAF8] border border-[#E8E0D8] p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-[#9C9590] mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Okupansi Meja</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Grid2X2 className="w-3.5 h-3.5 text-amber-600" />
              </div>
            </div>
            <p className="text-lg md:text-xl font-bold text-[#1A1714] tracking-tight">
              {occupiedTablesCount} / {totalTablesCount}{' '}
              <span className="text-xs font-normal text-[#9C9590]">terisi</span>
            </p>
            <p className="text-[10px] text-[#B8B0A8] font-medium mt-1">
              {totalTablesCount > 0 ? Math.round((occupiedTablesCount / totalTablesCount) * 100) : 0}% Tingkat terisi
            </p>
          </div>

          <div className="bg-[#FAFAF8] border border-[#E8E0D8] p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-[#9C9590] mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Stok Kritis</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${lowStockItemsCount > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <AlertTriangle className={`w-3.5 h-3.5 ${lowStockItemsCount > 0 ? 'text-amber-500' : 'text-[#B8B0A8]'}`} />
              </div>
            </div>
            <p className={`text-lg md:text-xl font-bold tracking-tight ${lowStockItemsCount > 0 ? 'text-amber-600' : 'text-[#1A1714]'}`}>
              {lowStockItemsCount} <span className="text-xs font-normal text-[#9C9590]">item</span>
            </p>
            <p className="text-[10px] text-[#B8B0A8] font-medium mt-1">Bahan batas minimum</p>
          </div>
        </div>
      </div>

      {/* Configuration Hub */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-4 mb-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F0E8E0]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-200">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1714]">Pusat Konfigurasi</h2>
              <p className="text-[10px] text-[#9C9590] font-medium">Akses pengaturan profil, pajak, menu, staff, dan laporan</p>
            </div>
          </div>
          <span className="bg-violet-50 text-violet-600 border border-violet-200 text-[9px] font-semibold px-2 py-0.5 rounded-lg uppercase tracking-wider">
            Owner
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { onClick: () => onNavigateTab('blueprint'), bg: 'bg-amber-50', iconBg: 'bg-amber-100 text-amber-700', icon: Compass, title: 'Rancang Bangun', sub: 'Denah, Printer & PIN' },
            { onClick: () => onNavigateTab('settings'), bg: 'bg-[#FAFAF8]', iconBg: 'bg-violet-100 text-violet-600', icon: Percent, title: 'Resto & Pajak', sub: 'PB1 11% & Service' },
            { onClick: () => onNavigateTab('settings'), bg: 'bg-[#FAFAF8]', iconBg: 'bg-blue-100 text-blue-600', icon: Sparkles, title: 'Menu & Topping', sub: 'Katalog & Custom Isian' },
            { onClick: () => onNavigateTab('settings'), bg: 'bg-[#FAFAF8]', iconBg: 'bg-emerald-100 text-emerald-600', icon: Users, title: 'Staff & PIN', sub: 'Role & Hak Otoritas' },
            { onClick: () => onNavigateTab('inventory'), bg: 'bg-[#FAFAF8]', iconBg: 'bg-amber-100 text-amber-600', icon: Boxes, title: 'Stok & HPP', sub: 'Bahan Baku & Resep' },
            { onClick: () => onNavigateTab('analytics'), bg: 'bg-[#FAFAF8]', iconBg: 'bg-teal-100 text-teal-600', icon: PieChart, title: 'Analitik & Export', sub: 'Excel & PDF' },
            { onClick: () => setIsAddModalOpen(true), bg: 'bg-[#FAFAF8]', iconBg: 'bg-rose-100 text-rose-600', icon: Building2, title: '+ Cabang', sub: 'Registrasi Outlet' },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={item.onClick}
                className={`p-3 ${item.bg} hover:bg-[#F0E8E0] border border-[#E8E0D8] rounded-xl flex flex-col items-start gap-2 transition-all text-left group cursor-pointer`}
              >
                <div className={`w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#1A1714]">{item.title}</p>
                  <p className="text-[9px] text-[#9C9590] font-medium mt-0.5">{item.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-[#9C9590] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari outlet berdasarkan nama atau alamat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[#E8E0D8] text-[#1A1714] text-xs rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-orange-500/20 transition-all placeholder:text-[#B8B0A8] font-medium"
          />
        </div>

        <div className="text-xs text-[#6B6560] font-medium flex items-center gap-2">
          <span>Outlet Aktif:</span>
          <span className="bg-violet-600 text-white px-3 py-1 rounded-lg font-semibold text-[11px] flex items-center gap-1.5">
            <Store className="w-3 h-3" /> {currentBranch.name}
          </span>
        </div>
      </div>

      {/* Outlet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBranches.map((branch) => {
          const isSelected = branch.id === currentBranch.id;
          const branchOrders = orders.filter((o) => o.branchId === branch.id || (!o.branchId && branch.isMainBranch));
          const branchOmset = branchOrders
            .filter((o) => o.paymentStatus === 'PAID')
            .reduce((sum, o) => sum + o.total, 0);

          return (
            <div
              key={branch.id}
              className={`bg-white border rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 relative group ${
                isSelected
                  ? 'border-violet-400 ring-1 ring-violet-400/20'
                  : 'border-[#E8E0D8] hover:border-[#D5CFC8]'
              }`}
              style={{ boxShadow: isSelected ? '0 4px 12px rgba(99,102,241,0.08)' : '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      {branch.isMainBranch ? (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-semibold px-2 py-0.5 rounded-md uppercase">
                          Pusat
                        </span>
                      ) : (
                        <span className="bg-[#FAFAF8] text-[#9C9590] border border-[#E8E0D8] text-[9px] font-semibold px-2 py-0.5 rounded-md uppercase">
                          Cabang
                        </span>
                      )}
                      {isSelected && (
                        <span className="bg-violet-50 text-violet-600 border border-violet-200 text-[9px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Aktif
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[#1A1714] group-hover:text-violet-600 transition-colors">
                      {branch.name}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-[#FAFAF8] border border-[#E8E0D8] flex items-center justify-center text-violet-500 shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-1 text-xs text-[#9C9590] font-medium mb-3">
                  <p className="flex items-start gap-1.5">
                    <MapPin className="w-3 h-3 text-[#B8B0A8] shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{branch.address}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-[#B8B0A8] shrink-0" />
                    <span>{branch.phone}</span>
                  </p>
                </div>

                <div className="bg-[#FAFAF8] border border-[#E8E0D8] rounded-xl p-3 mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] text-[#9C9590] font-semibold uppercase tracking-wider">Omset Hari Ini</span>
                    <p className="text-sm font-bold text-emerald-600 mt-0.5">
                      Rp {branchOmset > 0 ? branchOmset.toLocaleString('id-ID') : '0'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#9C9590] font-semibold uppercase tracking-wider">Total Order</span>
                    <p className="text-sm font-bold text-[#1A1714] mt-0.5">
                      {branchOrders.length} <span className="text-[10px] text-[#9C9590] font-normal">transaksi</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-[#F0E8E0]">
                <button
                  type="button"
                  onClick={() => {
                    onSelectBranch(branch);
                    onNavigateTab('pos');
                  }}
                  className={`w-full py-2 px-4 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'bg-[#FAFAF8] hover:bg-[#F0E8E0] text-[#6B6560] border border-[#E8E0D8]'
                  }`}
                >
                  <span>{isSelected ? 'Buka Kasir POS' : 'Pilih & Buka POS'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <a
                  href={`?selforder=true&branch=${encodeURIComponent(branch.id)}&table=${encodeURIComponent(tables.find((table) => (!table.branchId || table.branchId === branch.id) && table.isSelfOrderEnabled)?.number || '01')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-1.5 px-3 rounded-xl bg-[#FAFAF8] hover:bg-[#F0E8E0] text-[#9C9590] hover:text-[#6B6560] text-[10px] font-medium flex items-center justify-center gap-1.5 border border-[#E8E0D8] transition-colors"
                >
                  <ExternalLink className="w-3 h-3 text-amber-500" />
                  <span>Buka Self-Order Mobile</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Outlet Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[#E8E0D8] w-full max-w-lg rounded-2xl p-5 relative overflow-hidden" style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.12)' }}>
            <div className="flex items-center justify-between border-b border-[#F0E8E0] pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600">
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
