import React, { useState } from 'react';
import {
  Compass,
  Grid2X2,
  UtensilsCrossed,
  ShieldCheck,
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  Sparkles,
  QrCode,
  Store,
  Layers,
  UserCheck,
  Building2,
  Percent,
  Check,
  AlertCircle,
  HelpCircle,
  Cpu,
  ArrowRight,
  RefreshCw,
  Sliders,
  DollarSign,
  Users,
  Settings,
  FileText,
  MapPin,
  Phone,
  Clock,
  Crown
} from 'lucide-react';
import {
  RestaurantProfile,
  RestaurantTable,
  Branch,
  PrinterConfig,
  MenuItem
} from '../../types/pos';

interface BlueprintArchitectureViewProps {
  profile: RestaurantProfile;
  onSaveProfile: (profile: RestaurantProfile) => void;
  tables: RestaurantTable[];
  onUpdateTables?: (tables: RestaurantTable[]) => void;
  branches: Branch[];
  currentBranch: Branch;
  onSelectBranch?: (branch: Branch) => void;
  onAddBranch?: (branch: Branch) => void;
  printerConfig: PrinterConfig;
  onUpdatePrinterConfig?: (config: PrinterConfig) => void;
  menuItems: MenuItem[];
  onNavigateTab: (tab: string) => void;
  onShowToast?: (title: string, message: string) => void;
}

