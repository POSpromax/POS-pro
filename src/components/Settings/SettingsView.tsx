import React, { useEffect, useState } from 'react';
import {
  Settings,
  Store,
  Smartphone,
  Volume2,
  Users,
  Layers,
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
  Edit2,
  X,
  Info,
  ExternalLink,
  Play,
  Camera,
  Compass,
  FileText,
  LogIn,
  Key
} from 'lucide-react';
import {
  RestaurantProfile,
  CondimentGroup,
  CondimentOption,
  CategoryType,
  UserAccount,
  UserRole,
  Branch,
  AccessControlRule,
  RestaurantTable,
  MenuItem
} from '../../types/pos';
import { INITIAL_CONDIMENT_GROUPS } from '../../data/initialData';
import { CustomerTableManagementModal } from '../SelfOrder/CustomerTableManagementModal';
import { playNewOrderSound } from '../../utils/audioNotification';

interface SettingsViewProps {
  profile: RestaurantProfile;
  onSaveProfile: (profile: RestaurantProfile) => void;
  condimentGroups: CondimentGroup[];
  menuItems: MenuItem[];
  onSaveCondimentGroup: (group: CondimentGroup) => void;
  onToggleGroupActive: (groupId: string, isActive: boolean) => void;
  onToggleOptionAvailable: (groupId: string, optionId: string, isAvailable: boolean) => void;
  onClearTransactions?: () => void;
  onFactoryReset?: () => void;
  staffAccounts: UserAccount[];
  branches: Branch[];
  currentBranch: Branch;
  onSaveStaff: (staff: UserAccount) => void | Promise<void>;
  onDeleteStaff?: (id: string) => void | Promise<void>;
  accessControl: AccessControlRule[];
  onSaveAccessControl: (rules: AccessControlRule[]) => void | Promise<void>;
  tables?: RestaurantTable[];
  onToggleTableSelfOrder?: (tableId: string, enabled: boolean) => void;
  onToggleAllTables?: (enabled: boolean) => void;
  isSelfOrderSystemEnabled?: boolean;
  onToggleSystemSelfOrder?: (enabled: boolean) => void;
  onShowToast?: (title: string, message: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onSaveProfile,
  condimentGroups,
  menuItems,
  onSaveCondimentGroup,
  onToggleGroupActive,
  onToggleOptionAvailable,
  onClearTransactions,
  onFactoryReset,
  staffAccounts,
  branches,
  currentBranch,
  onSaveStaff,
  onDeleteStaff,
  accessControl,
  onSaveAccessControl,
  tables = [],
  onToggleTableSelfOrder = () => {},
  onToggleAllTables = () => {},
  isSelfOrderSystemEnabled = true,
  onToggleSystemSelfOrder = (_enabled: boolean) => {},
  onShowToast
}) => {
  const toast = (title: string, message: string) => {
    if (onShowToast) onShowToast(title, message);
  };
  const [activeTab, setActiveTab] = useState<
    'PROFILE' | 'LANDING' | 'KDS' | 'STAFF' | 'CONDIMENTS' | 'FINANCE' | 'ACCESS' | 'DATABASE'
  >('PROFILE');

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionValue, setEditingOptionValue] = useState('');

  const [formProfile, setFormProfile] = useState<RestaurantProfile>(() => ({ ...profile }));
  const [isSavedAlert, setIsSavedAlert] = useState<boolean>(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState<boolean>(false);

  // Staff & PIN Management State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('KASIR');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffShift, setNewStaffShift] = useState('08:00');
  const [newStaffShiftEnd, setNewStaffShiftEnd] = useState('16:00');
  const [newStaffBranchId, setNewStaffBranchId] = useState(currentBranch.id);

  // Edit Staff Modal State
  const [editingStaff, setEditingStaff] = useState<UserAccount | null>(null);
  const [accessDraft, setAccessDraft] = useState<AccessControlRule[]>(accessControl);
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  useEffect(() => {
    setNewStaffBranchId(currentBranch.id);
  }, [currentBranch.id]);

  useEffect(() => {
    setAccessDraft(accessControl);
  }, [accessControl]);

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
  const [showCondimentTips, setShowCondimentTips] = useState<boolean>(false);

  const handleSaveAll = (_e?: any) => {
    onSaveProfile(formProfile);
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 2500);
  };

  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setFormProfile((prev) => ({
            ...prev,
            gpsLatitude: lat,
            gpsLongitude: lng
          }));
          const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
          window.open(mapsUrl, '_blank');
          toast('GPS Terdeteksi', `Latitude: ${lat.toFixed(6)}, Longitude: ${lng.toFixed(6)}. Google Maps dibuka untuk verifikasi.`);
        },
        (err) => {
          toast('GPS Gagal', 'Gagal mengambil lokasi GPS: ' + err.message);
        }
      );
    } else {
      toast('GPS Tidak Didukung', 'Browser Anda tidak mendukung fitur Geolocation GPS.');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !/^\d{6}$/.test(newStaffPin)) {
      toast('Data Tidak Lengkap', 'Isi nama dan PIN unik 6 digit untuk staff.');
      return;
    }
    if (staffAccounts.some((staff) => staff.pin && (staff.pin === newStaffPin || staff.pin.startsWith(newStaffPin) || newStaffPin.startsWith(staff.pin)))) {
      toast('PIN Konflik', 'PIN sama atau terlalu mirip dengan akun lain. Gunakan kombinasi yang benar-benar berbeda.');
      return;
    }

    const created: UserAccount = {
      id: 'usr-' + Date.now(),
      name: newStaffName.trim(),
      pin: newStaffPin.trim(),
      role: newStaffRole,
      branchIds: [newStaffBranchId],
      isActive: true,
      shiftStart: newStaffShift,
      shiftEnd: newStaffShiftEnd,
      workDays: [1, 2, 3, 4, 5, 6]
    };

    try {
      await onSaveStaff(created);
      setNewStaffName('');
      setNewStaffPin('');
    } catch {
      // Parent callback displays the server error and keeps this form intact.
    }
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
    playNewOrderSound();
    toast('Test Suara', `Memainkan chime: ${soundName}`);
  };

  return (
    <div className="flex-1 bg-[#FAFAFA] p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between text-slate-900">
      <div>
        {/* Main Header Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-tr from-[#EA580C] to-[#F97316] rounded-2xl flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#1A1714] tracking-tight">Pengaturan Operasional</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">CONTROL CENTER TOKO</p>
            </div>
          </div>

          {isSavedAlert && (
            <div className="bg-emerald-600 text-white px-4 py-2 rounded-full text-xs font-black flex items-center gap-2 shadow-lg animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              <span>Perubahan Berhasil Disimpan!</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Navigation Sidebar */}
          <div className="space-y-5">
            {/* UMUM */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">UMUM</p>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('PROFILE')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'PROFILE'
                      ? 'bg-white border-[#EA580C] ring-2 ring-orange-500/20 text-[#C2410C] shadow-2xs font-black'
                      : 'bg-white/80 border-[#EAE3DB] text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'PROFILE' ? 'bg-gradient-to-tr from-[#EA580C] to-[#F97316] text-white shadow-xs' : 'bg-slate-200 text-slate-700'}`}>
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#1A1714]">Profil & Brand</p>
                    <p className="text-[10px] text-slate-500 font-bold">Identitas, Logo, Sosmed</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('LANDING')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'LANDING'
                      ? 'bg-white border-[#EA580C] ring-2 ring-orange-500/20 text-[#C2410C] shadow-2xs font-black'
                      : 'bg-white/80 border-[#EAE3DB] text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'LANDING' ? 'bg-gradient-to-tr from-[#EA580C] to-[#F97316] text-white shadow-xs' : 'bg-slate-200 text-slate-700'}`}>
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#1A1714]">Landing Self-Order</p>
                    <p className="text-[10px] text-slate-500 font-bold">Tampilan App Pelanggan</p>
                  </div>
                </button>
              </div>
            </div>

            {/* OPERASIONAL */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">OPERASIONAL</p>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('KDS')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'KDS'
                      ? 'bg-white border-[#EA580C] ring-2 ring-orange-500/20 text-[#C2410C] shadow-2xs font-black'
                      : 'bg-white/80 border-[#EAE3DB] text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'KDS' ? 'bg-gradient-to-tr from-[#EA580C] to-[#F97316] text-white shadow-xs' : 'bg-slate-200 text-slate-700'}`}>
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#1A1714]">Dapur & KDS</p>
                    <p className="text-[10px] text-slate-500 font-bold">Timer, Alarm, Running Text</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('STAFF')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'STAFF'
                      ? 'bg-white border-[#EA580C] ring-2 ring-orange-500/20 text-[#C2410C] shadow-2xs font-black'
                      : 'bg-white/80 border-[#EAE3DB] text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'STAFF' ? 'bg-gradient-to-tr from-[#EA580C] to-[#F97316] text-white shadow-xs' : 'bg-slate-200 text-slate-700'}`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#1A1714]">Karyawan & Shift</p>
                    <p className="text-[10px] text-slate-500 font-bold">Absensi, GPS, Shift Staff</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('CONDIMENTS')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'CONDIMENTS'
                      ? 'bg-white border-[#EA580C] ring-2 ring-orange-500/20 text-[#C2410C] shadow-2xs font-black'
                      : 'bg-white/80 border-[#EAE3DB] text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'CONDIMENTS' ? 'bg-gradient-to-tr from-[#EA580C] to-[#F97316] text-white shadow-xs' : 'bg-slate-200 text-slate-700'}`}>
                    <Grid className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#1A1714]">Daftar Isian / Topping</p>
                    <p className="text-[10px] text-slate-500 font-bold">Opsi Kuah, Isian, Paket</p>
                  </div>
                </button>
              </div>
            </div>

            {/* SYSTEM */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">SYSTEM</p>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('FINANCE')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'FINANCE'
                      ? 'bg-white border-[#EA580C] ring-2 ring-orange-500/20 text-[#C2410C] shadow-2xs font-black'
                      : 'bg-white/80 border-[#EAE3DB] text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'FINANCE' ? 'bg-gradient-to-tr from-[#EA580C] to-[#F97316] text-white shadow-xs' : 'bg-slate-200 text-slate-700'}`}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#1A1714]">Keuangan & Pajak</p>
                    <p className="text-[10px] text-slate-500 font-bold">Pajak, Service, Diskon</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('ACCESS')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'ACCESS'
                      ? 'bg-white border-[#EA580C] ring-2 ring-orange-500/20 text-[#C2410C] shadow-2xs font-black'
                      : 'bg-white/80 border-[#EAE3DB] text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'ACCESS' ? 'bg-gradient-to-tr from-[#EA580C] to-[#F97316] text-white shadow-xs' : 'bg-slate-200 text-slate-700'}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#1A1714]">Hak Akses</p>
                    <p className="text-[10px] text-slate-500 font-bold">Role & Permissions</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('DATABASE')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'DATABASE'
                      ? 'bg-white border-[#EA580C] ring-2 ring-orange-500/20 text-[#C2410C] shadow-2xs font-black'
                      : 'bg-white/80 border-[#EAE3DB] text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'DATABASE' ? 'bg-gradient-to-tr from-[#EA580C] to-[#F97316] text-white shadow-xs' : 'bg-slate-200 text-slate-700'}`}>
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#1A1714]">Database & Reset</p>
                    <p className="text-[10px] text-slate-500 font-bold">Reset & Maintenance</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Bottom Save Changes Button */}
            <button
              type="button"
              onClick={handleSaveAll}
              className="w-full py-3.5 bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 text-white rounded-full font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer mt-4"
            >
              <Save className="w-4 h-4" />
              <span>SIMPAN PERUBAHAN</span>
            </button>
          </div>

          {/* Right Main Form Content Panel */}
          <div className="lg:col-span-3 bg-white border border-[#EAE3DB] rounded-2xl p-6 shadow-2xs min-h-[600px]">
            {/* 1. PROFIL & BRAND (Matching Image 1) */}
            {activeTab === 'PROFILE' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#1A1714]">Profil & Brand</h2>
                  <p className="text-xs text-[#9C9590] font-medium">Informasi dasar yang tampil di struk dan aplikasi.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {/* Logo Preview */}
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#E8E0D8] rounded-2xl p-4 bg-[#FAFAFA]">
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
                      className="w-full bg-white border border-[#E8E0D8] rounded-xl px-3 py-1.5 text-[11px] text-[#6B6560] outline-none focus:border-[#EA580C] font-medium"
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
                        className="w-full bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl px-4 py-3 text-sm font-bold text-[#1A1714] outline-none focus:border-[#EA580C] transition-all"
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
                        className="w-full bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C] transition-all"
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
                        className="w-full bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C] transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Social Media & Contact (Matching Image 1) */}
                <div className="border-t border-[#F0E8E0] pt-6">
                  <h3 className="text-xs font-bold text-[#1A1714] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#C2410C]" />
                    <span>KONTAK & SOSMED</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">WHATSAPP</label>
                      <input
                        type="text"
                        value={formProfile.phone}
                        onChange={(e) => setFormProfile({ ...formProfile, phone: e.target.value })}
                        className="w-full bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">INSTAGRAM</label>
                      <input
                        type="text"
                        value={formProfile.instagram}
                        onChange={(e) => setFormProfile({ ...formProfile, instagram: e.target.value })}
                        className="w-full bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#B8B0A8] uppercase mb-1">TIKTOK</label>
                      <input
                        type="text"
                        value={formProfile.tiktok}
                        onChange={(e) => setFormProfile({ ...formProfile, tiktok: e.target.value })}
                        className="w-full bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
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
                <div className="bg-[#EA580C] rounded-2xl p-6 text-white shadow-lg space-y-4">
                  <p className="text-[10px] font-bold text-orange-300 uppercase tracking-widest flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" /> BANNER PROMO UTAMA
                  </p>

                  <div>
                    <label className="block text-[10px] font-bold text-orange-300 uppercase mb-1">JUDUL PROMO</label>
                    <input
                      type="text"
                      value={formProfile.promoBannerTitle || ''}
                      onChange={(e) => setFormProfile({ ...formProfile, promoBannerTitle: e.target.value })}
                      className="w-full bg-white text-[#1A1714] font-bold text-sm rounded-2xl px-4 py-3 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-orange-300 uppercase mb-1">DESKRIPSI</label>
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
                      className="w-full bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div className="space-y-4 bg-[#FAFAFA] border border-[#E8E0D8] rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-[#1A1714] uppercase flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#C2410C]" /> LINK REVIEW GOOGLE
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
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA] space-y-4">
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
                  <div className="md:col-span-2 border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA] space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#E8E0D8]">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-5 h-5 text-[#C2410C]" />
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
                          formProfile.soundNotificationsEnabled ? 'bg-[#EA580C]' : 'bg-slate-300'
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
                            className="text-[10px] text-[#C2410C] font-bold flex items-center gap-1 hover:underline cursor-pointer"
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
                            className="text-[10px] text-[#C2410C] font-bold flex items-center gap-1 hover:underline cursor-pointer"
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
                            className="text-[10px] text-[#C2410C] font-bold flex items-center gap-1 hover:underline cursor-pointer"
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
                            className="text-[10px] text-[#C2410C] font-bold flex items-center gap-1 hover:underline cursor-pointer"
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
                <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA] space-y-2">
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(`/attendance?branch=${encodeURIComponent(currentBranch.id)}`, '_blank', 'noopener,noreferrer')}
                      className="flex items-center gap-1.5 rounded-xl border border-[#E2E2E2] bg-white px-3 py-2 text-[10px] font-bold text-[#1A1714] hover:bg-[#F5F5F5]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Buka Terminal
                    </button>
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
                </div>

                {/* Jadwal Shift & Toleransi Card (Matching Image 5) */}
                <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA]/80 space-y-4">
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
                <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA]/80 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Compass className="w-4 h-4 text-[#C2410C]" />
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
                          className="w-4 h-4 rounded text-[#C2410C] cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">Wajib GPS Aktif</span>
                        <input
                          type="checkbox"
                          checked={formProfile.requireGpsActive ?? true}
                          onChange={(e) => setFormProfile({ ...formProfile, requireGpsActive: e.target.checked })}
                          className="w-4 h-4 rounded text-[#C2410C] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      className="text-xs font-black text-[#C2410C] hover:text-orange-700 bg-orange-50 border border-orange-200 px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                    >
                      <MapPin className="w-4 h-4 text-[#C2410C]" />
                      <span>📍 Ambil Lokasi & Buka Google Maps</span>
                    </button>

                    <a
                      href={`https://www.google.com/maps?q=${formProfile.gpsLatitude || -6.609013171412514},${formProfile.gpsLongitude || 106.78293233420759}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-black text-slate-700 hover:text-slate-900 bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                    >
                      <ExternalLink className="w-4 h-4 text-slate-500" />
                      <span>🗺️ Lihat Titik di Google Maps</span>
                    </a>
                  </div>
                </div>

                {/* Jadwal Libur Rutin Harian / Mingguan */}
                <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA]/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                      <Clock className="w-4 h-4 text-[#C2410C]" />
                      <span>JADWAL LIBUR RUTIN HARIAN (OUTLET & STAFF)</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 font-semibold">
                    Tentukan hari libur rutin operasional outlet. Jika staf melakukan absensi pada hari libur, absensi akan dicatat sebagai Lembur / Ekstra Shift.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      { day: 1, label: 'Senin' },
                      { day: 2, label: 'Selasa' },
                      { day: 3, label: 'Rabu' },
                      { day: 4, label: 'Kamis' },
                      { day: 5, label: 'Jumat' },
                      { day: 6, label: 'Sabtu' },
                      { day: 0, label: 'Minggu' }
                    ].map((d) => {
                      const isOff = (formProfile.weeklyOffDays || [0]).includes(d.day);
                      return (
                        <button
                          key={d.day}
                          type="button"
                          onClick={() => {
                            const current = formProfile.weeklyOffDays || [0];
                            const updated = isOff ? current.filter((x) => x !== d.day) : [...current, d.day];
                            setFormProfile({ ...formProfile, weeklyOffDays: updated });
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            isOff
                              ? 'bg-rose-600 text-white shadow-md'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{d.label}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${isOff ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {isOff ? 'LIBUR' : 'KERJA'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Daftar Staff & PIN (Matching Image 6) */}
                <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA]/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Users className="w-4 h-4 text-[#C2410C]" />
                      <span>DAFTAR STAFF & PIN</span>
                    </div>

                    <span className="rounded-full border border-[#E2E2E2] bg-white px-3 py-1.5 text-[10px] font-black text-[#5A5A5A]">
                      {staffAccounts.length} akun terdaftar
                    </span>
                  </div>

                  {/* Form Tambah Staff */}
                  <form onSubmit={handleAddStaff} className="bg-[#FFF7F3] border border-[#F1C7B5] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <span className="block text-[10px] font-semibold text-[#C2410C] uppercase mb-1">NAMA STAFF</span>
                      <input
                        type="text"
                        placeholder="Nama Lengkap"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-xs font-bold text-[#1A1714]"
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
                      <span className="block text-[10px] font-semibold text-[#C2410C] uppercase mb-1">ROLE</span>
                      <select
                        value={newStaffRole}
                        onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-xs font-bold text-[#1A1714]"
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
                      <span className="block text-[10px] font-semibold text-[#C2410C] uppercase mb-1">PIN (6 ANGKA)</span>
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="Masukkan 6 digit"
                        value={newStaffPin}
                        onChange={(e) => setNewStaffPin(e.target.value)}
                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A1714] tracking-widest"
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-[#EA580C] hover:bg-[#C2410C] text-white p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Tambah Staff
                    </button>
                  </form>

                  {/* Staff List Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {staffAccounts.map((stf) => (
                      <div key={stf.id} className="bg-white border border-[#E8E0D8] rounded-2xl p-3.5 shadow-xs space-y-3 relative">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            {stf.avatar ? (
                              <img src={stf.avatar} alt={stf.name} className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-xs font-black text-orange-700">
                                {stf.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-black text-[#1A1714] truncate">{stf.name}</p>
                                <span className="px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-[#C2410C] font-mono text-[9px] font-bold">
                                  {stf.role}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-bold">{stf.shiftStart || '-'} – {stf.shiftEnd || '-'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingStaff({ ...stf })}
                              className="p-1.5 text-[#C2410C] hover:bg-orange-100 rounded-lg cursor-pointer transition-colors"
                              title="Edit Detail Staff & PIN"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirmingDeleteId === stf.id) {
                                  if (onDeleteStaff) void Promise.resolve(onDeleteStaff(stf.id)).catch(() => undefined);
                                  setConfirmingDeleteId(null);
                                } else {
                                  setConfirmingDeleteId(stf.id);
                                  setTimeout(() => setConfirmingDeleteId(null), 3000);
                                }
                              }}
                              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                                confirmingDeleteId === stf.id ? 'bg-rose-600 text-white' : 'text-rose-500 hover:bg-rose-50'
                              }`}
                              title={confirmingDeleteId === stf.id ? 'Klik lagi untuk hapus' : 'Hapus Staff'}
                            >
                              {confirmingDeleteId === stf.id ? <Check className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => void Promise.resolve(onSaveStaff({ ...stf, isActive: stf.isActive === false })).catch(() => undefined)}
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase cursor-pointer ${stf.isActive === false ? 'border-slate-300 text-slate-500 bg-slate-100' : 'border-emerald-200 text-emerald-700 bg-emerald-50'}`}
                            >
                              {stf.isActive === false ? 'Nonaktif' : 'Aktif'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] font-bold text-slate-500">
                          <div className="rounded-xl bg-[#F7F7F6] px-3 py-2">Shift: {stf.shiftStart || '-'}–{stf.shiftEnd || '-'}</div>
                          <div className="rounded-xl bg-[#F7F7F6] px-3 py-2">PIN: ••••••</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 5. DAFTAR ISIAN / TOPPING (Matching Screenshots 4 & 5) */}
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
                      onClick={() => setShowCondimentTips(true)}
                      className="bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#C2410C] font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Info className="w-4 h-4 text-[#C2410C]" />
                      <span>& Tips</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const defaultGroup: CondimentGroup = {
                          id: 'cg-preset-' + Date.now(),
                          name: 'Pilihan Kuah',
                          mode: 'PAKET',
                          isRequired: true,
                          targetCategory: 'BAKSO',
                          isActive: true,
                          options: [
                            { id: 'opt-1', name: 'Original', price: 0, isAvailable: true },
                            { id: 'opt-2', name: 'Kuah Mercon Pedas', price: 2000, isAvailable: true }
                          ]
                        };
                        onSaveCondimentGroup(defaultGroup);
                        toast('Preset Ditambahkan', 'Preset grup kuah standar berhasil ditambahkan!');
                      }}
                      className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Standar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewGroupModalOpen(true)}
                      className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Grup</span>
                    </button>
                  </div>
                </div>

                {/* List of Condiment Groups Accordion (Matching Screenshot 5) */}
                <div className="space-y-4">
                  {condimentGroups.map((group) => {
                    const isExpanded = expandedGroupIds.includes(group.id);
                    const selectedCategories = group.targetCategories || (group.targetCategory ? [group.targetCategory] : []);
                    const selectedProductIds = group.targetProductIds || [];
                    const selectedProductNames = group.targetProductNames || [];
                    const targetCount = selectedCategories.length + selectedProductIds.length + selectedProductNames.length;
                    return (
                      <div key={group.id} className="border border-[#E8E0D8] rounded-3xl overflow-hidden bg-white shadow-xs">
                        {/* Group Header */}
                        <div
                          onClick={() => toggleAccordion(group.id)}
                          className="p-4 flex items-center justify-between bg-[#FAFAFA]/80 hover:bg-slate-100/80 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-3.5 h-3.5 rounded-full bg-orange-500 shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black text-[#1A1714]">{group.name}</h3>
                                <span className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                                  MODE {group.mode}
                                </span>
                                <span className="text-xs text-slate-400 font-bold">• {group.options.length} Opsi</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                              <span>🏷️</span>
                              <span>{targetCount} Target</span>
                            </span>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                          </div>
                        </div>

                        {/* Group Options Content matching Screenshot 5 */}
                        {isExpanded && (
                          <div className="p-5 border-t border-[#F0E8E0] bg-white space-y-5 font-sans">
                            {/* Form Fields Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">NAMA GRUP</label>
                                <input
                                  type="text"
                                  value={group.name}
                                  onChange={(e) => onSaveCondimentGroup({ ...group, name: e.target.value })}
                                  className="w-full bg-[#F5F5F4] border border-[#E7E5E4] rounded-2xl p-2.5 text-xs font-black text-slate-900 outline-none focus:border-[#FF5A1F] focus:bg-white"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">TIPE PILIHAN</label>
                                <div className="flex items-center gap-2 bg-[#F6EFE7] p-1 rounded-2xl border border-[#EAE3DB]">
                                  <button
                                    type="button"
                                    onClick={() => onSaveCondimentGroup({ ...group, mode: 'PAKET' })}
                                    className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${group.mode === 'PAKET' ? 'bg-[#191817] text-white shadow-2xs' : 'text-slate-500'}`}
                                  >
                                    Pilih 1 (Wajib)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onSaveCondimentGroup({ ...group, mode: 'ADD_ON' })}
                                    className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${group.mode === 'ADD_ON' ? 'bg-[#191817] text-white shadow-2xs' : 'text-slate-500'}`}
                                  >
                                    Pilih Banyak (Opsi)
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Mode Pilihan & Berlaku Untuk */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">MODE PILIHAN</label>
                                <div className="flex items-center gap-2 bg-[#F6EFE7] p-1 rounded-2xl border border-[#EAE3DB]">
                                  <button
                                    type="button"
                                    onClick={() => onSaveCondimentGroup({ ...group, isRequired: true })}
                                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${group.isRequired !== false ? 'bg-[#FF5A1F] text-white shadow-md shadow-orange-500/20' : 'text-slate-500'}`}
                                  >
                                    Wajib Pilih (Harus Ada)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onSaveCondimentGroup({ ...group, isRequired: false })}
                                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${group.isRequired === false ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                                  >
                                    Opsional (Boleh Kosong)
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">TARGET KATEGORI (BISA LEBIH DARI 1)</label>
                                <div className="flex min-h-11 flex-wrap gap-1.5 rounded-2xl border border-[#E7E5E4] bg-[#F5F5F4] p-1.5">
                                  {(['ALL', 'BAKSO', 'MIE AYAM', 'MAKANAN', 'TAMBAHAN', 'KRIUK', 'MINUMAN', 'BUNDLING'] as CategoryType[]).map((category) => {
                                    const selected = selectedCategories.includes(category);
                                    return (
                                      <button
                                        key={category}
                                        type="button"
                                        onClick={() => {
                                          const next = category === 'ALL'
                                            ? (selected ? [] : ['ALL'] as CategoryType[])
                                            : selected
                                              ? selectedCategories.filter((item) => item !== category)
                                              : [...selectedCategories.filter((item) => item !== 'ALL'), category];
                                          onSaveCondimentGroup({ ...group, targetCategory: undefined, targetCategories: next });
                                        }}
                                        className={`rounded-xl px-2.5 py-1.5 text-[10px] font-black transition-colors ${selected ? 'bg-[#191817] text-white' : 'bg-white text-slate-500 hover:text-[#C2410C]'}`}
                                      >
                                        {category === 'ALL' ? 'SEMUA' : category}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">LABEL RINGKAS DI DAPUR</label>
                              <input
                                type="text"
                                placeholder="Contoh: CAMPUR (kosongkan untuk tampilkan daftar penuh)"
                                value={group.allSelectedLabel || ''}
                                onChange={(event) => onSaveCondimentGroup({ ...group, allSelectedLabel: event.target.value.toUpperCase() })}
                                className="w-full rounded-2xl border border-[#E7E5E4] bg-[#F5F5F4] p-2.5 text-xs font-black text-slate-900 outline-none focus:border-[#FF5A1F] focus:bg-white"
                              />
                              <p className="mt-1 text-[10px] font-bold text-slate-400">
                                Saat kasir memilih semua opsi grup ini, tiket dapur hanya menampilkan label tersebut.
                              </p>
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">TARGET MENU ITEM (BISA LEBIH DARI 1)</label>
                              <select
                                value=""
                                onChange={(event) => {
                                  const productId = event.target.value;
                                  if (!productId || selectedProductIds.includes(productId)) return;
                                  onSaveCondimentGroup({ ...group, targetProductIds: [...selectedProductIds, productId] });
                                }}
                                className="w-full rounded-2xl border border-[#E7E5E4] bg-[#F5F5F4] p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[#FF5A1F] focus:bg-white"
                              >
                                <option value="">+ Pilih menu item...</option>
                                {menuItems.filter((item) => item.isAvailable && !item.isManualPrice && !selectedProductIds.includes(item.id)).map((item) => (
                                  <option key={item.id} value={item.id}>{item.name} — {item.category}</option>
                                ))}
                              </select>
                              {(selectedProductIds.length > 0 || selectedProductNames.length > 0) && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {selectedProductIds.map((productId) => {
                                    const item = menuItems.find((menu) => menu.id === productId);
                                    return (
                                      <button key={productId} type="button" onClick={() => onSaveCondimentGroup({ ...group, targetProductIds: selectedProductIds.filter((id) => id !== productId) })} className="flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-black text-[#C2410C]">
                                        {item?.name || 'Menu tidak ditemukan'} <X className="h-3 w-3" />
                                      </button>
                                    );
                                  })}
                                  {selectedProductNames.map((productName) => (
                                    <button key={`legacy-${productName}`} type="button" onClick={() => onSaveCondimentGroup({ ...group, targetProductNames: selectedProductNames.filter((name) => name !== productName) })} className="flex items-center gap-1 rounded-full border border-[#DEDAD5] bg-white px-2.5 py-1 text-[10px] font-black text-slate-600">
                                      {productName} <X className="h-3 w-3" />
                                    </button>
                                  ))}
                                </div>
                              )}
                              <p className="mt-1.5 text-[10px] font-semibold text-slate-400">Kategori dan menu item digabungkan. Grup muncul jika salah satu target cocok.</p>
                            </div>

                            {/* Options List Tags */}
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">DAFTAR OPSI / PILIHAN</label>

                              <div className="flex items-center gap-2 mb-3">
                                <input
                                  type="text"
                                  placeholder="Ketik nama pilihan (misal: Bakso Halus)..."
                                  value={newOptionNames[group.id] || ''}
                                  onChange={(e) => setNewOptionNames({ ...newOptionNames, [group.id]: e.target.value })}
                                  className="flex-1 bg-[#F5F5F4] border border-[#E7E5E4] rounded-2xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[#FF5A1F] focus:bg-white"
                                />
                                <input
                                  type="number"
                                  placeholder="Harga (+Rp)"
                                  value={newOptionPrices[group.id] || ''}
                                  onChange={(e) => setNewOptionPrices({ ...newOptionPrices, [group.id]: Number(e.target.value) })}
                                  className="w-28 bg-[#F5F5F4] border border-[#E7E5E4] rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#FF5A1F] focus:bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddOptionToGroup(group)}
                                  className="w-10 h-10 bg-[#191817] hover:bg-black text-white rounded-2xl font-black flex items-center justify-center cursor-pointer shadow-xs"
                                >
                                  <Plus className="w-5 h-5" />
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {group.options.map((opt) => (
                                  <span
                                    key={opt.id}
                                    className={`border rounded-full text-xs font-black flex items-center gap-1.5 transition-all ${
                                      editingOptionId === opt.id
                                        ? 'bg-white border-[#EA580C] px-2 py-0.5 shadow-sm'
                                        : 'bg-slate-100 border-slate-200 px-3 py-1 text-slate-800'
                                    }`}
                                  >
                                    {editingOptionId === opt.id ? (
                                      <>
                                        <input
                                          autoFocus
                                          type="text"
                                          value={editingOptionValue}
                                          onChange={(e) => setEditingOptionValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && editingOptionValue.trim()) {
                                              const updatedOpts = group.options.map((o) =>
                                                o.id === opt.id ? { ...o, name: editingOptionValue.trim() } : o
                                              );
                                              onSaveCondimentGroup({ ...group, options: updatedOpts });
                                              setEditingOptionId(null);
                                            } else if (e.key === 'Escape') {
                                              setEditingOptionId(null);
                                            }
                                          }}
                                          className="w-28 text-xs font-black text-slate-900 outline-none bg-transparent border-b border-[#EA580C]"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (editingOptionValue.trim()) {
                                              const updatedOpts = group.options.map((o) =>
                                                o.id === opt.id ? { ...o, name: editingOptionValue.trim() } : o
                                              );
                                              onSaveCondimentGroup({ ...group, options: updatedOpts });
                                            }
                                            setEditingOptionId(null);
                                          }}
                                          className="text-[#C2410C] hover:text-[#C2410C] cursor-pointer"
                                          title="Simpan nama"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingOptionId(null)}
                                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                          title="Batal"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingOptionId(opt.id);
                                            setEditingOptionValue(opt.name);
                                          }}
                                          className="flex items-center gap-1 hover:text-[#C2410C] cursor-pointer transition-colors"
                                          title="Klik untuk edit nama"
                                        >
                                          <span>{opt.name.toUpperCase()}</span>
                                          <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                                        </button>
                                        {opt.price > 0 && <span className="text-[#C2410C] font-mono">+Rp{opt.price.toLocaleString('id-ID')}</span>}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedOpts = group.options.filter((o) => o.id !== opt.id);
                                            onSaveCondimentGroup({ ...group, options: updatedOpts });
                                          }}
                                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                          title="Hapus opsi"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Bottom Delete Group Action */}
                            <div className="pt-3 border-t border-slate-100 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirmingDeleteId === group.id) {
                                    onSaveCondimentGroup({ ...group, isActive: false });
                                    setConfirmingDeleteId(null);
                                  } else {
                                    setConfirmingDeleteId(group.id);
                                    setTimeout(() => setConfirmingDeleteId(null), 3000);
                                  }
                                }}
                                className={`px-4 py-2 border font-black text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer transition-colors ${
                                  confirmingDeleteId === group.id
                                    ? 'bg-rose-600 border-rose-700 text-white'
                                    : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600'
                                }`}
                              >
                                <Trash2 className="w-4 h-4" /> {confirmingDeleteId === group.id ? 'Yakin Hapus?' : 'Hapus Grup'}
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
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA]/80 flex items-center justify-between">
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
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA]/80 flex items-center justify-between">
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
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA]/80 flex items-center justify-between">
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

                  {/* Konfirmasi Terminal Kasir */}
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA]/80 space-y-4">
                    <div>
                      <p className="text-sm font-bold text-[#1A1714]">Konfirmasi Terminal Kasir</p>
                      <p className="text-xs text-[#9C9590] font-medium">
                        Minta kasir menekan tombol dua kali sebelum aksi dijalankan. Menahan salah klik, tapi memperlambat saat jam ramai.
                      </p>
                    </div>

                    {([
                      { key: 'confirmBeforeSaveOrder' as const, label: 'Tanya sebelum SIMPAN', hint: 'Tombol berubah jadi "Yakin simpan?" dulu.' },
                      { key: 'confirmBeforePayment' as const, label: 'Tanya sebelum BAYAR', hint: 'Tombol berubah jadi "Yakin bayar?" dulu.' }
                    ]).map(({ key, label, hint }) => {
                      const isOn = formProfile[key] === true;
                      return (
                        <div key={key} className="flex items-center justify-between gap-3 border-t border-[#EFE9E2] pt-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1A1714]">{label}</p>
                            <p className="text-[11px] text-[#9C9590] font-medium">{hint}</p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-xs font-bold ${isOn ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {isOn ? 'AKTIF' : 'NONAKTIF'}
                            </span>
                            <button
                              type="button"
                              aria-pressed={isOn}
                              onClick={() => setFormProfile({ ...formProfile, [key]: !isOn })}
                              className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${isOn ? 'bg-emerald-600' : 'bg-slate-300'}`}
                            >
                              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isOn ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pembulatan Harga */}
                  <div className="border border-[#E8E0D8] rounded-2xl p-5 bg-[#FAFAFA]/80 flex items-center justify-between">
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

            {/* 7. HAK AKSES (Matching Screenshots 2 & 3) */}
            {activeTab === 'ACCESS' && (
              <div className="space-y-6">
                {/* Section 1: Hak Akses & Role Header & Feature Cards Grid */}
                <div className="bg-white rounded-[32px] p-6 border border-slate-200/80 shadow-2xs space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">Hak Akses & Role</h2>
                      <p className="text-xs font-semibold text-slate-500">Kontrol fitur apa saja yang bisa diakses setiap role.</p>
                    </div>
                    <button
                      type="button"
                      disabled={isSavingAccess}
                      onClick={async () => {
                        setIsSavingAccess(true);
                        try {
                          await onSaveAccessControl(accessDraft);
                        } catch {
                          // Parent callback displays the server error; keep the draft for retry.
                        } finally {
                          setIsSavingAccess(false);
                        }
                      }}
                      className="ml-auto rounded-xl bg-[#1A1714] px-4 py-2 text-[10px] font-black uppercase tracking-wide text-white disabled:opacity-50"
                    >
                      {isSavingAccess ? 'Menyimpan…' : 'Simpan Hak Akses'}
                    </button>
                  </div>

                  {/* Grid of 10 Feature Permission Cards matching Screenshot 2 & 3 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
                    {[
                      { key: 'canAccessPOS', label: 'AKSES POS', icon: Smartphone },
                      { key: 'canAccessShift', label: 'AKSES SHIFT', icon: Clock },
                      { key: 'canAccessAttendance', label: 'AKSES ABSENSI', icon: Users },
                      { key: 'canAccessKDS', label: 'AKSES KITCHEN', icon: Volume2 },
                      { key: 'canAccessInventory', label: 'AKSES INVENTORY', icon: Layers },
                      { key: 'canAccessAnalytics', label: 'AKSES LAPORAN', icon: FileText },
                      { key: 'canAccessSettings', label: 'AKSES PENGATURAN', icon: Settings },
                      { key: 'canVoidOrder', label: 'VOID TRANSAKSI', icon: Trash2 },
                      { key: 'canGiveDiscount', label: 'BERI DISKON', icon: CreditCard },
                      { key: 'canOpenDrawer', label: 'BUKA LACI', icon: LogIn }
                    ].map((feature) => (
                      <div key={feature.key} className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#C2410C] flex items-center justify-center shrink-0">
                            <feature.icon className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-black text-slate-800 tracking-wide uppercase truncate">
                            {feature.label}
                          </span>
                        </div>

                        {/* 4 Roles Sub-Labels & Toggles: CAS, KIT, STA, ADM */}
                        <div className="grid grid-cols-4 gap-1 text-center pt-2 border-t border-slate-200/60">
                          {(['KASIR', 'KITCHEN', 'MANAGER', 'ADMIN'] as UserRole[]).map((role) => {
                            const roleAbbr = role === 'KASIR' ? 'CAS' : role === 'KITCHEN' ? 'KIT' : role === 'MANAGER' ? 'STA' : 'ADM';
                            const rule = accessDraft.find((r) => r.role === role);
                            const isChecked = rule ? (rule as any)[feature.key] ?? (role === 'ADMIN' || (role === 'KASIR' && feature.key === 'canAccessPOS')) : role === 'ADMIN';

                            return (
                              <div key={role} className="flex flex-col items-center space-y-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase">{roleAbbr}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = accessDraft.map((item) =>
                                      item.role === role ? { ...item, [feature.key]: !isChecked } : item
                                    );
                                    setAccessDraft(updated);
                                  }}
                                  className={`w-7 h-4 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                                    isChecked ? 'bg-[#EA580C]' : 'bg-slate-300'
                                  }`}
                                >
                                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isChecked ? 'translate-x-3' : 'translate-x-0'}`} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3: Meja untuk Customer Order Card matching Screenshot 2 & 3 */}
                <div className="bg-white rounded-[32px] p-6 border border-slate-200/80 shadow-2xs space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Grid className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900">Meja untuk Customer Order</h3>
                        <p className="text-xs font-semibold text-slate-500">
                          Hanya nomor meja di daftar ini yang bisa melakukan order dari halaman pelanggan.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <span className="text-xs font-black text-slate-600 uppercase">AKTIFKAN</span>
                      <input
                        type="checkbox"
                        checked={isSelfOrderSystemEnabled ?? (formProfile.isSelfOrderEnabled !== false)}
                        onChange={(e) => {
                          if (onToggleSystemSelfOrder) onToggleSystemSelfOrder(e.target.checked);
                          setFormProfile({ ...formProfile, isSelfOrderEnabled: e.target.checked });
                        }}
                        className="w-4.5 h-4.5 rounded accent-[#EA580C] cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      value={formProfile.allowedSelfOrderTables || '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15'}
                      onChange={(e) => setFormProfile({ ...formProfile, allowedSelfOrderTables: e.target.value })}
                      placeholder="1,2,3,4,5,6,7,8,9,10,11,12,13,14,15"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-800 outline-none focus:bg-white focus:border-slate-900 transition-all font-mono tracking-wider"
                    />
                    <p className="text-[11px] font-semibold text-slate-400">
                      Pisahkan dengan koma. Kosongkan jika semua meja boleh menggunakan customer order.
                    </p>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setIsTableModalOpen(true)}
                      className="text-xs font-black text-amber-700 hover:text-amber-800 underline cursor-pointer"
                    >
                      Buka manajemen meja
                    </button>
                  </div>
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
                        if (confirmingAction === 'clear-transactions') {
                          if (onClearTransactions) onClearTransactions();
                          toast('Transaksi Dihapus', 'Riwayat transaksi telah dibersihkan.');
                          setConfirmingAction(null);
                        } else {
                          setConfirmingAction('clear-transactions');
                          setTimeout(() => setConfirmingAction(null), 4000);
                        }
                      }}
                      className={`w-full py-3 text-white rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                        confirmingAction === 'clear-transactions'
                          ? 'bg-amber-700 shadow-amber-700/20 animate-pulse'
                          : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                      }`}
                    >
                      {confirmingAction === 'clear-transactions' ? '⚠️ Yakin? Klik lagi untuk konfirmasi' : 'Bersihkan Transaksi'}
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
                        if (confirmingAction === 'factory-reset') {
                          if (onFactoryReset) onFactoryReset();
                          toast('Factory Reset', 'Aplikasi telah di-reset ke data awal.');
                          setConfirmingAction(null);
                        } else {
                          setConfirmingAction('factory-reset');
                          setTimeout(() => setConfirmingAction(null), 4000);
                        }
                      }}
                      className={`w-full py-3 text-white rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                        confirmingAction === 'factory-reset'
                          ? 'bg-rose-900 shadow-rose-900/20 animate-pulse'
                          : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      }`}
                    >
                      {confirmingAction === 'factory-reset' ? '🔴 Yakin? Klik lagi untuk konfirmasi' : 'Factory Reset Total'}
                    </button>
                  </div>
                </div>

                {/* Architecture Blueprint Info Box */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-3 mt-6 border border-slate-800">
                  <div className="flex items-center gap-2 text-orange-300 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>RANCANGAN ARSITEKTUR KOSTUMISASI FREE TIER (VERCEL, SUPABASE & CLOUDINARY)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Sistem ini terintegrasi secara modular untuk berjalan di atas kuota <strong>Free Tier</strong> tanpa biaya langganan berlebih:
                  </p>
                  <ul className="text-xs text-[#B8B0A8] space-y-1.5 list-disc pl-5 font-medium">
                    <li><strong>Vercel Edge Deployment:</strong> Hosting SPA React & PWA Service Worker tanpa server overhead.</li>
                    <li><strong>Supabase Realtime Postgres:</strong> Menggunakan WebSocket Channels (<code className="text-orange-300">postgres_changes</code>) untuk sinkronisasi KDS & status order QR customer secara instant tanpa beban polling berulang.</li>
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
                  className="w-full bg-[#FAFAFA] border border-[#E8E0D8] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B6560] mb-1">Mode Pilihan</label>
                <select
                  value={newGroupMode}
                  onChange={(e) => setNewGroupMode(e.target.value as 'ADD_ON' | 'PAKET')}
                  className="w-full bg-[#FAFAFA] border border-[#E8E0D8] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800"
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
                  className="w-full bg-[#FAFAFA] border border-[#E8E0D8] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800"
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
                  className="px-4 py-2 bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
                >
                  Simpan Grup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Staff & PIN */}
      {editingStaff && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (editingStaff) {
                if (editingStaff.pin && !/^\d{6}$/.test(editingStaff.pin)) {
                  toast('PIN Tidak Valid', 'PIN baru harus tepat 6 digit, atau kosongkan jika tidak diubah.');
                  return;
                }
                try {
                  await onSaveStaff(editingStaff);
                  setEditingStaff(null);
                } catch {
                  // Parent callback displays the error; keep the modal open for correction.
                }
              }
            }}
            className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 font-sans text-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-[#1A1714] uppercase">Edit Detail Staff & PIN</h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">NAMA STAFF</label>
                <input
                  type="text"
                  required
                  value={editingStaff.name || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className="w-full bg-[#F6EFE7] border border-[#EAE3DB] rounded-2xl p-2.5 text-xs font-black outline-none focus:border-[#EA580C] focus:bg-white text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">ROLE</label>
                  <select
                    value={editingStaff.role || 'KASIR'}
                    onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value as any })}
                    className="w-full bg-[#F6EFE7] border border-[#EAE3DB] rounded-2xl p-2.5 text-xs font-black outline-none focus:border-[#EA580C] focus:bg-white text-slate-900"
                  >
                    <option value="KASIR">Kasir</option>
                    <option value="KITCHEN">Kitchen / Dapur</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OWNER">Owner</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">PIN 6-ANGKA</label>
                  <input
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    value={editingStaff.pin || ''}
                    placeholder="Kosong = tidak diubah"
                    onChange={(e) => setEditingStaff({ ...editingStaff, pin: e.target.value })}
                    className="w-full bg-[#F6EFE7] border border-[#EAE3DB] rounded-2xl p-2.5 text-xs font-mono font-black tracking-widest outline-none focus:border-[#EA580C] focus:bg-white text-[#C2410C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">MULAI SHIFT</label>
                  <input
                    type="time"
                    value={editingStaff.shiftStart || '08:00'}
                    onChange={(e) => setEditingStaff({ ...editingStaff, shiftStart: e.target.value })}
                    className="w-full bg-[#F6EFE7] border border-[#EAE3DB] rounded-2xl p-2.5 text-xs font-bold outline-none focus:border-[#EA580C] focus:bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">SELESAI SHIFT</label>
                  <input
                    type="time"
                    value={editingStaff.shiftEnd || '16:00'}
                    onChange={(e) => setEditingStaff({ ...editingStaff, shiftEnd: e.target.value })}
                    className="w-full bg-[#F6EFE7] border border-[#EAE3DB] rounded-2xl p-2.5 text-xs font-bold outline-none focus:border-[#EA580C] focus:bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">OUTLET PENUGASAN</label>
                <select
                  value={editingStaff.branchIds?.length === branches.length ? '' : editingStaff.branchIds?.[0] || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, branchIds: e.target.value ? [e.target.value] : branches.map((b) => b.id) })}
                  className="w-full bg-[#F6EFE7] border border-[#EAE3DB] rounded-2xl p-2.5 text-xs font-black outline-none focus:border-[#EA580C] focus:bg-white text-slate-900"
                >
                  <option value="">Semua Outlet</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Panduan Konfigurasi Menu & Tips (Matching Screenshot 4) */}
      {showCondimentTips && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl space-y-5 font-sans text-slate-900 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[#C2410C] font-black text-sm">
                <Info className="w-5 h-5 text-[#C2410C]" />
                <span>Panduan Konfigurasi Menu</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCondimentTips(false)}
                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-black text-xs text-[#C2410C] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#C2410C]" />
                  <span>Apa Fungsi Grup?</span>
                </h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Grup adalah wadah untuk mengelompokkan opsi tambahan pada menu. Anda bisa membuat banyak grup sesuai kebutuhan.
                </p>
                <div className="space-y-2 mt-3">
                  <div className="bg-amber-50/60 border border-amber-200/80 p-3 rounded-2xl">
                    <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase font-mono mr-2">SINGLE</span>
                    <strong className="text-xs font-black text-slate-900">Pilih 1 (Wajib)</strong>
                    <p className="text-[11px] text-slate-600 font-medium mt-1">Pelanggan HARUS memilih satu opsi. Cocok untuk varian rasa, level pedas, atau jenis kuah.</p>
                  </div>

                  <div className="bg-orange-50/60 border border-orange-200/80 p-3 rounded-2xl">
                    <span className="bg-[#EA580C] text-white text-[9px] font-black px-2 py-0.5 rounded uppercase font-mono mr-2">MULTIPLE</span>
                    <strong className="text-xs font-black text-slate-900">Pilih Banyak (Opsional)</strong>
                    <p className="text-[11px] text-slate-600 font-medium mt-1">Pelanggan bisa memilih lebih dari satu atau tidak sama sekali. Cocok untuk topping atau isian.</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-black text-xs text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Apa Fungsi Preset?</span>
                </h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Preset adalah template konfigurasi siap pakai. Gunakan tombol <strong className="text-amber-700">"Preset Standar"</strong> untuk membuat struktur grup umum (seperti Varian + Topping) secara otomatis tanpa perlu mengetik manual.
                </p>
              </div>

              <div className="bg-orange-50/60 border border-orange-200 p-4 rounded-2xl space-y-2">
                <h4 className="font-black text-xs text-[#C2410C] uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-[#C2410C]" />
                  <span>Tips Konfigurasi Kuah</span>
                </h4>
                <p className="text-[11px] text-slate-600 font-bold">Untuk menu dengan varian kuah (misal: Bakso):</p>
                <ol className="text-xs text-slate-700 space-y-1 list-decimal pl-5 font-medium">
                  <li>Buat Grup tipe <strong>SINGLE</strong> (misal: "Pilihan Kuah").</li>
                  <li>Isi opsi kuah (misal: Original, Mercon).</li>
                  <li>Targetkan ke kategori menu yang sesuai.</li>
                  <li>Sistem akan memaksa pelanggan memilih salah satu saat order.</li>
                </ol>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCondimentTips(false)}
                className="px-5 py-2.5 bg-[#EA580C] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md cursor-pointer"
              >
                Paham & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Manajemen Meja (Customer Order) matching Screenshot 1 */}
      <CustomerTableManagementModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        tables={tables}
        onToggleTableSelfOrder={onToggleTableSelfOrder}
        onToggleAllTables={onToggleAllTables}
        isSelfOrderSystemEnabled={isSelfOrderSystemEnabled ?? (formProfile.isSelfOrderEnabled !== false)}
        onToggleSystemSelfOrder={onToggleSystemSelfOrder}
      />
    </div>
  );
};
