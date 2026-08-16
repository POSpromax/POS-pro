import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Eye,
  Filter,
  Layers3,
  ListChecks,
  Loader2,
  PackageCheck,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Utensils,
  WandSparkles,
  X,
} from 'lucide-react';
import type { CategoryType, CondimentGroup, CondimentOption, MenuItem } from '../../types/pos';
import { CondimentPreviewPanel } from './CondimentPreviewPanel';

type SaveResult = CondimentGroup | void;
type ScopeMode = 'CATEGORY' | 'MENU' | 'MIXED';
type Role = 'NONE' | 'BROTH' | 'FILLING';

type Props = {
  condimentGroups: CondimentGroup[];
  menuItems: MenuItem[];
  onSaveCondimentGroup: (group: CondimentGroup) => Promise<SaveResult> | SaveResult;
  onShowToast?: (title: string, message: string) => void;
};

const normalize = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const cloneGroup = (group: CondimentGroup): CondimentGroup => JSON.parse(JSON.stringify(group));
const makeTempId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const inferRole = (group: CondimentGroup): Role => {
  if (group.selfOrderRole === 'BROTH' || group.selfOrderRole === 'FILLING') return group.selfOrderRole;
  const name = normalize(group.name);
  if (name.includes('KUAH')) return 'BROTH';
  if (name.includes('ISIAN')) return 'FILLING';
  return 'NONE';
};

const getScopeMode = (group: CondimentGroup): ScopeMode => {
  const hasCategories = Boolean((group.targetCategories || (group.targetCategory ? [group.targetCategory] : [])).length);
  const hasMenus = Boolean((group.targetProductIds || []).length || (group.targetProductNames || []).length);
  if (hasCategories && hasMenus) return 'MIXED';
  if (hasMenus) return 'MENU';
  return 'CATEGORY';
};

const activeOptions = (group: CondimentGroup) => group.options.filter((option) => option.isAvailable !== false);
const isSingle = (group: CondimentGroup) => group.mode === 'PAKET' || Number(group.maxSelect || 0) === 1;
const isRequired = (group: CondimentGroup) => group.required === true || group.isRequired === true || Number(group.minSelect || 0) > 0;

const groupIssues = (group: CondimentGroup) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const categories = group.targetCategories || (group.targetCategory ? [group.targetCategory] : []);
  const hasTarget = categories.length > 0 || Boolean(group.targetProductIds?.length) || Boolean(group.targetProductNames?.length);
  const available = activeOptions(group);
  const names = available.map((option) => normalize(option.name));
  const duplicateNames = names.filter((name, index) => name && names.indexOf(name) !== index);
  const required = isRequired(group);
  const role = inferRole(group);

  if (!String(group.name || '').trim()) errors.push('Nama grup belum diisi.');
  if (!hasTarget) errors.push('Belum ada target kategori atau menu.');
  if (!available.length) errors.push('Belum ada opsi aktif.');
  if (duplicateNames.length) errors.push('Ada nama opsi yang sama.');

  if (isSingle(group)) {
    if (Number(group.maxSelect || 1) !== 1) warnings.push('Mode pilih satu sebaiknya memiliki maksimum 1.');
    if (Number(group.minSelect || 0) > 1) errors.push('Minimum pilihan tidak boleh lebih dari 1 untuk mode pilih satu.');
  } else {
    const max = Number(group.maxSelect || 0);
    const min = Number(group.minSelect || 0);
    if (max > 0 && min > max) errors.push('Minimum pilihan lebih besar dari maksimum.');
    if (max > available.length && available.length > 0) warnings.push('Maksimum pilihan lebih besar dari opsi aktif.');
  }

  if (required && Number(group.minSelect || 0) < 1) warnings.push('Grup wajib sebaiknya memiliki minimum 1.');

  const activeSet = new Set(available.map((option) => normalize(option.name)));
  if (role === 'BROTH') {
    if (!isSingle(group)) errors.push('Peran Kuah harus menggunakan mode Pilih 1.');
    if (!required) errors.push('Peran Kuah harus Wajib.');
    const defaults = (group.selfOrderDefaultOptions || []).filter((name) => activeSet.has(normalize(name)));
    if (!defaults.length) errors.push('Default kuah Self Order belum dipilih.');
  }

  if (role === 'FILLING') {
    if (isSingle(group)) errors.push('Peran Isian/Racikan Cepat harus menggunakan mode Pilih Banyak.');
    if (!required) errors.push('Peran Isian/Racikan Cepat harus Wajib.');
    const baksoOnly = (group.selfOrderBaksoOnlyOptions || []).filter((name) => activeSet.has(normalize(name)));
    const campur = (group.selfOrderCampurOptions || []).filter((name) => activeSet.has(normalize(name)));
    if (!baksoOnly.length) errors.push('Preset Bakso Saja belum memiliki isian.');
    if (!campur.length) errors.push('Preset Campur belum memiliki isian.');
    if (baksoOnly.length && campur.length && baksoOnly.every((name) => campur.map(normalize).includes(normalize(name))) && campur.length === baksoOnly.length) {
      warnings.push('Bakso Saja dan Campur memiliki isi yang sama.');
    }
  }

  return { errors, warnings, ready: errors.length === 0 };
};

const ensureOption = (group: CondimentGroup, name: string, price = 0) => {
  const existing = group.options.find((option) => normalize(option.name) === normalize(name));
  if (existing) {
    if (existing.isAvailable === false) existing.isAvailable = true;
    return existing.name;
  }
  const option: CondimentOption = {
    id: makeTempId('opt'),
    name,
    price,
    isAvailable: true,
  };
  group.options.push(option);
  return option.name;
};

