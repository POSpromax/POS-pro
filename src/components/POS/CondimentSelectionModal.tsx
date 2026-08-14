import React, { useState, useEffect } from 'react';
import { X, Utensils, Check } from 'lucide-react';
import { MenuItem, CondimentGroup, SelectedCondimentGroup } from '../../types/pos';
import { isGroupApplicable } from '../../utils/condimentUtils';
import { optimizeCloudinaryImage } from '../../utils/imageUrl';

const EMPTY_SELECTED_CONDIMENTS: SelectedCondimentGroup[] = [];

interface CondimentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  condimentGroups: CondimentGroup[];
  onConfirm: (menuItem: MenuItem, selectedCondiments: SelectedCondimentGroup[], notes: string, extraPrice: number) => void;
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
  // Filter active condiment groups for this menuItem
  const applicableGroups = menuItem
    ? condimentGroups.filter((g) => g.isActive !== false && isGroupApplicable(g, menuItem))
    : [];

  // State for selections: { [groupId]: string[] (selected option names) }
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<string>('');

  // Pre-select defaults (e.g., required groups select first available option)
  useEffect(() => {
    const initialSel: Record<string, string[]> = {};
    applicableGroups.forEach((group) => {
      const availableOptions = group.options.filter((o) => o.isAvailable);
      const existing = initialSelectedCondiments.find((selection) => selection.groupName === group.name);
      if (existing) {
        initialSel[group.id] = existing.options;
      } else if (group.required && availableOptions.length > 0) {
        initialSel[group.id] = [availableOptions[0].name];
      } else {
        initialSel[group.id] = [];
      }
    });
    setSelections(initialSel);
    setNotes(initialNotes);
  }, [menuItem, initialNotes, initialSelectedCondiments]);

  // Semua hook harus tetap dipanggil pada setiap render. Conditional return
  // ditempatkan setelah hook agar membuka/menutup modal tidak mengubah urutan
  // hook React dan memicu "Expected static flag was missing".
  if (!isOpen || !menuItem) return null;

  const toggleOption = (group: CondimentGroup, optionName: string) => {
    setSelections((prev) => {
      const current = prev[group.id] || [];
      if (group.maxSelect === 1) {
        // Radio behavior (single choice)
        return { ...prev, [group.id]: [optionName] };
      }
      // Checkbox / multi-select behavior
      if (current.includes(optionName)) {
        return { ...prev, [group.id]: current.filter((n) => n !== optionName) };
      } else {
        if (group.maxSelect && current.length >= group.maxSelect) {
          return prev; // Reached max
        }
        return { ...prev, [group.id]: [...current, optionName] };
      }
    });
  };

  const handleSelectAllGroup = (group: CondimentGroup) => {
    const availableOptionNames = group.options.filter((o) => o.isAvailable).map((o) => o.name);
    setSelections((prev) => ({
      ...prev,
      [group.id]: availableOptionNames
    }));
  };

  const handleResetGroup = (group: CondimentGroup) => {
    setSelections((prev) => ({
      ...prev,
      [group.id]: group.required && group.options.length > 0 ? [group.options[0].name] : []
    }));
  };

  // Calculate extra cost from selected options
  let extraPriceTotal = 0;
  applicableGroups.forEach((group) => {
    const selectedNames = selections[group.id] || [];
    group.options.forEach((opt) => {
      if (selectedNames.includes(opt.name) && opt.price > 0) {
        extraPriceTotal += opt.price;
      }
    });
  });

  const finalUnitPrice = menuItem.price + extraPriceTotal;
  const isSelfOrder = visualMode === 'SELF_ORDER';

  const handleSave = () => {
    // Validate required groups
    for (const group of applicableGroups) {
      if (group.required && (!selections[group.id] || selections[group.id].length === 0)) {
        if (onShowToast) onShowToast('Pilihan Wajib', `Silakan pilih opsi untuk ${group.name}`);
        return;
      }
    }

    // Format selectedCondiments
    const formatted: SelectedCondimentGroup[] = applicableGroups
      .map((g) => ({
        groupName: g.name,
        options: selections[g.id] || []
      }))
      .filter((g) => g.options.length > 0);

    onConfirm(menuItem, formatted, notes, extraPriceTotal);
    onClose();
  };

  return (
    <div className={`fixed inset-0 flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4 z-50 animate-fadeIn ${isSelfOrder ? 'bg-slate-950/60' : 'bg-slate-600/30'}`}>
      <div className={`bg-[var(--surface-card)] w-full max-w-md overflow-hidden shadow-xl border border-[var(--panel-border)] flex flex-col max-h-[92dvh] font-sans text-[var(--text-primary)] ${isSelfOrder ? 'rounded-t-[2rem] sm:rounded-[2rem]' : 'rounded-2xl'}`}>
        
        {/* Top Banner Image with Dark Gradient Overlay matching Screenshots 3 & 4 */}
        <div className="relative h-48 sm:h-52 w-full bg-[var(--surface-secondary)] overflow-hidden shrink-0">
          {menuItem.image ? (
            <img src={optimizeCloudinaryImage(menuItem.image, 900)} alt={menuItem.name} decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-[var(--primary-solid)] via-[var(--primary)] to-[var(--primary-light)] flex items-center justify-center text-white">
              <Utensils className="w-16 h-16 opacity-40" />
            </div>
          )}

          {/* Dark Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Close Button Top Left */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 bg-[var(--surface-card)] text-[var(--text-primary)] rounded-full flex items-center justify-center shadow-md font-bold hover:bg-[var(--surface-secondary)] transition-all cursor-pointer z-10"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Item Name & Price Pill Badge on Banner Bottom */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-extrabold text-white leading-tight drop-shadow-md min-w-0 flex-1">
              {menuItem.name}
            </h2>
            <div className={`${isSelfOrder ? 'bg-orange-500' : 'bg-[var(--primary)]'} text-white font-bold text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-md shrink-0 font-mono`}>
              Rp {finalUnitPrice.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        {/* Condiments / Options Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-[var(--surface-secondary)]">
          {applicableGroups.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-tertiary)] font-bold text-xs">
              Tidak ada opsi tambahan untuk menu ini.
            </div>
          ) : (
            applicableGroups.map((group) => {
              const selectedList = selections[group.id] || [];
              const isRequired = group.required;

              return (
                <div key={group.id} className="bg-[var(--surface-card)] p-4 rounded-2xl border border-[var(--panel-border)] shadow-sm space-y-3">
                  {/* Group Header matching Screenshots 3 & 4 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isSelfOrder ? (isRequired ? 'bg-orange-500' : 'bg-amber-400') : (isRequired ? 'bg-[var(--primary-solid)]' : 'bg-[var(--accent-green)]')}`} />
                      <h3 className="font-extrabold text-xs text-[var(--text-primary)] uppercase tracking-wider">
                        {group.name}
                      </h3>
                      {isRequired && (
                        <span className="text-[11px] font-bold text-[var(--accent-red)] bg-[var(--danger-soft)] border border-rose-200 px-2 py-0.5 rounded-lg">
                          *WAJIB
                        </span>
                      )}
                    </div>

                    {group.maxSelect > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectAllGroup(group)}
                          className="text-[11px] font-extrabold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-secondary)] hover:bg-[var(--panel-border-light)] px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetGroup(group)}
                          className="text-[11px] font-extrabold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-secondary)] hover:bg-[var(--panel-border-light)] px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                        >
                          Bersihkan
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Opsi memakai CHECKBOX (multi-pilih; grup maxSelect=1 tetap
                      berperilaku pilih-satu lewat toggleOption). */}
                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map((option) => {
                      const isSelected = selectedList.includes(option.name);
                      const isAvailable = option.isAvailable !== false;

                      return (
                        <label
                          key={option.id}
                          className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all flex items-center gap-2.5 select-none ${
                            !isAvailable
                              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? (isSelfOrder ? 'bg-orange-50 border-orange-500 text-orange-800 shadow-sm ring-1 ring-orange-200 cursor-pointer' : 'bg-[#ECFDF5] border-[#059669] text-[#047857] shadow-sm ring-1 ring-[#047857]/30 cursor-pointer')
                              : (isSelfOrder ? 'bg-white border-slate-200 hover:border-orange-400 text-slate-800 cursor-pointer' : 'bg-white border-slate-200 hover:border-[#059669] text-slate-800 cursor-pointer')
                          }`}
                        >
                          {/* Kotak checkbox */}
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isSelected}
                            disabled={!isAvailable}
                            onChange={() => isAvailable && toggleOption(group, option.name)}
                          />
                          <span
                            aria-hidden="true"
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                              isSelected ? (isSelfOrder ? 'bg-orange-500 border-orange-500 text-white' : 'bg-[#047857] border-[#047857] text-white') : 'bg-white border-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </span>

                          <span className="truncate min-w-0 flex-1">
                            <span className="block font-black text-[#111827] uppercase tracking-wide text-xs">{option.name}</span>
                            {option.price > 0 && (
                              <span className={`block text-[11px] font-extrabold mt-0.5 font-mono ${isSelfOrder ? 'text-orange-600' : 'text-[#047857]'}`}>
                                +Rp {option.price.toLocaleString('id-ID')}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Catatan (opsional)... Input Box matching Screenshots 3 & 4 */}
          <div className="bg-[var(--surface-card)] p-3.5 rounded-2xl border border-[var(--panel-border)]">
            <input
              type="text"
              placeholder="Catatan (opsional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="ui-input w-full px-3.5 py-3 text-xs font-bold"
            />
          </div>
        </div>

        {/* Footer Action Button + Tambahkan Pesanan matching Screenshots 3 & 4 */}
        <div className="p-4 bg-[var(--surface-card)] border-t border-[var(--panel-border)] shrink-0">
          <button
            type="button"
            onClick={handleSave}
            className={`w-full rounded-2xl py-4 text-sm font-extrabold flex items-center justify-center gap-2 text-white transition ${isSelfOrder ? 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200' : 'ui-button ui-button-primary'}`}
          >
            <span>+ Tambahkan Pesanan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
