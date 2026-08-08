import React, { useState, useEffect } from 'react';
import { X, Utensils, Check } from 'lucide-react';
import { MenuItem, CondimentGroup, SelectedCondimentGroup } from '../../types/pos';

interface CondimentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  condimentGroups: CondimentGroup[];
  onConfirm: (menuItem: MenuItem, selectedCondiments: SelectedCondimentGroup[], notes: string, extraPrice: number) => void;
}

export const CondimentSelectionModal: React.FC<CondimentSelectionModalProps> = ({
  isOpen,
  onClose,
  menuItem,
  condimentGroups,
  onConfirm
}) => {
  if (!isOpen || !menuItem) return null;

  // Filter active condiment groups for this menuItem category or 'ALL'
  const applicableGroups = condimentGroups.filter(
    (g) => g.isActive && (g.targetCategories.includes('ALL') || g.targetCategories.includes(menuItem.category))
  );

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
        alert(`Silakan pilih opsi untuk ${group.name} (*WAJIB)`);
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-[#F0E8E0] flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150">
        {/* Vibrant Orange Brand Header matching Image 9 */}
        <div className="bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 p-5 text-white relative shrink-0 shadow-sm">
          <button
            onClick={onClose}
            className="w-8 h-8 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center transition-all mb-3"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start justify-between">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="bg-white/20 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider">
                  {menuItem.category}
                </span>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Stok: {menuItem.stockCount ?? 999}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight leading-snug">{menuItem.name}</h2>
              <p className="text-base font-bold text-amber-100">
                Rp {finalUnitPrice.toLocaleString('id-ID')}
                {extraPriceTotal > 0 && (
                  <span className="text-xs font-semibold ml-1 text-white/90">
                    (Termasuk tambahan +Rp {extraPriceTotal.toLocaleString('id-ID')})
                  </span>
                )}
              </p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shrink-0">
              <Utensils className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Condiments / Options Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-[#FAFAF8]/60">
          {applicableGroups.length === 0 ? (
            <div className="py-8 text-center text-[#B8B0A8] font-bold text-xs">
              Tidak ada opsi tambahan untuk menu ini.
            </div>
          ) : (
            applicableGroups.map((group) => {
              const selectedList = selections[group.id] || [];
              return (
                <div key={group.id} className="bg-white p-4 rounded-2xl border border-[#E8E0D8]/80 shadow-xs space-y-3">
                  {/* Group Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      <h3 className="font-semibold text-xs text-[#1A1714] uppercase tracking-wider">
                        {group.name}
                      </h3>
                      {group.required && (
                        <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md">
                          *WAJIB
                        </span>
                      )}
                    </div>

                    {/* All / Reset buttons for multi-select groups matching settings */}
                    {(group.maxSelect > 1 || group.options.length > 1) && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectAllGroup(group)}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold rounded-lg transition-all border border-amber-300/60 flex items-center gap-1"
                          title="Pilih Semua Isian/Topping"
                        >
                          ✓ Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetGroup(group)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-[#6B6560] text-[10px] font-bold rounded-lg transition-all border border-[#E8E0D8] flex items-center gap-1"
                          title="Kosongkan Pilihan"
                        >
                          ✕ Unselect All
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options List / Grid matching Image 9 */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {group.options.map((option) => {
                      const isSelected = selectedList.includes(option.name);
                      const isAvailable = option.isAvailable;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => isAvailable && toggleOption(group, option.name)}
                          className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between gap-2 select-none ${
                            !isAvailable
                              ? 'bg-slate-100 border-[#E8E0D8] text-[#B8B0A8] opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-orange-500 text-[#1A1714] font-semibold shadow-2xs ring-1 ring-orange-500/30'
                              : 'bg-white border-[#E8E0D8] hover:border-slate-300 text-[#6B6560] hover:bg-[#FAFAF8]'
                          }`}
                        >
                          <span className="truncate">
                            <span className="block font-bold text-[#1A1714]">{option.name}</span>
                            {option.price > 0 ? (
                              <span className="block text-[10px] font-bold text-[#D94B15] mt-0.5">
                                +Rp {option.price.toLocaleString('id-ID')}
                              </span>
                            ) : (
                              <span className="block text-[9px] font-semibold text-[#B8B0A8] mt-0.5">
                                Gratis / Standard
                              </span>
                            )}
                          </span>

                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                              isSelected
                                ? 'border-orange-500 bg-orange-500 text-white shadow-2xs'
                                : 'border-slate-300 bg-slate-100 text-[#B8B0A8]'
                            }`}
                          >
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Notes Input */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D8]/80">
            <label className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider block mb-1">
              CATATAN KHUSUS (OPSIONAL)
            </label>
            <input
              type="text"
              placeholder="Contoh: Sangat pedas, kuah dipisah, dsb."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Footer Action matching Image 9 */}
        <div className="p-4 bg-white border-t border-[#F0E8E0] shrink-0">
          <button
            onClick={handleSave}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all"
          >
            <span>Simpan Pesanan</span>
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
