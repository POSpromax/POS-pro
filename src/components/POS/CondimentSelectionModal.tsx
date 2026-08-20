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
  // Explicit semantic roles always win.
  if (group.selfOrderRole === 'BROTH' || group.selfOrderRole === 'FILLING') {
    return group.selfOrderRole;
  }

  // Self-heal canonical Bakso Ujo groups. Older/stale branch config can contain
  // selfOrderRole='NONE' after a generic group save. KUAH and ISIAN are reserved
  // operational groups, so their semantic role must not disappear from Self Order.
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
  if (group.disabledQuickPresets?.includes('BAKSO_ONLY')) return [];
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
  if (group.disabledQuickPresets?.includes('CAMPUR')) return [];
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

  // KUAH and ISIAN are hard safety rules for QR Self Order. Generic groups
  // still follow Settings (e.g. topping can remain MULTIPLE + OPSIONAL).
  const role = resolveSelfOrderRole(group);
  return configuredRequired || (isSelfOrder && (role === 'BROTH' || role === 'FILLING'));
};

const isSingleGroup = (group: CondimentGroup): boolean =>
  group.mode === 'PAKET' || Number(group.maxSelect || 0) === 1;

const visibleOptions = (group: CondimentGroup) =>
  group.options.filter(
    (option) =>
      option.isAvailable !== false &&
      !(resolveSelfOrderRole(group) === 'FILLING' && isLegacyPresetOption(option.name)),
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

  // Semantic KUAH/ISIAN groups are resolved for BOTH QR Self Order and POS.
  // The hard-required safety rule remains Self Order specific, while Cashier
  // follows the group's Settings configuration.
  const brothGroup = useMemo(
    () => applicableGroups.find((group) => resolveSelfOrderRole(group) === 'BROTH'),
    [applicableGroups],
  );

  const fillingGroup = useMemo(
    () => applicableGroups.find((group) => resolveSelfOrderRole(group) === 'FILLING'),
    [applicableGroups],
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
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const initial: Record<string, string[]> = {};

    applicableGroups.forEach((group) => {
      const available = visibleOptions(group);
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
  const customPresets = fillingGroup
    ? (fillingGroup.quickPresets || []).flatMap((preset) => {
        const names = limitPreset(fillingGroup, configuredNames(fillingGroup, preset.options));
        return names.length ? [{...preset, options: names}] : [];
      })
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

  const applyCustomPreset = (options: string[]) => {
    if (!fillingGroup || !options.length) return;
    setSelections((current) => ({...current, [fillingGroup.id]: options}));
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
        const role = resolveSelfOrderRole(group);
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
    const options = visibleOptions(group);
    const role = resolveSelfOrderRole(group);

    return (
      <section key={group.id} className="so-card p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
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

        {isSelfOrder && role === 'BROTH' && selected.length > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-[var(--so-surface-soft)] px-3 py-2 text-[8px] font-bold text-[var(--so-text-soft)]">
            <span>Default customer</span>
            <span className="rounded-full bg-white px-2 py-1 font-black text-[var(--so-brand)]">{selected.join(', ')}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {options.map((option) => {
            const active = selected.includes(option.name);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleOption(group, option.name)}
                className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition duration-150 active:scale-[.985] ${active ? 'border-[var(--so-brand-weak)] bg-[var(--so-brand-soft)] text-[var(--so-text)]' : 'border-[var(--so-border)] bg-white text-[var(--so-text-soft)] hover:border-[var(--so-brand-weak)]'}`}
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

  const renderQuickPreset = () => fillingGroup ? (
    <section className="so-card p-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--so-brand-soft)] text-[var(--so-brand)]"><Sparkles className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.13em] text-[var(--so-text)]">Racikan Cepat</p>
          <p className="mt-1 text-[8px] font-semibold leading-relaxed text-[var(--so-text-muted)]">Pilih racikan standar lalu ubah detail isian bila perlu.</p>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {([
          {key: 'BAKSO_ONLY' as const, title: 'Bakso Saja', detail: baksoOnlyPreset.join(' + ') || 'Atur preset di Pengaturan', active: sameSelection(selections[fillingGroup.id] || [], baksoOnlyPreset)},
          {key: 'CAMPUR' as const, title: 'Campur', detail: campurPreset.length ? `${campurPreset.length} isian` : 'Atur preset di Pengaturan', active: sameSelection(selections[fillingGroup.id] || [], campurPreset)},
        ]).map((preset) => (
          <button key={preset.key} type="button" onClick={() => applyInstantPreset(preset.key)} className={`min-h-[68px] rounded-[1.05rem] border p-3 text-left transition active:scale-[.985] ${preset.active ? 'border-[var(--so-brand)] bg-[var(--so-brand-soft)] text-[var(--so-text)] shadow-[0_8px_20px_rgba(15,23,42,.04)]' : 'border-[var(--so-border)] bg-[var(--so-surface-soft)] text-[var(--so-text)]'}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black">{preset.title}</span>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${preset.active ? 'bg-[var(--so-brand)] text-white' : 'border border-[var(--so-border)] bg-white text-[var(--so-text-faint)]'}`}>{preset.active ? <Check className="h-3 w-3 stroke-[3]" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
            </span>
            <span className={`mt-2 block line-clamp-2 text-[8px] font-bold leading-relaxed ${preset.active ? 'text-[var(--so-brand-strong)]' : 'text-[var(--so-text-muted)]'}`}>{preset.detail}</span>
          </button>
        ))}
        {customPresets.map((preset) => {
          const active = sameSelection(selections[fillingGroup.id] || [], preset.options);
          return (
            <button key={preset.id} type="button" onClick={() => applyCustomPreset(preset.options)} className={`min-h-[68px] rounded-[1.05rem] border p-3 text-left transition active:scale-[.985] ${active ? 'border-[var(--so-brand)] bg-[var(--so-brand-soft)] text-[var(--so-text)] shadow-[0_8px_20px_rgba(15,23,42,.04)]' : 'border-[var(--so-border)] bg-[var(--so-surface-soft)] text-[var(--so-text)]'}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black">{preset.name}</span>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full ${active ? 'bg-[var(--so-brand)] text-white' : 'border border-[var(--so-border)] bg-white text-[var(--so-text-faint)]'}`}>{active ? <Check className="h-3 w-3 stroke-[3]" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
              </span>
              <span className={`mt-2 block line-clamp-2 text-[8px] font-bold leading-relaxed ${active ? 'text-[var(--so-brand-strong)]' : 'text-[var(--so-text-muted)]'}`}>{preset.options.join(' + ')}</span>
            </button>
          );
        })}
      </div>
    </section>
  ) : null;

  const renderConfigurationContent = () => (
    <>
      {brothGroup && renderGroup(brothGroup)}
      {renderQuickPreset()}
      {fillingGroup && renderGroup(fillingGroup)}
      {standardGroups.map(renderGroup)}
      {applicableGroups.length === 0 && <div className="so-card px-4 py-8 text-center"><Utensils className="mx-auto h-6 w-6 text-[var(--so-text-faint)]" /><p className="mt-2 text-[10px] font-black text-[var(--so-text-soft)]">Menu ini tidak memiliki pilihan tambahan.</p></div>}
      <label className="so-card block p-3"><span className="text-[8px] font-black uppercase tracking-[.13em] text-[var(--so-text-muted)]">Catatan item · opsional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 240))} rows={2} placeholder="Contoh: dibungkus, kuah dipisah, tanpa sawi..." className="so-native-textarea mt-2 w-full resize-none rounded-xl border border-[var(--so-border)] bg-[var(--so-surface-soft)] px-3 py-2.5 text-[10px] font-semibold text-[var(--so-text-soft)] outline-none transition placeholder:text-[var(--so-text-faint)] focus:border-[var(--so-brand-weak)] focus:bg-white" /></label>
    </>
  );

  if (!isSelfOrder) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/20 p-3 backdrop-blur-[2px] animate-fadeIn md:p-5">
        <section className="theme-self-order grid h-[min(92dvh,820px)] min-h-[520px] w-full max-w-[1120px] grid-cols-1 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,.28)] md:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-slate-200 bg-slate-50/80 md:flex md:flex-col">
            <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden bg-white p-5">
              {menuItem.image ? (
                <img src={optimizeCloudinaryImage(menuItem.image, 760)} alt={menuItem.name} decoding="async" className="so-food-photo h-full max-h-[220px] w-full object-contain" />
              ) : (
                <Utensils className="h-12 w-12 text-slate-300" />
              )}
            </div>
            <div className="border-t border-slate-200 p-5">
              <p className="text-[9px] font-black uppercase tracking-[.16em] text-[var(--so-brand)]">Menu dipilih</p>
              <h2 className="mt-2 text-[20px] font-black leading-tight tracking-[-.025em] text-slate-950">{menuItem.name}</h2>
              <p className="mt-2 text-[15px] font-black text-[var(--so-brand)]">Rp {finalUnitPrice.toLocaleString('id-ID')}</p>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 text-[10px] font-semibold leading-relaxed text-slate-500">
                Racikan berlaku untuk <strong className="font-black text-slate-800">1 porsi</strong>. Untuk porsi dengan racikan berbeda, tambahkan sebagai item terpisah.
              </div>
            </div>
          </aside>

          <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-[#f7f8fa]">
            <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3.5 md:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[.17em] text-[var(--so-brand)]">Atur Pesanan</p>
                <div className="mt-1 flex items-center gap-2 md:hidden">
                  <h2 className="truncate text-[16px] font-black text-slate-950">{menuItem.name}</h2>
                  <span className="shrink-0 rounded-full bg-[var(--so-brand-soft)] px-2.5 py-1 text-[9px] font-black text-[var(--so-brand)]">Rp {finalUnitPrice.toLocaleString('id-ID')}</span>
                </div>
                <p className="mt-1 hidden text-[11px] font-semibold text-slate-500 md:block">Pilih kuah, racikan cepat, isian, tambahan, lalu simpan ke keranjang.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Tutup pengaturan pesanan" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"><X className="h-5 w-5" /></button>
            </header>

            <div className="min-h-0 overflow-y-auto overscroll-contain px-3.5 py-3.5 scrollbar-thin md:px-5 md:py-4">
              <div className="mx-auto max-w-[660px] space-y-3">{renderConfigurationContent()}</div>
            </div>

            <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 md:px-5">
              <div className="mx-auto flex max-w-[660px] items-center gap-3">
                <div className="hidden min-w-0 flex-1 sm:block">
                  <p className="text-[8px] font-black uppercase tracking-[.14em] text-slate-400">Total per porsi</p>
                  <p className="mt-0.5 text-[15px] font-black text-slate-950">Rp {finalUnitPrice.toLocaleString('id-ID')}</p>
                </div>
                <button type="button" onClick={handleSave} className="so-primary-button min-h-[48px] flex-1 sm:max-w-[320px]">Tambahkan ke Keranjang</button>
              </div>
            </footer>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="theme-self-order fixed inset-0 z-50 flex items-end justify-center bg-[#0f172a]/45 backdrop-blur-[3px] sm:items-center sm:p-4 animate-fadeIn">
      <section className="flex max-h-[96dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-[2rem] border border-[var(--so-border)] bg-[var(--so-canvas)] shadow-[0_-18px_70px_rgba(15,23,42,.18)] sm:rounded-[2rem] animate-slideUp">
        <header className="shrink-0 border-b border-[var(--so-border)] bg-white">
          <div className="relative h-[152px] overflow-hidden bg-white sm:h-[168px]">
            {menuItem.image ? (
              <img src={optimizeCloudinaryImage(menuItem.image, 900)} alt={menuItem.name} decoding="async" className="so-food-photo h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center"><Utensils className="h-12 w-12 text-[var(--so-text-faint)]" /></div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/25 to-transparent" />
            <button type="button" onClick={onClose} aria-label="Tutup detail menu" className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--so-border)] bg-white/95 text-[var(--so-text)] shadow-sm transition active:scale-95"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-2">
            <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.17em] text-[var(--so-brand)]">Atur Pesanan</p><h2 className="mt-1 line-clamp-2 text-[17px] font-black leading-tight tracking-[-.02em] text-[var(--so-text)]">{menuItem.name}</h2></div>
            <span className="shrink-0 rounded-full bg-[var(--so-brand-soft)] px-3 py-1.5 text-[9px] font-black text-[var(--so-brand)]">Rp {finalUnitPrice.toLocaleString('id-ID')}</span>
          </div>
        </header>
        <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 pb-4 pt-2.5 scrollbar-thin sm:px-4">{renderConfigurationContent()}</div>
        <footer className="shrink-0 border-t border-[var(--so-border)] bg-white p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]"><button type="button" onClick={handleSave} className="so-primary-button">Tambahkan · Rp {finalUnitPrice.toLocaleString('id-ID')}</button></footer>
      </section>
    </div>
  );
};
