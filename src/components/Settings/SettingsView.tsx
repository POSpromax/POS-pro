import React, { useEffect, useRef, useState } from 'react';
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
  ImageIcon,
  GripVertical
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
import { CondimentPreviewPanel } from './CondimentPreviewPanel';
import { CondimentBuilderPanel } from './CondimentBuilderPanel';
import { purgeCompletedOrders } from '../../services/transactionPurgeService';

const STAFF_WEEKDAYS = [
  { day: 1, short: 'Sen', label: 'Senin' },
  { day: 2, short: 'Sel', label: 'Selasa' },
  { day: 3, short: 'Rab', label: 'Rabu' },
  { day: 4, short: 'Kam', label: 'Kamis' },
  { day: 5, short: 'Jum', label: 'Jumat' },
  { day: 6, short: 'Sab', label: 'Sabtu' },
  { day: 0, short: 'Min', label: 'Minggu' },
];

const staffWorkDays = (staff: UserAccount) => staff.workDays?.length ? staff.workDays : [1, 2, 3, 4, 5, 6];
const staffOffDays = (staff: UserAccount) => STAFF_WEEKDAYS.filter((item) => !staffWorkDays(staff).includes(item.day));

const normalizeCondimentName = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const normalizeTableNumber = (value: string) =>
  String(value || '').trim().replace(/^0+(?=\d)/, '');

const parseTableNumberList = (value?: string): string[] => {
  const seen = new Set<string>();
  return String(value || '')
    .split(',')
    .map(normalizeTableNumber)
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));
};

const DEFAULT_KDS_CATEGORY_ORDER: CategoryType[] = [
  'BAKSO',
  'MIE AYAM',
  'MAKANAN',
  'TAMBAHAN',
  'KRIUK',
  'BUNDLING',
  'MINUMAN',
];

const normalizeKdsCategoryOrder = (value?: CategoryType[]): CategoryType[] => {
  const allowed = new Set(DEFAULT_KDS_CATEGORY_ORDER);
  const seen = new Set<CategoryType>();
  const result: CategoryType[] = [];
  for (const category of value || []) {
    if (!allowed.has(category) || seen.has(category)) continue;
    seen.add(category);
    result.push(category);
  }
  for (const category of DEFAULT_KDS_CATEGORY_ORDER) {
    if (!seen.has(category)) result.push(category);
  }
  return result;
};

const moveKdsCategory = (order: CategoryType[], from: CategoryType, to: CategoryType): CategoryType[] => {
  if (from === to) return order;
  const next = [...order];
  const fromIndex = next.indexOf(from);
  const toIndex = next.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return order;
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, from);
  return next;
};