export const BlueprintArchitectureView: React.FC<BlueprintArchitectureViewProps> = ({
  profile,
  onSaveProfile,
  tables,
  branches,
  currentBranch,
  onSelectBranch,
  onAddBranch,
  printerConfig,
  onUpdatePrinterConfig,
  menuItems,
  onNavigateTab,
  onShowToast
}) => {
  const [activeSubBlueprint, setActiveSubBlueprint] = useState<
    'PROFILE' | 'LAYOUT' | 'MENU_TREE' | 'ACCESS_MATRIX' | 'PAYMENT_GATEWAY' | 'WORKFLOW'
  >('PROFILE');

  // Modal New Branch State
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState<boolean>(false);
  const [newBranchName, setNewBranchName] = useState<string>('');
  const [newBranchCode, setNewBranchCode] = useState<string>('');
  const [newBranchAddress, setNewBranchAddress] = useState<string>('');
  const [newBranchPhone, setNewBranchPhone] = useState<string>('');

  // Local Profile Form State
  const [restoName, setRestoName] = useState<string>(profile.name || 'Resto & Bakso Malang');
  const [restoPhone, setRestoPhone] = useState<string>(profile.phone || '0812-3456-7890');
  const [restoAddress, setRestoAddress] = useState<string>(profile.address || 'Jl. Raya Utama No. 88');
  const [receiptHeader, setReceiptHeader] = useState<string>(profile.receiptHeader || 'Selamat Datang di Resto Kami!');
  const [receiptFooter, setReceiptFooter] = useState<string>(profile.receiptFooter || 'Terima kasih atas kunjungan Anda');

  const [isSavedNotice, setIsSavedNotice] = useState<boolean>(false);

  // Price Markup Blueprint State
  const [onlinePriceMarkup, setOnlinePriceMarkup] = useState<number>(20); // 20% for GoFood/GrabFood
  const [pb1TaxRate, setPb1TaxRate] = useState<number>(profile.taxPercentage || 11);
  const [serviceChargeRate, setServiceChargeRate] = useState<number>(profile.serviceChargePercentage || 5);

  // Role Matrix State
  const [rolePermissions, setRolePermissions] = useState([
    { action: 'Buka Laci Tunai (Open Cash Drawer)', owner: true, manager: true, kasir: false, kitchen: false },
    { action: 'Memberi Diskon Khusus (>10%)', owner: true, manager: true, kasir: false, kitchen: false },
    { action: 'Void / Pembatalan Pesanan Lunas', owner: true, manager: true, kasir: false, kitchen: false },
    { action: 'Ubah Harga Menu / Stock In', owner: true, manager: true, kasir: false, kitchen: false },
    { action: 'Tutup Shift & Rekap Kasir', owner: true, manager: true, kasir: true, kitchen: false },
    { action: 'Proses Transaksi POS Harian', owner: true, manager: true, kasir: true, kitchen: false },
    { action: 'Update Status Masakan Dapur (KDS)', owner: true, manager: true, kasir: true, kitchen: true }
  ]);

  const handleSaveBlueprintSettings = () => {
    // Save tax & service charge updates back to profile
    onSaveProfile({
      ...profile,
      name: restoName,
      phone: restoPhone,
      address: restoAddress,
      receiptHeader,
      receiptFooter,
      taxPercentage: pb1TaxRate,
      serviceChargePercentage: serviceChargeRate
    });

    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  const handleCreateBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || !newBranchCode.trim()) {
      if (onShowToast) onShowToast('Validasi', 'Isi nama dan kode cabang outlet!');
      return;
    }

    const created: Branch = {
      id: 'br-' + Date.now(),
      name: newBranchName.trim(),
      code: newBranchCode.trim().toUpperCase(),
      address: newBranchAddress.trim() || 'Alamat Outlet Baru',
      phone: newBranchPhone.trim() || '0812-3456-7890',
      isHeadquarters: false,
      managerName: 'Manager ' + newBranchName.trim()
    };

    if (onAddBranch) {
      onAddBranch(created);
    }
    if (onSelectBranch) {
      onSelectBranch(created);
    }

    setIsAddBranchModalOpen(false);
    setNewBranchName('');
    setNewBranchCode('');
    setNewBranchAddress('');
    setNewBranchPhone('');
  };


  const togglePermission = (index: number, roleKey: 'owner' | 'manager' | 'kasir' | 'kitchen') => {
    const updated = [...rolePermissions];
    updated[index][roleKey] = !updated[index][roleKey];
    setRolePermissions(updated);
  };

  return (
    <div className="flex-1 bg-slate-100/80 text-[#1A1714] overflow-y-auto p-4 md:p-6 font-sans">
      {/* Executive Studio Header Banner */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 mb-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-orange-50 text-[#C2410C] border border-orange-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5 text-[#C2410C]" /> Executive Portal Owner Studio
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-600" /> Outlet Aktif: {currentBranch.name} ({currentBranch.code})
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#1A1714] tracking-tight">
              Pusat Pengaturan & Arsitektur Bisnis Resto
            </h1>
            <p className="text-[#9C9590] text-xs md:text-sm mt-1 max-w-3xl font-medium leading-relaxed">
              Studio resmi Pemilik Resto: Kelola profil outlet, tata letak denah ruangan, hierarki katalog menu, routing printer thermal multi-dapur, otorisasi PIN kasir, dan pajak PB1.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveBlueprintSettings}
              className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-xs px-5 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan Studio</span>
            </button>
          </div>
        </div>

        {/* OUTLET SELECTOR ROW */}
        <div className="mt-6 pt-5 border-t border-[#F0E8E0]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#C2410C]" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Daftar Outlet & Cabang Terdaftar ({branches.length}):
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAddBranchModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer self-start md:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tambah Outlet Cabang Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {branches.map((br) => {
              const isSelected = br.id === currentBranch.id;

              return (
                <button
                  key={br.id}
                  type="button"
                  onClick={() => onSelectBranch && onSelectBranch(br)}
                  className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                    isSelected
                      ? 'bg-[#FFF7F3] border-[#EA580C] text-[#2A211D] shadow-sm ring-2 ring-[#EA580C]/10'
                      : 'bg-[#FAFAFA] border-[#E8E0D8] text-[#6B6560] hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#1A1714]">{br.name}</span>
                        {br.isHeadquarters && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-300">
                            Pusat
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#9C9590] font-medium line-clamp-1 mt-0.5">{br.address}</p>
                    </div>

                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#E8E0D8]/60 flex items-center justify-between text-[10px] font-bold text-[#9C9590]">
                    <span className="font-mono text-[#C2410C]">KODE: {br.code}</span>
                    <span className="text-emerald-700 font-bold">POS AKTIF</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Blueprint Toast Notice */}
        {isSavedNotice && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Seluruh konfigurasi arsitektur studio outlet {currentBranch.name} berhasil disimpan!</span>
          </div>
        )}

        {/* Navigation Tabs for Sub-Blueprints */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-[#F0E8E0] overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveSubBlueprint('PROFILE')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
              activeSubBlueprint === 'PROFILE'
                ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[#6B6560] border-[#E8E0D8]/80'
            }`}
          >
            <Building2 className="w-4 h-4 text-orange-300" />
            <span>1. Profil Resto & Struk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubBlueprint('LAYOUT')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
              activeSubBlueprint === 'LAYOUT'
                ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[#6B6560] border-[#E8E0D8]/80'
            }`}
          >
            <Grid2X2 className="w-4 h-4 text-amber-500" />
            <span>2. Pengaturan Meja Resto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubBlueprint('MENU_TREE')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
              activeSubBlueprint === 'MENU_TREE'
                ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[#6B6560] border-[#E8E0D8]/80'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-[#C2410C]" />
            <span>3. Katalog Menu & Auto-Markup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubBlueprint('ACCESS_MATRIX')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
              activeSubBlueprint === 'ACCESS_MATRIX'
                ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[#6B6560] border-[#E8E0D8]/80'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-rose-500" />
            <span>4. Matriks Otorisasi PIN Staff</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubBlueprint('PAYMENT_GATEWAY')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
              activeSubBlueprint === 'PAYMENT_GATEWAY'
                ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[#6B6560] border-[#E8E0D8]/80'
            }`}
          >
            <CreditCard className="w-4 h-4 text-teal-500" />
            <span>6. Pajak PB1 & Payment Gateway</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubBlueprint('WORKFLOW')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
              activeSubBlueprint === 'WORKFLOW'
                ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[#6B6560] border-[#E8E0D8]/80'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-orange-500" />
            <span>7. Workflow & Kesiapan Outlet</span>
          </button>
        </div>
      </div>

      {/* ================= MODULE 1: PROFIL RESTO & STRUK ================= */}
      {activeSubBlueprint === 'PROFILE' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#F0E8E0]">
              <div>
                <h2 className="text-lg font-bold text-[#1A1714] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#C2410C]" /> Pengaturan Identitas Resto & Cetak Struk
                </h2>
                <p className="text-xs text-[#9C9590] font-medium mt-0.5">
                  Atur informasi resmi usaha, nomor kontak customer, alamat lengkap, dan teks footer pada nota transaksi.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveBlueprintSettings}
                className="bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" /> Simpan Profil
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#6B6560] mb-1">Nama Usaha / Restoran</label>
                  <input
                    type="text"
                    value={restoName}
                    onChange={(e) => setRestoName(e.target.value)}
                    className="w-full bg-[#FAFAFA] border border-[#E8E0D8] text-[#1A1714] font-semibold text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-[#EA580C] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B6560] mb-1">No. Telepon WhatsApp / CS</label>
                  <input
                    type="text"
                    value={restoPhone}
                    onChange={(e) => setRestoPhone(e.target.value)}
                    className="w-full bg-[#FAFAFA] border border-[#E8E0D8] text-[#1A1714] font-semibold text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-[#EA580C] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B6560] mb-1">Alamat Outlet Cabang {currentBranch.name}</label>
                  <textarea
                    rows={3}
                    value={restoAddress}
                    onChange={(e) => setRestoAddress(e.target.value)}
                    className="w-full bg-[#FAFAFA] border border-[#E8E0D8] text-[#1A1714] font-medium text-xs rounded-xl p-3 outline-none focus:border-[#EA580C] focus:bg-white resize-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#6B6560] mb-1">Header Pesan Nota Thermal</label>
                  <input
                    type="text"
                    value={receiptHeader}
                    onChange={(e) => setReceiptHeader(e.target.value)}
                    className="w-full bg-[#FAFAFA] border border-[#E8E0D8] text-[#1A1714] font-medium text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-[#EA580C] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B6560] mb-1">Footer Pesan Penutup Nota</label>
                  <input
                    type="text"
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    className="w-full bg-[#FAFAFA] border border-[#E8E0D8] text-[#1A1714] font-medium text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-[#EA580C] focus:bg-white"
                  />
                </div>

                {/* Preview Card */}
                <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl font-mono text-xs text-slate-800">
                  <p className="text-[10px] font-bold uppercase text-amber-800 mb-2 font-sans">Simulasi Header Struk Kasir:</p>
                  <p className="text-center font-bold">{restoName.toUpperCase()}</p>
                  <p className="text-center text-[11px] text-slate-600">{restoAddress}</p>
                  <p className="text-center text-[11px] text-slate-600">Telp: {restoPhone}</p>
                  <div className="my-2 border-b border-dashed border-slate-300" />
                  <p className="text-center italic text-[11px] text-[#9C9590]">{receiptHeader}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODULE 2: TABLE LAYOUT BLUEPRINT ================= */}
      {activeSubBlueprint === 'LAYOUT' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-5 border-b border-[#F0E8E0]">
              <div>
                <h2 className="text-lg font-bold text-[#1A1714] flex items-center gap-2">
                  <Grid2X2 className="w-5 h-5 text-amber-500" /> Daftar & Status Meja Resto
                </h2>
                <p className="text-xs text-[#9C9590] font-medium mt-0.5">
                  Tampilan nomor meja pelanggan (1 - 15) dan status terisi/bebas secara real-time.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('tables')}
                className="bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <QrCode className="w-4 h-4" />
                <span>Buka Kelola QR Meja Full</span>
              </button>
            </div>

            {/* Visual Table Cards Matrix */}
            <div className="bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b border-[#E8E0D8]/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-[#1A1714] uppercase tracking-wider">
                    Total {tables.length} Meja Terdaftar
                  </span>
                </div>
              </div>

              {/* Tables Blueprint Matrix Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tables.map((table) => {
                  const cleanNumber = (table.number || '').replace(/^0+/, '') || table.number;
                  const isOccupied = table.status === 'OCCUPIED';

                  return (
                    <div
                      key={table.id}
                      className={`border rounded-2xl p-4 flex flex-col items-center justify-between gap-3 text-center transition-all shadow-2xs ${
                        isOccupied
                          ? 'bg-rose-50 border-rose-200 text-rose-950'
                          : 'bg-white border-[#E8E0D8] hover:border-[#EA580C]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-bold text-[#B8B0A8] uppercase">
                          Kapasitas: {table.capacity}
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isOccupied ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'
                          }`}
                        />
                      </div>

                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-[#E8E0D8] flex flex-col items-center justify-center font-bold text-[#1A1714]">
                        <span className="text-[9px] text-[#B8B0A8] uppercase">MEJA</span>
                        <span className="text-lg leading-none text-[#C2410C]">{cleanNumber}</span>
                      </div>

                      <div className="w-full pt-2 border-t border-[#F0E8E0] flex items-center justify-between text-[10px] font-bold">
                        <span className={isOccupied ? 'text-rose-700' : 'text-emerald-700'}>
                          {isOccupied ? 'Terisi' : 'Kosong'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            table.isSelfOrderEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          QR {table.isSelfOrderEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODULE 3: MENU HIERARCHY & PRICING MATRIX BLUEPRINT ================= */}
      {activeSubBlueprint === 'MENU_TREE' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-5 border-b border-[#F0E8E0]">
              <div>
                <h2 className="text-lg font-bold text-[#1A1714] flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-[#C2410C]" /> Katalog Menu & Auto-Markup Online
                </h2>
                <p className="text-xs text-[#9C9590] font-medium mt-0.5">
                  Atur struktur kategori menu, markup harga order online (GoFood/GrabFood), serta persentase profit margin target.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('settings')}
                className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Kelola Katalog Menu & Topping</span>
              </button>
            </div>

            {/* Price Markup Blueprint Card */}
            <div className="bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl p-5 mb-6">
              <h3 className="text-sm font-bold text-[#1A1714] mb-3 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#C2410C]" /> Auto-Markup Harga Online (GoFood / GrabFood)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-[#6B6560] mb-1">
                    Persentase Auto-Markup Harga Online (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={onlinePriceMarkup}
                      onChange={(e) => setOnlinePriceMarkup(Number(e.target.value))}
                      className="bg-white border border-[#E8E0D8] text-[#C2410C] font-bold text-sm rounded-xl px-3 py-2 outline-none w-28 text-center"
                    />
                    <span className="text-xs font-bold text-[#9C9590]">% dari Harga Normal</span>
                  </div>
                </div>

                <div className="bg-white border border-[#E8E0D8] p-3 rounded-xl">
                  <p className="text-[11px] text-[#9C9590] font-medium">Contoh Simulasi Harga Menu:</p>
                  <p className="text-xs font-semibold text-[#1A1714] mt-1">
                    Harga Normal: <span className="text-emerald-600">Rp 25.000</span> → Online (+{onlinePriceMarkup}%):{' '}
                    <span className="text-amber-600">
                      Rp {Math.round(25000 * (1 + onlinePriceMarkup / 100)).toLocaleString('id-ID')}
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleSaveBlueprintSettings}
                    className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Terapkan Markup
                  </button>
                </div>
              </div>
            </div>

            {/* Menu Items Matrix Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#E8E0D8]">
              <table className="w-full text-left text-xs font-medium text-[#6B6560]">
                <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider border-b border-[#E8E0D8]">
                  <tr>
                    <th className="p-3">Nama Menu</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Harga Normal</th>
                    <th className="p-3">Harga Online (+{onlinePriceMarkup}%)</th>
                    <th className="p-3">Status Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {menuItems.map((item) => {
                    const onlinePrice = Math.round(item.price * (1 + onlinePriceMarkup / 100));

                    return (
                      <tr key={item.id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="p-3 font-semibold text-[#1A1714] flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-[#E8E0D8]">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <span>{item.name}</span>
                        </td>
                        <td className="p-3 font-bold text-[#C2410C]">{item.category}</td>
                        <td className="p-3 font-bold text-emerald-600">Rp {item.price.toLocaleString('id-ID')}</td>
                        <td className="p-3 font-bold text-amber-600">Rp {onlinePrice.toLocaleString('id-ID')}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              item.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.isAvailable ? 'Tersedia' : 'Habis'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODULE 4: MULTI-STATION KITCHEN PRINTER ROUTING BLUEPRINT ================= */}
      {/* ================= MODULE 5: STAFF ROLE & PIN AUTHORITY MATRIX BLUEPRINT ================= */}
      {activeSubBlueprint === 'ACCESS_MATRIX' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs">
            <div className="pb-4 mb-5 border-b border-[#F0E8E0]">
              <h2 className="text-lg font-bold text-[#1A1714] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-rose-500" /> Matriks Otoritas & Hak Akses PIN Staff
              </h2>
              <p className="text-xs text-[#9C9590] font-medium mt-0.5">
                Rancang bangun batasan tindakan sensitif kasir, pemberian diskon, void transaksi, serta pembukaan laci kasir.
              </p>
            </div>

            {/* Interactive Matrix Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#E8E0D8]">
              <table className="w-full text-left text-xs font-medium text-[#6B6560]">
                <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider border-b border-[#E8E0D8]">
                  <tr>
                    <th className="p-3.5">Aksi / Tindakan Sensitif Sistem</th>
                    <th className="p-3.5 text-center text-[#C2410C]">Super Owner</th>
                    <th className="p-3.5 text-center text-[#C2410C]">Manager</th>
                    <th className="p-3.5 text-center text-emerald-700">Kasir POS</th>
                    <th className="p-3.5 text-center text-amber-700">Koki Dapur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rolePermissions.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="p-3.5 font-semibold text-[#1A1714]">{item.action}</td>
                      <td className="p-3.5 text-center">
                        <span className="text-[#C2410C] font-bold">FULL (✓)</span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(idx, 'manager')}
                          className={`w-6 h-6 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors ${
                            item.manager ? 'bg-[#EA580C] text-white' : 'bg-slate-200 text-[#B8B0A8]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(idx, 'kasir')}
                          className={`w-6 h-6 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors ${
                            item.kasir ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-[#B8B0A8]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(idx, 'kitchen')}
                          className={`w-6 h-6 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors ${
                            item.kitchen ? 'bg-amber-600 text-white' : 'bg-slate-200 text-[#B8B0A8]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODULE 6: PAYMENT GATEWAY & TAX BLUEPRINT ================= */}
      {activeSubBlueprint === 'PAYMENT_GATEWAY' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs">
            <div className="pb-4 mb-5 border-b border-[#F0E8E0]">
              <h2 className="text-lg font-bold text-[#1A1714] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-600" /> Metode Pembayaran & Pajak PB1
              </h2>
              <p className="text-xs text-[#9C9590] font-medium mt-0.5">
                Konfigurasi QRIS Dinamis, Mesin EDC BCA/Mandiri, Pajak PPN/PB1 11% & Service Charge Resto.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PB1 Tax & Service Charge Card */}
              <div className="bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-[#1A1714] flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[#C2410C]" /> Aturan Pajak PB1 & Service Charge
                </h3>

                <div>
                  <label className="block text-xs font-bold text-[#6B6560] mb-1">
                    Pajak Resto PB1 / PPN (%)
                  </label>
                  <input
                    type="number"
                    value={pb1TaxRate}
                    onChange={(e) => setPb1TaxRate(Number(e.target.value))}
                    className="w-full bg-white border border-[#E8E0D8] text-[#1A1714] font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-[#EA580C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B6560] mb-1">
                    Service Charge Resto (%)
                  </label>
                  <input
                    type="number"
                    value={serviceChargeRate}
                    onChange={(e) => setServiceChargeRate(Number(e.target.value))}
                    className="w-full bg-white border border-[#E8E0D8] text-[#1A1714] font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-[#EA580C]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveBlueprintSettings}
                  className="w-full py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                >
                  Simpan Aturan Pajak & Service
                </button>
              </div>

              {/* QRIS & Payment Channels */}
              <div className="bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#1A1714] flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-600" /> Payment Gateway Channels
                </h3>

                <div className="space-y-2">
                  <div className="p-3 bg-white border border-[#E8E0D8] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#1A1714]">Tunai (Cash)</p>
                      <p className="text-[10px] text-[#9C9590]">Pembayaran tunai di kasir + hitung kembalian</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 font-semibold text-[10px] px-2 py-0.5 rounded">
                      AKTIF
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-[#E8E0D8] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#1A1714]">QRIS Dinamis / Statis</p>
                      <p className="text-[10px] text-[#9C9590]">Scan QRIS BCA, Mandiri, GoPay, OVO, ShopeePay</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 font-semibold text-[10px] px-2 py-0.5 rounded">
                      AKTIF
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-[#E8E0D8] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#1A1714]">Debit / Kartu Kredit (EDC)</p>
                      <p className="text-[10px] text-[#9C9590]">Mesin EDC BCA / Mandiri / BRI / BNI</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 font-semibold text-[10px] px-2 py-0.5 rounded">
                      AKTIF
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODULE 7: WORKFLOW & OUTLET READINESS ================= */}
      {activeSubBlueprint === 'WORKFLOW' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-[#E95412]" />
                  <h2 className="text-lg font-bold text-[#1A1714]">Kesiapan Operasional {currentBranch.name}</h2>
                </div>
                <p className="text-xs text-[#8A8580]">Checklist ini mengarahkan urutan konfigurasi sebelum outlet menerima transaksi nyata.</p>
              </div>
              <span className="rounded-full border border-[#F1C7B5] bg-[#FFF7F3] px-3 py-1.5 text-[10px] font-bold text-[#C2410C]">BLUEPRINT P0 / P1</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[
                { title: 'Profil & identitas outlet', ready: Boolean(currentBranch.name && currentBranch.address), detail: 'Nama, alamat, kode, dan kontak outlet' },
                { title: 'Meja & self-order', ready: tables.length > 0 && profile.isSelfOrderEnabled !== false, detail: `${tables.length} meja terdaftar · master self-order ${profile.isSelfOrderEnabled === false ? 'nonaktif' : 'aktif'}` },
                { title: 'Koordinat absensi', ready: currentBranch.gpsLatitude !== undefined && currentBranch.gpsLongitude !== undefined, detail: 'Koordinat dan radius harus spesifik per outlet' },
                { title: 'Printer operasional', ready: printerConfig.isConnected, detail: printerConfig.isConnected ? `${printerConfig.deviceName} terhubung` : 'Lakukan pairing dan test print' },
                { title: 'Katalog aktif', ready: menuItems.some((item) => item.isAvailable !== false), detail: `${menuItems.filter((item) => item.isAvailable !== false).length} menu tersedia` },
                { title: 'Keamanan produksi', ready: false, detail: 'Backend auth, audit log, signed QR, dan idempotency wajib P0' }
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-[#E8E0D8] bg-[#FAFAFA] p-4 flex items-start gap-3">
                  <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${item.ready ? 'bg-[#1A1714] text-white' : 'bg-[#FFF0E8] text-[#E95412]'}`}>
                    {item.ready ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1A1714]">{item.title}</p>
                    <p className="text-[10px] leading-relaxed text-[#8A8580] mt-1">{item.detail}</p>
                    <p className={`text-[9px] font-bold uppercase mt-2 ${item.ready ? 'text-[#55504C]' : 'text-[#C2410C]'}`}>{item.ready ? 'Siap secara UI' : 'Perlu tindakan'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {[
              { phase: 'P0', title: 'Sebelum pilot', items: ['Backend auth & hash PIN', 'Isolasi outlet server-side', 'Signed QR & idempotency', 'Audit pembayaran/void'] },
              { phase: 'P1', title: 'Operasional multi-cabang', items: ['Kalender jadwal staf', 'Multi-shift per outlet', 'GPS & koreksi absensi', 'Offline conflict handling'] },
              { phase: 'P2', title: 'Skala & kontrol', items: ['MFA owner/admin', 'Anomali absensi', 'Forecast kebutuhan shift', 'Backup dan observability'] }
            ].map((group) => (
              <div key={group.phase} className="bg-white border border-[#E8E0D8] rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-[#C2410C]">{group.phase}</p>
                    <h3 className="text-sm font-bold text-[#1A1714]">{group.title}</h3>
                  </div>
                  <Clock className="w-4 h-4 text-[#8A8580]" />
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-[11px] font-semibold text-[#5F5A56]">
                      <ArrowRight className="w-3.5 h-3.5 text-[#E95412]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#F1C7B5] bg-[#FFF7F3] p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#C2410C] shrink-0" />
            <p className="text-xs leading-relaxed text-[#5F514A]"><strong>Batas keamanan:</strong> kontrol PIN dan lockout pada UI saat ini hanya untuk demonstrasi. Jangan memproses data biometrik atau pembayaran nyata sebelum seluruh P0 pada dokumen blueprint repository selesai.</p>
          </div>
        </div>
      )}

      {/* Modal Tambah Outlet / Cabang Baru */}
      {isAddBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 max-w-md w-full shadow-xl relative animate-fade-in">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#F0E8E0]">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-[#C2410C]" />
                <h3 className="text-base font-bold text-[#1A1714]">Tambah Outlet / Cabang Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBranchModalOpen(false)}
                className="text-[#B8B0A8] hover:text-[#6B6560] p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBranchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#6B6560] mb-1">Nama Outlet Cabang *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Bakso Malang - Cabang Bekasi"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full bg-[#FAFAFA] border border-[#E8E0D8] text-[#1A1714] text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-[#EA580C] font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B6560] mb-1">Kode Cabang (Singkat) *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: BKS-01"
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  className="w-full bg-[#FAFAFA] border border-[#E8E0D8] text-amber-700 text-xs font-mono rounded-xl px-3.5 py-2.5 outline-none focus:border-[#EA580C] uppercase font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B6560] mb-1">Alamat Outlet</label>
                <input
                  type="text"
                  placeholder="Misal: Jl. Raya Ahmad Yani No. 88, Bekasi"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="w-full bg-[#FAFAFA] border border-[#E8E0D8] text-[#1A1714] text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-[#EA580C] font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B6560] mb-1">No. Telepon / WhatsApp Outlet</label>
                <input
                  type="text"
                  placeholder="0812-9988-7766"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  className="w-full bg-[#FAFAFA] border border-[#E8E0D8] text-[#1A1714] text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-[#EA580C] font-medium"
                />
              </div>

              <div className="pt-4 border-t border-[#F0E8E0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddBranchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-[#6B6560] text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Daftarkan Outlet Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