const buildBaksoStandard = (currentGroups: CondimentGroup[]) => {
  const now = Date.now();
  const groups = currentGroups.map(cloneGroup);
  let broth = groups.find((group) => inferRole(group) === 'BROTH');
  let filling = groups.find((group) => inferRole(group) === 'FILLING');

  if (!broth) {
    broth = {
      id: `draft-kuah-${now}`,
      name: 'KUAH',
      mode: 'PAKET',
      required: true,
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      targetCategories: ['BAKSO'],
      options: [],
      isActive: true,
      selfOrderRole: 'BROTH',
    };
    groups.push(broth);
  }
  broth.mode = 'PAKET';
  broth.required = true;
  broth.isRequired = true;
  broth.minSelect = 1;
  broth.maxSelect = 1;
  broth.isActive = true;
  broth.selfOrderRole = 'BROTH';
  broth.targetCategories = Array.from(new Set([...(broth.targetCategories || []), 'BAKSO' as CategoryType]));
  const original = ensureOption(broth, 'ORIGINAL');
  ensureOption(broth, 'MISDASEM');
  broth.selfOrderDefaultOptions = [original];

  if (!filling) {
    filling = {
      id: `draft-isian-${now + 1}`,
      name: 'ISIAN',
      mode: 'ADD_ON',
      required: true,
      isRequired: true,
      minSelect: 1,
      maxSelect: 7,
      targetCategories: ['BAKSO'],
      options: [],
      isActive: true,
      selfOrderRole: 'FILLING',
    };
    groups.push(filling);
  }
  filling.mode = 'ADD_ON';
  filling.required = true;
  filling.isRequired = true;
  filling.minSelect = 1;
  filling.isActive = true;
  filling.selfOrderRole = 'FILLING';
  filling.targetCategories = Array.from(new Set([...(filling.targetCategories || []), 'BAKSO' as CategoryType]));

  const mie = ensureOption(filling, 'MIE');
  const bihun = ensureOption(filling, 'BIHUN');
  ensureOption(filling, 'KWETIAW');
  const sawi = ensureOption(filling, 'SAWI');
  const tauge = ensureOption(filling, 'TAUGE');
  const bawang = ensureOption(filling, 'BAWANG');
  const sledri = ensureOption(filling, 'SLEDRI');

  const baksoOnly = [bawang, sledri];
  const campur = [mie, bihun, sawi, tauge, bawang, sledri];
  filling.selfOrderBaksoOnlyOptions = baksoOnly;
  filling.selfOrderCampurOptions = campur;
  filling.allSelectedLabel = 'CAMPUR';
  filling.maxSelect = Math.max(Number(filling.maxSelect || 0), activeOptions(filling).length, campur.length);

  return { groups, brothId: broth.id, fillingId: filling.id };
};

const scopeLabel = (group: CondimentGroup) => {
  const categories = group.targetCategories || (group.targetCategory ? [group.targetCategory] : []);
  const menuCount = (group.targetProductIds || []).length + (group.targetProductNames || []).length;
  if (categories.length && menuCount) return `${categories.length} kategori + ${menuCount} menu`;
  if (categories.length) return categories.includes('ALL') ? 'Semua kategori' : categories.join(', ');
  if (menuCount) return `${menuCount} menu`;
  return 'Belum ada target';
};

const ruleLabel = (group: CondimentGroup) => `${isSingle(group) ? 'Pilih 1' : 'Pilih Banyak'} · ${isRequired(group) ? 'Wajib' : 'Opsional'}`;

