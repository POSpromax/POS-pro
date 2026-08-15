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
  Key,
  UserCheck,
  Phone,
  Building2,
  MonitorCog,
  Upload,
  ImageIcon
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
import { playNewOrderSound, playSelfOrderAlertSound } from '../../utils/audioNotification';
import { uploadImage } from '../../services/cloudinaryMedia';

const normalizeCondimentName = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const inferSelfOrderRole = (group: CondimentGroup): 'NONE' | 'BROTH' | 'FILLING' => {
  if (group.selfOrderRole === 'NONE' || group.selfOrderRole === 'BROTH' || group.selfOrderRole === 'FILLING') return group.selfOrderRole;
  const normalized = normalizeCondimentName(group.name);
  if (normalized.includes('KUAH')) return 'BROTH';
  if (normalized.includes('ISIAN')) return 'FILLING';
  return 'NONE';
};

const existingConfiguredOptions = (group: CondimentGroup, configured?: string[]) => {
  const wanted = new Set((configured || []).map(normalizeCondimentName));
  if (!wanted.size) return [];
  return group.options
    .filter((option) => option.isAvailable !== false && wanted.has(normalizeCondimentName(option.name)))
    .map((option) => option.name);
};

const defaultBrothConfig = (group: CondimentGroup) => {
  const configured = existingConfiguredOptions(group, group.selfOrderDefaultOptions);
  if (configured.length) return configured.slice(0, 1);
  const original = group.options.find((option) => option.isAvailable !== false && normalizeCondimentName(option.name) === 'ORIGINAL');
  return original ? [original.name] : [];
};

const defaultBaksoOnlyConfig = (group: CondimentGroup) => {
  const configured = existingConfiguredOptions(group, group.selfOrderBaksoOnlyOptions);
  if (configured.length) return configured;
  return group.options
    .filter((option) => {
      if (option.isAvailable === false) return false;
      const name = normalizeCondimentName(option.name);
      return name === 'BAWANG' || name === 'SLEDRI' || name === 'SELEDRI';
    })
    .map((option) => option.name);
};

