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
  MenuItem,
  MerchantChannel,
  MerchantFeeConfig
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

  const merchantDefaults: Record<MerchantChannel, MerchantFeeConfig> = {
    GOFOOD: { platformFeePercent: 0, promotionPercent: 0, additionalPercent: 0, rounding: 500 },
    GRABFOOD: { platformFeePercent: 0, promotionPercent: 0, additionalPercent: 0, rounding: 500 },
    SHOPEEFOOD: { platformFeePercent: 0, promotionPercent: 0, additionalPercent: 0, rounding: 500 },
    TIKTOK: { platformFeePercent: 0, promotionPercent: 0, additionalPercent: 0, rounding: 500 },
    LAINNYA: { platformFeePercent: 0, promotionPercent: 0, additionalPercent: 0, rounding: 500 },
  };
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantChannel>('GOFOOD');
  const [merchantFees, setMerchantFees] = useState<Record<MerchantChannel, MerchantFeeConfig>>(() => ({ ...merchantDefaults, ...profile.merchantFees }));
  const selectedFee = merchantFees[selectedMerchant];
  const onlinePriceMarkup = selectedFee.platformFeePercent + selectedFee.promotionPercent + selectedFee.additionalPercent;
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
      serviceChargePercentage: serviceChargeRate,
      merchantFees,
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
    <div className="ui-surface flex-1 text-[var(--text-primary)] overflow-y-auto p-4 md:p-6 font-sans">
      {/* Executive Studio Header Banner */}
      <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-6 mb-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[var(--brand-50)] text-[var(--primary-hover)] border border-[var(--brand-200)] text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5 text-[var(--primary-hover)]" /> Executive Portal Owner Studio
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-600" /> Outlet Aktif: {currentBranch.name} ({currentBranch.code})
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Pusat Pengaturan & Arsitektur Bisnis Resto
            </h1>
            <p className="text-[var(--text-tertiary)] text-xs md:text-sm mt-1 max-w-3xl font-medium leading-relaxed">
              Studio resmi Pemilik Resto: Kelola profil outlet, tata letak denah ruangan, hierarki katalog menu, routing printer thermal multi-dapur, otorisasi PIN kasir, dan pajak PB1.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveBlueprintSettings}
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-xs px-5 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan Studio</span>
            </button>
          </div>
        </div>

        {/* OUTLET SELECTOR ROW */}
        <div className="mt-6 pt-5 border-t border-[var(--panel-border-light)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[var(--primary-hover)]" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Daftar Outlet & Cabang Terdaftar ({branches.length}):
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAddBranchModalOpen(true)}
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer self-start md:self-auto"
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
                      ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--text-primary)] shadow-sm ring-2 ring-[var(--primary)]/10'
                      : 'bg-[var(--surface-card)] border-[var(--panel-border)] text-[var(--text-secondary)] hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{br.name}</span>
                        {br.isHeadquarters && (
                          <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-1.5 py-0.2 rounded border border-amber-300">
                            Pusat
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)] font-medium line-clamp-1 mt-0.5">{br.address}</p>
                    </div>

                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[var(--panel-border)]/60 flex items-center justify-between text-[11px] font-bold text-[var(--text-tertiary)]">
                    <span className="font-mono text-[var(--primary-hover)]">KODE: {br.code}</span>
                    <span className="text-emerald-700 font-bold">POS AKTIF</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Blueprint Toast Notice */}
        {isSavedNotice && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Seluruh konfigurasi arsitektur studio outlet {currentBranch.name} berhasil disimpan!</span>
          </div>
        )}

        {/* Navigation Tabs for Sub-Blueprints */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-[var(--panel-border-light)] overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveSubBlueprint('PROFILE')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
              activeSubBlueprint === 'PROFILE'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[var(--text-secondary)] border-[var(--panel-border)]/80'
            }`}
          >
            <Building2 className="w-4 h-4 text-[var(--primary-text)]" />
            <span>1. Profil Resto & Struk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubBlueprint('LAYOUT')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
              activeSubBlueprint === 'LAYOUT'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[var(--text-secondary)] border-[var(--panel-border)]/80'
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
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[var(--text-secondary)] border-[var(--panel-border)]/80'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-[var(--primary-hover)]" />
            <span>3. Katalog Menu & Auto-Markup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubBlueprint('ACCESS_MATRIX')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
              activeSubBlueprint === 'ACCESS_MATRIX'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[var(--text-secondary)] border-[var(--panel-border)]/80'
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
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[var(--text-secondary)] border-[var(--panel-border)]/80'
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
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-[var(--text-secondary)] border-[var(--panel-border)]/80'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-[var(--primary-text)]" />
            <span>7. Workflow & Kesiapan Outlet</span>
          </button>
        </div>
      </div>

      {/* ================= MODULE 1: PROFIL RESTO & STRUK ================= */}
      {activeSubBlueprint === 'PROFILE' && (
        <div className="space-y-6">
          <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--panel-border-light)]">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[var(--primary-hover)]" /> Pengaturan Identitas Resto & Cetak Struk
                </h2>
                <p className="text-xs text-[var(--text-tertiary)] font-medium mt-0.5">
                  Atur informasi resmi usaha, nomor kontak customer, alamat lengkap, dan teks footer pada nota transaksi.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveBlueprintSettings}
                className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" /> Simpan Profil
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Nama Usaha / Restoran</label>
                  <input
                    type="text"
                    value={restoName}
                    onChange={(e) => setRestoName(e.target.value)}
                    className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] text-[var(--text-primary)] font-semibold text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--primary)] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">No. Telepon WhatsApp / CS</label>
                  <input
                    type="text"
                    value={restoPhone}
                    onChange={(e) => setRestoPhone(e.target.value)}
                    className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] text-[var(--text-primary)] font-semibold text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--primary)] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Alamat Outlet Cabang {currentBranch.name}</label>
                  <textarea
                    rows={3}
                    value={restoAddress}
                    onChange={(e) => setRestoAddress(e.target.value)}
                    className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] text-[var(--text-primary)] font-medium text-xs rounded-xl p-3 outline-none focus:border-[var(--primary)] focus:bg-white resize-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Header Pesan Nota Thermal</label>
                  <input
                    type="text"
                    value={receiptHeader}
                    onChange={(e) => setReceiptHeader(e.target.value)}
                    className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] text-[var(--text-primary)] font-medium text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--primary)] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Footer Pesan Penutup Nota</label>
                  <input
                    type="text"
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] text-[var(--text-primary)] font-medium text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--primary)] focus:bg-white"
                  />
                </div>

                {/* Preview Card */}
                <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl font-mono text-xs text-slate-800">
                  <p className="text-[11px] font-bold uppercase text-amber-800 mb-2 font-sans">Simulasi Header Struk Kasir:</p>
                  <p className="text-center font-bold">{restoName.toUpperCase()}</p>
                  <p className="text-center text-[11px] text-slate-600">{restoAddress}</p>
                  <p className="text-center text-[11px] text-slate-600">Telp: {restoPhone}</p>
                  <div className="my-2 border-b border-dashed border-slate-300" />
                  <p className="text-center italic text-[11px] text-[var(--text-tertiary)]">{receiptHeader}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODULE 2: TABLE LAYOUT BLUEPRINT ================= */}
      {activeSubBlueprint === 'LAYOUT' && (
        <div className="space-y-6">
          <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-5 border-b border-[var(--panel-border-light)]">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Grid2X2 className="w-5 h-5 text-amber-500" /> Daftar & Status Meja Resto
                </h2>
                <p className="text-xs text-[var(--text-tertiary)] font-medium mt-0.5">
                  Tampilan nomor meja pelanggan (1 - 15) dan status terisi/bebas secara real-time.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('tables')}
                className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <QrCode className="w-4 h-4" />
                <span>Buka Kelola QR Meja Full</span>
              </button>
            </div>

            {/* Visual Table Cards Matrix */}
            <div className="bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b border-[var(--panel-border)]/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
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
                      className={`border rounded-2xl p-4 flex flex-col items-center justify-between gap-3 text-center transition-all shadow-sm ${
                        isOccupied
                          ? 'bg-rose-50 border-rose-200 text-rose-950'
                          : 'bg-white border-[var(--panel-border)] hover:border-[var(--primary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase">
                          Kapasitas: {table.capacity}
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isOccupied ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'
                          }`}
                        />
                      </div>

                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-[var(--panel-border)] flex flex-col items-center justify-center font-bold text-[var(--text-primary)]">
                        <span className="text-[11px] text-[var(--text-tertiary)] uppercase">MEJA</span>
                        <span className="text-lg leading-none text-[var(--primary-hover)]">{cleanNumber}</span>
                      </div>

                      <div className="w-full pt-2 border-t border-[var(--panel-border-light)] flex items-center justify-between text-[11px] font-bold">
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
          <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-5 border-b border-[var(--panel-border-light)]">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-[var(--primary-hover)]" /> Katalog Menu & Auto-Markup Online
                </h2>
                <p className="text-xs text-[var(--text-tertiary)] font-medium mt-0.5">
                  Atur struktur kategori menu, markup harga order online (GoFood/GrabFood), serta persentase profit margin target.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('settings')}
                className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Kelola Katalog Menu & Topping</span>
              </button>
            </div>

            {/* Price Markup Blueprint Card */}
            <div className="bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl p-5 mb-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[var(--primary-hover)]" /> Kalkulator Harga Merchant per Cabang
              </h3>
              <div className="grid grid-cols-1 gap-4 items-end lg:grid-cols-5">
                <label className="space-y-1 text-xs font-bold text-[var(--text-secondary)]">Merchant
                  <select value={selectedMerchant} onChange={(event) => setSelectedMerchant(event.target.value as MerchantChannel)} className="ui-input">
                    <option value="GOFOOD">GoFood</option>
                    <option value="GRABFOOD">GrabFood</option>
                    <option value="SHOPEEFOOD">ShopeeFood</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </label>
                {([
                  ['platformFeePercent', 'Fee platform'],
                  ['promotionPercent', 'Kontribusi promo'],
                  ['additionalPercent', 'Biaya tambahan'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="space-y-1 text-xs font-bold text-[var(--text-secondary)]">{label} (%)
                    <input type="number" min={0} max={95} step="0.1" value={selectedFee[key]} onChange={(event) => setMerchantFees((current) => ({ ...current, [selectedMerchant]: { ...current[selectedMerchant], [key]: Math.max(0, Math.min(95, Number(event.target.value) || 0)) } }))} className="ui-input" />
                  </label>
                ))}

                <div className="bg-white border border-[var(--panel-border)] p-3 rounded-xl">
                  <p className="text-[11px] text-[var(--text-tertiary)] font-medium">Contoh Simulasi Harga Menu:</p>
                  <p className="text-xs font-semibold text-[var(--text-primary)] mt-1">
                    Harga Normal: <span className="text-emerald-600">Rp 25.000</span> → Online (+{onlinePriceMarkup}%):{' '}
                    <span className="text-amber-600">
                      Rp {(onlinePriceMarkup >= 95 ? 0 : Math.ceil((25000 / (1 - onlinePriceMarkup / 100)) / selectedFee.rounding) * selectedFee.rounding).toLocaleString('id-ID')}
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleSaveBlueprintSettings}
                    className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Simpan Fee Cabang
                  </button>
                </div>
              </div>
            </div>

            {/* Menu Items Matrix Table */}
            <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)]">
              <table className="w-full text-left text-xs font-medium text-[var(--text-secondary)]">
                <thead className="bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-[var(--panel-border)]">
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
                    const onlinePrice = onlinePriceMarkup >= 95
                      ? 0
                      : Math.ceil((item.price / (1 - onlinePriceMarkup / 100)) / selectedFee.rounding) * selectedFee.rounding;

                    return (
                      <tr key={item.id} className="hover:bg-[var(--surface-card)] transition-colors">
                        <td className="p-3 font-semibold text-[var(--text-primary)] flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-[var(--panel-border)]">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-400">
                                <UtensilsCrossed className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                          <span>{item.name}</span>
                        </td>
                        <td className="p-3 font-bold text-[var(--primary-hover)]">{item.category}</td>
                        <td className="p-3 font-bold text-emerald-600">Rp {item.price.toLocaleString('id-ID')}</td>
                        <td className="p-3 font-bold text-amber-600">Rp {onlinePrice.toLocaleString('id-ID')}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${
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
          <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-6 shadow-sm">
            <div className="pb-4 mb-5 border-b border-[var(--panel-border-light)]">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-rose-500" /> Matriks Otoritas & Hak Akses PIN Staff
              </h2>
              <p className="text-xs text-[var(--text-tertiary)] font-medium mt-0.5">
                Rancang bangun batasan tindakan sensitif kasir, pemberian diskon, void transaksi, serta pembukaan laci kasir.
              </p>
            </div>

            {/* Interactive Matrix Table */}
            <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)]">
              <table className="w-full text-left text-xs font-medium text-[var(--text-secondary)]">
                <thead className="bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-[var(--panel-border)]">
                  <tr>
                    <th className="p-3.5">Aksi / Tindakan Sensitif Sistem</th>
                    <th className="p-3.5 text-center text-[var(--primary-hover)]">Super Owner</th>
                    <th className="p-3.5 text-center text-[var(--primary-hover)]">Manager</th>
                    <th className="p-3.5 text-center text-emerald-700">Kasir POS</th>
                    <th className="p-3.5 text-center text-amber-700">Koki Dapur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rolePermissions.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[var(--surface-card)] transition-colors">
                      <td className="p-3.5 font-semibold text-[var(--text-primary)]">{item.action}</td>
                      <td className="p-3.5 text-center">
                        <span className="text-[var(--primary-hover)] font-bold">FULL (✓)</span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(idx, 'manager')}
                          className={`w-6 h-6 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors ${
                            item.manager ? 'bg-[var(--primary)] text-white' : 'bg-slate-200 text-[var(--text-tertiary)]'
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
                            item.kasir ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-[var(--text-tertiary)]'
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
                            item.kitchen ? 'bg-amber-600 text-white' : 'bg-slate-200 text-[var(--text-tertiary)]'
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
          <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-6 shadow-sm">
            <div className="pb-4 mb-5 border-b border-[var(--panel-border-light)]">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-600" /> Metode Pembayaran & Pajak PB1
              </h2>
              <p className="text-xs text-[var(--text-tertiary)] font-medium mt-0.5">
                Konfigurasi QRIS Dinamis, Mesin EDC BCA/Mandiri, Pajak PPN/PB1 11% & Service Charge Resto.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PB1 Tax & Service Charge Card */}
              <div className="bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[var(--primary-hover)]" /> Aturan Pajak PB1 & Service Charge
                </h3>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Pajak Resto PB1 / PPN (%)
                  </label>
                  <input
                    type="number"
                    value={pb1TaxRate}
                    onChange={(e) => setPb1TaxRate(Number(e.target.value))}
                    className="w-full bg-white border border-[var(--panel-border)] text-[var(--text-primary)] font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Service Charge Resto (%)
                  </label>
                  <input
                    type="number"
                    value={serviceChargeRate}
                    onChange={(e) => setServiceChargeRate(Number(e.target.value))}
                    className="w-full bg-white border border-[var(--panel-border)] text-[var(--text-primary)] font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveBlueprintSettings}
                  className="w-full py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
                >
                  Simpan Aturan Pajak & Service
                </button>
              </div>

              {/* QRIS & Payment Channels */}
              <div className="bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-600" /> Payment Gateway Channels
                </h3>

                <div className="space-y-2">
                  <div className="p-3 bg-white border border-[var(--panel-border)] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Tunai (Cash)</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">Pembayaran tunai di kasir + hitung kembalian</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 font-semibold text-[11px] px-2 py-0.5 rounded">
                      AKTIF
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-[var(--panel-border)] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">QRIS Dinamis / Statis</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">Scan QRIS BCA, Mandiri, GoPay, OVO, ShopeePay</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 font-semibold text-[11px] px-2 py-0.5 rounded">
                      AKTIF
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-[var(--panel-border)] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Debit / Kartu Kredit (EDC)</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">Mesin EDC BCA / Mandiri / BRI / BNI</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 font-semibold text-[11px] px-2 py-0.5 rounded">
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
          <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-[var(--primary)]" />
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Kesiapan Operasional {currentBranch.name}</h2>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">Checklist ini mengarahkan urutan konfigurasi sebelum outlet menerima transaksi nyata.</p>
              </div>
              <span className="rounded-full border border-[var(--brand-200)] bg-[var(--primary-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--primary-hover)]">BLUEPRINT P0 / P1</span>
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
                <div key={item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4 flex items-start gap-3">
                  <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${item.ready ? 'bg-[var(--primary)] text-white' : 'bg-[var(--primary-soft)] text-[var(--primary)]'}`}>
                    {item.ready ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">{item.title}</p>
                    <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] mt-1">{item.detail}</p>
                    <p className={`text-[11px] font-bold uppercase mt-2 ${item.ready ? 'text-[var(--text-secondary)]' : 'text-[var(--primary-hover)]'}`}>{item.ready ? 'Siap secara UI' : 'Perlu tindakan'}</p>
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
              <div key={group.phase} className="bg-white border border-[var(--panel-border)] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[11px] font-bold text-[var(--primary-hover)]">{group.phase}</p>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{group.title}</h3>
                  </div>
                  <Clock className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--brand-200)] bg-[var(--primary-soft)] p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--primary-hover)] shrink-0" />
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]"><strong>Batas keamanan:</strong> kontrol PIN dan lockout pada UI saat ini hanya untuk demonstrasi. Jangan memproses data biometrik atau pembayaran nyata sebelum seluruh P0 pada dokumen blueprint repository selesai.</p>
          </div>
        </div>
      )}

      {/* Modal Tambah Outlet / Cabang Baru */}
      {isAddBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-600/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-6 max-w-md w-full shadow-xl relative animate-fade-in">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--panel-border-light)]">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-[var(--primary-hover)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">Tambah Outlet / Cabang Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBranchModalOpen(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBranchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Nama Outlet Cabang *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Bakso Malang - Cabang Bekasi"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] text-[var(--text-primary)] text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--primary)] font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Kode Cabang (Singkat) *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: BKS-01"
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] text-amber-700 text-xs font-mono rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--primary)] uppercase font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Alamat Outlet</label>
                <input
                  type="text"
                  placeholder="Misal: Jl. Raya Ahmad Yani No. 88, Bekasi"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] text-[var(--text-primary)] text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--primary)] font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">No. Telepon / WhatsApp Outlet</label>
                <input
                  type="text"
                  placeholder="0812-9988-7766"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] text-[var(--text-primary)] text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--primary)] font-medium"
                />
              </div>

              <div className="pt-4 border-t border-[var(--panel-border-light)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddBranchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-[var(--text-secondary)] text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
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