export const CondimentBuilderPanel: React.FC<Props> = ({ condimentGroups, menuItems, onSaveCondimentGroup, onShowToast }) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [drafts, setDrafts] = useState<Record<string, CondimentGroup>>({});
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [activeStep, setActiveStep] = useState<'TARGET' | 'RULE' | 'OPTIONS' | 'INSTANT' | 'PREVIEW'>('TARGET');

  const toast = (title: string, message: string) => onShowToast?.(title, message);

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const group of condimentGroups) {
        if (!dirtyIds.includes(group.id)) next[group.id] = cloneGroup(group);
      }
      for (const key of Object.keys(next)) {
        const isTemp = key.startsWith('draft-') || key.startsWith('new-');
        if (!isTemp && !condimentGroups.some((group) => group.id === key) && !dirtyIds.includes(key)) delete next[key];
      }
      return next;
    });
    if (!selectedId && condimentGroups.length) setSelectedId(condimentGroups[0].id);
  }, [condimentGroups, dirtyIds, selectedId]);

  const orderedGroups = useMemo(() => {
    const result: CondimentGroup[] = [];
    const seen = new Set<string>();
    for (const group of condimentGroups) {
      result.push(drafts[group.id] || group);
      seen.add(group.id);
    }
    for (const [id, group] of Object.entries(drafts)) {
      if (!seen.has(id)) result.push(group);
    }
    return result;
  }, [condimentGroups, drafts]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orderedGroups;
    return orderedGroups.filter((group) => {
      const haystack = [group.name, scopeLabel(group), ruleLabel(group), ...group.options.map((option) => option.name)].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [orderedGroups, search]);

  const current = selectedId ? drafts[selectedId] || orderedGroups.find((group) => group.id === selectedId) : undefined;
  const currentIssues = current ? groupIssues(current) : { errors: [], warnings: [], ready: false };
  const dirtySet = new Set(dirtyIds);
  const isCurrentDirty = Boolean(current && dirtySet.has(current.id));
  const isCurrentSaving = Boolean(current && savingIds.includes(current.id));

  const availableCategories = useMemo(() => {
    const categories = Array.from(new Set(menuItems.map((item) => item.category).filter(Boolean)));
    return categories.sort((a, b) => String(a).localeCompare(String(b), 'id'));
  }, [menuItems]);

  const groupStats = useMemo(() => {
    const active = orderedGroups.filter((group) => group.isActive !== false);
    const ready = active.filter((group) => groupIssues(group).ready).length;
    const needsReview = active.length - ready;
    const targetedMenuIds = new Set<string>();
    active.forEach((group) => {
      const categories = group.targetCategories || (group.targetCategory ? [group.targetCategory] : []);
      menuItems.forEach((item) => {
        const categoryMatch = categories.includes('ALL') || categories.includes(item.category);
        const idMatch = (group.targetProductIds || []).includes(item.id);
        const nameMatch = (group.targetProductNames || []).some((name) => item.name.toLowerCase().includes(name.toLowerCase()));
        if (categoryMatch || idMatch || nameMatch) targetedMenuIds.add(item.id);
      });
    });
    return { active: active.length, ready, needsReview, targetedMenus: targetedMenuIds.size };
  }, [orderedGroups, menuItems]);

  const markDirty = (group: CondimentGroup) => {
    setDrafts((currentDrafts) => ({ ...currentDrafts, [group.id]: group }));
    setDirtyIds((ids) => (ids.includes(group.id) ? ids : [...ids, group.id]));
  };

  const updateCurrent = (updater: (group: CondimentGroup) => CondimentGroup) => {
    if (!current) return;
    markDirty(updater(cloneGroup(current)));
  };

  const replaceDraftIdentity = (oldId: string, saved: CondimentGroup) => {
    setDrafts((currentDrafts) => {
      const next = { ...currentDrafts };
      delete next[oldId];
      next[saved.id] = cloneGroup(saved);
      return next;
    });
    setDirtyIds((ids) => ids.filter((id) => id !== oldId && id !== saved.id));
    setSavingIds((ids) => ids.filter((id) => id !== oldId && id !== saved.id));
    if (selectedId === oldId) setSelectedId(saved.id);
  };

  const saveGroup = async (group: CondimentGroup) => {
    const issues = groupIssues(group);
    if (issues.errors.length) {
      toast('Konfigurasi Belum Lengkap', issues.errors[0]);
      setSelectedId(group.id);
      return false;
    }
    setSavingIds((ids) => (ids.includes(group.id) ? ids : [...ids, group.id]));
    try {
      const saved = await onSaveCondimentGroup(cloneGroup(group));
      if (saved && typeof saved === 'object' && 'id' in saved) replaceDraftIdentity(group.id, saved as CondimentGroup);
      else {
        setDirtyIds((ids) => ids.filter((id) => id !== group.id));
        setSavingIds((ids) => ids.filter((id) => id !== group.id));
      }
      toast('Grup Tersimpan', `${group.name} sudah disinkronkan ke Kasir, Self Order, dan Kitchen.`);
      return true;
    } catch (error) {
      setSavingIds((ids) => ids.filter((id) => id !== group.id));
      toast('Grup Gagal Disimpan', error instanceof Error ? error.message : 'Perubahan belum tersimpan ke cloud.');
      return false;
    }
  };

  const saveAll = async () => {
    for (const id of [...dirtyIds]) {
      const group = drafts[id] || orderedGroups.find((item) => item.id === id);
      if (!group) continue;
      const ok = await saveGroup(group);
      if (!ok) break;
    }
  };

  const discardCurrent = () => {
    if (!current) return;
    const original = condimentGroups.find((group) => group.id === current.id);
    if (original) {
      setDrafts((draftMap) => ({ ...draftMap, [current.id]: cloneGroup(original) }));
    } else {
      setDrafts((draftMap) => {
        const next = { ...draftMap };
        delete next[current.id];
        return next;
      });
      const nextId = condimentGroups[0]?.id || '';
      setSelectedId(nextId);
    }
    setDirtyIds((ids) => ids.filter((id) => id !== current.id));
  };

  const createDraft = (kind: 'SINGLE_REQUIRED' | 'MULTIPLE_OPTIONAL' | 'CUSTOM') => {
    const id = makeTempId('draft-group');
    const group: CondimentGroup = {
      id,
      name: kind === 'SINGLE_REQUIRED' ? 'PILIHAN BARU' : kind === 'MULTIPLE_OPTIONAL' ? 'TOPPING BARU' : 'GRUP BARU',
      mode: kind === 'SINGLE_REQUIRED' ? 'PAKET' : 'ADD_ON',
      required: kind === 'SINGLE_REQUIRED',
      isRequired: kind === 'SINGLE_REQUIRED',
      minSelect: kind === 'SINGLE_REQUIRED' ? 1 : 0,
      maxSelect: kind === 'SINGLE_REQUIRED' ? 1 : 5,
      targetCategories: [],
      targetProductIds: [],
      options: [],
      isActive: true,
      selfOrderRole: 'NONE',
    };
    markDirty(group);
    setSelectedId(id);
    setActiveStep('TARGET');
    setShowTemplateModal(false);
  };

  const applyBaksoTemplate = () => {
    const { groups, brothId, fillingId } = buildBaksoStandard(orderedGroups);
    const changed: string[] = [];
    const nextDrafts: Record<string, CondimentGroup> = { ...drafts };
    for (const nextGroup of groups) {
      const previous = orderedGroups.find((group) => group.id === nextGroup.id);
      const changedValue = !previous || JSON.stringify(previous) !== JSON.stringify(nextGroup);
      if (changedValue) {
        nextDrafts[nextGroup.id] = nextGroup;
        changed.push(nextGroup.id);
      }
    }
    setDrafts(nextDrafts);
    setDirtyIds((ids) => Array.from(new Set([...ids, ...changed])));
    setSelectedId(fillingId || brothId);
    setActiveStep('INSTANT');
    setShowTemplateModal(false);
    toast('Template Bakso Disiapkan', `${changed.length || 2} grup disiapkan sebagai draft. Periksa lalu klik Simpan Semua agar aktif di Kasir, Self Order, dan Kitchen.`);
  };

  const setScopeMode = (mode: ScopeMode) => {
    updateCurrent((group) => {
      if (mode === 'CATEGORY') {
        group.targetProductIds = [];
        group.targetProductNames = [];
      } else if (mode === 'MENU') {
        group.targetCategory = undefined;
        group.targetCategories = [];
      }
      return group;
    });
  };

  const toggleCategory = (category: CategoryType) => {
    updateCurrent((group) => {
      const categories = group.targetCategories || (group.targetCategory ? [group.targetCategory] : []);
      group.targetCategory = undefined;
      group.targetCategories = categories.includes(category) ? categories.filter((item) => item !== category) : [...categories, category];
      return group;
    });
  };

  const toggleMenu = (menuId: string) => {
    updateCurrent((group) => {
      const ids = group.targetProductIds || [];
      group.targetProductIds = ids.includes(menuId) ? ids.filter((id) => id !== menuId) : [...ids, menuId];
      group.targetProductNames = [];
      return group;
    });
  };

  const setRole = (role: Role) => {
    updateCurrent((group) => {
      group.selfOrderRole = role;
      if (role === 'BROTH') {
        group.mode = 'PAKET';
        group.required = true;
        group.isRequired = true;
        group.minSelect = 1;
        group.maxSelect = 1;
        const original = activeOptions(group).find((option) => normalize(option.name) === 'ORIGINAL') || activeOptions(group)[0];
        group.selfOrderDefaultOptions = original ? [original.name] : [];
      }
      if (role === 'FILLING') {
        group.mode = 'ADD_ON';
        group.required = true;
        group.isRequired = true;
        group.minSelect = 1;
        group.maxSelect = Math.max(Number(group.maxSelect || 0), activeOptions(group).length || 1);
      }
      if (role === 'NONE') {
        group.selfOrderDefaultOptions = [];
        group.selfOrderBaksoOnlyOptions = [];
        group.selfOrderCampurOptions = [];
      }
      return group;
    });
  };

  const updateOption = (optionId: string, patch: Partial<CondimentOption>) => {
    updateCurrent((group) => {
      group.options = group.options.map((option) => (option.id === optionId ? { ...option, ...patch } : option));
      return group;
    });
  };

  const removeOption = (optionId: string) => {
    updateCurrent((group) => {
      const removed = group.options.find((option) => option.id === optionId);
      group.options = group.options.filter((option) => option.id !== optionId);
      if (removed) {
        const removeName = (values?: string[]) => (values || []).filter((name) => normalize(name) !== normalize(removed.name));
        group.selfOrderDefaultOptions = removeName(group.selfOrderDefaultOptions);
        group.selfOrderBaksoOnlyOptions = removeName(group.selfOrderBaksoOnlyOptions);
        group.selfOrderCampurOptions = removeName(group.selfOrderCampurOptions);
      }
      return group;
    });
  };

  const addOption = () => {
    updateCurrent((group) => {
      group.options = [...group.options, { id: makeTempId('opt'), name: 'OPSI BARU', price: 0, isAvailable: true }];
      group.maxSelect = isSingle(group) ? 1 : Math.max(Number(group.maxSelect || 0), 1);
      return group;
    });
  };

  const moveOption = (optionId: string, direction: -1 | 1) => {
    updateCurrent((group) => {
      const index = group.options.findIndex((option) => option.id === optionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= group.options.length) return group;
      const next = [...group.options];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      group.options = next;
      return group;
    });
  };

  const togglePresetOption = (field: 'selfOrderBaksoOnlyOptions' | 'selfOrderCampurOptions', optionName: string) => {
    updateCurrent((group) => {
      const currentValues = group[field] || [];
      const exists = currentValues.some((name) => normalize(name) === normalize(optionName));
      group[field] = exists
        ? currentValues.filter((name) => normalize(name) !== normalize(optionName))
        : [...currentValues, optionName];
      return group;
    });
  };

  const menuCandidates = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return menuItems
      .filter((item) => !q || item.name.toLowerCase().includes(q) || String(item.category).toLowerCase().includes(q))
      .slice(0, 80);
  }, [menuItems, menuSearch]);

  const steps = [
    { id: 'TARGET' as const, label: '1. Target', detail: 'Menu mana yang memakai grup ini' },
    { id: 'RULE' as const, label: '2. Aturan', detail: 'Pilih 1/banyak dan wajib/opsional' },
    { id: 'OPTIONS' as const, label: '3. Opsi', detail: 'Isi pilihan, harga, urutan' },
    { id: 'INSTANT' as const, label: '4. Perilaku', detail: 'Kuah, racikan cepat, atau normal' },
    { id: 'PREVIEW' as const, label: '5. Preview', detail: 'Lihat dampak ke customer & dapur' },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--panel-border)] bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-[var(--text-primary)]">Racikan, Isian & Topping</h2>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">1 SUMBER KONFIGURASI</span>
            </div>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-[var(--text-tertiary)]">
              Atur satu kali untuk Kasir, Self Order, dan Kitchen. Perubahan dibuat sebagai draft lokal dahulu, lalu disimpan per grup agar layar tidak meloncat dan konfigurasi tidak berubah setengah jalan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowGuide(true)} className="ui-button ui-button-secondary min-h-10 px-3 text-[10px]">
              <CircleHelp className="h-4 w-4" /> Panduan 1 Menit
            </button>
            <button type="button" onClick={() => setShowTemplateModal(true)} className="min-h-10 rounded-xl border border-amber-200 bg-amber-50 px-3 text-[10px] font-black text-amber-800 hover:bg-amber-100">
              <WandSparkles className="mr-1.5 inline h-4 w-4" /> Template Cepat
            </button>
            <button type="button" onClick={() => createDraft('CUSTOM')} className="ui-button ui-button-primary min-h-10 px-3 text-[10px]">
              <Plus className="h-4 w-4" /> Grup Baru
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ['Grup Aktif', groupStats.active, 'Konfigurasi yang sedang dipakai'],
            ['Siap', groupStats.ready, 'Tidak ada error konfigurasi'],
            ['Perlu Dicek', groupStats.needsReview, 'Ada target/aturan/preset belum lengkap'],
            ['Menu Terjangkau', groupStats.targetedMenus, 'Menu yang terkena minimal satu grup'],
          ].map(([label, value, detail]) => (
            <div key={String(label)} className="rounded-xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] px-3 py-2.5">
              <div className="flex items-end justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-wide text-[var(--text-tertiary)]">{label}</span><strong className="text-lg leading-none text-[var(--text-primary)]">{value}</strong></div>
              <p className="mt-1 text-[9px] font-semibold text-[var(--text-tertiary)]">{detail}</p>
            </div>
          ))}
        </div>

        {dirtyIds.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[10px] font-black text-amber-900">{dirtyIds.length} grup memiliki draft belum disimpan</p><p className="text-[9px] font-semibold text-amber-700">Draft aman saat berpindah grup pada layar ini, tetapi belum masuk ke cloud.</p></div>
            <button type="button" onClick={() => void saveAll()} className="min-h-9 rounded-xl bg-amber-600 px-3 text-[10px] font-black text-white hover:bg-amber-700"><Save className="mr-1.5 inline h-3.5 w-3.5" /> Simpan Semua ({dirtyIds.length})</button>
          </div>
        )}
      </section>

      <section className="grid min-h-[640px] overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white shadow-sm xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--panel-border)] bg-slate-50/80 xl:border-b-0 xl:border-r">
          <div className="sticky top-0 z-10 border-b border-[var(--panel-border)] bg-slate-50/95 p-3 backdrop-blur">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari grup, target, opsi..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[11px] font-semibold outline-none focus:border-[var(--primary)]" /></div>
          </div>
          <div className="max-h-[720px] space-y-2 overflow-y-auto p-3">
            {filteredGroups.map((group) => {
              const issues = groupIssues(group);
              const selected = group.id === selectedId;
              const role = inferRole(group);
              return (
                <button key={group.id} type="button" onClick={() => { setSelectedId(group.id); setActiveStep('TARGET'); }} className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-[var(--primary)] bg-white shadow-sm ring-1 ring-[var(--primary)]/10' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${group.isActive !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} /><strong className="truncate text-[12px] text-slate-900">{group.name}</strong>{dirtySet.has(group.id) && <span className="h-2 w-2 rounded-full bg-amber-500" title="Draft belum disimpan" />}</div><p className="mt-1 truncate text-[9px] font-bold text-slate-500">{scopeLabel(group)}</p></div>
                    {issues.ready ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-600">{ruleLabel(group)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-600">{activeOptions(group).length} opsi</span>
                    {role !== 'NONE' && <span className="rounded-full bg-orange-50 px-2 py-1 text-[8px] font-black text-orange-600">{role === 'BROTH' ? 'KUAH' : 'RACIKAN CEPAT'}</span>}
                  </div>
                </button>
              );
            })}
            {!filteredGroups.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-[10px] font-semibold text-slate-500">Tidak ada grup yang cocok.</div>}
          </div>
        </aside>

        <main className="min-w-0 bg-white">
          {!current ? (
            <div className="flex min-h-[640px] items-center justify-center p-8 text-center"><div><Layers3 className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-3 text-sm font-black text-slate-900">Belum ada grup dipilih</h3><p className="mt-1 text-xs font-semibold text-slate-500">Pilih grup di kiri atau buat konfigurasi baru.</p></div></div>
          ) : (
            <div className="flex min-h-[640px] flex-col">
              <header className="shrink-0 border-b border-[var(--panel-border)] bg-white px-4 py-3 md:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={current.name} onChange={(e) => updateCurrent((group) => ({ ...group, name: e.target.value }))} className="min-w-[180px] max-w-lg border-0 bg-transparent p-0 text-lg font-black text-slate-950 outline-none placeholder:text-slate-300" placeholder="Nama grup" />
                      <button type="button" onClick={() => updateCurrent((group) => ({ ...group, isActive: group.isActive === false ? true : false }))} className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${current.isActive !== false ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{current.isActive !== false ? 'AKTIF' : 'NONAKTIF'}</button>
                      {currentIssues.ready ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">✓ SIAP DIGUNAKAN</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black text-amber-700">{currentIssues.errors.length} PERLU DIPERBAIKI</span>}
                    </div>
                    <p className="mt-1 text-[10px] font-semibold text-slate-500">{scopeLabel(current)} · {ruleLabel(current)} · {activeOptions(current).length} opsi aktif</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isCurrentDirty && <button type="button" onClick={discardCurrent} className="min-h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-600 hover:bg-slate-50">Batalkan Draft</button>}
                    <button type="button" disabled={!isCurrentDirty || isCurrentSaving} onClick={() => void saveGroup(current)} className="ui-button ui-button-primary min-h-9 px-3 text-[10px] disabled:cursor-not-allowed disabled:opacity-45">{isCurrentSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {isCurrentSaving ? 'Menyimpan…' : 'Simpan Grup'}</button>
                  </div>
                </div>
                {(currentIssues.errors.length > 0 || currentIssues.warnings.length > 0) && (
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {currentIssues.errors.slice(0, 2).map((issue) => <div key={issue} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[9px] font-bold text-rose-700">⚠ {issue}</div>)}
                    {currentIssues.warnings.slice(0, 2).map((issue) => <div key={issue} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[9px] font-bold text-amber-700">• {issue}</div>)}
                  </div>
                )}
              </header>

              <div className="shrink-0 overflow-x-auto border-b border-[var(--panel-border)] bg-slate-50 px-3 py-2 md:px-5">
                <div className="flex min-w-max gap-1.5">
                  {steps.map((step) => <button key={step.id} type="button" onClick={() => setActiveStep(step.id)} className={`rounded-xl border px-3 py-2 text-left ${activeStep === step.id ? 'border-[var(--primary)] bg-white text-[var(--primary-hover)] shadow-sm' : 'border-transparent bg-transparent text-slate-500 hover:bg-white'}`}><span className="block text-[9px] font-black">{step.label}</span><span className="mt-0.5 block text-[8px] font-semibold opacity-70">{step.detail}</span></button>)}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/45 p-4 md:p-5" style={{ maxHeight: '720px' }}>
                {activeStep === 'TARGET' && (
                  <div className="space-y-4">
                    <SectionTitle icon={<Filter className="h-4 w-4" />} title="Tentukan Target" detail="Pilih menu mana yang akan menampilkan grup ini. Jangan pilih Kategori dan Menu Satuan tanpa sengaja; gunakan mode Campuran bila memang keduanya diperlukan." />
                    <div className="grid gap-2 md:grid-cols-3">
                      {[{ id: 'CATEGORY' as ScopeMode, title: 'Kategori', detail: 'Berlaku ke seluruh menu dalam kategori.' }, { id: 'MENU' as ScopeMode, title: 'Menu Satuan', detail: 'Hanya menu yang dipilih satu per satu.' }, { id: 'MIXED' as ScopeMode, title: 'Campuran', detail: 'Gabungkan kategori + menu tertentu.' }].map((item) => {
                        const selected = getScopeMode(current) === item.id;
                        return <button key={item.id} type="button" onClick={() => setScopeMode(item.id)} className={`rounded-xl border p-3 text-left ${selected ? 'border-[var(--primary)] bg-[var(--brand-50)] text-[var(--primary-hover)]' : 'border-slate-200 bg-white text-slate-700'}`}><strong className="block text-[11px]">{item.title}</strong><span className="mt-1 block text-[9px] font-semibold opacity-70">{item.detail}</span></button>;
                      })}
                    </div>

                    {getScopeMode(current) !== 'MENU' && (
                      <div className="rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-[10px] font-black text-slate-900">Kategori Menu</p><p className="mt-1 text-[9px] font-semibold text-slate-500">Klik satu atau beberapa kategori.</p><div className="mt-3 flex flex-wrap gap-2">{availableCategories.map((category) => { const selected = (current.targetCategories || []).includes(category); return <button key={String(category)} type="button" onClick={() => toggleCategory(category)} className={`rounded-xl border px-3 py-2 text-[9px] font-black ${selected ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{String(category)}</button>; })}</div></div>
                    )}

                    {getScopeMode(current) !== 'CATEGORY' && (
                      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black text-slate-900">Menu Satuan</p><p className="mt-1 text-[9px] font-semibold text-slate-500">Pilih menu spesifik. Cocok untuk Teh, Air Mineral, atau varian tertentu.</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">{(current.targetProductIds || []).length} dipilih</span></div>
                        <div className="relative mt-3"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} placeholder="Cari nama menu..." className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[10px] font-semibold outline-none focus:border-[var(--primary)]" /></div>
                        <div className="mt-2 grid max-h-64 gap-1.5 overflow-y-auto pr-1 md:grid-cols-2">{menuCandidates.map((item) => { const selected = (current.targetProductIds || []).includes(item.id); return <button key={item.id} type="button" onClick={() => toggleMenu(item.id)} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>{selected && <Check className="h-3 w-3" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[9px] text-slate-900">{item.name}</strong><span className="block text-[8px] font-semibold text-slate-400">{String(item.category)}</span></span></button>; })}</div>
                      </div>
                    )}
                  </div>
                )}

                {activeStep === 'RULE' && (
                  <div className="space-y-4">
                    <SectionTitle icon={<ListChecks className="h-4 w-4" />} title="Aturan Pilihan" detail="Pisahkan dua konsep: berapa banyak yang boleh dipilih, dan apakah pelanggan wajib memilih." />
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-[10px] font-black text-slate-900">Jumlah Pilihan</p><div className="mt-3 grid grid-cols-2 gap-2"><RuleCard active={isSingle(current)} title="Pilih 1" detail="Radio / satu pilihan" onClick={() => updateCurrent((group) => ({ ...group, mode: 'PAKET', maxSelect: 1, minSelect: isRequired(group) ? 1 : 0 }))} /><RuleCard active={!isSingle(current)} title="Pilih Banyak" detail="Checkbox / beberapa pilihan" onClick={() => updateCurrent((group) => ({ ...group, mode: 'ADD_ON', maxSelect: Math.max(2, Number(group.maxSelect || 0), activeOptions(group).length || 2) }))} /></div></div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-[10px] font-black text-slate-900">Kewajiban</p><div className="mt-3 grid grid-cols-2 gap-2"><RuleCard active={isRequired(current)} title="Wajib" detail="Order tidak bisa lanjut bila kosong" onClick={() => updateCurrent((group) => ({ ...group, required: true, isRequired: true, minSelect: Math.max(1, Number(group.minSelect || 0)) }))} /><RuleCard active={!isRequired(current)} title="Opsional" detail="Pelanggan boleh melewati" onClick={() => updateCurrent((group) => ({ ...group, required: false, isRequired: false, minSelect: 0 }))} /></div></div>
                    </div>
                    {!isSingle(current) && <div className="rounded-xl border border-slate-200 bg-white p-3.5"><div className="grid gap-3 sm:grid-cols-2"><NumberField label="Minimum" value={Number(current.minSelect || 0)} min={isRequired(current) ? 1 : 0} max={99} onChange={(value) => updateCurrent((group) => ({ ...group, minSelect: value, required: value > 0 ? true : group.required, isRequired: value > 0 ? true : group.isRequired }))} /><NumberField label="Maksimum" value={Number(current.maxSelect || 0)} min={1} max={99} onChange={(value) => updateCurrent((group) => ({ ...group, maxSelect: value }))} /></div><p className="mt-2 text-[9px] font-semibold text-slate-500">Untuk Isian Bakso, maksimum biasanya mengikuti jumlah opsi aktif. Untuk topping, tentukan batas sesuai kebutuhan operasional.</p></div>}
                  </div>
                )}

                {activeStep === 'OPTIONS' && (
                  <div className="space-y-4">
                    <SectionTitle icon={<PackageCheck className="h-4 w-4" />} title="Daftar Opsi" detail="Edit nama, harga tambahan, status, dan urutan tanpa langsung mengirim perubahan ke cloud." />
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="hidden grid-cols-[42px_minmax(180px,1fr)_150px_100px_92px] gap-2 border-b bg-slate-50 px-3 py-2 text-[8px] font-black uppercase tracking-wide text-slate-400 md:grid"><span>Urut</span><span>Nama Opsi</span><span>Harga Tambahan</span><span>Status</span><span>Aksi</span></div>
                      <div className="divide-y divide-slate-100">{current.options.map((option, index) => <div key={option.id} className="grid gap-2 px-3 py-2.5 md:grid-cols-[42px_minmax(180px,1fr)_150px_100px_92px] md:items-center"><div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => moveOption(option.id, -1)} className="h-7 w-7 rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30">↑</button><button type="button" disabled={index === current.options.length - 1} onClick={() => moveOption(option.id, 1)} className="h-7 w-7 rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30">↓</button></div><input value={option.name} onChange={(e) => updateOption(option.id, { name: e.target.value.toUpperCase() })} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-black text-slate-900 outline-none focus:border-[var(--primary)]" /><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">Rp</span><input type="number" min={0} value={Number(option.price || 0)} onChange={(e) => updateOption(option.id, { price: Math.max(0, Number(e.target.value || 0)) })} className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-2 text-[10px] font-bold outline-none focus:border-[var(--primary)]" /></div><button type="button" onClick={() => updateOption(option.id, { isAvailable: option.isAvailable === false ? true : false })} className={`h-8 rounded-lg border px-2 text-[9px] font-black ${option.isAvailable !== false ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{option.isAvailable !== false ? 'AKTIF' : 'NONAKTIF'}</button><button type="button" onClick={() => removeOption(option.id)} className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[9px] font-black text-rose-600"><Trash2 className="mr-1 inline h-3 w-3" /> Hapus</button></div>)}</div>
                      <button type="button" onClick={addOption} className="flex w-full items-center justify-center gap-1.5 border-t bg-slate-50 px-3 py-3 text-[10px] font-black text-[var(--primary-hover)] hover:bg-[var(--brand-50)]"><Plus className="h-4 w-4" /> Tambah Opsi</button>
                    </div>
                  </div>
                )}

                {activeStep === 'INSTANT' && (
                  <div className="space-y-4">
                    <SectionTitle icon={<Sparkles className="h-4 w-4" />} title="Perilaku di Kasir, Self Order & Kitchen" detail="Pilih peran khusus hanya bila diperlukan. Kuah dan Isian/Racikan Cepat mempunyai perilaku tambahan di Self Order dan ringkasan KDS." />
                    <div className="grid gap-2 md:grid-cols-3">{[{ id: 'NONE' as Role, title: 'Normal', detail: 'Untuk topping, suhu minuman, level pedas, dll.' }, { id: 'BROTH' as Role, title: 'Kuah', detail: 'Pilih 1, wajib, punya default Self Order.' }, { id: 'FILLING' as Role, title: 'Isian / Racikan Cepat', detail: 'Memunculkan tombol Bakso Saja dan Campur.' }].map((item) => <button key={item.id} type="button" onClick={() => setRole(item.id)} className={`rounded-xl border p-3 text-left ${inferRole(current) === item.id ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-slate-200 bg-white text-slate-700'}`}><strong className="text-[10px]">{item.title}</strong><span className="mt-1 block text-[9px] font-semibold opacity-70">{item.detail}</span></button>)}</div>

                    {inferRole(current) === 'BROTH' && <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3.5"><p className="text-[10px] font-black text-orange-900">Default Kuah Self Order</p><p className="mt-1 text-[9px] font-semibold text-orange-700">Pelanggan tetap bisa mengganti pilihan. Default hanya mempercepat order.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{activeOptions(current).map((option) => { const selected = (current.selfOrderDefaultOptions || []).some((name) => normalize(name) === normalize(option.name)); return <button key={option.id} type="button" onClick={() => updateCurrent((group) => ({ ...group, selfOrderDefaultOptions: [option.name] }))} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[9px] font-black ${selected ? 'border-orange-400 bg-white text-orange-700' : 'border-orange-100 bg-white/70 text-slate-600'}`}><span className={`h-4 w-4 rounded-full border ${selected ? 'border-orange-500 bg-orange-500 ring-2 ring-white' : 'border-slate-300'}`} />{option.name}</button>; })}</div></div>}

                    {inferRole(current) === 'FILLING' && (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3.5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black text-orange-900">Racikan Instan</p><p className="mt-1 text-[9px] font-semibold text-orange-700">Tombol ini muncul di POS dan Self Order. Customer/kasir masih boleh mengubah isian manual setelah memilih preset.</p></div><span className="rounded-full bg-white px-2 py-1 text-[8px] font-black text-orange-600">LIVE: KASIR + SELF ORDER + KDS</span></div></div>
                        <PresetEditor title="Bakso Saja" detail="Umumnya hanya bawang + seledri." options={activeOptions(current)} selected={current.selfOrderBaksoOnlyOptions || []} onToggle={(name) => togglePresetOption('selfOrderBaksoOnlyOptions', name)} />
                        <PresetEditor title="Campur" detail="Racikan lengkap. Untuk standar Bakso Ujo: semua isian kecuali kwetiaw." options={activeOptions(current)} selected={current.selfOrderCampurOptions || []} onToggle={(name) => togglePresetOption('selfOrderCampurOptions', name)} />
                        <div className="rounded-xl border border-slate-200 bg-white p-3.5"><label className="text-[9px] font-black uppercase tracking-wide text-slate-500">Label ringkas Kitchen saat tepat sama preset Campur</label><input value={current.allSelectedLabel || ''} onChange={(e) => updateCurrent((group) => ({ ...group, allSelectedLabel: e.target.value.toUpperCase() }))} placeholder="CAMPUR" className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-3 text-[10px] font-black outline-none focus:border-[var(--primary)]" /><p className="mt-1 text-[8px] font-semibold text-slate-400">Jika customer mengubah satu opsi saja, Kitchen akan menampilkan daftar isian aktual, bukan label CAMPUR.</p></div>
                      </div>
                    )}
                  </div>
                )}

                {activeStep === 'PREVIEW' && (
                  <div className="space-y-4"><SectionTitle icon={<Eye className="h-4 w-4" />} title="Preview Sebelum Simpan" detail="Cek apakah customer dan Kitchen akan membaca konfigurasi sesuai yang Anda maksud." /><CondimentPreviewPanel group={current} /><div className={`rounded-xl border p-3.5 ${currentIssues.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-start gap-2">{currentIssues.ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />}<div><p className={`text-[10px] font-black ${currentIssues.ready ? 'text-emerald-800' : 'text-amber-800'}`}>{currentIssues.ready ? 'Konfigurasi siap disimpan' : 'Lengkapi konfigurasi sebelum disimpan'}</p>{[...currentIssues.errors, ...currentIssues.warnings].map((issue) => <p key={issue} className="mt-1 text-[9px] font-semibold text-slate-600">• {issue}</p>)}</div></div></div></div>
                )}
              </div>

              <footer className="shrink-0 border-t border-[var(--panel-border)] bg-white px-4 py-3 md:px-5"><div className="flex items-center justify-between gap-3"><button type="button" onClick={() => { const index = steps.findIndex((step) => step.id === activeStep); if (index > 0) setActiveStep(steps[index - 1].id); }} disabled={activeStep === steps[0].id} className="min-h-9 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-black text-slate-500 disabled:opacity-30"><ChevronLeft className="mr-1 inline h-3.5 w-3.5" /> Sebelumnya</button><span className="hidden text-[9px] font-semibold text-slate-400 sm:inline">Perubahan baru aktif setelah <strong>Simpan Grup</strong>.</span><button type="button" onClick={() => { const index = steps.findIndex((step) => step.id === activeStep); if (index < steps.length - 1) setActiveStep(steps[index + 1].id); }} disabled={activeStep === steps[steps.length - 1].id} className="min-h-9 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-black text-slate-600 disabled:opacity-30">Berikutnya <ChevronRight className="ml-1 inline h-3.5 w-3.5" /></button></div></footer>
            </div>
          )}
        </main>
      </section>

      {showTemplateModal && (
        <ModalShell onClose={() => setShowTemplateModal(false)} title="Template Cepat" subtitle="Mulai dari struktur yang benar, lalu review sebelum menyimpan.">
          <div className="grid gap-3 md:grid-cols-2">
            <TemplateCard icon={<Utensils className="h-5 w-5" />} title="Bakso Ujo Standard" badge="DIREKOMENDASIKAN" detail="Membuat atau memperbaiki KUAH + ISIAN, default Original, Bakso Saja = Bawang + Seledri, Campur = semua kecuali Kwetiaw. Opsi custom yang sudah ada tidak dihapus." onClick={applyBaksoTemplate} />
            <TemplateCard icon={<ListChecks className="h-5 w-5" />} title="Pilih 1 Wajib" detail="Untuk suhu minuman, jenis kuah, level pedas, atau varian yang harus dipilih satu." onClick={() => createDraft('SINGLE_REQUIRED')} />
            <TemplateCard icon={<Layers3 className="h-5 w-5" />} title="Topping Opsional" detail="Pelanggan boleh memilih beberapa tambahan atau melewati grup." onClick={() => createDraft('MULTIPLE_OPTIONAL')} />
            <TemplateCard icon={<Plus className="h-5 w-5" />} title="Mulai Kosong" detail="Buat grup tanpa preset untuk kebutuhan khusus." onClick={() => createDraft('CUSTOM')} />
          </div>
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[9px] font-semibold leading-relaxed text-blue-800"><strong>Catatan:</strong> Template hanya menyiapkan draft. Tidak ada perubahan cloud sampai Anda menekan <strong>Simpan Grup</strong> atau <strong>Simpan Semua</strong>.</div>
        </ModalShell>
      )}

      {showGuide && (
        <ModalShell onClose={() => setShowGuide(false)} title="Cara Kerja 1 Menit" subtitle="Urutan paling aman untuk membuat konfigurasi baru.">
          <div className="space-y-3">{[
            ['1', 'Target', 'Tentukan dulu menu yang memakai grup. Gunakan Kategori untuk massal, Menu Satuan untuk menu tertentu, Campuran bila benar-benar perlu keduanya.'],
            ['2', 'Aturan', 'Pilih apakah hanya 1 atau boleh banyak, lalu tentukan Wajib atau Opsional. Ini dua pengaturan yang berbeda.'],
            ['3', 'Opsi', 'Masukkan pilihan yang tampil ke kasir/customer. Harga 0 berarti tanpa tambahan biaya.'],
            ['4', 'Perilaku', 'Gunakan Normal untuk kebanyakan grup. Pilih Kuah atau Isian/Racikan Cepat hanya untuk perilaku Self Order khusus.'],
            ['5', 'Preview & Simpan', 'Cek customer dan Kitchen, lalu Simpan Grup. Perubahan tidak disimpan setiap kali Anda mengetik.'],
          ].map(([number, title, detail]) => <div key={number} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[10px] font-black text-white">{number}</span><div><strong className="text-[10px] text-slate-900">{title}</strong><p className="mt-1 text-[9px] font-semibold leading-relaxed text-slate-500">{detail}</p></div></div>)}</div>
        </ModalShell>
      )}
    </div>
  );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; detail: string }> = ({ icon, title, detail }) => <div className="flex items-start gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--primary-hover)]">{icon}</span><div><h3 className="text-sm font-black text-slate-950">{title}</h3><p className="mt-0.5 max-w-2xl text-[10px] font-semibold leading-relaxed text-slate-500">{detail}</p></div></div>;

const RuleCard: React.FC<{ active: boolean; title: string; detail: string; onClick: () => void }> = ({ active, title, detail, onClick }) => <button type="button" onClick={onClick} className={`rounded-xl border p-3 text-left ${active ? 'border-[var(--primary)] bg-[var(--brand-50)] text-[var(--primary-hover)]' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><strong className="block text-[10px]">{title}</strong><span className="mt-1 block text-[8px] font-semibold opacity-70">{detail}</span></button>;

const NumberField: React.FC<{ label: string; value: number; min: number; max: number; onChange: (value: number) => void }> = ({ label, value, min, max, onChange }) => <label><span className="text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</span><input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value || 0))))} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-[11px] font-black outline-none focus:border-[var(--primary)]" /></label>;

const PresetEditor: React.FC<{ title: string; detail: string; options: CondimentOption[]; selected: string[]; onToggle: (name: string) => void }> = ({ title, detail, options, selected, onToggle }) => <div className="rounded-xl border border-slate-200 bg-white p-3.5"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black text-slate-900">{title}</p><p className="mt-0.5 text-[9px] font-semibold text-slate-500">{detail}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-600">{selected.length} isian</span></div><div className="mt-3 flex flex-wrap gap-2">{options.map((option) => { const active = selected.some((name) => normalize(name) === normalize(option.name)); return <button key={option.id} type="button" onClick={() => onToggle(option.name)} className={`rounded-lg border px-2.5 py-2 text-[9px] font-black ${active ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{active ? '✓ ' : ''}{option.name}</button>; })}</div></div>;

const TemplateCard: React.FC<{ icon: React.ReactNode; title: string; detail: string; badge?: string; onClick: () => void }> = ({ icon, title, detail, badge, onClick }) => <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--primary)] hover:shadow-sm"><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--primary-hover)]">{icon}</span>{badge && <span className="rounded-full bg-amber-50 px-2 py-1 text-[7px] font-black text-amber-700">{badge}</span>}</div><strong className="mt-3 block text-[11px] text-slate-900">{title}</strong><p className="mt-1 text-[9px] font-semibold leading-relaxed text-slate-500">{detail}</p></button>;

const ModalShell: React.FC<{ title: string; subtitle: string; onClose: () => void; children: React.ReactNode }> = ({ title, subtitle, onClose, children }) => <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-base font-black text-slate-950">{title}</h3><p className="mt-1 text-[10px] font-semibold text-slate-500">{subtitle}</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button></div><div className="max-h-[75dvh] overflow-y-auto p-5">{children}</div></div></div>;
