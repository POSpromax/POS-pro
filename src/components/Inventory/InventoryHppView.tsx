import React, { useState } from 'react';
import {
  Boxes,
  Layers,
  AlertTriangle,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  RotateCcw,
  Utensils,
  Package,
  Search,
  Download,
  Minus,
  ChevronDown,
  ChevronUp,
  FileText,
  Camera,
  Upload,
  Check
} from 'lucide-react';
import { RawMaterial, MenuItem, Branch, CategoryType, RecipeIngredient } from '../../types/pos';
import { uploadImage } from '../../services/cloudinaryMedia';

interface InventoryHppViewProps {
  rawMaterials: RawMaterial[];
  menuItems: MenuItem[];
  branches: Branch[];
  currentBranch?: Branch;
  onUpdateRawMaterial: (material: RawMaterial) => void;
  onDeleteRawMaterial: (id: string) => void;
  onSaveMenuItem: (menu: MenuItem) => void;
  onDeleteMenuItem: (id: string) => void;
  onResetCatalogDefaults: () => void;
  onShowToast?: (title: string, message: string) => void;
}

export const InventoryHppView: React.FC<InventoryHppViewProps> = ({
  rawMaterials,
  menuItems,
  branches,
  currentBranch,
  onUpdateRawMaterial,
  onDeleteRawMaterial,
  onSaveMenuItem,
  onDeleteMenuItem,
  onResetCatalogDefaults,
  onShowToast
}) => {
  const toast = (title: string, message: string) => {
    if (onShowToast) onShowToast(title, message);
  };
  const handleExportCSV = () => {
    let csv = 'data:text/csv;charset=utf-8,';
    if (subTab === 'MENU' || subTab === 'LAPORAN') {
      csv += 'Nama Menu,Kategori,Harga,HPP,Margin,Stok,Status\n';
      menuItems.forEach((m) => {
        const margin = m.price - (m.hppCost || 0);
        csv += `"${m.name}",${m.category},${m.price},${m.hppCost || 0},${margin},${m.stockCount || 0},${m.isAvailable ? 'Aktif' : 'Nonaktif'}\n`;
      });
    } else {
      csv += 'Nama Bahan,Unit,Stok,Min Stok,Harga/Unit,Cabang\n';
      rawMaterials.forEach((r) => {
        csv += `"${r.name}",${r.unit},${r.stockQuantity},${r.minStockThreshold},${r.costPerUnit},"${r.branchName || ''}"\n`;
      });
    }
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `Inventori_${subTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Export CSV', 'File CSV berhasil diunduh.');
  };

  const handlePrintReport = () => {
    window.print();
    toast('Cetak', 'Jendela cetak dibuka.');
  };

  const [subTab, setSubTab] = useState<'BAHAN' | 'DAPUR' | 'MENU' | 'LAPORAN'>('BAHAN');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [categoriesList, setCategoriesList] = useState<CategoryType[]>([
    'BAKSO', 'MIE AYAM', 'MAKANAN', 'TAMBAHAN', 'KRIUK', 'MINUMAN', 'BUNDLING'
  ]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    BAKSO: true,
    'MIE AYAM': true,
    MAKANAN: true
  });

  // Modal states
  const [isEditMenuModalOpen, setIsEditMenuModalOpen] = useState<boolean>(false);
  const [editingMenu, setEditingMenu] = useState<Partial<MenuItem> | null>(null);

  const [isRawModalOpen, setIsRawModalOpen] = useState<boolean>(false);
  const [editingRaw, setEditingRaw] = useState<Partial<RawMaterial> | null>(null);

  // Recipe Builder inside Edit Menu Modal
  const [selectedRecipeMaterialId, setSelectedRecipeMaterialId] = useState<string>('');
  const [selectedRecipeQty, setSelectedRecipeQty] = useState<number>(1);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const handleUploadMenuPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPhoto(true);
      const targetBranchId = currentBranch?.id || '00000000-0000-4000-a000-000000000010';
      const uploaded = await uploadImage(file, 'menus', targetBranchId);
      setEditingMenu((prev) => prev ? { ...prev, image: uploaded.secureUrl } : null);
    } catch (err) {
      console.warn('Cloudinary signature/auth fallback:', err);
      const blobUrl = URL.createObjectURL(file);
      setEditingMenu((prev) => prev ? { ...prev, image: blobUrl } : null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Separate materials into BAHAN (prepared porsi items) and DAPUR (raw kitchen ingredients)
  const bahanItems = rawMaterials.filter((m) =>
    m.id.startsWith('raw-b') || m.unit === 'pcs' || m.unit === 'porsi' || m.name.toLowerCase().includes('bakso') || m.name.toLowerCase().includes('mie')
  );

  const dapurItems = rawMaterials.filter((m) =>
    !bahanItems.some((b) => b.id === m.id)
  );

  const activeRawList = subTab === 'BAHAN' ? (bahanItems.length ? bahanItems : rawMaterials) : dapurItems;
  const filteredRawList = activeRawList.filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMenuItems = menuItems.filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Quantities & Restock calculation
  const totalAssetsCount = rawMaterials.length;
  const restockNeedCount = rawMaterials.filter((m) => m.stockQuantity <= m.minStockThreshold).length;

  const handleAdjustStock = (material: RawMaterial, delta: number) => {
    const updatedQty = Math.max(0, material.stockQuantity + delta);
    onUpdateRawMaterial({ ...material, stockQuantity: updatedQty });
  };

  const handleOpenEditMenuModal = (menu?: MenuItem) => {
    if (menu) {
      setEditingMenu({
        ...menu,
        isAutoStock: menu.isAutoStock !== false,
        ingredients: menu.ingredients ? [...menu.ingredients] : []
      });
    } else {
      setEditingMenu({
        id: 'menu-' + Date.now().toString().slice(-4),
        name: '',
        category: 'BAKSO',
        price: 25000,
        hppCost: 10000,
        image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=80',
        description: '',
        isAvailable: true,
        stockCount: 100,
        isAutoStock: true,
        ingredients: []
      });
    }
    setIsEditMenuModalOpen(true);
  };

  const handleSaveMenuForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenu?.name?.trim()) {
      toast('Validasi', 'Nama produk menu wajib diisi!');
      return;
    }
    const finalMenu: MenuItem = {
      id: editingMenu.id || 'menu-' + Date.now().toString().slice(-4),
      name: editingMenu.name.trim(),
      category: editingMenu.category || 'BAKSO',
      price: Number(editingMenu.price) || 0,
      hppCost: Number(editingMenu.hppCost) || 0,
      image: editingMenu.image || 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=80',
      description: editingMenu.description || '',
      isAvailable: editingMenu.isAvailable !== false,
      stockCount: Number(editingMenu.stockCount) || 100,
      isAutoStock: editingMenu.isAutoStock !== false,
      ingredients: editingMenu.ingredients || []
    };
    onSaveMenuItem(finalMenu);
    setIsEditMenuModalOpen(false);
    setEditingMenu(null);
  };

  const handleAddIngredientToRecipe = () => {
    if (!selectedRecipeMaterialId) {
      toast('Validasi', 'Pilih bahan baku terlebih dahulu!');
      return;
    }
    const mat = rawMaterials.find((r) => r.id === selectedRecipeMaterialId);
    if (!mat) return;

    const existingIdx = (editingMenu?.ingredients || []).findIndex((i) => i.rawMaterialId === mat.id);
    let updatedIngredients = [...(editingMenu?.ingredients || [])];

    if (existingIdx >= 0) {
      updatedIngredients[existingIdx] = {
        ...updatedIngredients[existingIdx],
        amountNeeded: updatedIngredients[existingIdx].amountNeeded + selectedRecipeQty
      };
    } else {
      updatedIngredients.push({
        rawMaterialId: mat.id,
        rawMaterialName: mat.name,
        amountNeeded: selectedRecipeQty,
        unit: mat.unit
      });
    }

    setEditingMenu({ ...editingMenu, ingredients: updatedIngredients });
  };

  const handleRemoveIngredientFromRecipe = (rawMaterialId: string) => {
    const updated = (editingMenu?.ingredients || []).filter((i) => i.rawMaterialId !== rawMaterialId);
    setEditingMenu({ ...editingMenu, ingredients: updated });
  };

  const handleOpenRawModal = (raw?: RawMaterial) => {
    if (raw) {
      setEditingRaw({ ...raw });
    } else {
      setEditingRaw({
        id: 'raw-' + Date.now().toString().slice(-4),
        name: '',
        unit: 'pcs',
        stockQuantity: 10,
        minStockThreshold: 5,
        costPerUnit: 10000,
        branchId: currentBranch?.id || branches[0]?.id || '00000000-0000-4000-a000-000000000010',
        branchName: currentBranch?.name || branches[0]?.name || 'Pasirmulya Bogor'
      });
    }
    setIsRawModalOpen(true);
  };

  const handleSaveRawForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRaw?.name?.trim()) {
      toast('Validasi', 'Nama bahan baku wajib diisi!');
      return;
    }
    const targetBranch = branches.find((b) => b.id === editingRaw.branchId) || currentBranch;
    const finalMaterial: RawMaterial = {
      id: editingRaw.id || 'raw-' + Date.now().toString().slice(-4),
      name: editingRaw.name.trim(),
      unit: (editingRaw.unit as any) || 'pcs',
      stockQuantity: Number(editingRaw.stockQuantity) || 0,
      minStockThreshold: Number(editingRaw.minStockThreshold) || 0,
      costPerUnit: Number(editingRaw.costPerUnit) || 0,
      branchId: editingRaw.branchId || targetBranch?.id || '00000000-0000-4000-a000-000000000010',
      branchName: targetBranch?.name || 'Pasirmulya Bogor'
    };
    onUpdateRawMaterial(finalMaterial);
    setIsRawModalOpen(false);
    setEditingRaw(null);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const cat = newCategoryName.trim().toUpperCase() as CategoryType;
    if (!categoriesList.includes(cat)) {
      setCategoriesList([...categoriesList, cat]);
      setExpandedCategories({ ...expandedCategories, [cat]: true });
    }
    setNewCategoryName('');
  };

  return (
    <div className="flex-1 bg-[#F8FAFC] p-3 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between text-slate-900">
      {/* Top Header Bar — stacks vertically on mobile */}
      <div className="flex flex-col gap-3 mb-4 md:mb-5">
        {/* Title row */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0">
            <Boxes className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Inventory</h1>
        </div>

        {/* Sub-tab Navigation — scrollable on mobile */}
        <div className="overflow-x-auto scrollbar-none -mx-3 px-3 md:mx-0 md:px-0">
          <div className="bg-slate-100 border border-slate-200/80 p-1 rounded-full flex items-center gap-0.5 md:gap-1 shadow-2xs w-max">
            {([
              { key: 'BAHAN' as const, icon: Package, label: 'BAHAN' },
              { key: 'DAPUR' as const, icon: Utensils, label: 'DAPUR' },
              { key: 'MENU' as const, icon: Utensils, label: 'MENU' },
              { key: 'LAPORAN' as const, icon: FileText, label: 'LAPORAN' },
            ]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setSubTab(key)}
                className={`px-3 md:px-4 py-1.5 rounded-full text-[10px] md:text-xs font-black transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  subTab === key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-bold'
                }`}
              >
                <Icon className="w-3 h-3 md:w-3.5 md:h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + Actions row — stacks on mobile */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-full pl-9 pr-4 py-2 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 md:px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-full text-[10px] md:text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">EXPORT</span>
            </button>

            {subTab === 'MENU' ? (
              <button
                onClick={() => handleOpenEditMenuModal()}
                className="px-3 md:px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-[10px] md:text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all flex-1 sm:flex-initial justify-center"
              >
                <Plus className="w-3.5 h-3.5" /> TAMBAH MENU
              </button>
            ) : (
              <button
                onClick={() => handleOpenRawModal()}
                className="px-3 md:px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-[10px] md:text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all flex-1 sm:flex-initial justify-center"
              >
                <Plus className="w-3.5 h-3.5" /> TAMBAH BAHAN
              </button>
            )}

            <button
              onClick={onResetCatalogDefaults}
              className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer transition-colors shrink-0"
              title="Reset & Muat Data Standar Resto"
            >
              <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4 mb-4 md:mb-6">
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-slate-200 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-400">MENU</p>
            <p className="text-xl md:text-3xl font-black text-slate-900 mt-0.5 md:mt-1">{menuItems.length}</p>
          </div>
          <div className="w-9 h-9 md:w-12 md:h-12 bg-slate-900 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-xs">
            <Utensils className="w-4 h-4 md:w-6 md:h-6 text-white" />
          </div>
        </div>

        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-slate-200 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-400">ASET</p>
            <p className="text-xl md:text-3xl font-black text-slate-900 mt-0.5 md:mt-1">{totalAssetsCount}</p>
          </div>
          <div className="w-9 h-9 md:w-12 md:h-12 bg-slate-100 border border-slate-200 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-700">
            <Boxes className="w-4 h-4 md:w-6 md:h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-slate-200 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-400">RESTOCK</p>
            <p className="text-xl md:text-3xl font-black text-orange-600 mt-0.5 md:mt-1">{restockNeedCount}</p>
          </div>
          <div className="w-9 h-9 md:w-12 md:h-12 bg-orange-600 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-xs shadow-orange-500/20">
            <AlertTriangle className="w-4 h-4 md:w-6 md:h-6 text-white" />
          </div>
        </div>

        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-slate-200 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-400">KATEGORI</p>
            <p className="text-xl md:text-3xl font-black text-slate-900 mt-0.5 md:mt-1">{categoriesList.length}</p>
          </div>
          <div className="w-9 h-9 md:w-12 md:h-12 bg-slate-100 border border-slate-200 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-700">
            <Layers className="w-4 h-4 md:w-6 md:h-6" />
          </div>
        </div>
      </div>

      {/* BAHAN & DAPUR Grid — 2 cols mobile, scales up on larger screens */}
      {(subTab === 'BAHAN' || subTab === 'DAPUR') && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 md:gap-3.5">
          {filteredRawList.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl p-8 md:p-10 text-center text-slate-400 font-bold border border-slate-200">
              Tidak ada item ditemukan. Klik "TAMBAH BAHAN" atau "Reset Data Standar".
            </div>
          ) : (
            filteredRawList.map((raw) => {
              const isLow = raw.stockQuantity <= raw.minStockThreshold;

              return (
                <div
                  key={raw.id}
                  className="bg-white rounded-xl md:rounded-2xl p-2.5 md:p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between relative hover:shadow-md transition-shadow"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-[11px] md:text-xs text-[#1A1714] truncate">{raw.name}</h3>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">
                        {raw.unit} <span className="text-slate-300">Min: {raw.minStockThreshold}</span>
                      </p>
                    </div>

                    {isLow && (
                      <span className="bg-rose-500 text-white text-[8px] md:text-[9px] font-black px-1 md:px-1.5 py-0.5 rounded-md shadow-xs animate-pulse flex items-center gap-0.5">
                        LOW
                      </span>
                    )}
                  </div>

                  {/* Stock quantity */}
                  <div className="my-1.5 md:my-2 text-right">
                    <span className="text-lg md:text-xl font-black text-[#1A1714] tracking-tight">
                      {raw.stockQuantity.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Card Bottom Controls */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 md:pt-2">
                    <div className="flex items-center gap-0.5 md:gap-1">
                      <button
                        onClick={() => handleOpenRawModal(raw)}
                        className="p-1 text-indigo-500 hover:bg-indigo-50 rounded-lg cursor-pointer"
                        title="Edit Bahan"
                      >
                        <Edit2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmingDeleteId === raw.id) {
                            onDeleteRawMaterial(raw.id);
                            setConfirmingDeleteId(null);
                            toast('Dihapus', `${raw.name} berhasil dihapus.`);
                          } else {
                            setConfirmingDeleteId(raw.id);
                            setTimeout(() => setConfirmingDeleteId(null), 3000);
                          }
                        }}
                        className={`p-1 rounded-lg cursor-pointer transition-colors ${
                          confirmingDeleteId === raw.id ? 'bg-rose-600 text-white' : 'text-rose-400 hover:bg-rose-50'
                        }`}
                        title={confirmingDeleteId === raw.id ? 'Klik lagi untuk hapus' : 'Hapus Bahan'}
                      >
                        {confirmingDeleteId === raw.id ? <Check className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-0.5 md:gap-1">
                      <button
                        onClick={() => handleAdjustStock(raw, -1)}
                        className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Minus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      </button>
                      <button
                        onClick={() => handleAdjustStock(raw, 1)}
                        className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MENU List View */}
      {subTab === 'MENU' && (
        <div className="space-y-3 md:space-y-4">
          {/* Category Creator */}
          <div className="flex items-center gap-2 md:gap-3">
            <input
              type="text"
              placeholder="Buat Kategori Baru..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="bg-white border border-[#E5E5E7] rounded-full px-3 md:px-4 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 flex-1 max-w-64 shadow-2xs"
            />
            <button
              onClick={handleAddCategory}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Tambah</span>
            </button>
          </div>

          {/* Categories Accordion */}
          {categoriesList.map((cat) => {
            const categoryItems = filteredMenuItems.filter((m) => m.category === cat);
            if (categoryItems.length === 0 && searchTerm) return null;
            const isExpanded = expandedCategories[cat] !== false;

            return (
              <div key={cat} className="bg-white rounded-xl md:rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div
                  onClick={() =>
                    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
                  }
                  className="p-3 md:p-4 bg-[#FAFAF8] flex items-center justify-between border-b border-slate-100 cursor-pointer hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />}
                    <h3 className="font-black text-xs md:text-sm text-[#1A1714] uppercase">{cat}</h3>
                    <span className="text-[9px] md:text-[10px] font-bold bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full">
                      {categoryItems.length}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {categoryItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 md:p-3.5 flex items-center justify-between hover:bg-[#FAFAF8] transition-colors gap-2"
                      >
                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover shrink-0 border border-slate-200"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                              <span className="font-black text-[11px] md:text-xs text-[#1A1714] truncate">{item.name}</span>
                              {item.isAutoStock !== false && (
                                <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[8px] md:text-[9px] font-black px-1 md:px-1.5 py-0.5 rounded hidden sm:inline-block">
                                  Auto-Stock
                                </span>
                              )}
                            </div>
                            <span className="font-black text-[10px] md:text-xs text-slate-500 md:hidden">
                              Rp {item.price.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 md:gap-6 shrink-0">
                          <span className="font-black text-xs text-[#1A1714] hidden md:inline">
                            Rp {item.price.toLocaleString('id-ID')}
                          </span>

                          <span className="bg-slate-100 text-slate-700 text-[10px] md:text-xs font-black px-2 md:px-3 py-0.5 md:py-1 rounded-md border border-slate-200">
                            {item.stockCount || 100}
                          </span>

                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleOpenEditMenuModal(item)}
                              className="p-1 md:p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg cursor-pointer"
                              title="Edit Menu & Resep"
                            >
                              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirmingDeleteId === item.id) {
                                  onDeleteMenuItem(item.id);
                                  setConfirmingDeleteId(null);
                                  toast('Dihapus', `${item.name} berhasil dihapus.`);
                                } else {
                                  setConfirmingDeleteId(item.id);
                                  setTimeout(() => setConfirmingDeleteId(null), 3000);
                                }
                              }}
                              className={`p-1 md:p-1.5 rounded-lg cursor-pointer ${
                                confirmingDeleteId === item.id ? 'bg-rose-600 text-white' : 'text-rose-400 hover:bg-rose-50'
                              }`}
                              title={confirmingDeleteId === item.id ? 'Klik lagi untuk hapus' : 'Hapus Menu'}
                            >
                              {confirmingDeleteId === item.id ? <Check className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LAPORAN Summary */}
      {subTab === 'LAPORAN' && (
        <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-slate-200/90 shadow-2xs space-y-4 font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
            <h2 className="font-black text-[#1A1714] text-sm md:text-base">Laporan Ringkasan Stok & HPP</h2>
            <button
              onClick={handlePrintReport}
              className="px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-full text-[10px] md:text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Cetak Laporan
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="p-3 md:p-4 bg-[#FAFAF8] rounded-xl md:rounded-2xl border border-slate-200">
              <p className="text-[10px] md:text-xs font-bold text-slate-400">Total Nilai Bahan Baku:</p>
              <p className="text-lg md:text-xl font-black text-emerald-600 mt-1">
                Rp {rawMaterials.reduce((acc, curr) => acc + (curr.stockQuantity * curr.costPerUnit), 0).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="p-3 md:p-4 bg-[#FAFAF8] rounded-xl md:rounded-2xl border border-slate-200">
              <p className="text-[10px] md:text-xs font-bold text-slate-400">Rata-rata Margin HPP:</p>
              <p className="text-lg md:text-xl font-black text-indigo-600 mt-1">
                {Math.round(
                  menuItems.reduce((acc, curr) => acc + (((curr.price - curr.hppCost) / curr.price) * 100), 0) / (menuItems.length || 1)
                )}%
              </p>
            </div>

            <div className="p-3 md:p-4 bg-[#FAFAF8] rounded-xl md:rounded-2xl border border-slate-200">
              <p className="text-[10px] md:text-xs font-bold text-slate-400">Bahan Baku Perlu Restock:</p>
              <p className="text-lg md:text-xl font-black text-rose-600 mt-1">{restockNeedCount} Item</p>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MENU Modal */}
      {isEditMenuModalOpen && editingMenu && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
          <form
            onSubmit={handleSaveMenuForm}
            className="bg-white w-full max-w-3xl rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-2xl space-y-4 md:space-y-5 font-sans text-slate-900 border border-slate-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm md:text-base font-black text-[#1A1714] tracking-tight uppercase">EDIT MENU</h2>
              <button
                type="button"
                onClick={() => setIsEditMenuModalOpen(false)}
                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* LEFT: INFO PRODUK */}
              <div className="space-y-3 md:space-y-4">
                <label className="text-xs font-black text-orange-600 uppercase tracking-wider block border-b border-orange-100 pb-1">
                  INFO PRODUK
                </label>

                <div className="flex gap-3 items-start">
                  <div className="relative group shrink-0">
                    <img
                      src={editingMenu.image || 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400'}
                      alt={editingMenu.name || 'Preview'}
                      className="w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl object-cover border border-slate-200 shadow-2xs"
                    />
                    <label className="absolute inset-0 bg-slate-950/60 rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-white text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera className="w-4 h-4 mb-0.5" />
                      <span>UPLOAD</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleUploadMenuPhoto} />
                    </label>
                  </div>

                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">NAMA MENU</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Bakso Keju Komplit"
                      value={editingMenu.name || ''}
                      onChange={(e) => setEditingMenu({ ...editingMenu, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                    />

                    <label className="inline-flex items-center gap-1.5 px-2 md:px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl text-[9px] md:text-[10px] font-bold cursor-pointer hover:bg-orange-100/80 transition-colors">
                      <Upload className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      <span>{isUploadingPhoto ? 'Mengunggah...' : 'Upload Foto'}</span>
                      <input type="file" accept="image/*" className="hidden" disabled={isUploadingPhoto} onChange={handleUploadMenuPhoto} />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">KATEGORI</label>
                  <select
                    value={editingMenu.category || 'BAKSO'}
                    onChange={(e) => setEditingMenu({ ...editingMenu, category: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  >
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">HARGA</label>
                    <input
                      type="number"
                      required
                      value={editingMenu.price ?? 28000}
                      onChange={(e) => setEditingMenu({ ...editingMenu, price: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">DESKRIPSI</label>
                    <input
                      type="text"
                      placeholder="Deskripsi..."
                      value={editingMenu.description || ''}
                      onChange={(e) => setEditingMenu({ ...editingMenu, description: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 md:p-3 rounded-xl md:rounded-2xl flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-stock-chk"
                    checked={editingMenu.isAutoStock !== false}
                    onChange={(e) => setEditingMenu({ ...editingMenu, isAutoStock: e.target.checked })}
                    className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                  />
                  <label htmlFor="auto-stock-chk" className="text-[10px] md:text-xs font-black text-slate-900 cursor-pointer uppercase">
                    GUNAKAN RESEP (AUTO-STOCK)
                  </label>
                </div>
              </div>

              {/* RIGHT: RESEP & KOMPOSISI */}
              <div className="space-y-3 md:space-y-4">
                <label className="text-xs font-black text-orange-600 uppercase tracking-wider block border-b border-orange-100 pb-1">
                  RESEP & KOMPOSISI
                </label>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedRecipeMaterialId}
                    onChange={(e) => setSelectedRecipeMaterialId(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-bold outline-none focus:border-slate-900 focus:bg-white text-slate-900"
                  >
                    <option value="">Pilih Bahan Baku...</option>
                    {rawMaterials.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={selectedRecipeQty}
                    onChange={(e) => setSelectedRecipeQty(Number(e.target.value))}
                    className="w-14 md:w-16 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-black text-center outline-none focus:border-slate-900 focus:bg-white text-slate-900"
                  />

                  <button
                    type="button"
                    onClick={handleAddIngredientToRecipe}
                    className="w-8 h-8 md:w-9 md:h-9 bg-orange-600 hover:bg-orange-700 text-white rounded-xl md:rounded-2xl flex items-center justify-center font-black cursor-pointer shadow-xs shrink-0"
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3 space-y-2 min-h-40 md:min-h-48 max-h-56 overflow-y-auto">
                  {editingMenu.ingredients && editingMenu.ingredients.length > 0 ? (
                    editingMenu.ingredients.map((ing) => (
                      <div
                        key={ing.rawMaterialId}
                        className="bg-white border border-slate-200 rounded-xl p-2 md:p-2.5 flex items-center justify-between shadow-2xs"
                      >
                        <span className="font-black text-[11px] md:text-xs text-slate-900">{ing.rawMaterialName}</span>
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className="font-black text-[10px] md:text-xs text-slate-600 font-mono">
                            {ing.amountNeeded} {ing.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredientFromRecipe(ing.rawMaterialId)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-36 md:h-40 flex items-center justify-center text-[10px] md:text-xs font-bold text-slate-400 italic">
                      Belum ada bahan baku dikonfigurasi pada resep ini.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 md:py-3.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black text-xs rounded-xl md:rounded-2xl shadow-md uppercase tracking-wider transition-all cursor-pointer"
              >
                Simpan Perubahan Menu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT / TAMBAH BAHAN BAKU Modal */}
      {isRawModalOpen && editingRaw && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
          <form
            onSubmit={handleSaveRawForm}
            className="bg-white w-full max-w-md rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-2xl space-y-3 md:space-y-4 font-sans text-slate-900 border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                {editingRaw.id ? 'EDIT BAHAN BAKU' : 'TAMBAH BAHAN BAKU'}
              </h2>
              <button
                type="button"
                onClick={() => setIsRawModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">NAMA BAHAN BAKU</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Daging Sapi Urat, Keju, Minyak..."
                  value={editingRaw.name || ''}
                  onChange={(e) => setEditingRaw({ ...editingRaw, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">SATUAN</label>
                  <select
                    value={editingRaw.unit || 'pcs'}
                    onChange={(e) => setEditingRaw({ ...editingRaw, unit: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  >
                    <option value="pcs">PCS</option>
                    <option value="porsi">PORSI</option>
                    <option value="kg">KG</option>
                    <option value="gram">GRAM</option>
                    <option value="pack">PACK</option>
                    <option value="pouch">POUCH</option>
                    <option value="bungkus">BUNGKUS</option>
                    <option value="box">BOX</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">STOK SAAT INI</label>
                  <input
                    type="number"
                    step="any"
                    value={editingRaw.stockQuantity ?? 10}
                    onChange={(e) => setEditingRaw({ ...editingRaw, stockQuantity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">BATAS MINIMUM</label>
                  <input
                    type="number"
                    step="any"
                    value={editingRaw.minStockThreshold ?? 5}
                    onChange={(e) => setEditingRaw({ ...editingRaw, minStockThreshold: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">BIAYA (RP/SATUAN)</label>
                  <input
                    type="number"
                    value={editingRaw.costPerUnit ?? 10000}
                    onChange={(e) => setEditingRaw({ ...editingRaw, costPerUnit: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 md:py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl md:rounded-2xl shadow-md uppercase tracking-wider transition-all cursor-pointer"
              >
                Simpan Bahan Baku
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
