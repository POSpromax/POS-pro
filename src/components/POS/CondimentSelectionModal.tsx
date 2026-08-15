import React, {useEffect, useMemo, useState} from 'react';
import {Check, Sparkles, Utensils, X} from 'lucide-react';
import {CondimentGroup, MenuItem, SelectedCondimentGroup} from '../../types/pos';
import {isGroupApplicable} from '../../utils/condimentUtils';
import {optimizeCloudinaryImage} from '../../utils/imageUrl';

const EMPTY_SELECTED_CONDIMENTS: SelectedCondimentGroup[] = [];

const normalizeChoice = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

type SelfOrderRole = 'NONE' | 'BROTH' | 'FILLING';

const resolveSelfOrderRole = (group: CondimentGroup): SelfOrderRole => {
  if (
    group.selfOrderRole === 'NONE' ||
    group.selfOrderRole === 'BROTH' ||
    group.selfOrderRole === 'FILLING'
  ) {
    return group.selfOrderRole;
  }

  // Compatibility for older branches that were created before selfOrderRole
  // was persisted in branch_operational_config.
  const normalized = normalizeChoice(group.name);
  if (normalized.includes('KUAH')) return 'BROTH';
  if (normalized.includes('ISIAN')) return 'FILLING';
  return 'NONE';
};

const isLegacyPresetOption = (name: string) => {
  const normalized = normalizeChoice(name);
  return normalized === 'BAKSOAJA' || normalized === 'BAKSOSAJA';
};

const configuredNames = (group: CondimentGroup, names?: string[]) => {
  const wanted = new Set((names || []).map(normalizeChoice));
  if (!wanted.size) return [];

  return group.options
    .filter(
      (option) =>
        option.isAvailable !== false &&
        wanted.has(normalizeChoice(option.name)),
    )
    .map((option) => option.name);
};

const defaultBrothOptions = (group: CondimentGroup) => {
  const configured = configuredNames(group, group.selfOrderDefaultOptions);
  if (configured.length) return configured.slice(0, 1);

  const original = group.options.find(
    (option) =>
      option.isAvailable !== false &&
      normalizeChoice(option.name) === 'ORIGINAL',
  );

  return original ? [original.name] : [];
};

const defaultBaksoOnlyOptions = (group: CondimentGroup) => {
  const configured = configuredNames(group, group.selfOrderBaksoOnlyOptions);
  if (configured.length) return configured;

  return group.options
    .filter((option) => {
      if (option.isAvailable === false || isLegacyPresetOption(option.name)) return false;
      const name = normalizeChoice(option.name);
      return name === 'BAWANG' || name === 'SLEDRI' || name === 'SELEDRI';
    })
    .map((option) => option.name);
};

const defaultCampurOptions = (group: CondimentGroup) => {
  const configured = configuredNames(group, group.selfOrderCampurOptions);
  if (configured.length) return configured;

  return group.options
    .filter((option) => {
      if (option.isAvailable === false || isLegacyPresetOption(option.name)) return false;
      return normalizeChoice(option.name) !== 'KWETIAW';
    })
    .map((option) => option.name);
};

const isGroupRequired = (
  group: CondimentGroup,
  isSelfOrder: boolean,
): boolean => {
  const configuredRequired =
    group.required === true ||
    group.isRequired === true ||
    Number(group.minSelect || 0) > 0;

  // Broth is a hard safety rule in QR self-order: a Bakso order must always
  // carry one broth choice. FILLING and all other groups follow Settings.
  return configuredRequired || (isSelfOrder && resolveSelfOrderRole(group) === 'BROTH');
};

const isSingleGroup = (group: CondimentGroup): boolean =>
  group.mode === 'PAKET' || Number(group.maxSelect || 0) === 1;

const visibleOptions = (group: CondimentGroup, isSelfOrder: boolean) =>
  group.options.filter(
    (option) =>
      option.isAvailable !== false &&
      !(isSelfOrder && isLegacyPresetOption(option.name)),
  );

const limitPreset = (group: CondimentGroup, names: string[]) => {
  if (isSingleGroup(group)) return names.slice(0, 1);
  const max = Number(group.maxSelect || 0);
  return max > 0 ? names.slice(0, max) : names;
};

const sameSelection = (a: string[], b: string[]) => {
  const left = a.map(normalizeChoice).sort();
  const right = b.map(normalizeChoice).sort();
  return (
    left.length > 0 &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
};

interface CondimentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  condimentGroups: CondimentGroup[];
  onConfirm: (
    menuItem: MenuItem,
    selectedCondiments: SelectedCondimentGroup[],
    notes: string,
    extraPrice: number,
  ) => void;
  onShowToast?: (title: string, message: string) => void;
  initialSelectedCondiments?: SelectedCondimentGroup[];
  initialNotes?: string;
  visualMode?: 'DEFAULT' | 'SELF_ORDER';
}

