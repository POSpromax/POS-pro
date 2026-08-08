import React, { useState } from 'react';
import { Boxes, Layers, AlertTriangle, RefreshCw, Plus, Edit, CheckCircle2, TrendingUp } from 'lucide-react';
import { RawMaterial, MenuItem, Branch } from '../../types/pos';

interface InventoryHppViewProps {
  rawMaterials: RawMaterial[];
  menuItems: MenuItem[];
  branches: Branch[];
  onUpdateRawMaterial: (material: RawMaterial) => void;
  onUpdateMenuItem: (menu: MenuItem) => void;
}

export const InventoryHppView: React.FC<InventoryHppViewProps> = ({
  rawMaterials,
  menuItems,
  branches,
  onUpdateRawMaterial,
  onUpdateMenuItem
}) => {
  const [activeTab, setActiveTab] = useState<'RAW_STOCK' | 'RECIPE_HPP'>('RAW_STOCK');
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);

  // Sync animation simulation
  const [isSyncingBranches, setIsSyncingBranches] = useState<boolean>(false);

  const handleSimulateBranchSync = () => {
    setIsSyncingBranches(true);
    setTimeout(() => {
      setIsSyncingBranches(false);
      alert('Sinkronisasi stok antar cabang (Bogor, Pajajaran, Jakarta) berhasil diperbarui!');
    }, 1500);
  };

  return (
    <div className="flex-1 bg-slate-100/70 p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight flex items-center gap-2">
            <Boxes className="w-7 h-7 text-[#F05A1F]" />
            Manajemen Inventaris Stok & Kalkulator HPP Resep
          </h1>
          <p className="text-xs text-[#9C9590] font-bold mt-1">
            Lacak ketersediaan bahan baku, hitung otomatis HPP per menu porsi, dan sinkronisasi stok antar cabang secara otomatis.
          </p>
        </div>

        {/* Sync Button */}
        <button
          onClick={handleSimulateBranchSync}
          disabled={isSyncingBranches}
          className="px-4 py-2 bg-[#1C1B19] hover:bg-black text-white rounded-2xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncingBranches ? 'animate-spin' : ''}`} />
          <span>Sync Stok Antar Cabang</span>
        </button>
      </div>

      {/* Main Tabs */}
      <div className="flex bg-slate-200/80 p-1 rounded-2xl mb-6 max-w-md">
        <button
          onClick={() => setActiveTab('RAW_STOCK')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'RAW_STOCK'
              ? 'bg-white text-[#D94B15] shadow-xs'
              : 'text-slate-600 hover:text-[#1A1714]'
          }`}
        >
          Stok Bahan Baku ({rawMaterials.length})
        </button>
        <button
          onClick={() => setActiveTab('RECIPE_HPP')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'RECIPE_HPP'
              ? 'bg-white text-[#D94B15] shadow-xs'
              : 'text-slate-600 hover:text-[#1A1714]'
          }`}
        >
          HPP & Resep Menu ({menuItems.length})
        </button>
      </div>

      {/* Tab 1: Raw Material Stock Table */}
      {activeTab === 'RAW_STOCK' && (
        <div className="bg-white rounded-2xl p-6 border border-[#E8E0D8]/80 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-[#1A1714] text-base">Master Bahan Baku & Stok Gudang</h2>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Auto-Deduct Saat Transaksi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-[#6B6560]">
              <thead className="bg-[#FAFAF8] text-[#B8B0A8] font-semibold text-[10px] uppercase border-b border-[#E8E0D8]">
                <tr>
                  <th className="p-3">NAMA BAHAN BAKU</th>
                  <th className="p-3">CABANG</th>
                  <th className="p-3 text-right">STOK SAAT INI</th>
                  <th className="p-3 text-right">BATAS MINIMUM</th>
                  <th className="p-3 text-right">BIAYA / SATUAN</th>
                  <th className="p-3 text-center">STATUS</th>
                  <th className="p-3 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rawMaterials.map((raw) => {
                  const isLow = raw.stockQuantity <= raw.minStockThreshold;

                  return (
                    <tr key={raw.id} className="hover:bg-[#FAFAF8] transition-colors">
                      <td className="p-3 font-semibold text-[#1A1714]">{raw.name}</td>
                      <td className="p-3 text-[#9C9590]">{raw.branchName}</td>
                      <td className="p-3 text-right font-bold text-[#1A1714]">
                        {raw.stockQuantity} <span className="text-[10px] text-[#B8B0A8]">{raw.unit}</span>
                      </td>
                      <td className="p-3 text-right text-[#B8B0A8]">
                        {raw.minStockThreshold} {raw.unit}
                      </td>
                      <td className="p-3 text-right font-mono font-bold">
                        Rp {raw.costPerUnit.toLocaleString('id-ID')} / {raw.unit}
                      </td>
                      <td className="p-3 text-center">
                        {isLow ? (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-1 rounded-full animate-pulse">
                            STOK MENIPIS!
                          </span>
                        ) : (
                          <span className="bg-[#F2F2F2] text-[#444444] border border-[#DEDEDE] text-[10px] font-bold px-2.5 py-1 rounded-full">
                            AMAN
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            const newQty = prompt(`Update stok (${raw.name}):`, raw.stockQuantity.toString());
                            if (newQty && !isNaN(Number(newQty))) {
                              onUpdateRawMaterial({ ...raw, stockQuantity: Number(newQty) });
                            }
                          }}
                          className="px-3 py-1 bg-[#FFF4EE] text-[#C94716] hover:bg-[#FFE9DE] rounded-xl text-[11px] font-bold"
                        >
                          Edit Stok
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Recipe & HPP Calculator */}
      {activeTab === 'RECIPE_HPP' && (
        <div className="bg-white rounded-2xl p-6 border border-[#E8E0D8]/80 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-[#1A1714] text-base">Kalkulasi HPP & Resep Bahan Per Porsi Menu</h2>
            <span className="text-xs font-bold text-[#C94716] bg-[#FFF4EE] px-3 py-1 rounded-full">
              HPP dihitung otomatis dari harga bahan baku
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.map((menu) => {
              const profitMargin = Math.round(((menu.price - menu.hppCost) / menu.price) * 100);

              return (
                <div key={menu.id} className="bg-[#FAFAF8] rounded-2xl p-4 border border-[#E8E0D8]/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <img src={menu.image} alt={menu.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      <div>
                        <h3 className="font-semibold text-xs text-[#1A1714] line-clamp-1">{menu.name}</h3>
                        <p className="text-[10px] font-bold text-[#B8B0A8]">{menu.category}</p>
                      </div>
                    </div>

                    {/* Price & HPP Breakdown */}
                    <div className="bg-white p-3 rounded-xl border border-[#E8E0D8] space-y-1 my-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#9C9590] font-bold">Harga Jual:</span>
                        <span className="font-bold text-[#252525]">Rp {menu.price.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#9C9590] font-bold">Estimasi HPP:</span>
                        <span className="font-bold text-rose-600">Rp {menu.hppCost.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="text-[#9C9590] font-bold">Margin Keuntungan:</span>
                        <span className="font-bold text-[#D94B15]">{profitMargin}%</span>
                      </div>
                    </div>

                    {/* Recipe Ingredients */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-[#B8B0A8] uppercase">Resep Bahan Per Porsi:</p>
                      {menu.ingredients && menu.ingredients.length > 0 ? (
                        menu.ingredients.map((ing, i) => (
                          <div key={i} className="text-[11px] font-semibold text-[#6B6560] flex justify-between bg-white px-2 py-1 rounded">
                            <span>{ing.rawMaterialName}</span>
                            <span className="font-bold">{ing.amountNeeded} {ing.unit}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-[#B8B0A8] italic">Resep standar langsung</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
