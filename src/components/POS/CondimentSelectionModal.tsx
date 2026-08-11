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
}) => {
  if (!isOpen || !menuItem) return null;

  // Filter active condiment groups for this menuItem
  const applicableGroups = condimentGroups.filter((g) => isGroupApplicable(g, menuItem));

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
    <div className="fixed inset-0 bg-slate-600/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-xl border border-slate-100 flex flex-col max-h-[92vh] font-sans text-slate-900">
        
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
            className="absolute top-4 left-4 w-9 h-9 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-md font-bold hover:bg-slate-100 transition-all cursor-pointer z-10"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Item Name & Price Pill Badge on Banner Bottom */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight drop-shadow-md min-w-0 flex-1">
              {menuItem.name}
            </h2>
            <div className="bg-[var(--primary)] text-white font-bold text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-md shrink-0 font-mono">
              Rp {finalUnitPrice.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        {/* Condiments / Options Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50">
          {applicableGroups.length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-bold text-xs">
              Tidak ada opsi tambahan untuk menu ini.
            </div>
          ) : (
            applicableGroups.map((group, groupIdx) => {
              const selectedList = selections[group.id] || [];
              const isRequired = group.required;

              return (
                <div key={group.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                  {/* Group Header matching Screenshots 3 & 4 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isRequired ? 'bg-[var(--primary-solid)]' : 'bg-emerald-500'}`} />
                      <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                        {group.name}
                      </h3>
                      {isRequired && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                          *WAJIB
                        </span>
                      )}
                    </div>

                    {group.maxSelect > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectAllGroup(group)}
                          className="text-[11px] font-extrabold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetGroup(group)}
                          className="text-[11px] font-extrabold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                        >
                          Bersihkan
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options laid out side-by-side so tall groups stay compact */}
                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map((option) => {
                      const isSelected = selectedList.includes(option.name);
                      const isAvailable = option.isAvailable;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => isAvailable && toggleOption(group, option.name)}
                          className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all flex items-center justify-between gap-2 select-none cursor-pointer ${
                            !isAvailable
                              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-amber-50/70 border-amber-300 text-amber-950 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                          }`}
                        >
                          <span className="truncate">
                            <span className="block font-bold text-slate-900 uppercase">{option.name}</span>
                            {option.price > 0 && (
                              <span className="block text-[11px] font-bold text-[var(--primary-text)] mt-0.5 font-mono">
                                +Rp {option.price.toLocaleString('id-ID')}
                              </span>
                            )}
                          </span>

                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSelected
                                ? 'border-[var(--primary)] bg-[var(--primary-solid)] text-white'
                                : 'border-slate-300 bg-slate-100'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Catatan (opsional)... Input Box matching Screenshots 3 & 4 */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80">
            <input
              type="text"
              placeholder="Catatan (opsional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-3 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 focus:bg-white placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Footer Action Button + Tambahkan Pesanan matching Screenshots 3 & 4 */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-4 bg-[var(--primary)] hover:bg-[var(--primary-pressed)] active:scale-95 text-white font-bold text-sm rounded-2xl shadow-md shadow-orange-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>+ Tambahkan Pesanan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