const inferSelfOrderRole = (group: CondimentGroup): 'NONE' | 'BROTH' | 'FILLING' => {
  if (group.selfOrderRole === 'BROTH' || group.selfOrderRole === 'FILLING') return group.selfOrderRole;

  // Canonical KUAH/ISIAN groups self-heal even when an older scope persisted NONE.
  // This prevents a normal settings edit from silently removing Self Order presets.
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
  onSaveProfile: (profile: RestaurantProfile) => void | Promise<void>;
  condimentGroups: CondimentGroup[];
  menuItems: MenuItem[];
  onSaveCondimentGroup: (group: CondimentGroup) => void | Promise<CondimentGroup | void>;
  onDeleteCondimentGroup?: (groupId: string) => void | Promise<void>;
  onToggleGroupActive: (groupId: string, isActive: boolean) => void;
  onToggleOptionAvailable: (groupId: string, optionId: string, isAvailable: boolean) => void;
  onClearTransactions?: () => void;
  onFactoryReset?: () => void;
  staffAccounts: UserAccount[];
  branches: Branch[];
  currentBranch: Branch;
  activeUserRole: UserRole;
  activeUserId?: string;
  onSaveStaff: (staff: UserAccount) => void | Promise<void>;
  onDeleteStaff?: (id: string) => void | Promise<void>;
  accessControl: AccessControlRule[];
  onSaveAccessControl: (rules: AccessControlRule[]) => void | Promise<void>;
  tables?: RestaurantTable[];
  onToggleTableSelfOrder?: (tableId: string, enabled: boolean) => void;
  onToggleAllTables?: (enabled: boolean) => void;
  onEnsureTables?: (tableNumbers: string[]) => void | Promise<void>;
  onShowToast?: (title: string, message: string) => void;
  cloudMode?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onSaveProfile,
  condimentGroups,
  menuItems,
  onSaveCondimentGroup: rawSaveCondimentGroup,
  onDeleteCondimentGroup,
  onToggleGroupActive,
  onToggleOptionAvailable,
  onClearTransactions,
  onFactoryReset,
  staffAccounts,
  branches,
  currentBranch,
  activeUserRole,
  activeUserId,
  onSaveStaff,
  onDeleteStaff,
  accessControl,
  onSaveAccessControl,
  tables = [],
  onToggleTableSelfOrder = () => {},
  onToggleAllTables = () => {},
  onEnsureTables,
  onShowToast,
  cloudMode = false,
}) => {
  const toast = (title: string, message: string) => {
    if (onShowToast) onShowToast(title, message);
  };
  const [activeTab, setActiveTab] = useState<
    'PROFILE' | 'LANDING' | 'KDS' | 'STAFF' | 'CONDIMENTS' | 'FINANCE' | 'ACCESS' | 'DATABASE'
  >('PROFILE');

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const [purgeRetentionDays, setPurgeRetentionDays] = useState(180);
  const [purgeConfirmName, setPurgeConfirmName] = useState('');
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeStep, setPurgeStep] = useState<'idle' | 'confirm'>('idle');
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionValue, setEditingOptionValue] = useState('');
  const [condimentTextDrafts, setCondimentTextDrafts] = useState<Record<string, string>>({});

  const [formProfile, setFormProfile] = useState<RestaurantProfile>(() => ({ ...profile }));
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [saveConfirmKind, setSaveConfirmKind] = useState<'PROFILE' | 'ACCESS' | null>(null);
  const [autoSavePulse, setAutoSavePulse] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState<boolean>(false);
  const [isSyncingTables, setIsSyncingTables] = useState<boolean>(false);
  const [draggedKdsCategory, setDraggedKdsCategory] = useState<CategoryType | null>(null);

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
  const settingsScrollRef = useRef<HTMLDivElement | null>(null);

  const sameValue = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  const profileDirty = !sameValue(formProfile, profile);
  const accessDirty = !sameValue(accessDraft, accessControl);
  const changedByKeys = (keys: string[]) => keys.some((key) => !sameValue((formProfile as any)[key], (profile as any)[key]));
  const centralBrandDirty = changedByKeys(['name', 'logoUrl', 'instagram', 'tiktok']);
  const changedDomains = [
    changedByKeys(['name', 'logoUrl', 'instagram', 'tiktok', 'tagline', 'address', 'phone']) ? 'Profil & Brand' : '',
    changedByKeys(['promoBannerTitle', 'promoBannerDescription', 'wallpaperBackgroundUrl', 'googleReviewUrl', 'googleReviewText', 'allowedSelfOrderTables']) ? 'Self-Order & Meja' : '',
    changedByKeys(['orderTimeLimitMinutes', 'soundNotificationsEnabled', 'soundOrderBaru', 'soundPesananMasuk', 'soundPembayaranSukses', 'soundCustomerOrder', 'kdsCategoryOrder', 'runningText']) ? 'Dapur & KDS' : '',
    changedByKeys(['isAttendanceEnabled', 'shiftScheduleKitchen', 'shiftScheduleCashier', 'shiftScheduleStaff', 'shiftScheduleAdmin', 'latenessToleranceMinutes', 'gpsLatitude', 'gpsLongitude', 'gpsRadiusMeters', 'maxGpsAccuracyMeters', 'requireSelfiePhoto', 'requireGpsActive', 'weeklyOffDays']) ? 'Karyawan & Shift' : '',
    changedByKeys(['taxRatePercent', 'isTaxEnabled', 'serviceChargePercent', 'isServiceChargeEnabled', 'isManualDiscountEnabled', 'roundingMode', 'isRoundingEnabled', 'confirmBeforeSaveOrder', 'confirmBeforePayment']) ? 'Keuangan & Kasir' : '',
  ].filter(Boolean);
  const activeScopeLabel = centralBrandDirty
    ? `Pusat + ${currentBranch.code || 'Cabang'}`
    : currentBranch.code || 'Cabang';

  const tableTargetDirty = changedByKeys(['allowedSelfOrderTables']);
  const gpsSettingsDirty = changedByKeys([
    'isAttendanceEnabled',
    'gpsLatitude',
    'gpsLongitude',
    'gpsRadiusMeters',
    'maxGpsAccuracyMeters',
    'requireGpsActive',
  ]);

  // Condiment changes may round-trip through cloud and replace the group array.
  // Preserve the settings viewport so button/input changes never throw the user
  // to another vertical position while editing a long group.
  const onSaveCondimentGroup = (group: CondimentGroup) => {
    const scrollNode = settingsScrollRef.current;
    const scrollTop = scrollNode?.scrollTop ?? 0;
    setAutoSavePulse(true);
    rawSaveCondimentGroup(group);
    window.setTimeout(() => setAutoSavePulse(false), 1200);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (scrollNode) scrollNode.scrollTop = scrollTop;
      });
    });
  };

  const condimentDraftKey = (groupId: string, field: 'name' | 'allSelectedLabel') => `${groupId}:${field}`;
  const readCondimentDraft = (groupId: string, field: 'name' | 'allSelectedLabel', fallback: string) => {
    const key = condimentDraftKey(groupId, field);
    return Object.prototype.hasOwnProperty.call(condimentTextDrafts, key) ? condimentTextDrafts[key] : fallback;
  };
  const commitCondimentText = (group: CondimentGroup, field: 'name' | 'allSelectedLabel', value: string) => {
    const normalized = field === 'allSelectedLabel' ? value.trim().toUpperCase() : value.trim();
    const fallback = field === 'name' ? group.name : (group.allSelectedLabel || '');
    const mayPersist = field === 'name' ? Boolean(normalized) : true;
    if (mayPersist && normalized !== fallback) onSaveCondimentGroup({ ...group, [field]: normalized });
    setCondimentTextDrafts((current) => {
      const next = { ...current };
      delete next[condimentDraftKey(group.id, field)];
      return next;
    });
  };

  const ROLE_RANK_UI: Record<UserRole, number> = {
    KITCHEN: 10, KASIR: 20, ADMIN: 40, MANAGER: 50, OWNER: 60, SUPER_OWNER: 70,
  };
  const canEditStaffAccount = (staff: UserAccount) => {
    if (staff.id === activeUserId) return true;
    if (activeUserRole === 'SUPER_OWNER') return true;
    return (ROLE_RANK_UI[staff.role] || 0) < (ROLE_RANK_UI[activeUserRole] || 0);
  };

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
    const hasUnsavedChanges = profileDirty || accessDirty;
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [profileDirty, accessDirty]);

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

  const actualTableNumbers = tables
    .map((table) => normalizeTableNumber(table.number))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));
  const desiredTableNumbers = parseTableNumberList(
    formProfile.allowedSelfOrderTables || actualTableNumbers.join(','),
  );
  const actualTableNumberSet = new Set(actualTableNumbers);
  const desiredTableNumberSet = new Set(desiredTableNumbers);
  const missingTableNumbers = desiredTableNumbers.filter((number) => !actualTableNumberSet.has(number));
  const outsideTargetTableNumbers = actualTableNumbers.filter((number) => !desiredTableNumberSet.has(number));
  const kdsCategoryOrder = normalizeKdsCategoryOrder(formProfile.kdsCategoryOrder);

  const saveKdsCategoryOrder = (nextOrder: CategoryType[]) => {
    setFormProfile({ ...formProfile, kdsCategoryOrder: normalizeKdsCategoryOrder(nextOrder) });
  };

  const shiftKdsCategory = (category: CategoryType, direction: -1 | 1) => {
    const currentIndex = kdsCategoryOrder.indexOf(category);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= kdsCategoryOrder.length) return;
    const next = [...kdsCategoryOrder];
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
    saveKdsCategoryOrder(next);
  };

  const handleSyncTableInventory = async () => {
    if (!onEnsureTables) {
      toast('Sinkronisasi Tidak Tersedia', 'Terminal ini belum memiliki handler sinkronisasi inventori meja.');
      return;
    }
    if (!desiredTableNumbers.length) {
      toast('Daftar Meja Kosong', 'Isi minimal satu nomor meja sebelum melakukan sinkronisasi.');
      return;
    }
    if (!missingTableNumbers.length) {
      toast('Inventori Meja Sudah Sinkron', `${tables.length} meja pada ${currentBranch.name} sudah mencakup seluruh daftar target.`);
      return;
    }

    setIsSyncingTables(true);
    try {
      await onEnsureTables(desiredTableNumbers);
      toast('Sinkronisasi Meja Selesai', `${missingTableNumbers.length} meja yang belum ada diminta dibuat untuk ${currentBranch.name}.`);
    } catch (error) {
      toast('Sinkronisasi Meja Gagal', error instanceof Error ? error.message : 'Inventori meja belum dapat disinkronkan.');
    } finally {
      setIsSyncingTables(false);
    }
  };

  const validateProfileDraft = (): string | null => {
    if (!String(formProfile.name || '').trim()) return 'Nama brand / resto tidak boleh kosong.';

    const orderLimit = Number(formProfile.orderTimeLimitMinutes ?? 5);
    if (!Number.isFinite(orderLimit) || orderLimit < 1 || orderLimit > 120) {
      return 'Alarm keterlambatan Kitchen harus antara 1–120 menit.';
    }

    const lateness = Number(formProfile.latenessToleranceMinutes ?? 5);
    if (!Number.isFinite(lateness) || lateness < 0 || lateness > 180) {
      return 'Toleransi keterlambatan staff harus antara 0–180 menit.';
    }

    const taxRate = Number(formProfile.taxRatePercent ?? 0);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      return 'Pajak harus berada pada rentang 0–100%.';
    }

    if (gpsSettingsDirty && formProfile.isAttendanceEnabled !== false && formProfile.requireGpsActive !== false) {
      const lat = Number(formProfile.gpsLatitude);
      const lng = Number(formProfile.gpsLongitude);
      const radius = Number(formProfile.gpsRadiusMeters ?? 20);
      const accuracy = Number(formProfile.maxGpsAccuracyMeters ?? 80);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        return 'Koordinat GPS outlet belum valid. Pastikan latitude dan longitude sudah benar.';
      }
      if (!Number.isFinite(radius) || radius < 5 || radius > 5000) {
        return 'Radius GPS harus antara 5–5.000 meter.';
      }
      if (!Number.isFinite(accuracy) || accuracy < 5 || accuracy > 500) {
        return 'Batas akurasi GPS harus antara 5–500 meter.';
      }
    }

    if (String(formProfile.allowedSelfOrderTables || '').trim() && desiredTableNumbers.length === 0) {
      return 'Daftar target meja Self-Order belum valid.';
    }

    return null;
  };

  const performSaveProfile = async () => {
    if (!profileDirty || isSavingProfile) {
      setSaveConfirmKind(null);
      return;
    }
    setIsSavingProfile(true);
    try {
      await onSaveProfile(formProfile);
      const savedTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSavedAt(savedTime);
      setSaveConfirmKind(null);
      toast(
        'Pengaturan Berhasil Disimpan',
        `${changedDomains.length ? changedDomains.join(', ') : 'Perubahan'} tersimpan untuk ${activeScopeLabel}.`,
      );
    } catch (error) {
      toast('Pengaturan Gagal Disimpan', error instanceof Error ? error.message : 'Perubahan belum tersimpan ke cloud.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const requestSaveProfile = () => {
    if (!profileDirty || isSavingProfile) return;
    const validationError = validateProfileDraft();
    if (validationError) {
      toast('Periksa Pengaturan', validationError);
      return;
    }
    setSaveConfirmKind('PROFILE');
  };

  const performSaveAccess = async () => {
    if (!accessDirty || isSavingAccess) {
      setSaveConfirmKind(null);
      return;
    }
    setIsSavingAccess(true);
    try {
      await onSaveAccessControl(accessDraft);
      setSaveConfirmKind(null);
      setLastSavedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      toast('Hak Akses Tersimpan', 'Matriks role sudah diperbarui untuk seluruh organisasi.');
    } catch (error) {
      toast('Hak Akses Gagal Disimpan', error instanceof Error ? error.message : 'Perubahan hak akses belum tersimpan.');
    } finally {
      setIsSavingAccess(false);
    }
  };

  const requestSaveAccess = () => {
    if (!accessDirty || isSavingAccess) return;
    setSaveConfirmKind('ACCESS');
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

  const settingsTabs = [
    { id: 'PROFILE' as const, label: 'Profil & Brand', shortLabel: 'Profil', icon: Store },
    { id: 'LANDING' as const, label: 'Self-Order & Meja', shortLabel: 'Self-Order', icon: Smartphone },
    { id: 'KDS' as const, label: 'Dapur & KDS', shortLabel: 'Dapur', icon: Volume2 },
    { id: 'STAFF' as const, label: 'Karyawan & Shift', shortLabel: 'Karyawan', icon: Users },
    { id: 'CONDIMENTS' as const, label: 'Isian & Topping', shortLabel: 'Isian', icon: Grid },
    { id: 'FINANCE' as const, label: 'Keuangan & Kasir', shortLabel: 'Keuangan', icon: CreditCard },
    ...(canManageTenant ? [{ id: 'ACCESS' as const, label: 'Hak Akses', shortLabel: 'Akses', icon: Shield }] : []),
    { id: 'DATABASE' as const, label: 'Sistem & Data', shortLabel: 'Sistem', icon: Database },
  ];

  const activeTabMeta = settingsTabs.find((tab) => tab.id === activeTab) || settingsTabs[0];
  return (
    <div ref={settingsScrollRef} className="ui-surface flex-1 overflow-y-auto bg-slate-50/70 px-3 py-3 font-sans text-[var(--text-primary)] md:px-5 md:py-4">
      <div className="mx-auto w-full max-w-[1540px] space-y-3">
        {/* Compact Control Center Header */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--panel-border)] bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
              <Settings className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-lg font-black tracking-tight text-[var(--text-primary)] md:text-xl">Pengaturan Operasional</h1>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Control Center Toko</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--text-tertiary)]">{activeTabMeta.label} · {currentBranch.name}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 ${scopeMeta.tone}`}>
              <ScopeIcon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-wider">{scopeMeta.label}</p>
                <p className="max-w-[340px] truncate text-[10px] font-semibold opacity-75">{scopeMeta.detail}</p>
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black ${profileDirty || accessDirty ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {profileDirty || accessDirty ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {profileDirty || accessDirty ? 'Ada perubahan belum disimpan' : lastSavedAt ? `Tersimpan ${lastSavedAt}` : 'Semua tersimpan'}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Sticky navigation + save command bar. Save is deliberately outside the horizontal tab scroller. */}
          <div className="sticky top-0 z-30 rounded-2xl border border-[var(--panel-border)] bg-white/96 p-2 shadow-sm backdrop-blur-xl">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                {settingsTabs.map((tab) => {
                  const TabIcon = tab.icon;
                  const selected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-extrabold transition md:px-3 md:text-[11px] ${selected ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm' : 'border-transparent bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-[var(--panel-border)] hover:bg-white'}`}
                    >
                      <TabIcon className="h-3.5 w-3.5" />
                      <span className="hidden xl:inline">{tab.label}</span>
                      <span className="xl:hidden">{tab.shortLabel}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 lg:border-l lg:border-t-0 lg:pl-2 lg:pt-0">
                {activeTab === 'CONDIMENTS' && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-2 text-[9px] font-black text-blue-700">
                    <Save className="h-3.5 w-3.5" /> Draft lokal · simpan per grup
                  </span>
                )}

                {activeTab === 'ACCESS' && accessDirty ? (
                  <button
                    type="button"
                    disabled={isSavingAccess}
                    onClick={requestSaveAccess}
                    className="ui-button ui-button-primary min-h-9 whitespace-nowrap px-3 text-[10px]"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isSavingAccess ? 'Menyimpan…' : 'Simpan Hak Akses'}</span>
                  </button>
                ) : profileDirty ? (
                  <button
                    type="button"
                    disabled={isSavingProfile}
                    onClick={requestSaveProfile}
                    className="ui-button ui-button-primary min-h-9 whitespace-nowrap px-3 text-[10px] shadow-sm"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isSavingProfile ? 'Menyimpan…' : `Simpan ${changedDomains.length || 1} Perubahan`}</span>
                  </button>
                ) : activeTab !== 'CONDIMENTS' && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[9px] font-black text-slate-500">
                    <Check className="h-3.5 w-3.5" /> Tidak ada draft
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Main Form Content Panel */}
          <div className="ui-card min-w-0 p-4 md:p-5">
            {/* 1. PROFIL & BRAND (Matching Image 1) */}
            {activeTab === 'PROFILE' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Profil & Brand</h2>
                  <p className="text-xs text-[var(--text-tertiary)] font-medium">Informasi dasar yang tampil di struk dan aplikasi.</p>
                </div>

                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-black text-violet-700">PUSAT · Nama, logo, Instagram, TikTok</span>
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[10px] font-black text-orange-700">{currentBranch.code} · Tagline, alamat, WhatsApp</span>
                  <span className="self-center text-[10px] font-semibold text-slate-500">Perubahan pusat hanya dapat dilakukan Owner.</span>
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
                      <label className="block text-[13px] font-bold">
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
                      <label className="block text-[13px] font-bold">
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
                      <label className="block text-[13px] font-bold">
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
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Self-Order & Meja</h2>
                  <p className="text-xs text-[var(--text-tertiary)] font-medium">Satu tempat untuk inventori meja, tampilan landing pelanggan, dan link review.</p>
                </div>

                <div className="bg-white border border-[var(--panel-border)] rounded-2xl p-4">
                  <p className="text-xs font-bold text-[var(--text-primary)]">Kontrol Self-Order per Meja</p>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Akses customer order tidak memakai saklar global. Aktif/nonaktif ditentukan dari Manajemen Meja & QR untuk setiap meja atau aksi semua meja.</p>
                </div>

                {/* Inventori meja customer order — operational source of truth. */}
                <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-4 shadow-sm space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Grid className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Inventori Meja Customer Order</h3>
                        <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-[var(--text-secondary)]">
                          Daftar target menentukan nomor meja yang seharusnya tersedia. Akses customer order tetap dikontrol dari tombol tiap meja; daftar ini tidak mengaktifkan meja secara otomatis.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsTableModalOpen(true)}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:shadow-lg"
                    >
                      Kelola Meja Aktif
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Database</p>
                      <p className="mt-1 text-lg font-black text-slate-900">{tables.length}</p>
                      <p className="text-[9px] font-semibold text-slate-500">meja aktual</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Target</p>
                      <p className="mt-1 text-lg font-black text-slate-900">{desiredTableNumbers.length}</p>
                      <p className="text-[9px] font-semibold text-slate-500">nomor terdaftar</p>
                    </div>
                    <div className={`rounded-2xl border px-3 py-3 ${missingTableNumbers.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                      <p className={`text-[9px] font-black uppercase tracking-wider ${missingTableNumbers.length ? 'text-amber-600' : 'text-emerald-600'}`}>Belum Ada</p>
                      <p className={`mt-1 text-lg font-black ${missingTableNumbers.length ? 'text-amber-900' : 'text-emerald-900'}`}>{missingTableNumbers.length}</p>
                      <p className={`text-[9px] font-semibold ${missingTableNumbers.length ? 'text-amber-700' : 'text-emerald-700'}`}>{missingTableNumbers.length ? 'perlu dibuat' : 'sudah sinkron'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Daftar target meja</label>
                    <input
                      type="text"
                      value={formProfile.allowedSelfOrderTables ?? actualTableNumbers.join(',')}
                      onChange={(e) => setFormProfile({ ...formProfile, allowedSelfOrderTables: e.target.value })}
                      placeholder={actualTableNumbers.join(',') || '1,2,3,4,5'}
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-4 font-mono text-xs font-bold tracking-wider text-[var(--text-primary)] outline-none transition-all focus:border-[var(--primary)] focus:bg-white"
                    />
                    <p className="text-[11px] font-semibold leading-relaxed text-[var(--text-tertiary)]">
                      Pisahkan dengan koma. Sinkronisasi hanya <strong className="text-slate-600">membuat meja yang belum ada</strong>; meja lama, status bill, dan pengaturan ON/OFF tidak pernah dihapus otomatis.
                    </p>
                  </div>

                  {missingTableNumbers.length > 0 && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-amber-900">Database belum sama dengan daftar target</p>
                        <p className="mt-1 text-[11px] font-semibold leading-relaxed text-amber-800">
                          Belum ada: <span className="font-mono font-black">{missingTableNumbers.join(', ')}</span>. Meja baru dibuat NONAKTIF agar aman sampai Anda mengaktifkannya dari Manajemen Meja.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isSyncingTables || !onEnsureTables || tableTargetDirty}
                        onClick={() => void handleSyncTableInventory()}
                        className="shrink-0 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                        title={tableTargetDirty ? 'Simpan daftar target terlebih dahulu.' : 'Buat hanya meja yang belum ada.'}
                      >
                        {tableTargetDirty ? 'Simpan Target Dulu' : isSyncingTables ? 'Menyinkronkan…' : `Buat ${missingTableNumbers.length} Meja`}
                      </button>
                    </div>
                  )}

                  {!missingTableNumbers.length && desiredTableNumbers.length > 0 && (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Inventori meja database sudah mencakup seluruh daftar target.
                    </div>
                  )}

                  {outsideTargetTableNumbers.length > 0 && (
                    <p className="text-[10px] font-semibold text-slate-500">
                      Meja database di luar daftar target tetap dipertahankan: <span className="font-mono font-black">{outsideTargetTableNumbers.join(', ')}</span>.
                    </p>
                  )}
                </div>

                {/* Banner Promo Utama Card */}
                <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 text-slate-900 shadow-sm space-y-4">
                  <p className="text-[11px] font-black text-orange-700 uppercase tracking-widest flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" /> BANNER PROMO UTAMA
                  </p>

                  <div>
                    <label className="block text-[13px] font-bold">JUDUL PROMO</label>
                    <input
                      type="text"
                      value={formProfile.promoBannerTitle || ''}
                      onChange={(e) => setFormProfile({ ...formProfile, promoBannerTitle: e.target.value })}
                      className="w-full bg-white text-[var(--text-primary)] font-bold text-sm rounded-2xl px-4 py-3 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold">DESKRIPSI</label>
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
                    <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-slate-100">
                      {formProfile.wallpaperBackgroundUrl ? (
                        <img src={formProfile.wallpaperBackgroundUrl} alt="Wallpaper Preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-center text-slate-400"><ImageIcon className="mx-auto h-8 w-8" /><p className="mt-2 text-[10px] font-bold">Belum ada wallpaper</p></div>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Tempel URL gambar / CDN..."
                      value={formProfile.wallpaperBackgroundUrl || ''}
                      onChange={(e) => setFormProfile({ ...formProfile, wallpaperBackgroundUrl: e.target.value })}
                      className="w-full bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none"
                    />
                    <label className="ui-button ui-button-secondary w-full cursor-pointer py-2 text-[11px]">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isUploadingWallpaper ? 'Mengunggah wallpaper…' : 'Upload dari perangkat'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        disabled={isUploadingWallpaper}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (!file) return;
                          setIsUploadingWallpaper(true);
                          void uploadImage(file, 'branding', currentBranch.id)
                            .then((uploaded) => {
                              setFormProfile((current) => ({ ...current, wallpaperBackgroundUrl: uploaded.secureUrl }));
                              toast('Wallpaper Berhasil Diunggah', 'Preview sudah diperbarui. Simpan perubahan agar digunakan pelanggan.');
                            })
                            .catch((error) => toast('Upload Wallpaper Gagal', error instanceof Error ? error.message : 'Wallpaper tidak dapat diunggah.'))
                            .finally(() => setIsUploadingWallpaper(false));
                        }}
                      />
                    </label>
                  </div>

                  <div className="space-y-4 bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[var(--primary-hover)]" /> LINK REVIEW GOOGLE
                    </h3>

                    <div>
                      <label className="block text-[13px] font-bold">URL MAPS</label>
                      <input
                        type="text"
                        value={formProfile.googleReviewUrl || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, googleReviewUrl: e.target.value })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-bold">TEKS AJAKAN</label>
                      <input
                        type="text"
                        value={formProfile.googleReviewText || ''}
                        onChange={(e) => setFormProfile({ ...formProfile, googleReviewText: e.target.value })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!formProfile.googleReviewUrl}
                      onClick={() => formProfile.googleReviewUrl && window.open(formProfile.googleReviewUrl, '_blank', 'noopener,noreferrer')}
                      className="ui-button ui-button-secondary w-full text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Uji Link Review
                    </button>
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
                      <span>ALARM KETERLAMBATAN</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={formProfile.orderTimeLimitMinutes ?? 5}
                        onChange={(e) => setFormProfile({ ...formProfile, orderTimeLimitMinutes: Number(e.target.value) })}
                        className="w-20 bg-white border border-[var(--panel-border)] rounded-2xl p-3 text-2xl font-bold text-center text-[var(--text-primary)] outline-none"
                      />
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)] uppercase">MENIT SETELAH ORDER MASUK</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] font-semibold">KDS mulai memberi alarm & status terlambat</p>
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

                {/* KDS Category Order */}
                <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)] space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Grid className="h-4 w-4 text-[var(--primary-hover)]" />
                        <p className="text-xs font-black text-[var(--text-primary)]">URUTAN KATEGORI TICKET KITCHEN</p>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[var(--text-tertiary)]">
                        Urutan pertama = tampil paling atas di setiap ticket. Di dalam kategori, item mengikuti urutan master menu / inventory cabang.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveKdsCategoryOrder(DEFAULT_KDS_CATEGORY_ORDER)}
                      className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset urutan
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {kdsCategoryOrder.map((category, index) => (
                      <div
                        key={category}
                        draggable
                        onDragStart={() => setDraggedKdsCategory(category)}
                        onDragEnd={() => setDraggedKdsCategory(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!draggedKdsCategory) return;
                          saveKdsCategoryOrder(moveKdsCategory(kdsCategoryOrder, draggedKdsCategory, category));
                          setDraggedKdsCategory(null);
                        }}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${draggedKdsCategory === category ? 'border-emerald-300 bg-emerald-50 opacity-70' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" />
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black text-white">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-black text-slate-800">{category}</p>
                          <p className="text-[9px] font-semibold text-slate-400">{category === 'MINUMAN' ? 'Panel Minuman' : 'Panel Makanan'}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => shiftKdsCategory(category, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30"
                            title="Naikkan urutan"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === kdsCategoryOrder.length - 1}
                            onClick={() => shiftKdsCategory(category, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30"
                            title="Turunkan urutan"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-semibold text-sky-800">
                    Urutan ini hanya mengubah susunan di KDS. Tidak mengubah kategori, harga, stok, urutan input kasir, atau data transaksi.
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
                        min={0}
                        max={180}
                        value={formProfile.latenessToleranceMinutes ?? 5}
                        onChange={(e) => setFormProfile({ ...formProfile, latenessToleranceMinutes: Math.max(0, Math.min(180, Number(e.target.value))) })}
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
                        type="number"
                        step="0.000001"
                        min={-90}
                        max={90}
                        value={formProfile.gpsLatitude ?? -6.609013171412514}
                        onChange={(e) => setFormProfile({ ...formProfile, gpsLatitude: Number(e.target.value) })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-mono font-semibold text-[var(--text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">RADIUS AREA (METER)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={5}
                          max={5000}
                          value={formProfile.gpsRadiusMeters ?? 20}
                          onChange={(e) => setFormProfile({ ...formProfile, gpsRadiusMeters: Math.max(5, Math.min(5000, Number(e.target.value))) })}
                          className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)]"
                        />
                        <span className="text-xs font-semibold text-[var(--text-tertiary)]">Meter</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">LONGITUDE (GARIS BUJUR)</label>
                      <input
                        type="number"
                        step="0.000001"
                        min={-180}
                        max={180}
                        value={formProfile.gpsLongitude ?? 106.78293233420759}
                        onChange={(e) => setFormProfile({ ...formProfile, gpsLongitude: Number(e.target.value) })}
                        className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-mono font-semibold text-[var(--text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">AKURASI GPS MAKS. (METER)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={5}
                          max={500}
                          value={formProfile.maxGpsAccuracyMeters ?? 80}
                          onChange={(e) => setFormProfile({ ...formProfile, maxGpsAccuracyMeters: Math.max(5, Math.min(500, Number(e.target.value))) })}
                          className="w-full bg-white border border-[var(--panel-border)] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)]"
                        />
                        <span className="text-xs font-semibold text-[var(--text-tertiary)]">Meter</span>
                      </div>
                      <p className="mt-1 text-[10px] font-semibold text-[var(--text-tertiary)]">Presensi ditolak jika sensor GPS terlalu tidak akurat.</p>
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
                      <span>DEFAULT HARI LIBUR OUTLET</span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] font-semibold">
                    Ini menjadi fallback untuk staff yang belum memiliki Hari Kerja Rutin sendiri. Jadwal per-staff pada kartu akun selalu lebih prioritas.
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
                                {stf.id === activeUserId && <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">Akun Anda</span>}
                              </div>
                              <p className="text-[11px] text-[var(--text-secondary)] font-bold">{stf.shiftStart || '-'} – {stf.shiftEnd || '-'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!canEditStaffAccount(stf)}
                              onClick={() => setEditingStaff({ ...stf })}
                              className="p-1.5 text-[var(--primary-hover)] hover:bg-[var(--brand-100)] rounded-lg cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                              title={canEditStaffAccount(stf) ? 'Edit Detail Staff & PIN' : 'Akun dengan kewenangan setara atau lebih tinggi tidak dapat diubah'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={stf.id === activeUserId || !canEditStaffAccount(stf)}
                              onClick={() => {
                                if (stf.id === activeUserId || !canEditStaffAccount(stf)) return;
                                if (confirmingDeleteId === stf.id) {
                                  if (onDeleteStaff) void Promise.resolve(onDeleteStaff(stf.id)).catch(() => undefined);
                                  setConfirmingDeleteId(null);
                                } else {
                                  setConfirmingDeleteId(stf.id);
                                  setTimeout(() => setConfirmingDeleteId(null), 3000);
                                }
                              }}
                              className={`p-1.5 rounded-lg cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
                                confirmingDeleteId === stf.id ? 'bg-rose-600 text-white' : 'text-[var(--accent-red)] hover:bg-[var(--danger-soft)]'
                              }`}
                              title={cloudMode ? (confirmingDeleteId === stf.id ? 'Klik lagi untuk cabut akses' : 'Cabut akses & sesi staff') : (confirmingDeleteId === stf.id ? 'Klik lagi untuk hapus' : 'Hapus Staff')}
                            >
                              {confirmingDeleteId === stf.id ? <Check className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              disabled={stf.id === activeUserId || !canEditStaffAccount(stf)}
                              onClick={() => void Promise.resolve(onSaveStaff({ ...stf, isActive: stf.isActive === false })).catch(() => undefined)}
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${stf.isActive === false ? 'border-[var(--panel-border)] text-[var(--text-secondary)] bg-[var(--surface-secondary)]' : 'border-emerald-200 text-[var(--accent-green)] bg-[var(--success-soft)]'}`}
                            >
                              {stf.isActive === false ? 'Nonaktif' : 'Aktif'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-1 text-[11px] font-bold text-[var(--text-secondary)] sm:grid-cols-2">
                          <div className="rounded-xl bg-[var(--surface-main)] px-3 py-2">Shift: {stf.shiftStart || '-'}–{stf.shiftEnd || '-'}</div>
                          <div className="rounded-xl bg-[var(--surface-main)] px-3 py-2">Libur rutin: {staffOffDays(stf).map((day) => day.short).join(', ') || '-'}</div>
                          <div className="rounded-xl bg-[var(--surface-main)] px-3 py-2 sm:col-span-2">
                            <span className="mr-2 text-[var(--text-tertiary)]">Hari masuk</span>
                            {STAFF_WEEKDAYS.filter((day) => staffWorkDays(stf).includes(day.day)).map((day) => (
                              <span key={day.day} className="mr-1 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">{day.short}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 5. RACIKAN / ISIAN / TOPPING — FIX11 MASTER-DETAIL BUILDER */}
            {activeTab === 'CONDIMENTS' && (
              <CondimentBuilderPanel
                condimentGroups={condimentGroups}
                menuItems={menuItems}
                onSaveCondimentGroup={rawSaveCondimentGroup}
                onDeleteCondimentGroup={onDeleteCondimentGroup}
                onShowToast={onShowToast}
              />
            )}

            {/* 6. KEUANGAN (Matching Image 7) */}
            {activeTab === 'FINANCE' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Keuangan & Kasir</h2>
                  <p className="text-xs text-[var(--text-tertiary)] font-medium">Atur pajak, diskon, konfirmasi kasir, serta status fitur perhitungan yang sudah benar-benar terhubung.</p>
                </div>

                <div className="space-y-4">
                  {/* Pajak Tax */}
                  <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 flex items-center justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-[var(--text-primary)]">Pajak (Tax)</p><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">Terhubung ke POS</span></div>
                      <p className="text-xs text-[var(--text-tertiary)] font-medium">Persentase pajak diterapkan otomatis pada order baru ketika fitur aktif.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-white border border-[var(--panel-border)] rounded-2xl px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={formProfile.taxRatePercent ?? 0}
                          onChange={(e) => setFormProfile({ ...formProfile, taxRatePercent: Math.max(0, Math.min(100, Number(e.target.value))) })}
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

                  {/* Service Charge — intentionally disabled until the transaction engine stores it explicitly. */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-amber-950">Service Charge</p>
                          <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">Belum aktif di engine transaksi</span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-amber-800">Nilai lama tetap disimpan, tetapi kontrol dikunci agar operator tidak mengira biaya ini sudah masuk total POS.</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 opacity-60">
                        <div className="flex items-center gap-1 rounded-xl border border-amber-200 bg-white px-3 py-2">
                          <span className="w-10 text-center text-sm font-black text-amber-900">{formProfile.serviceChargePercent || 0}</span>
                          <span className="text-xs font-bold text-amber-700">%</span>
                        </div>
                        <span className="rounded-lg bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-700">TERKUNCI</span>
                      </div>
                    </div>
                  </div>

                  {/* Diskon Manual */}
                  <div className="border border-[var(--panel-border)] rounded-2xl p-5 bg-[var(--surface-card)]/80 flex items-center justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-[var(--text-primary)]">Diskon Manual</p><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">Terhubung ke POS</span></div>
                      <p className="text-xs text-[var(--text-tertiary)] font-medium">Aktifkan atau kunci input diskon persentase di terminal kasir.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${formProfile.isManualDiscountEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>{formProfile.isManualDiscountEnabled ? 'AKTIF' : 'NONAKTIF'}</span>
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

                  {/* Pembulatan Harga — pending explicit rounding persistence in order schema. */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-amber-950">Pembulatan Harga</p>
                          <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">Belum aktif di engine transaksi</span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-amber-800">Mode tersimpan saat ini: <strong>{formProfile.roundingMode || 'TERDEKAT'}</strong>. Kontrol dikunci sampai selisih pembulatan tercatat aman pada order dan laporan.</p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[9px] font-black text-amber-700">TERKUNCI</span>
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
                    <div className={`ml-auto inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[9px] font-black ${accessDirty ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                      {accessDirty ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {accessDirty ? 'Perubahan belum disimpan' : 'Matriks tersimpan'}
                    </div>
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
                            const roleAbbr = role === 'KASIR' ? 'KAS' : role === 'KITCHEN' ? 'KIT' : role === 'MANAGER' ? 'MGR' : 'ADM';
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



              </div>
            )}

            {/* 8. DATABASE & RESET (Matching Image 8) */}
            {activeTab === 'DATABASE' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Sistem & Data</h2>
                  <p className="text-xs text-[var(--text-tertiary)] font-medium">Maintenance terminal, reset data, dan informasi teknis. Aksi destruktif selalu membutuhkan konfirmasi dua langkah.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-amber-200 rounded-2xl p-5 bg-amber-50/40 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">{cloudMode ? 'Data Transaksi Cloud' : 'Hapus Transaksi Lokal'}</h3>
                        <p className="text-[11px] text-[var(--text-tertiary)] font-medium">{cloudMode ? 'Data transaksi cloud dilindungi dan tidak dapat dihapus dari Control Center ini.' : 'Hapus order/laporan lokal untuk data trial. Produk tetap aman.'}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={cloudMode}
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
                      className={`w-full py-3 text-white rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                        confirmingAction === 'clear-transactions'
                          ? 'bg-amber-700 shadow-amber-700/20 animate-pulse'
                          : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                      }`}
                    >
                      {cloudMode ? 'Dilindungi pada Mode Cloud' : confirmingAction === 'clear-transactions' ? '⚠️ Yakin? Klik lagi untuk konfirmasi' : 'Bersihkan Transaksi Lokal'}
                    </button>
                  </div>

                  <div className="border border-rose-200 rounded-2xl p-5 bg-[var(--danger-soft)]/40 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-rose-900">{cloudMode ? 'Reset Cloud Dilindungi' : 'Factory Reset Lokal'}</h3>
                        <p className="text-[11px] text-[var(--accent-red)] font-medium">{cloudMode ? 'Reset dari layar ini tidak menghapus data Supabase.' : 'Hapus seluruh data lokal dan kembali ke awal.'}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={cloudMode}
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
                      {cloudMode ? 'Tidak Tersedia di Mode Cloud' : confirmingAction === 'factory-reset' ? '🔴 Yakin? Klik lagi untuk konfirmasi' : 'Factory Reset Lokal'}
                    </button>
                  </div>
                </div>

                {cloudMode && canManageTenant && (
                  <div className="border border-rose-200 rounded-2xl p-5 bg-[var(--danger-soft)]/30 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-rose-900">Purge Riwayat Transaksi Cloud</h3>
                        <p className="text-[11px] text-[var(--accent-red)] font-medium">
                          Hapus permanen order selesai/dibatalkan yang lebih tua dari periode retensi. Menu, resep, staff, dan kartu stok tidak ikut terhapus. Setiap eksekusi tercatat di log audit permanen.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-[11px] font-bold text-[var(--text-secondary)] space-y-1">
                        <span>Hapus order lebih tua dari</span>
                        <select
                          value={purgeRetentionDays}
                          onChange={(event) => setPurgeRetentionDays(Number(event.target.value))}
                          disabled={purgeBusy}
                          className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                        >
                          <option value={90}>90 hari</option>
                          <option value={180}>180 hari (disarankan)</option>
                          <option value={365}>365 hari</option>
                          <option value={730}>2 tahun</option>
                        </select>
                      </label>
                      <label className="text-[11px] font-bold text-[var(--text-secondary)] space-y-1">
                        <span>Ketik nama cabang ini untuk konfirmasi: <strong>{currentBranch.name}</strong></span>
                        <input
                          type="text"
                          value={purgeConfirmName}
                          onChange={(event) => setPurgeConfirmName(event.target.value)}
                          disabled={purgeBusy}
                          placeholder={currentBranch.name}
                          className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={purgeBusy || purgeConfirmName.trim().toLowerCase() !== currentBranch.name.trim().toLowerCase()}
                      onClick={async () => {
                        if (purgeStep !== 'confirm') {
                          setPurgeStep('confirm');
                          setTimeout(() => setPurgeStep('idle'), 5000);
                          return;
                        }
                        setPurgeBusy(true);
                        try {
                          const result = await purgeCompletedOrders(currentBranch.id, purgeRetentionDays, purgeConfirmName.trim());
                          toast(
                            'Purge Selesai',
                            result.orderCount > 0
                              ? `${result.orderCount} order, ${result.paymentCount} pembayaran, dan ${result.eventCount} event dihapus permanen.`
                              : 'Tidak ada order yang memenuhi kriteria periode retensi ini.',
                          );
                          setPurgeConfirmName('');
                          setPurgeStep('idle');
                        } catch (error) {
                          toast('Purge Gagal', error instanceof Error ? error.message : 'Purge transaksi gagal diproses');
                        } finally {
                          setPurgeBusy(false);
                        }
                      }}
                      className={`w-full py-3 text-white rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                        purgeStep === 'confirm' ? 'bg-rose-900 shadow-rose-900/20 animate-pulse' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      }`}
                    >
                      {purgeBusy
                        ? 'Memproses purge...'
                        : purgeStep === 'confirm'
                          ? '🔴 Yakin? Klik lagi untuk hapus permanen'
                          : `Purge Transaksi > ${purgeRetentionDays} Hari`}
                    </button>
                  </div>
                )}

                {/* Technical architecture is secondary information; keep it collapsed by default. */}
                <details className="group rounded-2xl border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-black text-slate-700">
                    <span className="flex items-center gap-2"><MonitorCog className="h-4 w-4 text-slate-500" /> Info arsitektur & free-tier</span>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-slate-100 px-4 py-4">
                    <p className="text-[11px] font-semibold leading-relaxed text-slate-500">Informasi teknis ini hanya untuk owner/developer dan tidak memengaruhi operasi kasir.</p>
                    <ul className="mt-3 grid gap-2 text-[10px] font-semibold text-slate-600 md:grid-cols-3">
                      <li className="rounded-xl bg-slate-50 p-3"><strong className="block text-slate-800">Vercel</strong>Hosting SPA/PWA.</li>
                      <li className="rounded-xl bg-slate-50 p-3"><strong className="block text-slate-800">Supabase</strong>Database + broadcast invalidation realtime.</li>
                      <li className="rounded-xl bg-slate-50 p-3"><strong className="block text-slate-800">Cloudinary</strong>Media menu, wallpaper, dan selfie absensi.</li>
                    </ul>
                  </div>
                </details>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Confirmation — explicit confirmation replaces the old ambiguous save button. */}
      {saveConfirmKind && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Save className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-950">{saveConfirmKind === 'ACCESS' ? 'Simpan perubahan hak akses?' : 'Simpan perubahan pengaturan?'}</p>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">
                  {saveConfirmKind === 'ACCESS'
                    ? 'Matriks role akan berlaku untuk organisasi dan terminal yang menggunakan hak akses ini.'
                    : `Perubahan akan disimpan ke ${centralBrandDirty ? 'brand pusat dan ' : ''}cabang ${currentBranch.code || currentBranch.name}.`}
                </p>
              </div>
              <button type="button" onClick={() => setSaveConfirmKind(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              {saveConfirmKind === 'PROFILE' ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cakupan simpan</p>
                    <p className="mt-1 text-xs font-black text-slate-900">{activeScopeLabel}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Bagian yang berubah</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(changedDomains.length ? changedDomains : ['Pengaturan']).map((domain) => (
                        <span key={domain} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-black text-amber-800">{domain}</span>
                      ))}
                    </div>
                  </div>
                  {centralBrandDirty && (
                    <div className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-violet-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="text-[10px] font-semibold leading-relaxed">Nama/logo/Instagram/TikTok adalah brand pusat dan dapat terlihat di cabang lain.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-[10px] font-semibold leading-relaxed">Perubahan permission dapat langsung memengaruhi menu yang dapat dibuka role Kasir, Kitchen, Manager, dan Admin.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button type="button" onClick={() => setSaveConfirmKind(null)} className="ui-button ui-button-secondary">Batal</button>
              <button
                type="button"
                disabled={saveConfirmKind === 'ACCESS' ? isSavingAccess : isSavingProfile}
                onClick={() => void (saveConfirmKind === 'ACCESS' ? performSaveAccess() : performSaveProfile())}
                className="ui-button ui-button-primary min-w-32"
              >
                <Save className="h-4 w-4" />
                {saveConfirmKind === 'ACCESS' ? (isSavingAccess ? 'Menyimpan…' : 'Ya, Simpan Akses') : (isSavingProfile ? 'Menyimpan…' : 'Ya, Simpan')}
              </button>
            </div>
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
                    <select className="ui-input font-bold disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={editingStaff.id === activeUserId && (editingStaff.role === 'OWNER' || editingStaff.role === 'SUPER_OWNER')}
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
                  {editingStaff.id === activeUserId && (editingStaff.role === 'OWNER' || editingStaff.role === 'SUPER_OWNER') && (
                    <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-800">
                      Anda boleh memperbarui profil dan PIN akun sendiri. Role dan status akun dikunci agar akses Owner tidak terputus. Akun Owner tidak mengikuti absensi maupun payroll operasional.
                    </p>
                  )}
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
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <label className="ui-form-label block">Hari Kerja Rutin</label>
                      <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">Hari yang tidak dipilih otomatis menjadi libur rutin.</p>
                    </div>
                    <span className="rounded-full bg-[var(--surface-main)] px-2 py-1 text-[9px] font-black text-[var(--text-secondary)]">{staffWorkDays(editingStaff).length} hari</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {STAFF_WEEKDAYS.map((day) => {
                      const selected = staffWorkDays(editingStaff).includes(day.day);
                      return (
                        <button
                          key={day.day}
                          type="button"
                          onClick={() => {
                            const current = staffWorkDays(editingStaff);
                            const next = selected ? current.filter((value) => value !== day.day) : [...current, day.day];
                            if (!next.length) return;
                            setEditingStaff({ ...editingStaff, workDays: next });
                          }}
                          className={`rounded-xl border px-1 py-2 text-[9px] font-black transition ${selected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                          title={selected ? `${day.label}: masuk` : `${day.label}: libur rutin`}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] font-bold text-rose-600">Libur rutin: {staffOffDays(editingStaff).map((day) => day.label).join(', ') || 'Tidak ada'}</p>
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

      {/* Modal Manajemen Meja (Customer Order) matching Screenshot 1 */}
      <CustomerTableManagementModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        tables={tables}
        onToggleTableSelfOrder={onToggleTableSelfOrder}
        onToggleAllTables={onToggleAllTables}
        targetTableNumbers={desiredTableNumbers}
        onEnsureTables={onEnsureTables}
      />
    </div>
  );
};
