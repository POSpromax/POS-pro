import React, { useState, useEffect } from 'react';
import { X, Utensils, Check } from 'lucide-react';
import { MenuItem, CondimentGroup, SelectedCondimentGroup } from '../../types/pos';
import { isGroupApplicable } from '../../utils/condimentUtils';

interface CondimentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  condimentGroups: CondimentGroup[];
  onConfirm: (menuItem: MenuItem, selectedCondiments: SelectedCondimentGroup[], notes: string, extraPrice: number) => void;
  onShowToast?: (title: string, message: string) => void;
}

export const CondimentSelectionModal: React.FC<CondimentSelectionModalProps> = ({
  isOpen,
  onClose,
  menuItem,
  condimentGroups,
  onConfirm,
  onShowToast
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
      if (group.required && availableOptions.length > 0) {
        initialSel[group.id] = [availableOptions[0].name];
      } else {
        initialSel[group.id] = [];
      }
    });
    setSelections(initialSel);
    setNotes('');
  }, [menuItem]);

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
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] font-sans text-slate-900">
        
        {/* Top Banner Image with Dark Gradient Overlay matching Screenshots 3 & 4 */}
        <div className="relative h-48 sm:h-52 w-full bg-slate-900 overflow-hidden shrink-0">
          {menuItem.image ? (
            <img src={menuItem.image} alt={menuItem.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-orange-600 via-amber-600 to-amber-500 flex items-center justify-center text-white">
              <Utensils className="w-16 h-16 opacity-40" />
            </div>
          )}

          {/* Dark Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Close Button Top Left */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg font-bold hover:bg-slate-100 transition-all cursor-pointer z-10"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Item Name & Price Pill Badge on Banner Bottom */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-black text-white leading-tight drop-shadow-md min-w-0 flex-1">
              {menuItem.name}
            </h2>
            <div className="bg-[#FF6B35] text-white font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-lg shrink-0 font-mono">
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
                <div key={group.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  {/* Group Header matching Screenshots 3 & 4 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isRequired ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                      <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">
                        {group.name}
                      </h3>
                      {isRequired && (
                        <span className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                          *WAJIB
                        </span>
                      )}
                    </div>

                    {/* All / Reset buttons for multi-select groups matching Screenshots 3 & 4 */}
                    {(group.maxSelect > 1 || group.options.length > 1) && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectAllGroup(group)}
                          className="text-[10px] font-extrabold text-slate-500 hover:text-slate-900 bg-slate-100 px-2.5 py-1 rounded-full cursor-pointer transition-all"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetGroup(group)}
                          className="text-[10px] font-extrabold text-slate-500 hover:text-slate-900 bg-slate-100 px-2.5 py-1 rounded-full cursor-pointer transition-all"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options List Grid matching Screenshots 3 & 4 */}
                  <div className={group.maxSelect === 1 ? "space-y-2" : "grid grid-cols-2 gap-2"}>
                    {group.options.map((option) => {
                      const isSelected = selectedList.includes(option.name);
                      const isAvailable = option.isAvailable;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => isAvailable && toggleOption(group, option.name)}
                          className={`p-3 rounded-2xl text-left border text-xs font-black transition-all flex items-center justify-between gap-2 select-none cursor-pointer ${
                            !isAvailable
                              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-amber-50/70 border-amber-300 text-amber-950 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                          }`}
                        >
                          <span className="truncate">
                            <span className="block font-black text-slate-900 uppercase">{option.name}</span>
                            {option.price > 0 && (
                              <span className="block text-[10px] font-black text-orange-600 mt-0.5 font-mono">
                                +Rp {option.price.toLocaleString('id-ID')}
                              </span>
                            )}
                          </span>

                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSelected
                                ? 'border-orange-600 bg-orange-600 text-white'
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
            className="w-full py-4 bg-[#FF6B35] hover:bg-orange-600 active:scale-95 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>+ Tambahkan Pesanan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