const defaultCampurConfig = (group: CondimentGroup) => {
  const configured = existingConfiguredOptions(group, group.selfOrderCampurOptions);
  if (configured.length) return configured;
  return group.options
    .filter((option) => {
      if (option.isAvailable === false) return false;
      const name = normalizeCondimentName(option.name);
      return name !== 'KWETIAW' && name !== 'BAKSOAJA' && name !== 'BAKSOSAJA';
    })
    .map((option) => option.name);
};

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
  activeUserRole: UserRole;
  onSaveStaff: (staff: UserAccount) => void | Promise<void>;
  onDeleteStaff?: (id: string) => void | Promise<void>;
  accessControl: AccessControlRule[];
  onSaveAccessControl: (rules: AccessControlRule[]) => void | Promise<void>;
  tables?: RestaurantTable[];
  onToggleTableSelfOrder?: (tableId: string, enabled: boolean) => void;
  onToggleAllTables?: (enabled: boolean) => void;
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
  activeUserRole,
  onSaveStaff,
  onDeleteStaff,
  accessControl,
  onSaveAccessControl,
  tables = [],
  onToggleTableSelfOrder = () => {},
  onToggleAllTables = () => {},
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
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
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
  const canManageTenant = activeUserRole === 'SUPER_OWNER' || activeUserRole === 'OWNER';

  const scopeMeta = activeTab === 'ACCESS'
    ? { label: 'PUSAT / SEMUA CABANG', detail: 'Matriks role berlaku untuk seluruh organisasi.', icon: Building2, tone: 'border-violet-200 bg-violet-50 text-violet-800' }
    : activeTab === 'DATABASE'
      ? { label: 'PERANGKAT INI', detail: 'Reset dan cache hanya memengaruhi browser/terminal ini.', icon: MonitorCog, tone: 'border-slate-200 bg-slate-50 text-slate-700' }
      : activeTab === 'PROFILE' || activeTab === 'STAFF'
        ? { label: 'PUSAT + CABANG', detail: `Brand/akun dikelola pusat; detail operasional berlaku untuk ${currentBranch.name}.`, icon: Building2, tone: 'border-blue-200 bg-blue-50 text-blue-800' }
        : { label: `CABANG ${currentBranch.code || ''}`, detail: `Perubahan hanya berlaku untuk ${currentBranch.name}.`, icon: MapPin, tone: 'border-orange-200 bg-orange-50 text-orange-800' };
  const ScopeIcon = scopeMeta.icon;

  useEffect(() => {
    setNewStaffBranchId(currentBranch.id);
  }, [currentBranch.id]);

  useEffect(() => {
    setAccessDraft(accessControl);
  }, [accessControl]);

  useEffect(() => {
    setFormProfile({ ...profile });
  }, [profile, currentBranch.id]);

  useEffect(() => {
    if (!canManageTenant && activeTab === 'ACCESS') setActiveTab('PROFILE');
  }, [activeTab, canManageTenant]);

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
      isRequired: newGroupRequired,
      minSelect: newGroupRequired ? 1 : 0,
      maxSelect: newGroupMode === 'PAKET' ? 1 : 10,
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
    if (soundName.toLocaleLowerCase('id-ID').includes('customer')) playSelfOrderAlertSound(soundName);
    else playNewOrderSound(soundName);
    toast('Test Suara', `Memainkan chime: ${soundName}`);
  };

  return (
    <div className="ui-surface flex-1 p-4 md:p-6 overflow-y-auto font-sans select-none text-[var(--text-primary)]">
      <div>
        {/* Main Header Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-light)] rounded-2xl flex items-center justify-center text-white shadow-[var(--shadow-md)]">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Pengaturan Operasional</h1>
              <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-widest">CONTROL CENTER TOKO</p>
            </div>
          </div>

          {isSavedAlert && (
            <div className="bg-emerald-600 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-md animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              <span>Perubahan Berhasil Disimpan!</span>
            </div>
          )}
        </div>

        <div className={`mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 ${scopeMeta.tone}`}>
          <ScopeIcon className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider">Cakupan: {scopeMeta.label}</p>
            <p className="mt-0.5 text-xs font-semibold opacity-80">{scopeMeta.detail}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Navigation Sidebar */}
          <div className="space-y-5">
            {/* UMUM */}
            <div>
              <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-2 mb-2">UMUM</p>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('PROFILE')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'PROFILE'
                      ? 'bg-white border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-hover)] shadow-sm font-bold'
                      : 'bg-white/80 border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'PROFILE' ? 'bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-light)] text-white shadow-sm' : 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'}`}>
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Profil & Brand</p>
                    <p className="text-[11px] text-[var(--text-secondary)] font-bold">Identitas, Logo, Sosmed</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('LANDING')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'LANDING'
                      ? 'bg-white border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-hover)] shadow-sm font-bold'
                      : 'bg-white/80 border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'LANDING' ? 'bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-light)] text-white shadow-sm' : 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'}`}>
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Landing Self-Order</p>
                    <p className="text-[11px] text-[var(--text-secondary)] font-bold">Tampilan App Pelanggan</p>
                  </div>
                </button>
              </div>
            </div>

            {/* OPERASIONAL */}
            <div>
              <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-2 mb-2">OPERASIONAL</p>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('KDS')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'KDS'
                      ? 'bg-white border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-hover)] shadow-sm font-bold'
                      : 'bg-white/80 border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'KDS' ? 'bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-light)] text-white shadow-sm' : 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'}`}>
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Dapur & KDS</p>
                    <p className="text-[11px] text-[var(--text-secondary)] font-bold">Timer, Alarm, Running Text</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('STAFF')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'STAFF'
                      ? 'bg-white border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-hover)] shadow-sm font-bold'
                      : 'bg-white/80 border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'STAFF' ? 'bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-light)] text-white shadow-sm' : 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'}`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Karyawan & Shift</p>
                    <p className="text-[11px] text-[var(--text-secondary)] font-bold">Absensi, GPS, Shift Staff</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('CONDIMENTS')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'CONDIMENTS'
                      ? 'bg-white border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-hover)] shadow-sm font-bold'
                      : 'bg-white/80 border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'CONDIMENTS' ? 'bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-light)] text-white shadow-sm' : 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'}`}>
                    <Grid className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Daftar Isian / Topping</p>
                    <p className="text-[11px] text-[var(--text-secondary)] font-bold">Opsi Kuah, Isian, Paket</p>
                  </div>
                </button>
              </div>
            </div>

            {/* SYSTEM */}
            <div>
              <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-2 mb-2">SYSTEM</p>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('FINANCE')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'FINANCE'
                      ? 'bg-white border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-hover)] shadow-sm font-bold'
                      : 'bg-white/80 border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'FINANCE' ? 'bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-light)] text-white shadow-sm' : 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'}`}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Keuangan & Pajak</p>
                    <p className="text-[11px] text-[var(--text-secondary)] font-bold">Pajak, Service, Diskon</p>
                  </div>
                </button>

                {canManageTenant && <button
                  onClick={() => setActiveTab('ACCESS')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'ACCESS'
                      ? 'bg-white border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-hover)] shadow-sm font-bold'
                      : 'bg-white/80 border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'ACCESS' ? 'bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-light)] text-white shadow-sm' : 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Hak Akses</p>
                    <p className="text-[11px] text-[var(--text-secondary)] font-bold">Role & Permissions</p>
                  </div>
                </button>}

                <button
                  onClick={() => setActiveTab('DATABASE')}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'DATABASE'
                      ? 'bg-white border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-hover)] shadow-sm font-bold'
                      : 'bg-white/80 border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'DATABASE' ? 'bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-light)] text-white shadow-sm' : 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'}`}>
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Database & Reset</p>
                    <p className="text-[11px] text-[var(--text-secondary)] font-bold">Reset & Maintenance</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Hanya form profil cabang yang memakai tombol simpan bersama.
                Hak akses, condiment, dan maintenance punya aksi tersendiri. */}
            {(['PROFILE', 'LANDING', 'KDS', 'STAFF', 'FINANCE'] as const).includes(activeTab as any) && <button
              type="button"
              onClick={handleSaveAll}
              className="ui-button ui-button-primary w-full cursor-pointer mt-4"
            >
              <Save className="w-4 h-4" />
              <span>{activeTab === 'PROFILE' && canManageTenant ? `SIMPAN PUSAT + ${currentBranch.code || 'CABANG'}` : `SIMPAN ${currentBranch.code || 'CABANG'}`}</span>
            </button>}
          </div>

          {/* Right Main Form Content Panel */}
          <div className="ui-card lg:col-span-3 p-6 min-h-[600px]">
            {/* 1. PROFIL & BRAND (Matching Image 1) */}
            {activeTab === 'PROFILE' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Profil & Brand</h2>
                  <p className="text-xs text-[var(--text-tertiary)] font-medium">Informasi dasar yang tampil di struk dan aplikasi.</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-violet-800">
                    <p className="text-[11px] font-black uppercase tracking-wider">Brand pusat</p>
                    <p className="mt-1 text-xs font-semibold">Nama, logo, Instagram, dan TikTok dipakai bersama oleh semua cabang. Hanya Owner yang dapat mengubah.</p>
                  </div>
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-orange-800">
                    <p className="text-[11px] font-black uppercase tracking-wider">Profil outlet: {currentBranch.code}</p>
                    <p className="mt-1 text-xs font-semibold">Tagline, alamat, WhatsApp, dan konfigurasi operasional hanya untuk {currentBranch.name}.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {/* Logo Preview */}
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--panel-border)] rounded-2xl p-4 bg-[var(--surface-card)]">
                    <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase mb-3">LOGO BRAND</p>
                    {formProfile.logoUrl ? (
                      <img
                        src={formProfile.logoUrl}
                        alt="Logo"
                        className="mb-3 h-36 w-36 rounded-2xl border bg-white p-2 object-contain shadow-sm"
                      />
                    ) : (
                      <div className="mb-3 flex h-36 w-36 items-center justify-center rounded-2xl border bg-white text-slate-300 shadow-sm">
                        <ImageIcon className="h-12 w-12" />
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="URL Logo Image..."
                      value={formProfile.logoUrl}
                      disabled={!canManageTenant}
                      onChange={(e) => setFormProfile({ ...formProfile, logoUrl: e.target.value })}
                      className="w-full bg-white border border-[var(--panel-border)] rounded-xl px-3 py-1.5 text-[11px] text-[var(--text-secondary)] outline-none focus:border-[var(--primary)] font-medium disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
                    />
                    {canManageTenant && (
                      <label className="ui-button ui-button-secondary mt-2 w-full cursor-pointer py-2 text-[11px]">
                        <Upload className="h-3.5 w-3.5" />
                        <span>{isUploadingLogo ? 'Mengunggah…' : 'Upload dari perangkat'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="sr-only"
                          disabled={isUploadingLogo}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (!file) return;
                            setIsUploadingLogo(true);
                            void uploadImage(file, 'branding', currentBranch.id)
                              .then((uploaded) => {
                                setFormProfile((current) => ({ ...current, logoUrl: uploaded.secureUrl }));
                                toast('Logo Berhasil Diunggah', 'Klik Simpan agar logo Cloudinary dipakai seluruh cabang.');
                              })
                              .catch((error) => toast('Upload Logo Gagal', error instanceof Error ? error.message : 'Logo tidak dapat diunggah.'))
                              .finally(() => setIsUploadingLogo(false));
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Brand Fields */}
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="block text-[13px]-bold-1">
                        NAMA BRAND / RESTO
                      </label>
                      <input
                        type="text"
                        value={formProfile.name}
                        disabled={!canManageTenant}
                        onChange={(e) => setFormProfile({ ...formProfile, name: e.target.value })}
                        className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-all disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px]-bold-1">
                        SLOGAN / TAGLINE
                      </label>
                      <input
                        type="text"
                        value={formProfile.tagline}
                        onChange={(e) => setFormProfile({ ...formProfile, tagline: e.target.value })}
                        className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px]-bold-1">
                        ALAMAT LENGKAP
                      </label>
                      <textarea
                        rows={3}
                        value={formProfile.address}
                        onChange={(e) => setFormProfile({ ...formProfile, address: e.target.value })}
                        className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Social Media & Contact (Matching Image 1) */}
                <div className="border-t border-[var(--panel-border)] pt-6">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[var(--primary-hover)]" />
                    <span>KONTAK & SOSMED</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">WHATSAPP</label>
                      <input
                        type="text"
                        value={formProfile.phone}
                        onChange={(e) => setFormProfile({ ...formProfile, phone: e.target.value })}
                        className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">INSTAGRAM</label>
                      <input
                        type="text"
                        value={formProfile.instagram}
                        disabled={!canManageTenant}
                        onChange={(e) => setFormProfile({ ...formProfile, instagram: e.target.value })}
                        className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">TIKTOK</label>
                      <input
                        type="text"
                        value={formProfile.tiktok}
                        disabled={!canManageTenant}
                        onChange={(e) => setFormProfile({ ...formProfile, tiktok: e.target.value })}
                        className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
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
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Landing Page Pelanggan</h2>
                  <p className="text-xs text-[var(--text-tertiary)] font-medium">Konfigurasi tampilan banner, wallpaper, dan review Google HP pelanggan.</p>
                </div>

                <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-4">
                  <p className="text-xs font-bold text-[var(--text-primary)]">Kontrol Self-Order per Meja</p>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Akses customer order tidak memakai saklar global. Aktif/nonaktif ditentukan dari Manajemen Meja & QR untuk setiap meja atau aksi semua meja.</p>
                </div>

                {/* Banner Promo Utama Card */}
                <div className="bg-[var(--primary)] rounded-2xl p-6 text-white shadow-md space-y-4">
                  <p className="text-[11px] font-bold text-[var(--primary-text)] uppercase tracking-widest flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" /> BANNER PROMO UTAMA
                  </p>

                  <div>
                    <label className="block text-[13px]-bold-1">JUDUL PROMO</label>
                    <input
                      type="text"
                      value={formProfile.promoBannerTitle || ''}
                      onChange={(e) => setFormProfile({ ...formProfile, promoBannerTitle: e.target.value })}
                      className="w-full bg-white text-[var(--text-primary)] font-bold text-sm rounded-2xl px-4 py-3 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px]-bold-1">DESKRIPSI</label>
                    <input
                      type="text"
                      value={formProfile.promoBannerDescription || ''}
                      onChange={(e) => setFormProfile({ ...formProfile, promoBannerDescription: e.target.value })}
                      className="w-full bg-white text-[var(--text-primary)] font-bold text-xs rounded-2xl px-4 py-3 outline-none shadow-sm"
                    />
                  </div>
                </div>

                {/* Wallpaper & Google Review Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3">
                    <label className="block text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                      WALLPAPER BACKGROUND
                    </label>
                    <div className="h-44 rounded-2xl overflow-hidden border border-[var(--panel-border)] relative group">
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
                      className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none"
                    />
                  </div>

                  <div className="space-y-4 bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[var(--primary-hover)]" /> LINK REVIEW GOOGLE
                    </h3>

                    <div>
                      <label className="block text-[13px]-bold-1">URL MAPS</label>
                      <input
                        type="text"
                        value={formProfile.googleReviewUrl || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, googleReviewUrl: e.target.value })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px]-bold-1">TEKS AJAKAN</label>
                      <input
                        type="text"
                        value={formProfile.googleReviewText || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, googleReviewText: e.target.value })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none"
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
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Dapur & KDS</h2>
                  <p className="text-xs text-[var(--text-tertiary)] font-medium">Pengaturan notifikasi dan tampilan layar dapur.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Batas Waktu Order */}
                  <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)] space-y-4">
                    <div className="flex items-center gap-2 text-[var(--text-secondary)] font-bold text-xs">
                      <Clock className="w-4 h-4 text-[var(--accent-amber)]" />
                      <span>BATAS WAKTU ORDER</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={formProfile.orderTimeLimitMinutes || 5}
                        onChange={(e) => setFormProfile({ ...formProfile, orderTimeLimitMinutes: Number(e.target.value) })}
                        className="w-20 bg-white border border-[var(--panel-border)] rounded-2xl p-3 text-2xl font-bold text-center text-[var(--text-primary)] outline-none"
                      />
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)] uppercase">MENIT SEBELUM</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] font-semibold">ALARM BERBUNYI</p>
                      </div>
                    </div>
                  </div>

                  {/* Sound & Notifications Master Switch & Audio Config */}
                  <div className="md:col-span-2 border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)] space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--panel-border)]">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-5 h-5 text-[var(--primary-hover)]" />
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">Suara & Notifikasi</p>
                          <p className="text-[11px] text-[var(--text-tertiary)] font-semibold uppercase">MASTER SWITCH</p>
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
                          formProfile.soundNotificationsEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--panel-border)]'
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold text-[var(--text-secondary)]">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] uppercase font-semibold text-[var(--text-tertiary)]">ORDER BARU (DAPUR)</span>
                          <button
                            type="button"
                            onClick={() => handleTestSound(formProfile.soundOrderBaru || 'High Alarm (Siren)')}
                            className="text-[11px] text-[var(--primary-hover)] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Test
                          </button>
                        </div>
                        <select
                          value={formProfile.soundOrderBaru || 'High Alarm (Siren)'}
                          onChange={(e) => setFormProfile({ ...formProfile, soundOrderBaru: e.target.value })}
                          className="w-full bg-white border border-[var(--panel-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                        >
                          <option value="High Alarm (Siren)">High Alarm (Siren)</option>
                          <option value="Kitchen Order">Kitchen Order</option>
                          <option value="Warning Beep">Warning Beep</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] uppercase font-semibold text-[var(--text-tertiary)]">PESANAN MASUK (POS)</span>
                          <button
                            type="button"
                            onClick={() => handleTestSound(formProfile.soundPesananMasuk || 'Kitchen Order')}
                            className="text-[11px] text-[var(--primary-hover)] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Test
                          </button>
                        </div>
                        <select
                          value={formProfile.soundPesananMasuk || 'Kitchen Order'}
                          onChange={(e) => setFormProfile({ ...formProfile, soundPesananMasuk: e.target.value })}
                          className="w-full bg-white border border-[var(--panel-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                        >
                          <option value="Kitchen Order">Kitchen Order</option>
                          <option value="Success Chime">Success Chime</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] uppercase font-semibold text-[var(--text-tertiary)]">PEMBAYARAN SUKSES</span>
                          <button
                            type="button"
                            onClick={() => handleTestSound(formProfile.soundPembayaranSukses || 'Success Chime')}
                            className="text-[11px] text-[var(--primary-hover)] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Test
                          </button>
                        </div>
                        <select
                          value={formProfile.soundPembayaranSukses || 'Success Chime'}
                          onChange={(e) => setFormProfile({ ...formProfile, soundPembayaranSukses: e.target.value })}
                          className="w-full bg-white border border-[var(--panel-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                        >
                          <option value="Success Chime">Success Chime</option>
                          <option value="Cash Register Chime">Cash Register Chime</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] uppercase font-semibold text-[var(--text-tertiary)]">SELF-ORDER DARI HP</span>
                          <button
                            type="button"
                            onClick={() => handleTestSound(formProfile.soundCustomerOrder || 'Customer Order')}
                            className="text-[11px] text-[var(--primary-hover)] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Test
                          </button>
                        </div>
                        <select
                          value={formProfile.soundCustomerOrder || 'Customer Order'}
                          onChange={(e) => setFormProfile({ ...formProfile, soundCustomerOrder: e.target.value })}
                          className="w-full bg-white border border-[var(--panel-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                        >
                          <option value="Customer Order">Customer Order Bell (Nyaring)</option>
                          <option value="Warning Beep">Warning Beep</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Running Text */}
                <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)] space-y-2">
                  <label className="block text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                    RUNNING TEXT KDS & DAPUR
                  </label>
                  <textarea
                    rows={2}
                    value={formProfile.runningText || 'JANGAN LUPA SHOLAT'}
                    onChange={(e) => setFormProfile({ ...formProfile, runningText: e.target.value })}
                    className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* 4. KARYAWAN & SHIFT (Matching Images 5 & 6) */}
            {activeTab === 'STAFF' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Karyawan & Shift</h2>
                  <p className="text-xs text-[var(--text-tertiary)] font-medium">Manajemen staff, akses PIN, dan jadwal shift.</p>
                </div>

                <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Aktifkan Absensi Outlet</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Jika nonaktif, staff tidak dapat melakukan clock-in atau clock-out.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(`/attendance?branch=${encodeURIComponent(currentBranch.id)}`, '_blank', 'noopener,noreferrer')}
                      className="flex items-center gap-1.5 rounded-xl border border-[var(--panel-border)] bg-white px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Buka Terminal
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormProfile({ ...formProfile, isAttendanceEnabled: formProfile.isAttendanceEnabled === false })}
                      className={`px-4 py-2 rounded-xl text-[11px] font-bold border ${
                        formProfile.isAttendanceEnabled !== false
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--panel-border)]'
                      }`}
                    >
                      {formProfile.isAttendanceEnabled !== false ? 'AKTIF' : 'NONAKTIF'}
                    </button>
                  </div>
                </div>

                {/* Jadwal Shift & Toleransi Card (Matching Image 5) */}
                <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                    <Clock className="w-4 h-4 text-[var(--accent-amber)]" />
                    <span>JADWAL SHIFT & TOLERANSI</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">KITCHEN</span>
                      <input
                        type="time"
                        value={formProfile.shiftScheduleKitchen || '07:00'}
                        onChange={(e) => setFormProfile({ ...formProfile, shiftScheduleKitchen: e.target.value })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                      />
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">CASHIER</span>
                      <input
                        type="time"
                        value={formProfile.shiftScheduleCashier || '08:00'}
                        onChange={(e) => setFormProfile({ ...formProfile, shiftScheduleCashier: e.target.value })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                      />
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">STAFF</span>
                      <input
                        type="time"
                        value={formProfile.shiftScheduleStaff || '09:00'}
                        onChange={(e) => setFormProfile({ ...formProfile, shiftScheduleStaff: e.target.value })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                      />
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">ADMIN</span>
                      <input
                        type="time"
                        value={formProfile.shiftScheduleAdmin || '08:00'}
                        onChange={(e) => setFormProfile({ ...formProfile, shiftScheduleAdmin: e.target.value })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  {/* Toleransi keterlambatan */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">Toleransi Keterlambatan</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] font-medium">Menit yang diizinkan sebelum dianggap terlambat.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={formProfile.latenessToleranceMinutes || 5}
                        onChange={(e) => setFormProfile({ ...formProfile, latenessToleranceMinutes: Number(e.target.value) })}
                        className="w-14 bg-white border border-amber-300 rounded-xl py-1 text-center font-bold text-xs text-[var(--text-primary)]"
                      />
                      <span className="text-xs font-bold text-amber-700">Menit</span>
                    </div>
                  </div>
                </div>

                {/* Lokasi & GPS Absensi (Matching Image 6) */}
                <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                    <Compass className="w-4 h-4 text-[var(--primary-hover)]" />
                    <span>LOKASI & GPS ABSENSI</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">LATITUDE (GARIS LINTANG)</label>
                      <input
                        type="text"
                        value={formProfile.gpsLatitude || -6.609013171412514}
                        onChange={(e) => setFormProfile({ ...formProfile, gpsLatitude: Number(e.target.value) })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-mono font-semibold text-[var(--text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">RADIUS AREA (METER)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={formProfile.gpsRadiusMeters || 20}
                          onChange={(e) => setFormProfile({ ...formProfile, gpsRadiusMeters: Number(e.target.value) })}
                          className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)]"
                        />
                        <span className="text-xs font-semibold text-[var(--text-tertiary)]">Meter</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">LONGITUDE (GARIS BUJUR)</label>
                      <input
                        type="text"
                        value={formProfile.gpsLongitude || 106.78293233420759}
                        onChange={(e) => setFormProfile({ ...formProfile, gpsLongitude: Number(e.target.value) })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-mono font-semibold text-[var(--text-primary)]"
                      />
                    </div>

                    <div className="flex flex-col justify-center space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">Wajib Foto Selfie</span>
                        <input
                          type="checkbox"
                          checked={formProfile.requireSelfiePhoto ?? true}
                          onChange={(e) => setFormProfile({ ...formProfile, requireSelfiePhoto: e.target.checked })}
                          className="w-4 h-4 rounded text-[var(--primary-hover)] cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">Wajib GPS Aktif</span>
                        <input
                          type="checkbox"
                          checked={formProfile.requireGpsActive ?? true}
                          onChange={(e) => setFormProfile({ ...formProfile, requireGpsActive: e.target.checked })}
                          className="w-4 h-4 rounded text-[var(--primary-hover)] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      className="text-xs font-bold text-[var(--primary-hover)] hover:text-[var(--primary-text)] bg-[var(--brand-50)] border border-[var(--brand-200)] px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <MapPin className="w-4 h-4 text-[var(--primary-hover)]" />
                      <span>📍 Ambil Lokasi & Buka Google Maps</span>
                    </button>

                    <a
                      href={`https://www.google.com/maps?q=${formProfile.gpsLatitude || -6.609013171412514},${formProfile.gpsLongitude || 106.78293233420759}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-[var(--text-primary)] hover:text-slate-900 bg-[var(--surface-secondary)] border border-[var(--panel-border)] px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <ExternalLink className="w-4 h-4 text-[var(--text-secondary)]" />
                      <span>🗺️ Lihat Titik di Google Maps</span>
                    </a>
                  </div>
                </div>

                {/* Jadwal Libur Rutin Harian / Mingguan */}
                <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Clock className="w-4 h-4 text-[var(--primary-hover)]" />
                      <span>JADWAL LIBUR RUTIN HARIAN (OUTLET & STAFF)</span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] font-semibold">
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
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isOff
                              ? 'bg-rose-600 text-white shadow-md'
                              : 'bg-white border border-[var(--panel-border)] text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                          }`}
                        >
                          <span>{d.label}</span>
                          <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-lg ${isOff ? 'bg-rose-700 text-white' : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'}`}>
                            {isOff ? 'LIBUR' : 'KERJA'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Daftar Staff & PIN (Matching Image 6) */}
                <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                      <Users className="w-4 h-4 text-[var(--primary-hover)]" />
                      <span>DAFTAR STAFF & PIN</span>
                    </div>

                    <span className="rounded-full border border-[var(--panel-border)] bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
                      {staffAccounts.length} akun terdaftar
                    </span>
                  </div>

                  {/* Form Tambah Staff */}
                  <form onSubmit={handleAddStaff} className="bg-[var(--primary-soft)] border border-[var(--brand-200)] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--primary-hover)] uppercase mb-1">NAMA STAFF</span>
                      <input
                        type="text"
                        placeholder="Nama Lengkap"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="w-full bg-white border border-[var(--brand-200)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                      />
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">OUTLET PENUGASAN</span>
                      <select
                        value={newStaffBranchId}
                        onChange={(e) => setNewStaffBranchId(e.target.value)}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                      >
                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--primary-hover)] uppercase mb-1">ROLE</span>
                      <select
                        value={newStaffRole}
                        onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                        className="w-full bg-white border border-[var(--brand-200)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                      >
                        <option value="KASIR">Kasir</option>
                        <option value="KITCHEN">Kitchen / Dapur</option>
                        <option value="ADMIN">Admin</option>
                        <option value="OWNER">Owner</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">MULAI SHIFT</span>
                      <input type="time" value={newStaffShift} onChange={(e) => setNewStaffShift(e.target.value)} className="ui-input" />
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">SELESAI SHIFT</span>
                      <input type="time" value={newStaffShiftEnd} onChange={(e) => setNewStaffShiftEnd(e.target.value)} className="ui-input" />
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--primary-hover)] uppercase mb-1">PIN (6 ANGKA)</span>
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="Masukkan 6 digit"
                        value={newStaffPin}
                        onChange={(e) => setNewStaffPin(e.target.value)}
                        className="w-full bg-white border border-[var(--brand-200)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-primary)] tracking-widest"
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Tambah Staff
                    </button>
                  </form>

                  {/* Staff List Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {staffAccounts.map((stf) => (
                      <div key={stf.id} className="bg-white border border-[var(--panel-border)] rounded-2xl p-3.5 shadow-sm space-y-3 relative">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            {stf.avatar ? (
                              <img src={stf.avatar} alt={stf.name} className="w-10 h-10 rounded-xl object-cover border border-[var(--panel-border)]" />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] text-xs font-bold text-[var(--primary-text)]">
                                {stf.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{stf.name}</p>
                                <span className="px-1.5 py-0.5 rounded bg-[var(--brand-50)] border border-[var(--brand-200)] text-[var(--primary-hover)] font-mono text-[11px] font-bold">
                                  {stf.role}
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--text-secondary)] font-bold">{stf.shiftStart || '-'} – {stf.shiftEnd || '-'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingStaff({ ...stf })}
                              className="p-1.5 text-[var(--primary-hover)] hover:bg-[var(--brand-100)] rounded-lg cursor-pointer transition-colors"
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
                                confirmingDeleteId === stf.id ? 'bg-rose-600 text-white' : 'text-[var(--accent-red)] hover:bg-[var(--danger-soft)]'
                              }`}
                              title={confirmingDeleteId === stf.id ? 'Klik lagi untuk hapus' : 'Hapus Staff'}
                            >
                              {confirmingDeleteId === stf.id ? <Check className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => void Promise.resolve(onSaveStaff({ ...stf, isActive: stf.isActive === false })).catch(() => undefined)}
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase cursor-pointer ${stf.isActive === false ? 'border-[var(--panel-border)] text-[var(--text-secondary)] bg-[var(--surface-secondary)]' : 'border-emerald-200 text-[var(--accent-green)] bg-[var(--success-soft)]'}`}
                            >
                              {stf.isActive === false ? 'Nonaktif' : 'Aktif'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-bold text-[var(--text-secondary)]">
                          <div className="rounded-xl bg-[var(--surface-main)] px-3 py-2">Shift: {stf.shiftStart || '-'}–{stf.shiftEnd || '-'}</div>
                          <div className="rounded-xl bg-[var(--surface-main)] px-3 py-2">PIN: ••••••</div>
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
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">Daftar Isian / Topping</h2>
                    <p className="text-xs text-[var(--text-tertiary)] font-medium">Atur pilihan tambahan untuk menu (Hanya Customer Order & Kitchen)</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCondimentTips(true)}
                      className="bg-[var(--brand-50)] hover:bg-[var(--brand-100)] border border-[var(--brand-200)] text-[var(--primary-hover)] font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Info className="w-4 h-4 text-[var(--primary-hover)]" />
                      <span>& Tips</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const hasBroth = condimentGroups.some((group) => inferSelfOrderRole(group) === 'BROTH');
                        const hasFilling = condimentGroups.some((group) => inferSelfOrderRole(group) === 'FILLING');
                        let created = 0;
                        const stamp = Date.now();

                        if (!hasBroth) {
                          onSaveCondimentGroup({
                            id: `cg-preset-kuah-${stamp}`,
                            name: 'KUAH',
                            mode: 'PAKET',
                            required: true,
                            isRequired: true,
                            minSelect: 1,
                            maxSelect: 1,
                            targetCategories: ['BAKSO'],
                            isActive: true,
                            selfOrderRole: 'BROTH',
                            selfOrderDefaultOptions: ['ORIGINAL'],
                            options: [
                              { id: `opt-kuah-original-${stamp}`, name: 'ORIGINAL', price: 0, isAvailable: true },
                              { id: `opt-kuah-misdasem-${stamp}`, name: 'MISDASEM', price: 0, isAvailable: true },
                            ],
                          });
                          created += 1;
                        }

                        if (!hasFilling) {
                          onSaveCondimentGroup({
                            id: `cg-preset-isian-${stamp + 1}`,
                            name: 'ISIAN',
                            mode: 'ADD_ON',
                            required: true,
                            isRequired: true,
                            minSelect: 1,
                            maxSelect: 7,
                            targetCategories: ['BAKSO'],
                            isActive: true,
                            selfOrderRole: 'FILLING',
                            selfOrderBaksoOnlyOptions: ['BAWANG', 'SLEDRI'],
                            selfOrderCampurOptions: ['MIE', 'BIHUN', 'SAWI', 'TAUGE', 'BAWANG', 'SLEDRI'],
                            allSelectedLabel: 'CAMPUR',
                            options: [
                              { id: `opt-isian-mie-${stamp}`, name: 'MIE', price: 0, isAvailable: true },
                              { id: `opt-isian-bihun-${stamp}`, name: 'BIHUN', price: 0, isAvailable: true },
                              { id: `opt-isian-kwetiaw-${stamp}`, name: 'KWETIAW', price: 0, isAvailable: true },
                              { id: `opt-isian-sawi-${stamp}`, name: 'SAWI', price: 0, isAvailable: true },
                              { id: `opt-isian-tauge-${stamp}`, name: 'TAUGE', price: 0, isAvailable: true },
                              { id: `opt-isian-bawang-${stamp}`, name: 'BAWANG', price: 0, isAvailable: true },
                              { id: `opt-isian-sledri-${stamp}`, name: 'SLEDRI', price: 0, isAvailable: true },
                            ],
                          });
                          created += 1;
                        }

                        toast(
                          created ? 'Preset Self Order Dibuat' : 'Preset Sudah Ada',
                          created
                            ? `${created} grup standar ditambahkan. Periksa target menu dan opsi sebelum digunakan.`
                            : 'Grup Kuah dan Isian untuk self-order sudah tersedia. Tidak ada duplikasi yang dibuat.',
                        );
                      }}
                      className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Preset Self Order</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewGroupModalOpen(true)}
                      className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-[var(--shadow-md)] cursor-pointer"
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
                    const selfOrderRole = inferSelfOrderRole(group);
                    const activeOptionNames = group.options.filter((option) => option.isAvailable !== false).map((option) => option.name);
                    const brothDefaults = defaultBrothConfig(group);
                    const baksoOnlyDefaults = defaultBaksoOnlyConfig(group);
                    const campurDefaults = defaultCampurConfig(group);
                    return (
                      <div key={group.id} className="border border-[var(--panel-border)] rounded-2xl overflow-hidden bg-white shadow-sm">
                        {/* Group Header */}
                        <div
                          onClick={() => toggleAccordion(group.id)}
                          className="p-4 flex items-center justify-between bg-[var(--surface-card)]/80 hover:bg-[var(--surface-secondary)]/80 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-3.5 h-3.5 rounded-full bg-[var(--primary-solid)] shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-[var(--text-primary)]">{group.name}</h3>
                                <span className="bg-[var(--surface-secondary)] border border-[var(--panel-border)] text-[var(--text-secondary)] text-[11px] font-bold px-2 py-0.5 rounded-lg uppercase">
                                  MODE {group.mode}
                                </span>
                                <span className="text-xs text-[var(--text-tertiary)] font-bold">• {group.options.length} Opsi</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Saklar ON / OFF Toggle Switch Condiment Group */}
                            <div
                              className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className={`text-[10px] font-extrabold uppercase tracking-wide ${group.isActive !== false ? 'text-[#047857]' : 'text-slate-400'}`}>
                                {group.isActive !== false ? 'AKTIF' : 'NONAKTIF'}
                              </span>
                              <button
                                type="button"
                                onClick={() => onSaveCondimentGroup({ ...group, isActive: group.isActive === false ? true : false })}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  group.isActive !== false ? 'bg-[#047857]' : 'bg-slate-300'
                                }`}
                                title={group.isActive !== false ? 'Saklar Condiment AKTIF (Klik untuk nonaktifkan)' : 'Saklar Condiment NONAKTIF (Klik untuk aktifkan)'}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    group.isActive !== false ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            <span className="bg-[var(--success-soft)] text-[var(--accent-green)] border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                              <span>🏷️</span>
                              <span>{targetCount} Target</span>
                            </span>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />}
                          </div>
                        </div>

                        {/* Group Options Content matching Screenshot 5 */}
                        {isExpanded && (
                          <div className="p-5 border-t border-[var(--panel-border)] bg-white space-y-5 font-sans">
                            {/* Form Fields Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[13px]-bold-1">NAMA GRUP</label>
                                <input
                                  type="text"
                                  value={group.name}
                                  onChange={(e) => onSaveCondimentGroup({ ...group, name: e.target.value })}
                                  className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[var(--primary)] focus:bg-white"
                                />
                              </div>

                              <div>
                                <label className="text-[13px]-bold-1">MODE PILIHAN</label>
                                <p className="mb-2 text-[10px] font-semibold text-[var(--text-tertiary)]">
                                  Atur jumlah opsi yang boleh dipilih. Ini terpisah dari status Wajib / Opsional.
                                </p>
                                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-1">
                                  <button
                                    type="button"
                                    onClick={() => onSaveCondimentGroup({ ...group, mode: 'PAKET', maxSelect: 1 })}
                                    className={`rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer ${group.mode === 'PAKET' ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-white text-[var(--text-secondary)]'}`}
                                  >
                                    <span className="block text-[10px] font-black uppercase tracking-wider">SINGLE</span>
                                    <span className={`mt-0.5 block text-[9px] font-semibold ${group.mode === 'PAKET' ? 'text-white/75' : 'text-[var(--text-tertiary)]'}`}>Hanya boleh pilih 1</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onSaveCondimentGroup({ ...group, mode: 'ADD_ON', maxSelect: Math.max(2, group.maxSelect || group.options.length || 2) })}
                                    className={`rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer ${group.mode === 'ADD_ON' ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-white text-[var(--text-secondary)]'}`}
                                  >
                                    <span className="block text-[10px] font-black uppercase tracking-wider">MULTIPLE</span>
                                    <span className={`mt-0.5 block text-[9px] font-semibold ${group.mode === 'ADD_ON' ? 'text-white/75' : 'text-[var(--text-tertiary)]'}`}>Bisa memilih lebih dari 1</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Mode Pilihan & Berlaku Untuk */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[13px]-bold-1">KEWAJIBAN PILIHAN</label>
                                <p className="mb-2 text-[10px] font-semibold text-[var(--text-tertiary)]">
                                  Tentukan apakah pelanggan harus mengisi grup ini atau boleh melewatinya.
                                </p>
                                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-1">
                                  <button
                                    type="button"
                                    onClick={() => onSaveCondimentGroup({ ...group, required: true, isRequired: true, minSelect: Math.max(1, group.minSelect || 1) })}
                                    className={`rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer ${(group.isRequired ?? group.required ?? false) ? 'bg-[var(--primary)] text-white shadow-[var(--shadow-md)]' : 'bg-white text-[var(--text-secondary)]'}`}
                                  >
                                    <span className="block text-[10px] font-black uppercase tracking-wider">WAJIB PILIH</span>
                                    <span className={`mt-0.5 block text-[9px] font-semibold ${(group.isRequired ?? group.required ?? false) ? 'text-white/75' : 'text-[var(--text-tertiary)]'}`}>Harus ada pilihan</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onSaveCondimentGroup({ ...group, required: false, isRequired: false, minSelect: 0 })}
                                    className={`rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer ${!(group.isRequired ?? group.required ?? false) ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-[var(--text-secondary)]'}`}
                                  >
                                    <span className="block text-[10px] font-black uppercase tracking-wider">OPSIONAL</span>
                                    <span className="mt-0.5 block text-[9px] font-semibold text-[var(--text-tertiary)]">Boleh kosong</span>
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="text-[13px]-bold-1">TARGET KATEGORI (BISA LEBIH DARI 1)</label>
                                <div className="flex min-h-11 flex-wrap gap-1.5 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-1.5">
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
                                        className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-colors ${selected ? 'bg-[var(--primary)] text-white' : 'bg-white text-[var(--text-secondary)] hover:text-[var(--primary-hover)]'}`}
                                      >
                                        {category === 'ALL' ? 'SEMUA' : category}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <section className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 space-y-4">
                              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-orange-600" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-orange-900">Peran di Self Order</h4>
                                  </div>
                                  <p className="mt-1 text-[11px] font-semibold text-orange-800/70">
                                    Aturan ini hanya mengatur customer QR order. POS kasir tetap mengikuti konfigurasi grup normal.
                                  </p>
                                </div>
                                {selfOrderRole !== 'NONE' && (
                                  <span className="w-fit rounded-full bg-orange-600 px-2.5 py-1 text-[9px] font-black text-white">
                                    SELF ORDER · {selfOrderRole === 'BROTH' ? 'KUAH' : 'ISIAN'}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { key: 'NONE' as const, label: 'Normal', detail: 'Tanpa preset' },
                                  { key: 'BROTH' as const, label: 'Kuah', detail: 'Default otomatis' },
                                  { key: 'FILLING' as const, label: 'Isian', detail: 'Bakso Saja / Campur' },
                                ].map((role) => (
                                  <button
                                    key={role.key}
                                    type="button"
                                    onClick={() => {
                                      if (role.key === 'NONE') {
                                        onSaveCondimentGroup({ ...group, selfOrderRole: 'NONE' });
                                        return;
                                      }
                                      if (role.key === 'BROTH') {
                                        const defaults = brothDefaults.length ? brothDefaults : activeOptionNames.slice(0, 1);
                                        onSaveCondimentGroup({
                                          ...group,
                                          selfOrderRole: 'BROTH',
                                          selfOrderDefaultOptions: defaults,
                                          mode: 'PAKET',
                                          required: true,
                                          isRequired: true,
                                          minSelect: 1,
                                          maxSelect: 1,
                                        });
                                        return;
                                      }
                                      const nextBaksoOnly = baksoOnlyDefaults;
                                      const nextCampur = campurDefaults;
                                      onSaveCondimentGroup({
                                        ...group,
                                        selfOrderRole: 'FILLING',
                                        selfOrderBaksoOnlyOptions: nextBaksoOnly,
                                        selfOrderCampurOptions: nextCampur,
                                        mode: 'ADD_ON',
                                        required: true,
                                        isRequired: true,
                                        minSelect: 1,
                                        maxSelect: Math.max(group.maxSelect || 1, nextBaksoOnly.length, nextCampur.length),
                                        allSelectedLabel: group.allSelectedLabel || 'CAMPUR',
                                      });
                                    }}
                                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                                      selfOrderRole === role.key
                                        ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                                        : 'border-orange-100 bg-white text-slate-700 hover:border-orange-300'
                                    }`}
                                  >
                                    <span className="block text-[11px] font-black">{role.label}</span>
                                    <span className={`mt-0.5 block text-[9px] font-semibold ${selfOrderRole === role.key ? 'text-white/75' : 'text-slate-400'}`}>
                                      {role.detail}
                                    </span>
                                  </button>
                                ))}
                              </div>

                              {selfOrderRole === 'BROTH' && (
                                <div className="rounded-xl border border-orange-100 bg-white p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-[10px] font-black text-slate-800">DEFAULT KUAH CUSTOMER</p>
                                      <p className="mt-0.5 text-[9px] font-semibold text-slate-400">
                                        Customer langsung mendapat pilihan ini. Rekomendasi: ORIGINAL.
                                      </p>
                                    </div>
                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black text-emerald-700">1 PILIHAN</span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {group.options.filter((option) => option.isAvailable !== false).map((option) => {
                                      const selected = brothDefaults.some((name) => normalizeCondimentName(name) === normalizeCondimentName(option.name));
                                      return (
                                        <button
                                          key={`broth-${option.id}`}
                                          type="button"
                                          onClick={() => onSaveCondimentGroup({
                                            ...group,
                                            selfOrderRole: 'BROTH',
                                            selfOrderDefaultOptions: [option.name],
                                            mode: 'PAKET',
                                            required: true,
                                            isRequired: true,
                                            minSelect: 1,
                                            maxSelect: 1,
                                          })}
                                          className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
                                        >
                                          {selected ? '✓ ' : ''}{option.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {selfOrderRole === 'FILLING' && (
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                  <div className="rounded-xl border border-orange-100 bg-white p-3">
                                    <p className="text-[10px] font-black text-slate-800">PRESET “BAKSO SAJA”</p>
                                    <p className="mt-0.5 text-[9px] font-semibold text-slate-400">
                                      Default Bakso Ujo: hanya BAWANG + SLEDRI.
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {group.options.filter((option) => option.isAvailable !== false && !['BAKSOAJA', 'BAKSOSAJA'].includes(normalizeCondimentName(option.name))).map((option) => {
                                        const selected = baksoOnlyDefaults.some((name) => normalizeCondimentName(name) === normalizeCondimentName(option.name));
                                        return (
                                          <button
                                            key={`bakso-only-${option.id}`}
                                            type="button"
                                            onClick={() => {
                                              const next = selected
                                                ? baksoOnlyDefaults.filter((name) => normalizeCondimentName(name) !== normalizeCondimentName(option.name))
                                                : [...baksoOnlyDefaults, option.name];
                                              onSaveCondimentGroup({
                                                ...group,
                                                selfOrderRole: 'FILLING',
                                                selfOrderBaksoOnlyOptions: next,
                                                maxSelect: Math.max(group.maxSelect || 1, next.length, campurDefaults.length),
                                              });
                                            }}
                                            className={`rounded-full border px-2.5 py-1.5 text-[9px] font-bold transition ${selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                                          >
                                            {selected ? '✓ ' : ''}{option.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-orange-100 bg-white p-3">
                                    <p className="text-[10px] font-black text-slate-800">PRESET “CAMPUR”</p>
                                    <p className="mt-0.5 text-[9px] font-semibold text-slate-400">
                                      Default: semua isian aktif kecuali KWETIAW.
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {group.options.filter((option) => option.isAvailable !== false && !['BAKSOAJA', 'BAKSOSAJA'].includes(normalizeCondimentName(option.name))).map((option) => {
                                        const selected = campurDefaults.some((name) => normalizeCondimentName(name) === normalizeCondimentName(option.name));
                                        return (
                                          <button
                                            key={`campur-${option.id}`}
                                            type="button"
                                            onClick={() => {
                                              const next = selected
                                                ? campurDefaults.filter((name) => normalizeCondimentName(name) !== normalizeCondimentName(option.name))
                                                : [...campurDefaults, option.name];
                                              onSaveCondimentGroup({
                                                ...group,
                                                selfOrderRole: 'FILLING',
                                                selfOrderCampurOptions: next,
                                                maxSelect: Math.max(group.maxSelect || 1, next.length, baksoOnlyDefaults.length),
                                                allSelectedLabel: group.allSelectedLabel || 'CAMPUR',
                                              });
                                            }}
                                            className={`rounded-full border px-2.5 py-1.5 text-[9px] font-bold transition ${selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                                          >
                                            {selected ? '✓ ' : ''}{option.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="lg:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-800">
                                    Opsi lama bernama “BAKSO AJA / BAKSO SAJA” tidak dipakai sebagai isian pada UI customer baru. Tombol preset menjadi shortcut, sedangkan isi sebenarnya mengikuti pilihan di atas.
                                  </div>
                                </div>
                              )}
                            </section>

                            <div>
                              <label className="text-[13px]-bold-1">LABEL RINGKAS DI DAPUR</label>
                              <input
                                type="text"
                                placeholder="Contoh: CAMPUR (kosongkan untuk tampilkan daftar penuh)"
                                value={group.allSelectedLabel || ''}
                                onChange={(event) => onSaveCondimentGroup({ ...group, allSelectedLabel: event.target.value.toUpperCase() })}
                                className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[var(--primary)] focus:bg-white"
                              />
                              <p className="mt-1 text-[11px] font-bold text-[var(--text-tertiary)]">
                                Jika pilihan sama persis dengan preset Campur (atau semua opsi bila preset belum diatur), tiket dapur menampilkan label ini.
                              </p>
                            </div>

                            <div>
                              <label className="text-[13px]-bold-1">TARGET MENU ITEM (BISA LEBIH DARI 1)</label>
                              <select
                                value=""
                                onChange={(event) => {
                                  const productId = event.target.value;
                                  if (!productId || selectedProductIds.includes(productId)) return;
                                  onSaveCondimentGroup({ ...group, targetProductIds: [...selectedProductIds, productId] });
                                }}
                                className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[var(--primary)] focus:bg-white"
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
                                      <button key={productId} type="button" onClick={() => onSaveCondimentGroup({ ...group, targetProductIds: selectedProductIds.filter((id) => id !== productId) })} className="flex items-center gap-1 rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-2.5 py-1 text-[11px] font-bold text-[var(--primary-hover)]">
                                        {item?.name || 'Menu tidak ditemukan'} <X className="h-3 w-3" />
                                      </button>
                                    );
                                  })}
                                  {selectedProductNames.map((productName) => (
                                    <button key={`legacy-${productName}`} type="button" onClick={() => onSaveCondimentGroup({ ...group, targetProductNames: selectedProductNames.filter((name) => name !== productName) })} className="flex items-center gap-1 rounded-full border border-[var(--panel-border)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)]">
                                      {productName} <X className="h-3 w-3" />
                                    </button>
                                  ))}
                                </div>
                              )}
                              <p className="mt-1.5 text-[11px] font-semibold text-[var(--text-tertiary)]">Kategori dan menu item digabungkan. Grup muncul jika salah satu target cocok.</p>
                            </div>

                            {/* Options List Tags */}
                            <div>
                              <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-2">DAFTAR OPSI / PILIHAN</label>

                              <div className="flex items-center gap-2 mb-3">
                                <input
                                  type="text"
                                  placeholder="Ketik nama pilihan (misal: Bakso Halus)..."
                                  value={newOptionNames[group.id] || ''}
                                  onChange={(e) => setNewOptionNames({ ...newOptionNames, [group.id]: e.target.value })}
                                  className="flex-1 bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[var(--primary)] focus:bg-white"
                                />
                                <input
                                  type="number"
                                  placeholder="Harga (+Rp)"
                                  value={newOptionPrices[group.id] || ''}
                                  onChange={(e) => setNewOptionPrices({ ...newOptionPrices, [group.id]: Number(e.target.value) })}
                                  className="w-28 bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[var(--primary)] focus:bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddOptionToGroup(group)}
                                  className="w-10 h-10 bg-[var(--primary)] hover:bg-[var(--primary-pressed)] text-white rounded-2xl font-bold flex items-center justify-center cursor-pointer shadow-sm"
                                >
                                  <Plus className="w-5 h-5" />
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {group.options.map((opt) => (
                                  <span
                                    key={opt.id}
                                    className={`border rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                                      editingOptionId === opt.id
                                        ? 'bg-white border-[var(--primary)] px-2 py-0.5 shadow-sm'
                                        : 'bg-[var(--surface-secondary)] border-[var(--panel-border)] px-3 py-1 text-[var(--text-primary)]'
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
                                          className="w-28 text-xs font-bold text-slate-900 outline-none bg-transparent border-b border-[var(--primary)]"
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
                                          className="text-[var(--primary-hover)] hover:text-[var(--primary-hover)] cursor-pointer"
                                          title="Simpan nama"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingOptionId(null)}
                                          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer"
                                          title="Batal"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        {/* Saklar ON / OFF Toggle Switch Item Opsi / Topping */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedOpts = group.options.map((o) =>
                                              o.id === opt.id ? { ...o, isAvailable: o.isAvailable === false ? true : false } : o
                                            );
                                            onSaveCondimentGroup({ ...group, options: updatedOpts });
                                          }}
                                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase transition-all cursor-pointer ${
                                            opt.isAvailable !== false
                                              ? 'bg-emerald-100 text-[#047857] border border-emerald-300'
                                              : 'bg-slate-200 text-slate-500 border border-slate-300'
                                          }`}
                                          title={opt.isAvailable !== false ? 'Saklar Option AKTIF (Klik untuk nonaktifkan)' : 'Saklar Option NONAKTIF (Klik untuk aktifkan)'}
                                        >
                                          {opt.isAvailable !== false ? 'ON' : 'OFF'}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingOptionId(opt.id);
                                            setEditingOptionValue(opt.name);
                                          }}
                                          className={`flex items-center gap-1 hover:text-[var(--primary-hover)] cursor-pointer transition-colors ${
                                            opt.isAvailable === false ? 'line-through opacity-50' : ''
                                          }`}
                                          title="Klik untuk edit nama"
                                        >
                                          <span>{opt.name.toUpperCase()}</span>
                                          <Edit2 className="w-3 h-3 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100" />
                                        </button>
                                        {opt.price > 0 && <span className="text-[var(--primary-hover)] font-mono">+Rp{opt.price.toLocaleString('id-ID')}</span>}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedOpts = group.options.filter((o) => o.id !== opt.id);
                                            onSaveCondimentGroup({ ...group, options: updatedOpts });
                                          }}
                                          className="text-[var(--text-tertiary)] hover:text-rose-600 transition-colors p-0.5"
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
                                className={`px-4 py-2 border font-bold text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer transition-colors ${
                                  confirmingDeleteId === group.id
                                    ? 'bg-rose-600 border-rose-700 text-white'
                                    : 'bg-[var(--danger-soft)] hover:bg-rose-100 border-rose-200 text-[var(--accent-red)]'
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
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Keuangan</h2>
                  <p className="text-xs text-[var(--text-tertiary)] font-medium">Pajak, service charge, dan metode pembulatan.</p>
                </div>

                <div className="space-y-4">
                  {/* Pajak Tax */}
                  <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">Pajak (Tax)</p>
                      <p className="text-xs text-[var(--text-tertiary)] font-medium">Persentase pajak yang dibebankan ke pelanggan.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-white border border-[var(--panel-border)] rounded-2xl px-3 py-1.5">
                        <input
                          type="number"
                          value={formProfile.taxRatePercent}
                          onChange={(e) => setFormProfile({ ...formProfile, taxRatePercent: Number(e.target.value) })}
                          className="w-12 text-center font-bold text-sm text-[var(--text-primary)] outline-none"
                        />
                        <span className="font-semibold text-[var(--text-tertiary)]">%</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setFormProfile({ ...formProfile, isTaxEnabled: !formProfile.isTaxEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                          formProfile.isTaxEnabled ? 'bg-emerald-600' : 'bg-[var(--panel-border)]'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formProfile.isTaxEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Service Charge */}
                  <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">Service Charge</p>
                      <p className="text-xs text-[var(--text-tertiary)] font-medium">Biaya layanan tambahan (opsional).</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-white border border-[var(--panel-border)] rounded-2xl px-3 py-1.5">
                        <input
                          type="number"
                          value={formProfile.serviceChargePercent}
                          onChange={(e) => setFormProfile({ ...formProfile, serviceChargePercent: Number(e.target.value) })}
                          className="w-12 text-center font-bold text-sm text-[var(--text-primary)] outline-none"
                        />
                        <span className="font-semibold text-[var(--text-tertiary)]">%</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setFormProfile({ ...formProfile, isServiceChargeEnabled: !formProfile.isServiceChargeEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                          formProfile.isServiceChargeEnabled ? 'bg-emerald-600' : 'bg-[var(--panel-border)]'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formProfile.isServiceChargeEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Diskon Manual */}
                  <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">Diskon Manual</p>
                      <p className="text-xs text-[var(--text-tertiary)] font-medium">Aktifkan fitur diskon per transaksi di POS.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[var(--accent-green)]">AKTIF</span>
                      <button
                        type="button"
                        onClick={() => setFormProfile({ ...formProfile, isManualDiscountEnabled: !formProfile.isManualDiscountEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                          formProfile.isManualDiscountEnabled ? 'bg-emerald-600' : 'bg-[var(--panel-border)]'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formProfile.isManualDiscountEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Konfirmasi Terminal Kasir */}
                  <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 space-y-4">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">Konfirmasi Terminal Kasir</p>
                      <p className="text-xs text-[var(--text-tertiary)] font-medium">
                        Minta kasir menekan tombol dua kali sebelum aksi dijalankan. Menahan salah klik, tapi memperlambat saat jam ramai.
                      </p>
                    </div>

                    {([
                      { key: 'confirmBeforeSaveOrder' as const, label: 'Tanya sebelum SIMPAN', hint: 'Tombol berubah jadi "Yakin simpan?" dulu.' },
                      { key: 'confirmBeforePayment' as const, label: 'Tanya sebelum BAYAR', hint: 'Tombol berubah jadi "Yakin bayar?" dulu.' }
                    ]).map(({ key, label, hint }) => {
                      const isOn = formProfile[key] === true;
                      return (
                        <div key={key} className="flex items-center justify-between gap-3 border-t border-[var(--panel-border)] pt-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--text-primary)]">{label}</p>
                            <p className="text-[11px] text-[var(--text-tertiary)] font-medium">{hint}</p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-xs font-bold ${isOn ? 'text-[var(--accent-green)]' : 'text-[var(--text-tertiary)]'}`}>
                              {isOn ? 'AKTIF' : 'NONAKTIF'}
                            </span>
                            <button
                              type="button"
                              aria-pressed={isOn}
                              onClick={() => setFormProfile({ ...formProfile, [key]: !isOn })}
                              className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${isOn ? 'bg-emerald-600' : 'bg-[var(--panel-border)]'}`}
                            >
                              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isOn ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pembulatan Harga */}
                  <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">Pembulatan Harga</p>
                      <p className="text-xs text-[var(--text-tertiary)] font-medium">Bulatkan total ke nominal terdekat.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={formProfile.roundingMode || 'TERDEKAT'}
                        onChange={(e) => setFormProfile({ ...formProfile, roundingMode: e.target.value as 'TERDEKAT' | 'KEATAS' | 'KEBAWAH' })}
                        className="bg-white border border-[var(--panel-border)] rounded-2xl px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                      >
                        <option value="TERDEKAT">Terdekat</option>
                        <option value="KEATAS">Ke Atas</option>
                        <option value="KEBAWAH">Ke Bawah</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setFormProfile({ ...formProfile, isRoundingEnabled: !formProfile.isRoundingEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                          formProfile.isRoundingEnabled ? 'bg-emerald-600' : 'bg-[var(--panel-border)]'
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
                <div className="bg-white rounded-2xl p-6 border border-[var(--panel-border)]/80 shadow-sm space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center shadow-md">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">Hak Akses & Role</h2>
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">Kontrol fitur apa saja yang bisa diakses setiap role.</p>
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
                      className="ml-auto rounded-xl bg-[var(--primary)] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-50"
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
                      <div key={feature.key} className="bg-[var(--surface-secondary)]/90 rounded-2xl p-4 border border-[var(--panel-border)]/80 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[var(--brand-50)] text-[var(--primary-hover)] flex items-center justify-center shrink-0">
                            <feature.icon className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-wide uppercase truncate">
                            {feature.label}
                          </span>
                        </div>

                        {/* 4 Roles Sub-Labels & Toggles: CAS, KIT, STA, ADM */}
                        <div className="grid grid-cols-4 gap-1 text-center pt-2 border-t border-[var(--panel-border)]/60">
                          {(['KASIR', 'KITCHEN', 'MANAGER', 'ADMIN'] as UserRole[]).map((role) => {
                            const roleAbbr = role === 'KASIR' ? 'CAS' : role === 'KITCHEN' ? 'KIT' : role === 'MANAGER' ? 'STA' : 'ADM';
                            const rule = accessDraft.find((r) => r.role === role);
                            const isChecked = rule ? (rule as any)[feature.key] ?? (role === 'ADMIN' || (role === 'KASIR' && feature.key === 'canAccessPOS')) : role === 'ADMIN';

                            return (
                              <div key={role} className="flex flex-col items-center space-y-1">
                                <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase">{roleAbbr}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = accessDraft.map((item) =>
                                      item.role === role ? { ...item, [feature.key]: !isChecked } : item
                                    );
                                    setAccessDraft(updated);
                                  }}
                                  className={`w-7 h-4 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                                    isChecked ? 'bg-[var(--primary)]' : 'bg-[var(--panel-border)]'
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
                <div className="bg-white rounded-2xl p-6 border border-[var(--panel-border)]/80 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Grid className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Meja untuk Customer Order</h3>
                        <p className="text-xs font-semibold text-[var(--text-secondary)]">
                          Hanya nomor meja di daftar ini yang bisa melakukan order dari halaman pelanggan.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsTableModalOpen(true)}
                        className="py-2 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all"
                      >
                        Buka Manajemen Meja
                      </button>
                    </label>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      value={formProfile.allowedSelfOrderTables || '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15'}
                      onChange={(e) => setFormProfile({ ...formProfile, allowedSelfOrderTables: e.target.value })}
                      placeholder="1,2,3,4,5,6,7,8,9,10,11,12,13,14,15"
                      className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:bg-white focus:border-[var(--primary)] transition-all font-mono tracking-wider"
                    />
                    <p className="text-[11px] font-semibold text-[var(--text-tertiary)]">
                      Pisahkan dengan koma. Kosongkan jika semua meja boleh menggunakan customer order.
                    </p>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setIsTableModalOpen(true)}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer"
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
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Database & Reset</h2>
                  <p className="text-xs text-[var(--text-tertiary)] font-medium">Zona berbahaya. Hapus data atau reset aplikasi.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-amber-200 rounded-2xl p-5 bg-amber-50/40 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Hapus Transaksi</h3>
                        <p className="text-[11px] text-[var(--text-tertiary)] font-medium">Hapus data order & laporan. Produk aman.</p>
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

                  <div className="border border-rose-200 rounded-2xl p-5 bg-[var(--danger-soft)]/40 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-rose-900">Factory Reset</h3>
                        <p className="text-[11px] text-[var(--accent-red)] font-medium">Hapus SEMUA data & kembali ke awal.</p>
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
                <div className="bg-[var(--primary)] text-white rounded-2xl p-6 space-y-3 mt-6 border border-[var(--primary-border)]">
                  <div className="flex items-center gap-2 text-[var(--primary-text)] font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>RANCANGAN ARSITEKTUR KOSTUMISASI FREE TIER (VERCEL, SUPABASE & CLOUDINARY)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Sistem ini terintegrasi secara modular untuk berjalan di atas kuota <strong>Free Tier</strong> tanpa biaya langganan berlebih:
                  </p>
                  <ul className="text-xs text-[var(--text-tertiary)] space-y-1.5 list-disc pl-5 font-medium">
                    <li><strong>Vercel Edge Deployment:</strong> Hosting SPA React & PWA Service Worker tanpa server overhead.</li>
                    <li><strong>Supabase Realtime:</strong> KDS dan Kasir memakai Broadcast privat berisi invalidation kecil; data resmi selalu diambil ulang dari database, dengan polling hanya sebagai fallback.</li>
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
        <div className="fixed inset-0 bg-slate-600/30 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[var(--panel-border)] w-full max-w-md rounded-2xl p-6 shadow-xl relative">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Tambah Grup Topping / Isian</h3>
            <form onSubmit={handleCreateNewGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Nama Grup (Contoh: Extra Sambal)</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-xl px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Mode Pilihan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewGroupMode('PAKET')}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${newGroupMode === 'PAKET' ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--panel-border)] bg-white text-[var(--text-secondary)]'}`}
                  >
                    <span className="block text-[10px] font-black uppercase">SINGLE</span>
                    <span className={`mt-0.5 block text-[9px] font-semibold ${newGroupMode === 'PAKET' ? 'text-white/75' : 'text-[var(--text-tertiary)]'}`}>Hanya 1 pilihan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewGroupMode('ADD_ON')}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${newGroupMode === 'ADD_ON' ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--panel-border)] bg-white text-[var(--text-secondary)]'}`}
                  >
                    <span className="block text-[10px] font-black uppercase">MULTIPLE</span>
                    <span className={`mt-0.5 block text-[9px] font-semibold ${newGroupMode === 'ADD_ON' ? 'text-white/75' : 'text-[var(--text-tertiary)]'}`}>Bisa lebih dari 1</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Kewajiban Pilihan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewGroupRequired(true)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${newGroupRequired ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--panel-border)] bg-white text-[var(--text-secondary)]'}`}
                  >
                    <span className="block text-[10px] font-black uppercase">WAJIB PILIH</span>
                    <span className={`mt-0.5 block text-[9px] font-semibold ${newGroupRequired ? 'text-white/75' : 'text-[var(--text-tertiary)]'}`}>Harus ada pilihan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewGroupRequired(false)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${!newGroupRequired ? 'border-slate-300 bg-slate-50 text-slate-900' : 'border-[var(--panel-border)] bg-white text-[var(--text-secondary)]'}`}
                  >
                    <span className="block text-[10px] font-black uppercase">OPSIONAL</span>
                    <span className="mt-0.5 block text-[9px] font-semibold text-[var(--text-tertiary)]">Boleh kosong</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Target Kategori Menu</label>
                <select
                  value={newGroupCategory}
                  onChange={(e) => setNewGroupCategory(e.target.value as CategoryType)}
                  className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-xl px-3.5 py-2 text-xs font-bold text-[var(--text-primary)]"
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
                  className="px-4 py-2 bg-[var(--surface-secondary)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="ui-button ui-button-primary cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'rgba(24,24,27,0.4)' }}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (editingStaff) {
                if (editingStaff.pin && !/^\d{6}$/.test(editingStaff.pin)) {
                  toast('PIN Tidak Valid', 'PIN baru harus tepat 6 digit, atau kosongkan jika tidak diubah.');
                  return;
                }
                if (editingStaff.nik && !/^\d{16}$/.test(editingStaff.nik)) {
                  toast('NIK Tidak Valid', 'NIK harus tepat 16 digit angka.');
                  return;
                }
                try {
                  await onSaveStaff(editingStaff);
                  setEditingStaff(null);
                } catch {
                  // error ditampilkan oleh parent
                }
              }
            }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border bg-white font-sans shadow-2xl"
            style={{ borderColor: 'var(--panel-border)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--panel-border-light)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary-hover)' }}>
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    Edit Data Karyawan
                  </h3>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {editingStaff.name}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setEditingStaff(null)}
                className="ui-icon-button h-8 w-8" aria-label="Tutup">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* ── 1. Identitas Login ── */}
              <div className="rounded-2xl border p-4 space-y-3"
                style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-card)' }}>
                <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--panel-border-light)' }}>
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--primary-hover)]">
                    <UserCheck className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--primary-text)]">
                    1. Identitas Login
                  </h4>
                </div>

                <div>
                  <label className="ui-form-label block mb-1">Nama Tampilan *</label>
                  <input type="text" required className="ui-input"
                    placeholder="Contoh: Budi Kasir"
                    value={editingStaff.name || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ui-form-label block mb-1">Role Penugasan *</label>
                    <select className="ui-input font-bold"
                      value={editingStaff.role || 'KASIR'}
                      onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value as any })}>
                      <option value="KASIR">Kasir</option>
                      <option value="KITCHEN">Dapur (Kitchen)</option>
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manajer</option>
                      <option value="OWNER">Owner</option>
                      <option value="SUPER_OWNER">Super Owner</option>
                    </select>
                  </div>
                  <div>
                    <label className="ui-form-label block mb-1">PIN 6-Angka *</label>
                    <input type="password" maxLength={6} inputMode="numeric" className="ui-input font-mono tracking-widest"
                      value={editingStaff.pin || ''} placeholder="Kosong = tidak diubah"
                      onChange={(e) => setEditingStaff({ ...editingStaff, pin: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* ── 2. Data Sesuai KTP ── */}
              <div className="rounded-2xl border p-4 space-y-3"
                style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-card)' }}>
                <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--panel-border-light)' }}>
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--primary-hover)]">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--primary-text)]">
                    2. Data Sesuai KTP
                  </h4>
                </div>

                <div>
                  <label className="ui-form-label block mb-1">Nama Lengkap Sesuai KTP</label>
                  <input type="text" className="ui-input"
                    placeholder="Sesuai dokumen resmi KTP"
                    value={editingStaff.fullNameKtp || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, fullNameKtp: e.target.value })} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="ui-form-label">NIK 16-Digit KTP</label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {editingStaff.nik ? `${editingStaff.nik.length}/16` : '0/16'}
                    </span>
                  </div>
                  <input type="text" inputMode="numeric" maxLength={16} className="ui-input font-mono tracking-wider"
                    placeholder="3271000000000000"
                    value={editingStaff.nik || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, nik: e.target.value.replace(/\D/g, '').slice(0, 16) })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ui-form-label block mb-1">Tempat Lahir</label>
                    <input type="text" className="ui-input"
                      placeholder="Kab. / Kota"
                      value={editingStaff.birthPlace || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, birthPlace: e.target.value })} />
                  </div>
                  <div>
                    <label className="ui-form-label block mb-1">Tanggal Lahir</label>
                    <input type="date" className="ui-input"
                      value={editingStaff.birthDate || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, birthDate: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="ui-form-label block mb-1">Alamat Sesuai KTP</label>
                  <textarea className="ui-input resize-none"
                    style={{ minHeight: '60px', paddingTop: '8px', paddingBottom: '8px' }}
                    placeholder="Jl. Raya Contoh No. 12, RT 01/RW 02, Kelurahan, Kecamatan"
                    value={editingStaff.address || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, address: e.target.value })} />
                </div>
              </div>

              {/* ── 3. Kontak & Kepegawaian ── */}
              <div className="rounded-2xl border p-4 space-y-3"
                style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-card)' }}>
                <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--panel-border-light)' }}>
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--primary-hover)]">
                    <Phone className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--primary-text)]">
                    3. Kontak & Kepegawaian
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ui-form-label block mb-1">No. HP / WhatsApp</label>
                    <input type="tel" inputMode="numeric" className="ui-input font-mono"
                      placeholder="08123456789"
                      value={editingStaff.phone || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="ui-form-label block mb-1">Tanggal Mulai Kerja</label>
                    <input type="date" className="ui-input"
                      value={editingStaff.joinDate || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, joinDate: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="ui-form-label block mb-1">Outlet Penugasan</label>
                  <select className="ui-input"
                    value={editingStaff.branchIds?.length === branches.length ? '' : editingStaff.branchIds?.[0] || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, branchIds: e.target.value ? [e.target.value] : branches.map((b) => b.id) })}>
                    <option value="">Semua Outlet (Akses Global)</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ui-form-label block mb-1">Jam Mulai Shift</label>
                    <input type="time" className="ui-input"
                      value={editingStaff.shiftStart || '08:00'}
                      onChange={(e) => setEditingStaff({ ...editingStaff, shiftStart: e.target.value })} />
                  </div>
                  <div>
                    <label className="ui-form-label block mb-1">Jam Selesai Shift</label>
                    <input type="time" className="ui-input"
                      value={editingStaff.shiftEnd || '16:00'}
                      onChange={(e) => setEditingStaff({ ...editingStaff, shiftEnd: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex justify-end gap-2 border-t px-5 py-4"
              style={{ borderColor: 'var(--panel-border-light)' }}>
              <button type="button" onClick={() => setEditingStaff(null)} className="ui-button ui-button-secondary">
                Batal
              </button>
              <button type="submit" className="ui-button ui-button-primary">
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Panduan Konfigurasi Menu & Tips (Matching Screenshot 4) */}
      {showCondimentTips && (
        <div className="fixed inset-0 bg-slate-600/30 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[var(--panel-border)] w-full max-w-lg rounded-2xl p-6 md:p-8 shadow-xl space-y-5 font-sans text-slate-900 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[var(--primary-hover)] font-bold text-sm">
                <Info className="w-5 h-5 text-[var(--primary-hover)]" />
                <span>Panduan Konfigurasi Menu</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCondimentTips(false)}
                className="w-7 h-7 bg-[var(--surface-secondary)] hover:bg-[var(--surface-secondary)] rounded-full flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-xs text-[var(--primary-hover)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[var(--primary-hover)]" />
                  <span>Apa Fungsi Grup?</span>
                </h4>
                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                  Grup adalah wadah untuk mengelompokkan opsi tambahan pada menu. Anda bisa membuat banyak grup sesuai kebutuhan.
                </p>
                <div className="space-y-2 mt-3">
                  <div className="bg-amber-50/60 border border-amber-200/80 p-3 rounded-2xl">
                    <span className="bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded uppercase font-mono mr-2">SINGLE</span>
                    <strong className="text-xs font-bold text-slate-900">Hanya boleh memilih 1</strong>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-1">Mengatur jumlah pilihan, bukan kewajibannya. SINGLE dapat dibuat Wajib maupun Opsional.</p>
                  </div>

                  <div className="bg-[var(--brand-50)]/60 border border-[var(--brand-200)]/80 p-3 rounded-2xl">
                    <span className="bg-[var(--primary)] text-white text-[11px] font-bold px-2 py-0.5 rounded uppercase font-mono mr-2">MULTIPLE</span>
                    <strong className="text-xs font-bold text-slate-900">Bisa memilih lebih dari 1</strong>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-1">MULTIPLE juga dapat Wajib atau Opsional. Cocok untuk isian, topping, dan kombinasi beberapa opsi.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <strong className="text-[10px] font-black text-emerald-800">WAJIB PILIH</strong>
                      <p className="mt-1 text-[10px] font-semibold text-emerald-700/75">Harus ada minimal satu pilihan sebelum order dapat dikirim.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <strong className="text-[10px] font-black text-slate-700">OPSIONAL</strong>
                      <p className="mt-1 text-[10px] font-semibold text-slate-500">Pelanggan boleh melewati grup tanpa memilih.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-xs text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Apa Fungsi Preset?</span>
                </h4>
                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                  Preset adalah template konfigurasi siap pakai. Gunakan tombol <strong className="text-amber-700">"Preset Standar"</strong> untuk membuat struktur grup umum (seperti Varian + Topping) secara otomatis tanpa perlu mengetik manual.
                </p>
              </div>

              <div className="bg-[var(--brand-50)]/60 border border-[var(--brand-200)] p-4 rounded-2xl space-y-2">
                <h4 className="font-bold text-xs text-[var(--primary-hover)] uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-[var(--primary-hover)]" />
                  <span>Tips Konfigurasi Kuah</span>
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)] font-bold">Contoh konfigurasi yang disarankan:</p>
                <ol className="text-xs text-[var(--text-primary)] space-y-1 list-decimal pl-5 font-medium">
                  <li><strong>Kuah Bakso:</strong> SINGLE + Wajib Pilih. Set default Self Order ke ORIGINAL.</li>
                  <li><strong>Teh Manis Dingin / Panas:</strong> SINGLE + Wajib Pilih.</li>
                  <li><strong>Air Mineral Dingin / Reguler:</strong> SINGLE + Wajib Pilih.</li>
                  <li><strong>Isian Bakso Ujo:</strong> MULTIPLE + Wajib Pilih, lalu atur preset Bakso Saja dan Campur.</li>
                  <li><strong>Topping tambahan:</strong> umumnya MULTIPLE + Opsional.</li>
                </ol>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCondimentTips(false)}
                className="ui-button ui-button-primary cursor-pointer"
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
      />
    </div>
  );
};