export const CondimentSelectionModal: React.FC<CondimentSelectionModalProps> = ({
  isOpen,
  onClose,
  menuItem,
  condimentGroups,
  onConfirm,
  onShowToast,
  initialSelectedCondiments = EMPTY_SELECTED_CONDIMENTS,
  initialNotes = '',
  visualMode = 'DEFAULT',
}) => {
  const isSelfOrder = visualMode === 'SELF_ORDER';

  const applicableGroups = useMemo(
    () =>
      menuItem
        ? condimentGroups.filter(
            (group) =>
              group.isActive !== false && isGroupApplicable(group, menuItem),
          )
        : [],
    [condimentGroups, menuItem],
  );

  const brothGroup = useMemo(
    () =>
      isSelfOrder
        ? applicableGroups.find((group) => resolveSelfOrderRole(group) === 'BROTH')
        : undefined,
    [applicableGroups, isSelfOrder],
  );

  const fillingGroup = useMemo(
    () =>
      isSelfOrder
        ? applicableGroups.find((group) => resolveSelfOrderRole(group) === 'FILLING')
        : undefined,
    [applicableGroups, isSelfOrder],
  );

  const standardGroups = useMemo(
    () =>
      applicableGroups.filter(
        (group) => group.id !== brothGroup?.id && group.id !== fillingGroup?.id,
      ),
    [applicableGroups, brothGroup?.id, fillingGroup?.id],
  );

  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const initial: Record<string, string[]> = {};

    applicableGroups.forEach((group) => {
      const available = visibleOptions(group, isSelfOrder);
      const valid = new Set(available.map((option) => normalizeChoice(option.name)));
      const existing = initialSelectedCondiments.find(
        (selection) =>
          normalizeChoice(selection.groupName) === normalizeChoice(group.name),
      );

      if (existing) {
        initial[group.id] = existing.options.filter((name) =>
          valid.has(normalizeChoice(name)),
        );
        return;
      }

      if (isSelfOrder && resolveSelfOrderRole(group) === 'BROTH') {
        initial[group.id] = defaultBrothOptions(group);
        return;
      }

      if (isSelfOrder) {
        // Generic required groups (e.g. Teh Manis Dingin/Panas) intentionally
        // start empty so the customer makes a conscious choice. Only broth has
        // a configured self-order default.
        initial[group.id] = [];
        return;
      }

      initial[group.id] =
        isGroupRequired(group, false) && isSingleGroup(group) && available[0]
          ? [available[0].name]
          : [];
    });

    setSelections(initial);
    setNotes(initialNotes);
  }, [applicableGroups, initialNotes, initialSelectedCondiments, isSelfOrder]);

  if (!isOpen || !menuItem) return null;

  const baksoOnlyPreset = fillingGroup
    ? limitPreset(fillingGroup, defaultBaksoOnlyOptions(fillingGroup))
    : [];
  const campurPreset = fillingGroup
    ? limitPreset(fillingGroup, defaultCampurOptions(fillingGroup))
    : [];

  const toggleOption = (group: CondimentGroup, optionName: string) => {
    setSelections((current) => {
      const selected = current[group.id] || [];

      if (isSingleGroup(group)) {
        return {...current, [group.id]: [optionName]};
      }

      if (selected.includes(optionName)) {
        return {
          ...current,
          [group.id]: selected.filter((name) => name !== optionName),
        };
      }

      const max = Number(group.maxSelect || 0);
      if (max > 0 && selected.length >= max) {
        onShowToast?.(
          'Pilihan Maksimal',
          `Maksimal ${max} pilihan untuk ${group.name}.`,
        );
        return current;
      }

      return {...current, [group.id]: [...selected, optionName]};
    });
  };

  const applyInstantPreset = (preset: 'BAKSO_ONLY' | 'CAMPUR') => {
    if (!fillingGroup) return;

    const names = preset === 'BAKSO_ONLY' ? baksoOnlyPreset : campurPreset;
    if (!names.length) {
      onShowToast?.(
        'Preset Belum Dikonfigurasi',
        `Atur preset ${preset === 'BAKSO_ONLY' ? 'Bakso Saja' : 'Campur'} di Pengaturan → Daftar Isian / Topping.`,
      );
      return;
    }

    setSelections((current) => ({...current, [fillingGroup.id]: names}));
  };

  const extraPriceTotal = applicableGroups.reduce((groupTotal, group) => {
    const selected = selections[group.id] || [];
    return (
      groupTotal +
      group.options.reduce(
        (optionTotal, option) =>
          optionTotal +
          (selected.includes(option.name) ? Number(option.price || 0) : 0),
        0,
      )
    );
  }, 0);

  const finalUnitPrice = menuItem.price + extraPriceTotal;

  const handleSave = () => {
    for (const group of applicableGroups) {
      const selected = selections[group.id] || [];
      const required = isGroupRequired(group, isSelfOrder);
      const min = required ? Math.max(1, Number(group.minSelect || 1)) : 0;
      const max = isSingleGroup(group) ? 1 : Number(group.maxSelect || 0);

      if (selected.length < min) {
        const role = isSelfOrder ? resolveSelfOrderRole(group) : 'NONE';
        onShowToast?.(
          'Pilihan Belum Lengkap',
          role === 'FILLING'
            ? 'Pilih Bakso Saja, Campur, atau tentukan isian secara manual.'
            : `${group.name} wajib dipilih sebelum menambahkan pesanan.`,
        );
        return;
      }

      if (max > 0 && selected.length > max) {
        onShowToast?.(
          'Pilihan Terlalu Banyak',
          `${group.name} maksimal ${max} pilihan.`,
        );
        return;
      }
    }

    const formatted: SelectedCondimentGroup[] = applicableGroups
      .map((group) => ({
        groupName: group.name,
        options: selections[group.id] || [],
      }))
      .filter((group) => group.options.length > 0);

    onConfirm(menuItem, formatted, notes.trim(), extraPriceTotal);
    onClose();
  };

  const renderGroup = (group: CondimentGroup) => {
    const selected = selections[group.id] || [];
    const required = isGroupRequired(group, isSelfOrder);
    const single = isSingleGroup(group);
    const options = visibleOptions(group, isSelfOrder);
    const role = isSelfOrder ? resolveSelfOrderRole(group) : 'NONE';

    return (
      <section key={group.id} className="so-card p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[11px] font-black uppercase tracking-[.12em] text-[var(--so-text)]">{group.name}</h3>
            <p className="mt-1 text-[8px] font-semibold leading-relaxed text-[var(--so-text-muted)]">
              {single ? 'Pilih satu opsi.' : `Bisa pilih lebih dari satu${group.maxSelect ? ` · maksimal ${group.maxSelect}` : ''}.`}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <span className="rounded-full bg-[var(--so-surface-soft)] px-2 py-1 text-[7px] font-black uppercase tracking-wider text-[var(--so-text-soft)]">{single ? 'Single' : 'Multiple'}</span>
            <span className={`rounded-full px-2 py-1 text-[7px] font-black uppercase tracking-wider ${required ? 'bg-[var(--so-brand-soft)] text-[var(--so-brand)]' : 'bg-[var(--so-surface-soft)] text-[var(--so-text-muted)]'}`}>{required ? 'Wajib' : 'Opsional'}</span>
          </div>
        </div>

        {role === 'BROTH' && selected.length > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-[var(--so-surface-soft)] px-3 py-2 text-[8px] font-bold text-[var(--so-text-soft)]">
            <span>Default customer</span>
            <span className="rounded-full bg-white px-2 py-1 font-black text-[var(--so-brand)]">{selected.join(', ')}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {options.map((option) => {
            const active = selected.includes(option.name);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleOption(group, option.name)}
                className={`flex min-h-[50px] items-center gap-2.5 rounded-[1rem] border px-3 py-2.5 text-left transition duration-150 active:scale-[.985] ${active ? 'border-[var(--so-brand-weak)] bg-[var(--so-brand-soft)] text-[var(--so-text)]' : 'border-[var(--so-border)] bg-white text-[var(--so-text-soft)] hover:border-[var(--so-brand-weak)]'}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 transition ${single ? 'rounded-full' : 'rounded-md'} ${active ? 'border-[var(--so-brand)] bg-[var(--so-brand)] text-white' : 'border-[#d7d1cb] bg-white'}`}>
                  {active && (single ? <span className="h-2 w-2 rounded-full bg-white" /> : <Check className="h-3 w-3 stroke-[3]" />)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-black uppercase leading-tight">{option.name}</span>
                  {Number(option.price || 0) > 0 && <span className="mt-1 block text-[8px] font-black text-[var(--so-brand)]">+Rp {Number(option.price).toLocaleString('id-ID')}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="theme-self-order fixed inset-0 z-50 flex items-end justify-center bg-[#1b120e]/55 backdrop-blur-[3px] sm:items-center sm:p-4 animate-fadeIn">
      <section className="flex max-h-[96dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-[2rem] border border-[var(--so-border)] bg-[var(--so-canvas)] shadow-[0_-18px_70px_rgba(34,24,18,.22)] sm:rounded-[2rem] animate-slideUp">
        <header className="shrink-0 border-b border-[var(--so-border)] bg-white">
          <div className="relative h-[182px] overflow-hidden bg-[var(--so-surface-soft)] sm:h-[205px]">
            {menuItem.image ? (
              <img src={optimizeCloudinaryImage(menuItem.image, 900)} alt={menuItem.name} decoding="async" className="h-full w-full object-contain p-3" />
            ) : (
              <div className="flex h-full items-center justify-center"><Utensils className="h-12 w-12 text-[var(--so-text-faint)]" /></div>
            )}
            <button type="button" onClick={onClose} aria-label="Tutup detail menu" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--so-border)] bg-white/95 text-[var(--so-text)] shadow-sm transition active:scale-95"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex items-start justify-between gap-4 px-4 pb-4 pt-3.5">
            <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.17em] text-[var(--so-brand)]">Atur Pesanan</p><h2 className="mt-1 line-clamp-2 text-[17px] font-black leading-tight tracking-[-.02em] text-[var(--so-text)]">{menuItem.name}</h2></div>
            <span className="shrink-0 rounded-full bg-[var(--so-brand-soft)] px-3 py-1.5 text-[9px] font-black text-[var(--so-brand)]">Rp {finalUnitPrice.toLocaleString('id-ID')}</span>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-3.5 pb-4 pt-3 scrollbar-thin sm:px-4">
          {brothGroup && renderGroup(brothGroup)}

          {fillingGroup && (
            <section className="so-card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--so-brand-soft)] text-[var(--so-brand)]"><Sparkles className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[var(--so-text)]">Racikan Cepat</p><p className="mt-1 text-[8px] font-semibold leading-relaxed text-[var(--so-text-muted)]">Shortcut isian. Setelah memilih, kamu tetap bisa mengubah pilihan manual di bawah.</p></div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {([
                  {key: 'BAKSO_ONLY' as const, title: 'Bakso Saja', detail: baksoOnlyPreset.join(' + ') || 'Atur preset di Pengaturan', active: fillingGroup ? sameSelection(selections[fillingGroup.id] || [], baksoOnlyPreset) : false},
                  {key: 'CAMPUR' as const, title: 'Campur', detail: campurPreset.length ? `${campurPreset.length} isian` : 'Atur preset di Pengaturan', active: fillingGroup ? sameSelection(selections[fillingGroup.id] || [], campurPreset) : false},
                ]).map((preset) => (
                  <button key={preset.key} type="button" onClick={() => applyInstantPreset(preset.key)} className={`min-h-[72px] rounded-[1.1rem] border p-3 text-left transition active:scale-[.985] ${preset.active ? 'border-[var(--so-brand)] bg-[var(--so-brand)] text-white shadow-[0_10px_24px_rgba(237,95,30,.16)]' : 'border-[var(--so-border)] bg-[var(--so-surface-soft)] text-[var(--so-text)]'}`}>
                    <span className="flex items-center justify-between gap-2"><span className="text-[11px] font-black">{preset.title}</span><span className={`flex h-5 w-5 items-center justify-center rounded-full ${preset.active ? 'bg-white text-[var(--so-brand)]' : 'border border-[var(--so-border)] bg-white text-[var(--so-text-faint)]'}`}>{preset.active ? <Check className="h-3 w-3 stroke-[3]" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span></span>
                    <span className={`mt-2 block line-clamp-2 text-[8px] font-bold leading-relaxed ${preset.active ? 'text-white/72' : 'text-[var(--so-text-muted)]'}`}>{preset.detail}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {fillingGroup && renderGroup(fillingGroup)}
          {standardGroups.map(renderGroup)}

          {applicableGroups.length === 0 && <div className="so-card px-4 py-8 text-center"><Utensils className="mx-auto h-6 w-6 text-[var(--so-text-faint)]" /><p className="mt-2 text-[10px] font-black text-[var(--so-text-soft)]">Menu ini tidak memiliki pilihan tambahan.</p></div>}

          <label className="so-card block p-4"><span className="text-[8px] font-black uppercase tracking-[.13em] text-[var(--so-text-muted)]">Catatan item · opsional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 240))} rows={2} placeholder="Contoh: dibungkus, kuah dipisah, tanpa sawi..." className="so-native-textarea mt-2 w-full resize-none rounded-xl border border-[var(--so-border)] bg-[var(--so-surface-soft)] px-3 py-2.5 text-[10px] font-semibold text-[var(--so-text-soft)] outline-none transition placeholder:text-[var(--so-text-faint)] focus:border-[var(--so-brand-weak)] focus:bg-white" /></label>
        </div>

        <footer className="shrink-0 border-t border-[var(--so-border)] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><button type="button" onClick={handleSave} className="so-primary-button">Tambahkan · Rp {finalUnitPrice.toLocaleString('id-ID')}</button></footer>
      </section>
    </div>
  );
};