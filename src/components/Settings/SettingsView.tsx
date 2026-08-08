import React, { useEffect, useState } from 'react';
import {
  Settings,
  Store,
  Smartphone,
  Volume2,
  Users,
  Grid,
  CreditCard,
  Shield,
  Database,
  Save,
  Check,
  Plus,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Info,
  ExternalLink,
  Play,
  Camera,
  Compass
} from 'lucide-react';
import {
  RestaurantProfile,
  CondimentGroup,
  CondimentOption,
  CategoryType,
  UserAccount,
  UserRole,
  Branch,
  AccessControlRule
} from '../../types/pos';
import { INITIAL_CONDIMENT_GROUPS } from '../../data/initialData';

interface SettingsViewProps {
  profile: RestaurantProfile;
  onSaveProfile: (profile: RestaurantProfile) => void;
  condimentGroups: CondimentGroup[];
  onSaveCondimentGroup: (group: CondimentGroup) => void;
  onToggleGroupActive: (groupId: string, isActive: boolean) => void;
  onToggleOptionAvailable: (groupId: string, optionId: string, isAvailable: boolean) => void;
  onClearTransactions?: () => void;
  onFactoryReset?: () => void;
  staffAccounts: UserAccount[];
  branches: Branch[];
  currentBranch: Branch;
  onSaveStaff: (staff: UserAccount) => void;
  accessControl: AccessControlRule[];
  onSaveAccessControl: (rules: AccessControlRule[]) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onSaveProfile,
  condimentGroups,
  onSaveCondimentGroup,
  onToggleGroupActive,
  onToggleOptionAvailable,
  onClearTransactions,
  onFactoryReset,
  staffAccounts,
  branches,
  currentBranch,
  onSaveStaff,
  accessControl,
  onSaveAccessControl
}) => {
  const [activeTab, setActiveTab] = useState<
    'PROFILE' | 'LANDING' | 'KDS' | 'STAFF' | 'CONDIMENTS' | 'FINANCE' | 'ACCESS' | 'DATABASE'
  >('PROFILE');

  // Form State initialized with profile
  const [formProfile, setFormProfile] = useState<RestaurantProfile>(profile);
  const [isSavedAlert, setIsSavedAlert] = useState<boolean>(false);

  // Staff & PIN Management State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('KASIR');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffShift, setNewStaffShift] = useState('08:00');
  const [newStaffShiftEnd, setNewStaffShiftEnd] = useState('16:00');
  const [newStaffBranchId, setNewStaffBranchId] = useState(currentBranch.id);

  useEffect(() => {
    setNewStaffBranchId(currentBranch.id);
  }, [currentBranch.id]);

  // Condiments Expanded Accordion State
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>(['cg-1', 'cg-2']);

  // New Group Modal State
  const [newGroupModalOpen, setNewGroupModalOpen] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupMode, setNewGroupMode] = useState<'ADD_ON' | 'PAKET'>('ADD_ON');
  const [newGroupRequired, setNewGroupRequired] = useState<boolean>(false);
  const [newGroupCategory, setNewGroupCategory] = useState<CategoryType>('BAKSO');

  // New Option State per group
  const [newOptionNames, setNewOptionNames] = useState<Record<string, string>>({});
  const [newOptionPrices, setNewOptionPrices] = useState<Record<string, number>>({});

  const handleSaveAll = () => {
    onSaveProfile(formProfile);
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 2500);
  };

  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormProfile((prev) => ({
            ...prev,
            gpsLatitude: pos.coords.latitude,
            gpsLongitude: pos.coords.longitude
          }));
          alert(`Lokasi GPS berhasil diperbarui: Lat ${pos.coords.latitude}, Lng ${pos.coords.longitude}`);
        },
        (err) => {
          alert('Gagal mengambil lokasi GPS: ' + err.message);
        }
      );
    } else {
      alert('Browser Anda tidak mendukung fitur Geolocation GPS.');
    }
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !/^\d{6}$/.test(newStaffPin)) {
      alert('Isi nama dan PIN unik 6 digit untuk staff.');
      return;
    }
    if (staffAccounts.some((staff) => staff.pin === newStaffPin || staff.pin.startsWith(newStaffPin) || newStaffPin.startsWith(staff.pin))) {
      alert('PIN sama atau terlalu mirip dengan akun lain. Gunakan kombinasi yang benar-benar berbeda.');
      return;
    }

    const created: UserAccount = {
      id: 'usr-' + Date.now(),
      name: newStaffName.trim(),
      pin: newStaffPin.trim(),
      role: newStaffRole,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      branchIds: [newStaffBranchId],
      isActive: true,
      shiftStart: newStaffShift,
      shiftEnd: newStaffShiftEnd,
      workDays: [1, 2, 3, 4, 5, 6]
    };

    onSaveStaff(created);
    setNewStaffName('');
    setNewStaffPin('');
  };

  const toggleAccordion = (groupId: string) => {
    setExpandedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleAddOptionToGroup = (group: CondimentGroup) => {
    const name = newOptionNames[group.id]?.trim();
    const price = newOptionPrices[group.id] || 0;
    if (!name) return;

    const newOpt: CondimentOption = {
      id: 'opt-' + Date.now() + Math.random().toString(36).substring(2, 4),
      name: name.toUpperCase(),
      price: price,
      isAvailable: true
    };

    const updatedGroup: CondimentGroup = {
      ...group,
      options: [...group.options, newOpt]
    };

    onSaveCondimentGroup(updatedGroup);

    setNewOptionNames((prev) => ({ ...prev, [group.id]: '' }));
    setNewOptionPrices((prev) => ({ ...prev, [group.id]: 0 }));
  };

  const handleCreateNewGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup: CondimentGroup = {
      id: 'cg-' + Date.now(),
      name: newGroupName.trim(),
      mode: newGroupMode,
      required: newGroupRequired,
      minSelect: newGroupRequired ? 1 : 0,
      maxSelect: 10,
      targetCategories: [newGroupCategory],
      isActive: true,
      options: []
    };

    onSaveCondimentGroup(newGroup);
    setExpandedGroupIds((prev) => [...prev, newGroup.id]);
    setNewGroupModalOpen(false);
    setNewGroupName('');
  };

  const handleTestSound = (soundName: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
      alert(`Playing test chime for: ${soundName}`);
    } catch {
      alert(`Test suara: ${soundName}`);
    }
  };

  return (
    <div className="flex-1 bg-slate-100/90 p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between">
      <div>
        {/* Main Header Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">Pengaturan</h1>
              <p className="text-xs text-[#9C9590] font-semibold uppercase tracking-widest">CONTROL CENTER</p>
            </div>
          </div>

          {isSavedAlert && (
            <div className="bg-emerald-600 text-white px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              <span>Perubahan Berhasil Disimpan!</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Navigation Sidebar matching user reference images */}
          <div className="space-y-5">
            {/* UMUM */}
            <div>
              <p className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-widest px-2 mb-2">UMUM</p>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('PROFILE')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'PROFILE'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm font-bold'
                      : 'bg-white/70 border-[#E8E0D8]/80 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1A1714]">Profil & Brand</p>
                    <p className="text-[10px] text-[#9C9590] font-medium">Identitas, Logo, Sosmed</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('LANDING')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'LANDING'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm font-bold'
                      : 'bg-white/70 border-[#E8E0D8]/80 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1A1714]">Landing Page</p>
                    <p className="text-[10px] text-[#9C9590] font-medium">Tampilan App Pelanggan</p>
                  </div>
                </button>
              </div>
            </div>

            {/* OPERASIONAL */}
            <div>
              <p className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-widest px-2 mb-2">OPERASIONAL</p>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('KDS')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'KDS'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm font-bold'
                      : 'bg-white/70 border-[#E8E0D8]/80 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1A1714]">Dapur & KDS</p>
                    <p className="text-[10px] text-[#9C9590] font-medium">Timer, Alarm, Running Text</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('STAFF')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'STAFF'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm font-bold'
                      : 'bg-white/70 border-[#E8E0D8]/80 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1A1714]">Karyawan & Shift</p>
                    <p className="text-[10px] text-[#9C9590] font-medium">Absensi, GPS, Gaji</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('CONDIMENTS')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'CONDIMENTS'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm font-bold'
                      : 'bg-white/70 border-[#E8E0D8]/80 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                    <Grid className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1A1714]">Daftar Isian / Topping</p>
                    <p className="text-[10px] text-[#9C9590] font-medium">Opsi Kuah, Isian, Paket</p>
                  </div>
                </button>
              </div>
            </div>

            {/* SYSTEM */}
            <div>
              <p className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-widest px-2 mb-2">SYSTEM</p>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('FINANCE')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'FINANCE'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm font-bold'
                      : 'bg-white/70 border-[#E8E0D8]/80 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1A1714]">Keuangan</p>
                    <p className="text-[10px] text-[#9C9590] font-medium">Pajak, Service, Diskon</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('ACCESS')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'ACCESS'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm font-bold'
                      : 'bg-white/70 border-[#E8E0D8]/80 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1A1714]">Hak Akses</p>
                    <p className="text-[10px] text-[#9C9590] font-medium">Role & Permissions</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('DATABASE')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'DATABASE'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-sm font-bold'
                      : 'bg-white/70 border-[#E8E0D8]/80 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1A1714]">Database & Reset</p>
                    <p className="text-[10px] text-[#9C9590] font-medium">Reset & Maintenance</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Bottom Save Changes Button */}
            <button
              type="button"
              onClick={handleSaveAll}
              className="w-full py-4 bg-[#1C1B19] hover:bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-black/20 active:scale-95 transition-all cursor-pointer mt-4"
            >
              <Save className="w-4 h-4" />
              <span>SIMPAN PERUBAHAN</span>
            </button>
          </div>

          {/* Right Main Form Content Panel */}
          <div className="lg:col-span-3 bg-white border border-[#E8E0D8]/80 rounded-2xl p-6 shadow-xs min-h-[600px]">
            {/* 1. PROFIL & BRAND (Matching Image 1) */}
            {activeTab === 'PROFILE' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#1A1714]">Profil & Brand</h2>
                  <p className="text-xs text-[#9C9590] font-medium">Informasi dasar yang tampil di struk dan aplikasi.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {/* Logo Preview */}
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#E8E0D8] rounded-2xl p-4 bg-[#FAFAF8]">
                    <p className="text-[10px] font-bold text-[#B8B0A8] uppercase mb-3">LOGO BRAND</p>
                    <img
                      src={formProfile.logoUrl}
                      alt="Logo"
                      className="w-36 h-36 object-contain rounded-2xl border bg-white p-2 shadow-xs mb-3"
                    />
                    <input
                      type="text"
                      placeholder="URL Logo Image..."
                      value={formProfile.logoUrl}
                      onChange={(e) => setFormProfile({ ...formProfile, logoUrl: e.target.value })}
                      className="w-full bg-white border border-[#E8E0D8] rounded-xl px-3 py-1.5 text-[11px] text-[#6B6560] outline-none focus:border-blue-500 font-medium"
                    />
                  </div>

                  {/* Brand Fields */}
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider mb-1">
                        NAMA BRAND / RESTO
                      </label>
                      <input
                        type="text"
                        value={formProfile.name}
                        onChange={(e) => setFormProfile({ ...formProfile, name: e.target.value })}
                        className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl px-4 py-3 text-sm font-bold text-[#1A1714] outline-none focus:border-blue-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider mb-1">
                        SLOGAN / TAGLINE
                      </label>
                      <input
                        type="text"
                        value={formProfile.tagline}
                        onChange={(e) => setFormProfile({ ...formProfile, tagline: e.target.value })}
                        className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider mb-1">
                        ALAMAT LENGKAP
                      </label>
                      <textarea
                        rows={3}
                        value={formProfile.address}
                        onChange={(e) => setFormProfile({ ...formProfile, address: e.target.value })}
                        className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Social Media & Contact (Matching Image 1) */}
                <div className="border-t border-[#F0E8E0] pt-6">
                  <h3 className="text-xs font-bold text-[#1A1714] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <span>KONTAK & SOSMED</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">WHATSAPP</label>
                      <input
                        type="text"
                        value={formProfile.phone}
                        onChange={(e) => setFormProfile({ ...formProfile, phone: e.target.value })}
                        className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">INSTAGRAM</label>
                      <input
                        type="text"
                        value={formProfile.instagram}
                        onChange={(e) => setFormProfile({ ...formProfile, instagram: e.target.value })}
                        className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">TIKTOK</label>
                      <input
                        type="text"
                        value={formProfile.tiktok}
                        onChange={(e) => setFormProfile({ ...formProfile, tiktok: e.target.value })}
                        className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. LANDING PAGE (Matching Image 2) */}
            {activeTab === 'LANDING' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#1A1714]">Landing Page Pelanggan</h2>
                  <p className="text-xs text-[#9C9590] font-medium">Konfigurasi tampilan banner, wallpaper, dan review Google HP pelanggan.</p>
                </div>

                <div className="bg-white border border-[#E2E2E2] rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-[#1A1714]">Aktifkan Customer Self-Order</p>
                    <p className="text-[10px] text-[#8E8E8E] mt-0.5">Kontrol utama untuk seluruh QR meja di outlet aktif.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormProfile({ ...formProfile, isSelfOrderEnabled: formProfile.isSelfOrderEnabled === false })}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold border ${
                      formProfile.isSelfOrderEnabled !== false
                        ? 'bg-[#1C1B19] text-white border-[#1C1B19]'
                        : 'bg-[#F5F5F5] text-[#666666] border-[#DDDDDD]'
                    }`}
                  >
                    {formProfile.isSelfOrderEnabled !== false ? 'AKTIF' : 'NONAKTIF'}
                  </button>
                </div>

                {/* Banner Promo Utama Card */}
                <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg space-y-4">
                  <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" /> BANNER PROMO UTAMA
                  </p>

                  <div>
                    <label className="block text-[10px] font-bold text-indigo-100 uppercase mb-1">JUDUL PROMO</label>
                    <input
                      type="text"
                      value={formProfile.promoBannerTitle || ''}
                      onChange={(e) => setFormProfile({ ...formProfile, promoBannerTitle: e.target.value })}
                      className="w-full bg-white text-[#1A1714] font-bold text-sm rounded-2xl px-4 py-3 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-indigo-100 uppercase mb-1">DESKRIPSI</label>
                    <input
                      type="text"
                      value={formProfile.promoBannerDescription || ''}
                      onChange={(e) => setFormProfile({ ...formProfile, promoBannerDescription: e.target.value })}
                      className="w-full bg-white text-[#1A1714] font-bold text-xs rounded-2xl px-4 py-3 outline-none shadow-sm"
                    />
                  </div>
                </div>

                {/* Wallpaper & Google Review Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider">
                      WALLPAPER BACKGROUND
                    </label>
                    <div className="h-44 rounded-2xl overflow-hidden border border-[#E8E0D8] relative group">
                      <img
                        src={formProfile.wallpaperBackgroundUrl}
                        alt="Wallpaper Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="URL Gambar Background..."
                      value={formProfile.wallpaperBackgroundUrl || ''}
                      onChange={(e) => setFormProfile({ ...formProfile, wallpaperBackgroundUrl: e.target.value })}
                      className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div className="space-y-4 bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-[#1A1714] uppercase flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-blue-600" /> LINK REVIEW GOOGLE
                    </h3>

                    <div>
                      <label className="block text-[10px] font-bold text-[#B8B0A8] uppercase mb-1">URL MAPS</label>
                      <input
                        type="text"
                        value={formProfile.googleReviewUrl || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, googleReviewUrl: e.target.value })}
                        className="w-full bg-white border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#B8B0A8] uppercase mb-1">TEKS AJAKAN</label>
                      <input
                        type="text"
                        value={formProfile.googleReviewText || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, googleReviewText: e.target.value })}
                        className="w-full bg-white border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. DAPUR & KDS (Matching Image 3) */}
            {activeTab === 'KDS' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#1A1714]">Dapur & KDS</h2>
                  <p className="text-xs text-[#9C9590] font-medium">Pengaturan notifikasi dan tampilan layar dapur.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Batas Waktu Order */}
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAF8] space-y-4">
                    <div className="flex items-center gap-2 text-[#6B6560] font-bold text-xs">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>BATAS WAKTU ORDER</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={formProfile.orderTimeLimitMinutes || 5}
                        onChange={(e) => setFormProfile({ ...formProfile, orderTimeLimitMinutes: Number(e.target.value) })}
                        className="w-20 bg-white border border-slate-300 rounded-2xl p-3 text-2xl font-bold text-center text-[#1A1714] outline-none"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800 uppercase">MENIT SEBELUM</p>
                        <p className="text-[10px] text-[#B8B0A8] font-semibold">ALARM BERBUNYI</p>
                      </div>
                    </div>
                  </div>

                  {/* Sound & Notifications Master Switch & Audio Config */}
                  <div className="md:col-span-2 border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAF8] space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#E8E0D8]">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-5 h-5 text-indigo-600" />
                        <div>
                          <p className="text-xs font-bold text-[#1A1714]">Suara & Notifikasi</p>
                          <p className="text-[10px] text-[#B8B0A8] font-semibold uppercase">MASTER SWITCH</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setFormProfile({
                            ...formProfile,
                            soundNotificationsEnabled: !formProfile.soundNotificationsEnabled
                          })
                        }
                        className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                          formProfile.soundNotificationsEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full transition-transform ${
                            formProfile.soundNotificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Sound Dropdowns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold text-[#6B6560]">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-semibold text-[#B8B0A8]">ORDER BARU (DAPUR)</span>
                          <button
                            type="button"
                            onClick={() => handleTestSound('Order Baru')}
                            className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Test
                          </button>
                        </div>
                        <select
                          value={formProfile.soundOrderBaru || 'High Alarm (Siren)'}
                          onChange={(e) => setFormProfile({ ...formProfile, soundOrderBaru: e.target.value })}
                          className="w-full bg-white border border-[#E8E0D8] rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                        >
                          <option value="High Alarm (Siren)">High Alarm (Siren)</option>
                          <option value="Kitchen Order">Kitchen Order</option>
                          <option value="Warning Beep">Warning Beep</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-semibold text-[#B8B0A8]">PESANAN MASUK (POS)</span>
                          <button
                            type="button"
                            onClick={() => handleTestSound('Pesanan Masuk')}
                            className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Test
                          </button>
                        </div>
                        <select
                          value={formProfile.soundPesananMasuk || 'Kitchen Order'}
                          onChange={(e) => setFormProfile({ ...formProfile, soundPesananMasuk: e.target.value })}
                          className="w-full bg-white border border-[#E8E0D8] rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                        >
                          <option value="Kitchen Order">Kitchen Order</option>
                          <option value="Success Chime">Success Chime</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-semibold text-[#B8B0A8]">PEMBAYARAN SUKSES</span>
                          <button
                            type="button"
                            onClick={() => handleTestSound('Pembayaran Sukses')}
                            className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Test
                          </button>
                        </div>
                        <select
                          value={formProfile.soundPembayaranSukses || 'Success Chime'}
                          onChange={(e) => setFormProfile({ ...formProfile, soundPembayaranSukses: e.target.value })}
                          className="w-full bg-white border border-[#E8E0D8] rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                        >
                          <option value="Success Chime">Success Chime</option>
                          <option value="Cash Register Chime">Cash Register Chime</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-semibold text-[#B8B0A8]">CUSTOMER ORDER</span>
                          <button
                            type="button"
                            onClick={() => handleTestSound('Customer Order')}
                            className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Test
                          </button>
                        </div>
                        <select
                          value={formProfile.soundCustomerOrder || 'Customer Order'}
                          onChange={(e) => setFormProfile({ ...formProfile, soundCustomerOrder: e.target.value })}
                          className="w-full bg-white border border-[#E8E0D8] rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                        >
                          <option value="Customer Order">Customer Order Bell</option>
                          <option value="Warning Beep">Warning Beep</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Running Text */}
                <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAF8] space-y-2">
                  <label className="block text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider">
                    RUNNING TEXT KDS & DAPUR
                  </label>
                  <textarea
                    rows={2}
                    value={formProfile.runningText || 'JANGAN LUPA SHOLAT'}
                    onChange={(e) => setFormProfile({ ...formProfile, runningText: e.target.value })}
                    className="w-full bg-white border border-[#E8E0D8] rounded-2xl px-4 py-3 text-xs font-bold text-[#1A1714] outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* 4. KARYAWAN & SHIFT (Matching Images 5 & 6) */}
            {activeTab === 'STAFF' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#1A1714]">Karyawan & Shift</h2>
                  <p className="text-xs text-[#9C9590] font-medium">Manajemen staff, akses PIN, dan jadwal shift.</p>
                </div>

                <div className="bg-white border border-[#E2E2E2] rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-[#1A1714]">Aktifkan Absensi Outlet</p>
                    <p className="text-[10px] text-[#8E8E8E] mt-0.5">Jika nonaktif, staff tidak dapat melakukan clock-in atau clock-out.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormProfile({ ...formProfile, isAttendanceEnabled: formProfile.isAttendanceEnabled === false })}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold border ${
                      formProfile.isAttendanceEnabled !== false
                        ? 'bg-[#1C1B19] text-white border-[#1C1B19]'
                        : 'bg-[#F5F5F5] text-[#666666] border-[#DDDDDD]'
                    }`}
                  >
                    {formProfile.isAttendanceEnabled !== false ? 'AKTIF' : 'NONAKTIF'}
                  </button>
                </div>

                {/* Jadwal Shift & Toleransi Card (Matching Image 5) */}
                <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAF8]/80 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>JADWAL SHIFT & TOLERANSI</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <span className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">KITCHEN</span>
                      <input
                        type="time"
                        value={formProfile.shiftScheduleKitchen || '07:00'}
                        onChange={(e) => setFormProfile({ ...formProfile, shiftScheduleKitchen: e.target.value })}
                        className="w-full bg-white border border-[#E8E0D8] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1A1714]"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">CASHIER</span>
                      <input
                        type="time"
                        value={formProfile.shiftScheduleCashier || '08:00'}
                        onChange={(e) => setFormProfile({ ...formProfile, shiftScheduleCashier: e.target.value })}
                        className="w-full bg-white border border-[#E8E0D8] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1A1714]"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">STAFF</span>
                      <input
                        type="time"
                        value={formProfile.shiftScheduleStaff || '09:00'}
                        onChange={(e) => setFormProfile({ ...formProfile, shiftScheduleStaff: e.target.value })}
                        className="w-full bg-white border border-[#E8E0D8] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1A1714]"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">ADMIN</span>
                      <input
                        type="time"
                        value={formProfile.shiftScheduleAdmin || '08:00'}
                        onChange={(e) => setFormProfile({ ...formProfile, shiftScheduleAdmin: e.target.value })}
                        className="w-full bg-white border border-[#E8E0D8] rounded-2xl px-3 py-2 text-xs font-semibold text-[#1A1714]"
                      />
                    </div>
                  </div>

                  {/* Toleransi keterlambatan */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <div>
                        <p className="text-xs font-bold text-[#1A1714]">Toleransi Keterlambatan</p>
                        <p className="text-[10px] text-[#9C9590] font-medium">Menit yang diizinkan sebelum dianggap terlambat.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={formProfile.latenessToleranceMinutes || 5}
                        onChange={(e) => setFormProfile({ ...formProfile, latenessToleranceMinutes: Number(e.target.value) })}
                        className="w-14 bg-white border border-amber-300 rounded-xl py-1 text-center font-bold text-xs text-[#1A1714]"
                      />
                      <span className="text-xs font-bold text-amber-700">Menit</span>
                    </div>
                  </div>
                </div>

                {/* Lokasi & GPS Absensi (Matching Image 6) */}
                <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAF8]/80 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Compass className="w-4 h-4 text-blue-600" />
                    <span>LOKASI & GPS ABSENSI</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">LATITUDE (GARIS LINTANG)</label>
                      <input
                        type="text"
                        value={formProfile.gpsLatitude || -6.609013171412514}
                        onChange={(e) => setFormProfile({ ...formProfile, gpsLatitude: Number(e.target.value) })}
                        className="w-full bg-white border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">RADIUS AREA (METER)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={formProfile.gpsRadiusMeters || 20}
                          onChange={(e) => setFormProfile({ ...formProfile, gpsRadiusMeters: Number(e.target.value) })}
                          className="w-full bg-white border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800"
                        />
                        <span className="text-xs font-semibold text-[#9C9590]">Meter</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">LONGITUDE (GARIS BUJUR)</label>
                      <input
                        type="text"
                        value={formProfile.gpsLongitude || 106.78293233420759}
                        onChange={(e) => setFormProfile({ ...formProfile, gpsLongitude: Number(e.target.value) })}
                        className="w-full bg-white border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-800"
                      />
                    </div>

                    <div className="flex flex-col justify-center space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">Wajib Foto Selfie</span>
                        <input
                          type="checkbox"
                          checked={formProfile.requireSelfiePhoto ?? true}
                          onChange={(e) => setFormProfile({ ...formProfile, requireSelfiePhoto: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">Wajib GPS Aktif</span>
                        <input
                          type="checkbox"
                          checked={formProfile.requireGpsActive ?? true}
                          onChange={(e) => setFormProfile({ ...formProfile, requireGpsActive: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Ambil Lokasi Saat Ini</span>
                  </button>
                </div>

                {/* Daftar Staff & PIN (Matching Image 6) */}
                <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAF8]/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>DAFTAR STAFF & PIN</span>
                    </div>
                  </div>

                  {/* Form Tambah Staff */}
                  <form onSubmit={handleAddStaff} className="bg-[#FFF7F3] border border-[#F1C7B5] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <span className="block text-[10px] font-semibold text-indigo-900 uppercase mb-1">NAMA STAFF</span>
                      <input
                        type="text"
                        placeholder="Nama Lengkap"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-[#1A1714]"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold text-[#5A5A5A] uppercase mb-1">OUTLET PENUGASAN</span>
                      <select
                        value={newStaffBranchId}
                        onChange={(e) => setNewStaffBranchId(e.target.value)}
                        className="w-full bg-white border border-[#E2E2E2] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1714]"
                      >
                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold text-indigo-900 uppercase mb-1">ROLE</span>
                      <select
                        value={newStaffRole}
                        onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                        className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-[#1A1714]"
                      >
                        <option value="KASIR">Kasir</option>
                        <option value="KITCHEN">Kitchen / Dapur</option>
                        <option value="ADMIN">Admin</option>
                        <option value="OWNER">Owner</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold text-[#5A5A5A] uppercase mb-1">MULAI SHIFT</span>
                      <input type="time" value={newStaffShift} onChange={(e) => setNewStaffShift(e.target.value)} className="w-full bg-white border border-[#E2E2E2] rounded-xl px-3 py-2 text-xs font-bold" />
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold text-[#5A5A5A] uppercase mb-1">SELESAI SHIFT</span>
                      <input type="time" value={newStaffShiftEnd} onChange={(e) => setNewStaffShiftEnd(e.target.value)} className="w-full bg-white border border-[#E2E2E2] rounded-xl px-3 py-2 text-xs font-bold" />
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold text-indigo-900 uppercase mb-1">PIN (6 ANGKA)</span>
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="123456"
                        value={newStaffPin}
                        onChange={(e) => setNewStaffPin(e.target.value)}
                        className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A1714] tracking-widest"
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Tambah Staff
                    </button>
                  </form>

                  {/* Staff List Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {staffAccounts.map((stf) => (
                      <div key={stf.id} className="bg-white border border-[#E8E0D8] rounded-2xl p-3.5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={stf.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                              alt={stf.name}
                              className="w-10 h-10 rounded-xl object-cover border"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#1A1714] truncate">{stf.name}</p>
                              <p className="text-[10px] text-[#777777] font-semibold">{stf.role} · {stf.shiftStart || '-'}–{stf.shiftEnd || '-'}</p>
                              <p className="text-[9px] text-[#A0A0A0] mt-0.5 truncate">{branches.find((branch) => stf.branchIds?.includes(branch.id))?.name || 'Semua outlet'}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onSaveStaff({ ...stf, isActive: stf.isActive === false })}
                            className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${stf.isActive === false ? 'border-[#D8D8D8] text-[#777777] bg-[#F5F5F5]' : 'border-[#F1C7B5] text-[#D94B15] bg-[#FFF7F3]'}`}
                          >
                            {stf.isActive === false ? 'Nonaktif' : 'Aktif'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="text-[9px] font-bold text-[#777777] uppercase">Mulai shift</span>
                            <input type="time" value={stf.shiftStart || ''} onChange={(e) => onSaveStaff({ ...stf, shiftStart: e.target.value })} className="w-full rounded-xl border border-[#E2E2E2] bg-[#FAFAFA] px-2.5 py-2 text-xs font-bold" />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[9px] font-bold text-[#777777] uppercase">Selesai shift</span>
                            <input type="time" value={stf.shiftEnd || ''} onChange={(e) => onSaveStaff({ ...stf, shiftEnd: e.target.value })} className="w-full rounded-xl border border-[#E2E2E2] bg-[#FAFAFA] px-2.5 py-2 text-xs font-bold" />
                          </label>
                        </div>

                        <div className="flex items-end gap-2">
                          <label className="space-y-1 flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-[#777777] uppercase">Outlet penugasan</span>
                            <select
                              value={stf.branchIds?.length === branches.length ? '' : stf.branchIds?.[0] || ''}
                              onChange={(e) => onSaveStaff({ ...stf, branchIds: e.target.value ? [e.target.value] : branches.map((branch) => branch.id) })}
                              className="w-full rounded-xl border border-[#E2E2E2] bg-[#FAFAFA] px-2.5 py-2 text-[10px] font-bold"
                            >
                              <option value="">Semua outlet</option>
                              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                            </select>
                          </label>
                          <div className="pb-1 text-right">
                            <p className="text-[9px] text-[#8E8E8E] font-semibold uppercase">PIN terlindungi</p>
                            <p className="text-xs font-mono font-bold text-[#D94B15]">••••••</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 5. DAFTAR ISIAN / TOPPING (Matching Image 4) */}
            {activeTab === 'CONDIMENTS' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1714]">Daftar Isian / Topping</h2>
                    <p className="text-xs text-[#9C9590] font-medium">Atur pilihan tambahan untuk menu (Hanya Customer Order & Kitchen)</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewGroupModalOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-md shadow-indigo-500/20 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Grup</span>
                    </button>
                  </div>
                </div>

                {/* List of Condiment Groups Accordion */}
                <div className="space-y-3">
                  {condimentGroups.map((group) => {
                    const isExpanded = expandedGroupIds.includes(group.id);
                    return (
                      <div key={group.id} className="border border-[#E8E0D8] rounded-2xl overflow-hidden bg-white shadow-xs">
                        {/* Group Header */}
                        <div
                          onClick={() => toggleAccordion(group.id)}
                          className="p-4 flex items-center justify-between bg-[#FAFAF8]/80 hover:bg-slate-100/80 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white text-[10px] font-bold">
                              •
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-[#1A1714]">{group.name}</h3>
                                <span className="bg-slate-200 text-[#6B6560] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                                  MODE {group.mode}
                                </span>
                                <span className="text-xs text-[#B8B0A8] font-bold">• {group.options.length} Opsi</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
                              🏷️ 1 Target Category
                            </span>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-[#B8B0A8]" /> : <ChevronDown className="w-5 h-5 text-[#B8B0A8]" />}
                          </div>
                        </div>

                        {/* Group Options Content */}
                        {isExpanded && (
                          <div className="p-4 border-t border-[#F0E8E0] bg-white space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {group.options.map((opt) => (
                                <div
                                  key={opt.id}
                                  className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAFAF8] border border-[#E8E0D8]/80 text-xs font-bold text-slate-800"
                                >
                                  <span>{opt.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#9C9590] font-mono">
                                      {opt.price > 0 ? `+Rp ${opt.price.toLocaleString('id-ID')}` : 'GRATIS'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => onToggleOptionAvailable(group.id, opt.id, !opt.isAvailable)}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                        opt.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                      }`}
                                    >
                                      {opt.isAvailable ? 'Aktif' : 'Nonaktif'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Add Option Form */}
                            <div className="pt-2 flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="+ Tambah Opsi Isian Baru"
                                value={newOptionNames[group.id] || ''}
                                onChange={(e) => setNewOptionNames({ ...newOptionNames, [group.id]: e.target.value })}
                                className="flex-1 bg-[#FAFAF8] border border-[#E8E0D8] rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-medium"
                              />
                              <input
                                type="number"
                                placeholder="Harga (+Rp)"
                                value={newOptionPrices[group.id] || ''}
                                onChange={(e) => setNewOptionPrices({ ...newOptionPrices, [group.id]: Number(e.target.value) })}
                                className="w-28 bg-[#FAFAF8] border border-[#E8E0D8] rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-medium"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddOptionToGroup(group)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
                              >
                                Tambah
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. KEUANGAN (Matching Image 7) */}
            {activeTab === 'FINANCE' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#1A1714]">Keuangan</h2>
                  <p className="text-xs text-[#9C9590] font-medium">Pajak, service charge, dan metode pembulatan.</p>
                </div>

                <div className="space-y-4">
                  {/* Pajak Tax */}
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAF8]/80 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#1A1714]">Pajak (Tax)</p>
                      <p className="text-xs text-[#9C9590] font-medium">Persentase pajak yang dibebankan ke pelanggan.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-2xl px-3 py-1.5">
                        <input
                          type="number"
                          value={formProfile.taxRatePercent}
                          onChange={(e) => setFormProfile({ ...formProfile, taxRatePercent: Number(e.target.value) })}
                          className="w-12 text-center font-bold text-sm text-[#1A1714] outline-none"
                        />
                        <span className="font-semibold text-[#9C9590]">%</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setFormProfile({ ...formProfile, isTaxEnabled: !formProfile.isTaxEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                          formProfile.isTaxEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formProfile.isTaxEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Service Charge */}
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAF8]/80 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#1A1714]">Service Charge</p>
                      <p className="text-xs text-[#9C9590] font-medium">Biaya layanan tambahan (opsional).</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-2xl px-3 py-1.5">
                        <input
                          type="number"
                          value={formProfile.serviceChargePercent}
                          onChange={(e) => setFormProfile({ ...formProfile, serviceChargePercent: Number(e.target.value) })}
                          className="w-12 text-center font-bold text-sm text-[#1A1714] outline-none"
                        />
                        <span className="font-semibold text-[#9C9590]">%</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setFormProfile({ ...formProfile, isServiceChargeEnabled: !formProfile.isServiceChargeEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                          formProfile.isServiceChargeEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formProfile.isServiceChargeEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Diskon Manual */}
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAF8]/80 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#1A1714]">Diskon Manual</p>
                      <p className="text-xs text-[#9C9590] font-medium">Aktifkan fitur diskon per transaksi di POS.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-emerald-600">AKTIF</span>
                      <button
                        type="button"
                        onClick={() => setFormProfile({ ...formProfile, isManualDiscountEnabled: !formProfile.isManualDiscountEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                          formProfile.isManualDiscountEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formProfile.isManualDiscountEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Pembulatan Harga */}
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAF8]/80 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#1A1714]">Pembulatan Harga</p>
                      <p className="text-xs text-[#9C9590] font-medium">Bulatkan total ke nominal terdekat.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={formProfile.roundingMode || 'TERDEKAT'}
                        onChange={(e) => setFormProfile({ ...formProfile, roundingMode: e.target.value as 'TERDEKAT' | 'KEATAS' | 'KEBAWAH' })}
                        className="bg-white border border-slate-300 rounded-2xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value="TERDEKAT">Terdekat</option>
                        <option value="KEATAS">Ke Atas</option>
                        <option value="KEBAWAH">Ke Bawah</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setFormProfile({ ...formProfile, isRoundingEnabled: !formProfile.isRoundingEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                          formProfile.isRoundingEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formProfile.isRoundingEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. HAK AKSES */}
            {activeTab === 'ACCESS' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#1A1714]">Hak Akses & Role</h2>
                  <p className="text-xs text-[#9C9590] font-medium">Matriks ini langsung menentukan menu dan halaman awal setelah PIN petugas dikenali.</p>
                </div>

                <div className="border border-[#E8E0D8] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs font-bold text-slate-800">
                    <thead className="bg-slate-100 text-[#9C9590] uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3.5">ROLE / JABATAN</th>
                        <th className="p-3.5 text-center">POS KASIR</th>
                        <th className="p-3.5 text-center">KDS DAPUR</th>
                        <th className="p-3.5 text-center">SHIFT & CASH</th>
                        <th className="p-3.5 text-center">STOK / RAW</th>
                        <th className="p-3.5 text-center">LAPORAN</th>
                        <th className="p-3.5 text-center">SETTINGS</th>
                        <th className="p-3.5 text-center">VOID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {accessControl.map((rule) => (
                        <tr key={rule.role} className="hover:bg-[#FAFAF8]/80">
                          <td className="p-3.5 font-bold text-[#1A1714]">{rule.role}</td>
                          {([
                            'canAccessPOS',
                            'canAccessKDS',
                            'canAccessShift',
                            'canAccessInventory',
                            'canAccessAnalytics',
                            'canAccessSettings',
                            'canVoidOrder'
                          ] as const).map((permission) => (
                            <td key={permission} className="p-3.5 text-center">
                              <input
                                type="checkbox"
                                aria-label={`${rule.role} ${permission}`}
                                checked={rule[permission]}
                                onChange={(event) => {
                                  const updated = accessControl.map((item) =>
                                    item.role === rule.role ? { ...item, [permission]: event.target.checked } : item
                                  );
                                  onSaveAccessControl(updated);
                                }}
                                className="h-4 w-4 cursor-pointer rounded accent-[#F05A1F]"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 8. DATABASE & RESET (Matching Image 8) */}
            {activeTab === 'DATABASE' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#1A1714]">Database & Reset</h2>
                  <p className="text-xs text-[#9C9590] font-medium">Zona berbahaya. Hapus data atau reset aplikasi.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-amber-200 rounded-2xl p-5 bg-amber-50/40 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#1A1714]">Hapus Transaksi</h3>
                        <p className="text-[11px] text-[#9C9590] font-medium">Hapus data order & laporan. Produk aman.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Yakin ingin menghapus seluruh riwayat transaksi? Data menu tidak akan terhapus.')) {
                          if (onClearTransactions) onClearTransactions();
                          alert('Riwayat transaksi telah dibersihkan.');
                        }
                      }}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      Bersihkan Transaksi
                    </button>
                  </div>

                  <div className="border border-rose-200 rounded-2xl p-5 bg-rose-50/40 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-rose-900">Factory Reset</h3>
                        <p className="text-[11px] text-rose-600 font-medium">Hapus SEMUA data & kembali ke awal.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('PERINGATAN! Seluruh data transaksi, menu, dan akun akan di-reset ke bawaan pabrik.')) {
                          if (onFactoryReset) onFactoryReset();
                          alert('Aplikasi telah di-reset ke data awal.');
                        }
                      }}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                    >
                      Factory Reset Total
                    </button>
                  </div>
                </div>

                {/* Architecture Blueprint Info Box */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-3 mt-6 border border-slate-800">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>RANCANGAN ARSITEKTUR KOSTUMISASI FREE TIER (VERCEL, SUPABASE & CLOUDINARY)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Sistem ini terintegrasi secara modular untuk berjalan di atas kuota <strong>Free Tier</strong> tanpa biaya langganan berlebih:
                  </p>
                  <ul className="text-xs text-[#B8B0A8] space-y-1.5 list-disc pl-5 font-medium">
                    <li><strong>Vercel Edge Deployment:</strong> Hosting SPA React & PWA Service Worker tanpa server overhead.</li>
                    <li><strong>Supabase Realtime Postgres:</strong> Menggunakan WebSocket Channels (<code className="text-indigo-300">postgres_changes</code>) untuk sinkronisasi KDS & status order QR customer secara instant tanpa beban polling berulang.</li>
                    <li><strong>Cloudinary CDN:</strong> Penyimpanan foto menu, bukti selfie absensi karyawan, dan wallpaper background dengan kompresi otomatis WebP.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal New Condiment Group */}
      {newGroupModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[#E8E0D8] w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-[#1A1714] mb-4">Tambah Grup Topping / Isian</h3>
            <form onSubmit={handleCreateNewGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#6B6560] mb-1">Nama Grup (Contoh: Extra Sambal)</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B6560] mb-1">Mode Pilihan</label>
                <select
                  value={newGroupMode}
                  onChange={(e) => setNewGroupMode(e.target.value as 'ADD_ON' | 'PAKET')}
                  className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="ADD_ON">ADD_ON (Bisa pilih beberapa)</option>
                  <option value="PAKET">PAKET (Pilih salah satu)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B6560] mb-1">Target Kategori Menu</label>
                <select
                  value={newGroupCategory}
                  onChange={(e) => setNewGroupCategory(e.target.value as CategoryType)}
                  className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="ALL">Semua Kategori (ALL)</option>
                  <option value="BAKSO">Bakso</option>
                  <option value="MIE AYAM">Mie Ayam</option>
                  <option value="MINUMAN">Minuman</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setNewGroupModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#6B6560] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
                >
                  Simpan Grup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
