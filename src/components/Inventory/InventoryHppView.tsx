import React, { useState, useMemo } from 'react';
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
  Check,
  ChefHat,
  ShoppingBag,
  LayoutGrid,
  List,
  History,
  ClipboardCheck,
  ArrowRight,
  ShieldCheck,
  Circle
} from 'lucide-react';
import { RawMaterial, MenuItem, Branch, CategoryType, MaterialGroup } from '../../types/pos';
import { uploadImage } from '../../services/cloudinaryMedia';
import { filterMaterialsByGroup, resolveMaterialGroup } from '../../utils/materialGroup';
import { listStockMovements, STOCK_MOVEMENT_LABELS, type StockMovement } from '../../services/stockLedgerService';
import { StockOpnamePanel } from './StockOpnamePanel';
import { optimizeCloudinaryImage } from '../../utils/imageUrl';
import { calculateMenuHpp, marginOf } from '../../utils/hpp';

type SubTab = 'BAHAN' | 'DAPUR' | 'KEMASAN' | 'MENU' | 'LAPORAN' | 'OPNAME';

const SUB_TAB_TO_GROUP: Partial<Record<SubTab, MaterialGroup>> = {
  BAHAN: 'MENU',
  DAPUR: 'DAPUR',
  KEMASAN: 'KEMASAN'
};

const GROUP_TAB_LABEL: Record<MaterialGroup, string> = {
  MENU: 'Bahan Menu',
  DAPUR: 'Stok Dapur',
  KEMASAN: 'Kemasan Bawa Pulang'
};

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
  onRefreshCatalog?: () => Promise<void> | void;
  // canViewCost=false (mis. KASIR): sembunyikan HPP, harga modal, & nilai aset;
  // batasi hanya ke daftar menu + stok opname. canDeleteCatalog=false: sembunyikan hapus.
  canViewCost?: boolean;
  canDeleteCatalog?: boolean;
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
  onRefreshCatalog,
  canViewCost = true,
  canDeleteCatalog = true,
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
      filteredRawList.forEach((r) => {
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

  // KASIR (tanpa akses HPP) hanya boleh di Daftar Menu.
  const [subTab, setSubTab] = useState<SubTab>('BAHAN');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
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
  // Kalkulator harga kemasan -> harga per satuan (mis. kecap pouch 600 ml).
  const [packPrice, setPackPrice] = useState<number | ''>('');
  const [packContent, setPackContent] = useState<number | ''>('');

  // Recipe Builder inside Edit Menu Modal
  const [selectedRecipeMaterialId, setSelectedRecipeMaterialId] = useState<string>('');
  const [selectedRecipeQty, setSelectedRecipeQty] = useState<number>(1);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isSetupPanelOpen, setIsSetupPanelOpen] = useState<boolean>(true);
  const [showOnlyMissingRecipes, setShowOnlyMissingRecipes] = useState<boolean>(false);

  // Riwayat pergerakan stok per bahan
  const [ledgerMaterial, setLedgerMaterial] = useState<RawMaterial | null>(null);
  const [ledgerRows, setLedgerRows] = useState<StockMovement[]>([]);
  const [ledgerState, setLedgerState] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [ledgerError, setLedgerError] = useState<string>('');

  const handleOpenLedger = async (raw: RawMaterial) => {
    setLedgerMaterial(raw);
    setLedgerRows([]);
    setLedgerError('');
    setLedgerState('LOADING');
    try {
      const result = await listStockMovements({ branchId: raw.branchId, rawMaterialId: raw.id, limit: 60 });
      setLedgerRows(result.rows);
      setLedgerState('IDLE');
    } catch (error) {
      setLedgerError(error instanceof Error ? error.message : 'Riwayat stok gagal dimuat.');
      setLedgerState('ERROR');
    }
  };

  const handleUploadMenuPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPhoto(true);
      const targetBranchId = currentBranch?.id || '00000000-0000-4000-a000-000000000010';
      const uploaded = await uploadImage(file, 'menus', targetBranchId);
      setEditingMenu((prev) => prev ? { ...prev, image: uploaded.secureUrl } : null);
    } catch (err) {
      console.warn('Cloudinary upload failed:', err);
      toast('Foto Gagal Diunggah', err instanceof Error ? err.message : 'Foto belum tersimpan ke cloud. Coba kembali setelah koneksi media tersedia.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const activeGroup = SUB_TAB_TO_GROUP[subTab];
  const activeRawList = activeGroup ? filterMaterialsByGroup(rawMaterials, activeGroup) : [];
  const filteredRawList = activeRawList.filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMenuItems = menuItems.filter((m) => (
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  ) && (!showOnlyMissingRecipes || (!m.isManualPrice && (m.ingredients?.length || 0) === 0)));

  // Quantities & Restock calculation
  const totalAssetsCount = rawMaterials.length;
  const restockNeedCount = rawMaterials.filter((m) => m.stockQuantity <= m.minStockThreshold).length;
  const recipeEligibleItems = menuItems.filter((menu) => !menu.isManualPrice);
  const recipeLinkedCount = recipeEligibleItems.filter((menu) => (menu.ingredients?.length || 0) > 0).length;
  const recipeMissingCount = recipeEligibleItems.length - recipeLinkedCount;
  const consumptionMaterials = rawMaterials.filter((material) => resolveMaterialGroup(material) === 'MENU');
  const configuredConsumptionMaterials = consumptionMaterials.filter((material) => material.costPerUnit > 0 && material.minStockThreshold >= 0);
  const inventorySetupSteps = [
    { id: 'menu', label: 'Master menu tersedia', detail: `${menuItems.length} menu di outlet`, done: menuItems.length > 0 },
    { id: 'material', label: 'Bahan konsumsi tersedia', detail: `${consumptionMaterials.length} bahan menu`, done: consumptionMaterials.length > 0 },
    { id: 'recipe', label: 'Resep menu lengkap', detail: `${recipeLinkedCount}/${recipeEligibleItems.length} menu terhubung`, done: recipeEligibleItems.length > 0 && recipeMissingCount === 0 },
    { id: 'cost', label: 'HPP dan batas stok siap', detail: `${configuredConsumptionMaterials.length}/${consumptionMaterials.length} bahan terkonfigurasi`, done: consumptionMaterials.length > 0 && configuredConsumptionMaterials.length === consumptionMaterials.length },
  ];
  const completedSetupSteps = inventorySetupSteps.filter((step) => step.done).length;
  const inventoryReadinessPercent = Math.round((completedSetupSteps / inventorySetupSteps.length) * 100);
  const isInventoryOperationalReady = completedSetupSteps === inventorySetupSteps.length;

  const handleContinueInventorySetup = () => {
    if (menuItems.length === 0) {
      setSubTab('MENU');
      handleOpenEditMenuModal();
      return;
    }
    if (consumptionMaterials.length === 0) {
      setSubTab('BAHAN');
      handleOpenRawModal();
      return;
    }
    if (recipeMissingCount > 0) {
      setSubTab('MENU');
      setSearchTerm('');
      setShowOnlyMissingRecipes(true);
      toast('Lengkapi Resep', 'Pilih Edit Menu & Resep pada setiap menu yang belum terhubung ke bahan.');
      return;
    }
    setSubTab('BAHAN');
    toast('Lengkapi HPP', 'Periksa harga satuan dan batas minimum setiap bahan menu.');
  };

  const handleAdjustStock = (material: RawMaterial, delta: number) => {
    const updatedQty = Math.max(0, material.stockQuantity + delta);
    onUpdateRawMaterial({ ...material, stockQuantity: updatedQty });
  };

  const renderRawActions = (raw: RawMaterial) => (
    <div className="flex items-center gap-0.5 md:gap-1">
      <button
        onClick={() => handleOpenLedger(raw)}
        className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] rounded-lg cursor-pointer transition-colors"
        title="Riwayat keluar-masuk stok"
      >
        <History className="w-3 h-3 md:w-3.5 md:h-3.5" />
      </button>
      <button
        onClick={() => handleOpenRawModal(raw)}
        className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] rounded-lg cursor-pointer transition-colors"
        title="Ubah item"
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
          confirmingDeleteId === raw.id ? 'bg-[var(--accent-red)] text-white' : 'text-[var(--accent-red)] hover:bg-[var(--danger-soft)]'
        }`}
        title={confirmingDeleteId === raw.id ? 'Klik lagi untuk hapus' : 'Hapus item'}
      >
        {confirmingDeleteId === raw.id ? <Check className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />}
      </button>
    </div>
  );

  const renderRawStepper = (raw: RawMaterial) => (
    <div className="flex items-center gap-0.5 md:gap-1">
      <button
        onClick={() => handleAdjustStock(raw, -1)}
        className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border transition-colors hover:bg-[var(--panel-border-strong)] md:h-6 md:w-6"
          style={{ background: 'var(--surface-secondary)', borderColor: 'var(--panel-border)', color: 'var(--text-secondary)' }}
        title="Kurangi stok"
      >
        <Minus className="w-2.5 h-2.5 md:w-3 md:h-3" />
      </button>
      <button
        onClick={() => handleAdjustStock(raw, 1)}
        className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[var(--brand-50)] border border-[var(--brand-200)] text-[var(--primary-text)] hover:bg-[var(--brand-100)] flex items-center justify-center cursor-pointer transition-colors"
        title="Tambah stok"
      >
        <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" />
      </button>
    </div>
  );

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
      // HPP disimpan dari hasil hitung RESEP (bukan angka manual/default),
      // supaya laporan margin memakai biaya bahan yang sebenarnya.
      hppCost: calculateMenuHpp(editingMenu as MenuItem, rawMaterials).total || Number(editingMenu.hppCost) || 0,
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
        branchName: currentBranch?.name || branches[0]?.name || 'Pasirmulya Bogor',
        group: activeGroup || 'DAPUR',
        takeAwayUsagePerItem: activeGroup === 'KEMASAN' ? 1 : undefined
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
      branchName: targetBranch?.name || 'Pasirmulya Bogor',
      group: editingRaw.group || 'DAPUR',
      takeAwayUsagePerItem: editingRaw.group === 'KEMASAN' ? Number(editingRaw.takeAwayUsagePerItem) || 1 : undefined
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
      setExpandedCategories((prev) => ({ ...prev, [cat]: true }));
    }
    setNewCategoryName('');
    toast('Kategori Ditambahkan', `Kategori ${cat} berhasil dibuat.`);
  };

  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);
  const [confirmingDeleteCat, setConfirmingDeleteCat] = useState<string | null>(null);

  // Dynamic merged list of all categories
  const displayCategories = useMemo(() => {
    const customCats = menuItems.map((m) => m.category);
    const set = new Set([...categoriesList, ...customCats]);
    return Array.from(set);
  }, [categoriesList, menuItems]);

  const handleSaveRenameCategory = () => {
    if (!editingCategory || !editingCategory.newName.trim()) return;
    const oldCat = editingCategory.oldName;
    const newCat = editingCategory.newName.trim().toUpperCase() as CategoryType;
    if (oldCat === newCat) {
      setEditingCategory(null);
      return;
    }

    setCategoriesList((prev) => prev.map((c) => (c === oldCat ? newCat : c)));
    setExpandedCategories((prev) => {
      const next = { ...prev };
      if (next[oldCat] !== undefined) {
        next[newCat] = next[oldCat];
        delete next[oldCat];
      }
      return next;
    });

    const matchingItems = menuItems.filter((m) => m.category === oldCat);
    matchingItems.forEach((item) => {
      onSaveMenuItem({ ...item, category: newCat });
    });

    setEditingCategory(null);
    toast('Kategori Diperbarui', `Kategori ${oldCat} diubah menjadi ${newCat} (${matchingItems.length} menu diperbarui).`);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    if (catToDelete === 'TAMBAHAN') {
      toast('Kategori Sistem', 'Kategori TAMBAHAN adalah kategori sistem utama dan tidak dapat dihapus.');
      return;
    }
    setCategoriesList((prev) => prev.filter((c) => c !== catToDelete));

    const affected = menuItems.filter((m) => m.category === catToDelete);
    affected.forEach((item) => {
      onSaveMenuItem({ ...item, category: 'TAMBAHAN' });
    });

    setConfirmingDeleteCat(null);
    toast('Kategori Dihapus', `Kategori ${catToDelete} dihapus.${affected.length > 0 ? ` ${affected.length} item dipindahkan ke TAMBAHAN.` : ''}`);
  };

  return (
    <div className="ui-surface flex-1 overflow-y-auto p-3 font-sans text-[var(--text-primary)] select-none md:p-6">
      {/* Top Header Bar — stacks vertically on mobile */}
      <div className="flex flex-col gap-3 mb-4 md:mb-5">
        {/* Title row */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_10px_24px_rgba(4,120,87,0.24)] md:h-12 md:w-12">
            <Boxes className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">Kontrol stok cabang</p>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-950 md:text-xl">Inventory</h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              {currentBranch?.name || 'Outlet aktif'} · master menu, bahan, kemasan, dan histori pergerakan.
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation — scrollable on mobile */}
        <div className="overflow-x-auto scrollbar-none -mx-3 px-3 md:mx-0 md:px-0">
          <div className="flex w-max items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            {([
              { key: 'MENU' as const, icon: Utensils, label: 'DAFTAR MENU' },
              { key: 'OPNAME' as const, icon: ClipboardCheck, label: 'STOK OPNAME' },
              { key: 'BAHAN' as const, icon: Package, label: 'BAHAN MENU' },
              { key: 'DAPUR' as const, icon: ChefHat, label: 'STOK DAPUR' },
              { key: 'KEMASAN' as const, icon: ShoppingBag, label: 'KEMASAN' },
              { key: 'LAPORAN' as const, icon: FileText, label: 'LAPORAN' },
            // Tanpa akses biaya (KASIR): tab stok TETAP terbuka supaya bisa memantau
            // mutasi stok masuk/keluar. Hanya LAPORAN yang disembunyikan karena
            // memuat nilai aset & margin HPP.
            ].filter((t) => canViewCost || t.key !== 'LAPORAN')).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setSubTab(key)}
                className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[11px] font-bold transition-all md:px-4 md:text-xs ${
                  subTab === key
                    ? 'text-white shadow-sm'
                    : 'hover:bg-[var(--surface-secondary)]'
                }`}
                style={subTab === key
                  ? { background: 'var(--primary)', boxShadow: '0 4px 12px rgb(234 88 12 / 22%)' }
                  : { color: 'var(--text-secondary)' }}
              >
                <Icon className="w-3 h-3 md:w-3.5 md:h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + Actions row — stacks on mobile. Disembunyikan di tab Opname
            karena panel opname punya pencarian & aksi sendiri. */}
        {subTab !== 'OPNAME' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ui-input pl-9 text-[12px]"
            />
          </div>

          <div className="flex items-center gap-2">
            {activeGroup && (
              <div className="bg-[var(--surface-secondary)] border border-[var(--panel-border)]/80 p-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                {([
                  { key: 'GRID' as const, icon: LayoutGrid, label: 'Tampilan kotak' },
                  { key: 'LIST' as const, icon: List, label: 'Tampilan daftar' }
                ]).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    title={label}
                    aria-label={label}
                    aria-pressed={viewMode === key}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      viewMode === key ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            )}

            {canViewCost && (
              <button
                onClick={handleExportCSV}
                className="ui-button ui-button-secondary gap-1 text-[11px]"
              >
                <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">EXPORT</span>
              </button>
            )}

            {subTab === 'MENU' ? (
              <button
                onClick={() => handleOpenEditMenuModal()}
                className="ui-button ui-button-primary flex-1 gap-1 text-[11px] sm:flex-initial"
              >
                <Plus className="w-3.5 h-3.5" /> TAMBAH MENU
              </button>
            ) : (
              <button
                onClick={() => handleOpenRawModal()}
                className="ui-button ui-button-primary flex-1 gap-1 text-[11px] sm:flex-initial"
              >
                <Plus className="w-3.5 h-3.5" /> TAMBAH {subTab === 'KEMASAN' ? 'KEMASAN' : subTab === 'DAPUR' ? 'STOK DAPUR' : 'BAHAN'}
              </button>
            )}

            {canDeleteCatalog && (
              <button
                onClick={onResetCatalogDefaults}
                className="p-2 bg-[var(--surface-card)] border border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] rounded-full cursor-pointer transition-colors shrink-0"
                title="Reset & Muat Data Standar Resto"
              >
                <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Panel kesiapan inventory — hitungan kesiapan, tanpa nilai rupiah, jadi
          aman ditampilkan untuk kasir yang memantau stok. */}
      <section className={`mb-4 overflow-hidden rounded-2xl border shadow-sm ${isInventoryOperationalReady ? 'border-[var(--primary-border)] bg-[var(--primary-soft)]' : 'border-[var(--panel-border)] bg-[var(--surface-card)]'}`}>
        <button
          type="button"
          onClick={() => setIsSetupPanelOpen((open) => !open)}
          className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left md:px-5"
          aria-expanded={isSetupPanelOpen}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm`}
            style={{ background: isInventoryOperationalReady ? 'var(--accent-green)' : 'var(--primary)' }}>
            {isInventoryOperationalReady ? <ShieldCheck className="h-5 w-5" /> : <ClipboardCheck className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Kesiapan Inventory Cabang</p>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide`}
                style={isInventoryOperationalReady
                  ? { background: 'var(--success-soft)', color: 'var(--accent-green)' }
                  : { background: 'var(--warning-soft)', color: '#b45309' }}>
                {isInventoryOperationalReady ? 'Siap operasional' : 'Perlu dilengkapi'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              {currentBranch?.name || 'Outlet aktif'} · {completedSetupSteps}/{inventorySetupSteps.length} tahap selesai
            </p>
          </div>
          <div className="hidden w-28 items-center gap-2 sm:flex">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-secondary)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${inventoryReadinessPercent}%`, background: isInventoryOperationalReady ? 'var(--accent-green)' : 'var(--primary)' }} />
            </div>
            <span className="text-[10px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{inventoryReadinessPercent}%</span>
          </div>
          {isSetupPanelOpen ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />}
        </button>

        {isSetupPanelOpen && (
          <div className="border-t px-4 py-4 md:px-5" style={{ borderColor: 'var(--panel-border-light)' }}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {inventorySetupSteps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5"
                  style={step.done
                    ? { borderColor: 'var(--primary-border)', background: 'var(--primary-soft)' }
                    : { borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)' }}>
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={step.done
                      ? { background: 'var(--accent-green)', color: '#fff' }
                      : { border: '1px solid var(--panel-border-strong)', background: 'var(--surface-card)', color: 'var(--text-tertiary)' }}>
                    {step.done ? <Check className="h-3 w-3" /> : <span className="text-[9px] font-extrabold">{index + 1}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-extrabold ${step.done ? 'text-emerald-950' : 'text-slate-800'}`}>{step.label}</p>
                    <p className="mt-0.5 text-[9px] font-medium text-slate-500">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {!isInventoryOperationalReady && (
              <div className="mt-3 flex flex-col gap-2 rounded-xl bg-slate-900 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <Circle className="mt-1 h-2.5 w-2.5 shrink-0 fill-amber-400 text-amber-400" />
                  <p className="text-[10px] font-semibold leading-relaxed text-slate-200">
                    Jangan gunakan kontrol stok otomatis sebelum bahan konsumsi, resep, HPP, dan batas minimum selesai dikonfigurasi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleContinueInventorySetup}
                  className="flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-[10px] font-extrabold text-slate-950 transition hover:bg-emerald-50"
                >
                  Lanjutkan setup <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {subTab === 'MENU' && recipeMissingCount > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 shadow-[0_8px_22px_rgba(180,83,9,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-amber-950">{recipeMissingCount} menu belum terhubung ke resep bahan</p>
              <p className="mt-0.5 text-[11px] font-medium text-amber-800">Stok bahan belum berkurang otomatis untuk menu tersebut. Buka Edit Menu lalu isi komposisi resep per outlet.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setShowOnlyMissingRecipes((current) => !current);
              }}
              className="cursor-pointer rounded-xl bg-amber-600 px-3 py-1.5 text-[10px] font-extrabold text-white transition hover:bg-amber-700"
            >
              {showOnlyMissingRecipes ? 'Tampilkan semua' : 'Fokus yang belum siap'}
            </button>
            <span className="rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-[10px] font-extrabold text-amber-800">
              Resep aktif {recipeLinkedCount}/{recipeEligibleItems.length}
            </span>
          </div>
        </div>
      )}

      {/* Kartu metrik: semuanya HITUNGAN (bukan rupiah) -> aman untuk kasir. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4 mb-4 md:mb-6">
        <div className="ui-card-feature flex items-center justify-between p-3 md:p-5">
          <div>
            <p className="ui-stat-label">MENU</p>
            <p className="ui-stat-value text-white" style={{ fontSize: '28px' }}>{menuItems.length}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/20 md:h-12 md:w-12">
            <Utensils className="h-4 w-4 text-white md:h-6 md:w-6" />
          </div>
        </div>

        <div className="ui-card flex items-center justify-between p-3 md:p-5">
          <div>
            <p className="ui-stat-label">TOTAL BAHAN</p>
            <p className="ui-stat-value" style={{ fontSize: '28px' }}>{totalAssetsCount}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl md:h-12 md:w-12"
            style={{ background: 'var(--primary-soft)', color: 'var(--primary-text)' }}>
            <Boxes className="h-4 w-4 md:h-6 md:w-6" />
          </div>
        </div>

        <div className="ui-card flex items-center justify-between p-3 md:p-5"
          style={restockNeedCount > 0 ? { borderColor: '#fde68a', background: 'var(--warning-soft)' } : undefined}>
          <div>
            <p className="ui-stat-label">PERLU BELANJA</p>
            <p className="ui-stat-value" style={{ fontSize: '28px', color: restockNeedCount > 0 ? '#b45309' : undefined }}>{restockNeedCount}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl text-white md:h-12 md:w-12"
            style={{ background: restockNeedCount > 0 ? 'var(--accent-amber)' : 'var(--surface-secondary)', color: restockNeedCount > 0 ? '#fff' : 'var(--text-tertiary)' }}>
            <AlertTriangle className="h-4 w-4 md:h-6 md:w-6" />
          </div>
        </div>

        <div className="ui-card flex items-center justify-between p-3 md:p-5">
          <div>
            <p className="ui-stat-label">KATEGORI</p>
            <p className="ui-stat-value" style={{ fontSize: '28px' }}>{categoriesList.length}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl md:h-12 md:w-12"
            style={{ background: 'var(--primary-soft)', color: 'var(--primary-text)' }}>
            <Layers className="h-4 w-4 md:h-6 md:w-6" />
          </div>
        </div>
      </div>

      {subTab === 'OPNAME' && (
        <StockOpnamePanel
          rawMaterials={rawMaterials}
          branchId={currentBranch?.id}
          onRefresh={() => onRefreshCatalog?.()}
          onShowToast={(t, m) => toast(t, m)}
        />
      )}

      {/* Stock list — grid or list mode */}
      {activeGroup && (
        filteredRawList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-white to-slate-50 p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:p-12">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
              <Package className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-extrabold text-slate-800">Belum ada {GROUP_TAB_LABEL[activeGroup]}</p>
            <p className="mx-auto mt-1 max-w-md text-xs font-medium text-slate-500">Tambahkan master bahan khusus {currentBranch?.code || 'outlet ini'} agar stok, HPP, dan peringatan belanja dapat dihitung.</p>
            <button type="button" onClick={() => handleOpenRawModal()} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold shadow-md hover:bg-emerald-700" style={{ color: '#ffffff' }}>
              <Plus className="h-4 w-4" /> Tambah item pertama
            </button>
          </div>
        ) : viewMode === 'GRID' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 md:gap-3.5">
            {filteredRawList.map((raw) => {
              const isLow = raw.stockQuantity <= raw.minStockThreshold;

              return (
                <div
                  key={raw.id}
                  className="bg-[var(--surface-card)] rounded-2xl p-2.5 md:p-3.5 border border-[var(--panel-border)]/90 shadow-sm flex flex-col justify-between relative hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[11px] md:text-xs text-[var(--text-primary)] truncate">{raw.name}</h3>
                      <p className="text-[11px] md:text-[11px] font-bold text-[var(--text-tertiary)] uppercase">
                        {raw.unit} <span className="text-[var(--text-tertiary)]">Min: {raw.minStockThreshold}</span>
                      </p>
                    </div>

                    {isLow && (
                      <span className="ui-badge ui-badge-danger flex items-center gap-0.5">
                        MENIPIS
                      </span>
                    )}
                  </div>

                  <div className="my-1.5 md:my-2 text-right">
                    <span className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">
                      {raw.stockQuantity.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--panel-border-light)] pt-1.5 md:pt-2">
                    {renderRawActions(raw)}
                    {renderRawStepper(raw)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="divide-y overflow-hidden rounded-2xl border shadow-sm"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--panel-border)', borderTopColor: 'var(--panel-border)' }}>
            {filteredRawList.map((raw) => {
              const isLow = raw.stockQuantity <= raw.minStockThreshold;

              return (
                <div key={raw.id} className="p-2.5 md:p-3.5 flex items-center gap-2 md:gap-4 hover:bg-[var(--surface-secondary)]/80 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[11px] md:text-xs text-[var(--text-primary)] truncate">{raw.name}</span>
                      {isLow && (
                        <span className="ui-badge ui-badge-danger">
                          MENIPIS
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] md:text-[11px] font-bold text-[var(--text-tertiary)] uppercase">
                      {raw.unit} <span className="text-[var(--text-tertiary)]">Min: {raw.minStockThreshold}</span>
                      {canViewCost && <span className="text-[var(--text-tertiary)]"> · Rp {raw.costPerUnit.toLocaleString('id-ID')}</span>}
                    </p>
                  </div>

                  <span className="text-base md:text-lg font-bold text-[var(--text-primary)] tracking-tight tabular-nums shrink-0">
                    {raw.stockQuantity.toLocaleString('id-ID')}
                  </span>

                  <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
                    {renderRawStepper(raw)}
                    {renderRawActions(raw)}
                  </div>
                </div>
              );
            })}
          </div>
        )
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
              className="bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-full px-3 md:px-4 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] flex-1 max-w-64 shadow-sm"
            />
            <button
              onClick={handleAddCategory}
              className="ui-button ui-button-primary gap-1"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Tambah</span>
            </button>
          </div>

          {/* Categories Accordion */}
          {displayCategories.map((cat) => {
            const categoryItems = filteredMenuItems.filter((m) => m.category === cat);
            if (categoryItems.length === 0 && (searchTerm.trim() || showOnlyMissingRecipes)) return null;
            const isExpanded = searchTerm.trim().length > 0 || showOnlyMissingRecipes ? true : (expandedCategories[cat] ?? true);

            return (
              <div key={cat} className="overflow-hidden rounded-2xl border shadow-sm"
                style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-card)' }}>
                {/* Category header — full row clickable for expand/collapse */}
                <div
                  role="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedCategories((prev) => ({ ...prev, [cat]: !(prev[cat] ?? true) }))}
                  className="flex cursor-pointer items-center justify-between border-b p-3 transition-colors hover:bg-[var(--surface-secondary)] md:p-4"
                  style={{ borderColor: 'var(--panel-border-light)' }}
                >
                  {/* Left: chevron + name + count */}
                  <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
                    {isExpanded
                      ? <ChevronUp className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" style={{ color: 'var(--text-tertiary)' }} />
                      : <ChevronDown className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" style={{ color: 'var(--text-tertiary)' }} />}
                    <h3 className="truncate text-xs font-bold uppercase md:text-sm" style={{ color: 'var(--text-primary)' }}>{cat}</h3>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>
                      {categoryItems.length}
                    </span>
                  </div>

                  {/* Right: category management actions — stopPropagation so row click still toggles */}
                  <div className="ml-2 flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditingCategory({ oldName: cat, newName: cat })}
                      className="rounded-lg p-1.5 transition-colors cursor-pointer hover:bg-[var(--brand-50)]"
                      style={{ color: 'var(--text-tertiary)' }}
                      title="Edit Nama Kategori"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    {cat !== 'TAMBAHAN' && canDeleteCatalog && (
                      <button
                        onClick={() => {
                          if (confirmingDeleteCat === cat) {
                            handleDeleteCategory(cat);
                          } else {
                            setConfirmingDeleteCat(cat);
                            setTimeout(() => setConfirmingDeleteCat(null), 3000);
                          }
                        }}
                        className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                          confirmingDeleteCat === cat
                            ? 'bg-[var(--accent-red)] text-white'
                            : 'hover:bg-[var(--danger-soft)]'
                        }`}
                        style={confirmingDeleteCat === cat ? undefined : { color: 'var(--accent-red)' }}
                        title={confirmingDeleteCat === cat ? 'Klik lagi untuk hapus' : 'Hapus Kategori'}
                      >
                        {confirmingDeleteCat === cat ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="divide-y" style={{ borderColor: 'var(--panel-border-light)' }}>
                    {categoryItems.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">
                        Belum ada item dalam kategori ini.
                      </div>
                    ) : (
                      categoryItems.map((item) => {
                        const isStickyItem = item.id === 'menu-custom' || item.isSticky || item.isManualPrice;
                        return (
                          <div
                            key={item.id}
                            className="p-2.5 md:p-3.5 flex items-center justify-between hover:bg-[var(--surface-card)] transition-colors gap-2"
                          >
                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                              {item.image ? (
                                <img
                                  src={optimizeCloudinaryImage(item.image, 80)}
                                  alt={item.name}
                                  className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover shrink-0 border border-[var(--panel-border)]"
                                />
                              ) : (
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--panel-border)] bg-slate-100 text-[10px] font-black text-slate-400 md:h-10 md:w-10">
                                  {item.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                                  <span className="font-bold text-[11px] md:text-xs text-[var(--text-primary)] truncate">{item.name}</span>
                                  {isStickyItem && (
                                    <span className="ui-badge ui-badge-primary text-[10px]">
                                      Melekat (Custom)
                                    </span>
                                  )}
                                  {item.isAutoStock !== false && !isStickyItem && (
                                    <span className="ui-badge ui-badge-success hidden sm:inline-flex">
                                      Auto-Stock
                                    </span>
                                  )}
                                  {!isStickyItem && (item.ingredients?.length || 0) === 0 && (
                                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-800">
                                      Resep belum ada
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-[11px] md:text-xs text-[var(--text-secondary)] md:hidden">
                                  {isStickyItem ? 'Harga Custom' : `Rp ${item.price.toLocaleString('id-ID')}`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 md:gap-6 shrink-0">
                              <span className="font-bold text-xs text-[var(--text-primary)] hidden md:inline">
                                {isStickyItem ? 'Harga Custom' : `Rp ${item.price.toLocaleString('id-ID')}`}
                              </span>

                              <span className="bg-[var(--surface-secondary)] text-[var(--text-primary)] text-[11px] md:text-xs font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-lg border border-[var(--panel-border)]">
                                {isStickyItem ? '∞' : (item.stockCount || 100)}
                              </span>

                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => handleOpenEditMenuModal(item)}
                                  className="p-1 md:p-1.5 text-[var(--primary-hover)] hover:bg-[var(--brand-100)] rounded-lg cursor-pointer"
                                  title="Edit Menu & Resep"
                                >
                                  <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                </button>

                                {!canDeleteCatalog ? null : isStickyItem ? (
                                  <span className="p-1 md:p-1.5 text-slate-300 cursor-not-allowed" title="Item Sistem Melekat (Tidak bisa dihapus)">
                                    <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 opacity-40" />
                                  </span>
                                ) : (
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
                                      confirmingDeleteId === item.id ? 'bg-[var(--accent-red)] text-white' : 'text-[var(--accent-red)] hover:bg-[var(--danger-soft)]'
                                    }`}
                                    title={confirmingDeleteId === item.id ? 'Klik lagi untuk hapus' : 'Hapus Menu'}
                                  >
                                    {confirmingDeleteId === item.id ? <Check className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Edit Kategori */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md" style={{ background: 'rgba(24,24,27,0.45)' }}>
          <div className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-xl space-y-4" style={{ borderColor: 'var(--panel-border)' }}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Edit Kategori</h3>
              <button onClick={() => setEditingCategory(null)} className="ui-icon-button h-7 w-7"><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="ui-form-label block mb-1">Nama Kategori</label>
              <input
                type="text"
                className="ui-input font-bold uppercase"
                value={editingCategory.newName}
                onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Mengubah nama kategori akan secara otomatis memperbarui kategori semua menu di dalamnya.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setEditingCategory(null)} className="ui-button ui-button-secondary">Batal</button>
              <button onClick={handleSaveRenameCategory} className="ui-button ui-button-primary">Simpan Nama</button>
            </div>
          </div>
        </div>
      )}

      {/* LAPORAN Summary */}
      {subTab === 'LAPORAN' && (
        <div className="bg-[var(--surface-card)] rounded-2xl p-4 md:p-6 border border-[var(--panel-border)]/90 shadow-sm space-y-4 font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--panel-border-light)] pb-3">
            <h2 className="font-bold text-[var(--text-primary)] text-sm md:text-base">Laporan Ringkasan Stok & HPP</h2>
            <button
              onClick={handlePrintReport}
              className="px-3 md:px-4 py-2 bg-[var(--primary)] text-white rounded-full text-[11px] md:text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Cetak Laporan
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="p-3 md:p-4 bg-[var(--surface-card)] rounded-2xl border border-[var(--panel-border)]">
              <p className="text-[11px] md:text-xs font-bold text-[var(--text-tertiary)]">Total Nilai Bahan Baku:</p>
              <p className="mt-1 text-lg font-bold md:text-xl" style={{ color: 'var(--accent-green)' }}>
                Rp {rawMaterials.reduce((acc, curr) => acc + (curr.stockQuantity * curr.costPerUnit), 0).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="p-3 md:p-4 bg-[var(--surface-card)] rounded-2xl border border-[var(--panel-border)]">
              <p className="text-[11px] md:text-xs font-bold text-[var(--text-tertiary)]">Rata-rata Margin HPP:</p>
              <p className="text-lg md:text-xl font-bold text-[var(--primary-hover)] mt-1">
                {Math.round(
                  menuItems.reduce((acc, curr) => acc + (((curr.price - curr.hppCost) / curr.price) * 100), 0) / (menuItems.length || 1)
                )}%
              </p>
            </div>

            <div className="p-3 md:p-4 bg-[var(--surface-card)] rounded-2xl border border-[var(--panel-border)]">
              <p className="text-[11px] md:text-xs font-bold text-[var(--text-tertiary)]">Bahan Baku Perlu Restock:</p>
              <p className="mt-1 text-lg font-bold md:text-xl" style={{ color: 'var(--accent-red)' }}>{restockNeedCount} Item</p>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MENU Modal */}
      {isEditMenuModalOpen && editingMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 backdrop-blur-md md:p-4"
          style={{ background: 'rgba(24,24,27,0.38)' }}>          <form
            onSubmit={handleSaveMenuForm}
            className="bg-[var(--surface-card)] w-full max-w-3xl rounded-2xl p-4 md:p-6 shadow-[var(--shadow-md)] space-y-4 md:space-y-5 font-sans text-[var(--text-primary)] border border-[var(--panel-border)] max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[var(--panel-border-light)] pb-3">
              <h2 className="text-sm md:text-base font-bold text-[var(--text-primary)] tracking-tight uppercase">EDIT MENU</h2>
              <button
                type="button"
                onClick={() => setIsEditMenuModalOpen(false)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-secondary)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* LEFT: INFO PRODUK */}
              <div className="space-y-3 md:space-y-4">
                <label className="text-xs font-bold text-[var(--primary-text)] uppercase tracking-wider block border-b border-[var(--brand-200)] pb-1">
                  INFO PRODUK
                </label>

                <div className="flex gap-3 items-start">
                  <div className="relative group shrink-0">
                    <img
                      src={editingMenu.image ? optimizeCloudinaryImage(editingMenu.image, 160) : 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400'}
                      alt={editingMenu.name || 'Preview'}
                      className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover border border-[var(--panel-border)] shadow-sm"
                    />
                    <label className="absolute inset-0 bg-[var(--primary)]/75 rounded-2xl flex flex-col items-center justify-center text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera className="w-4 h-4 mb-0.5" />
                      <span>UPLOAD</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleUploadMenuPhoto} />
                    </label>
                  </div>

                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">NAMA MENU</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Bakso Keju Komplit"
                      value={editingMenu.name || ''}
                      onChange={(e) => setEditingMenu({ ...editingMenu, name: e.target.value })}
                      className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)]"
                    />

                    <label className="inline-flex items-center gap-1.5 px-2 md:px-3 py-1 bg-[var(--brand-50)] border border-[var(--brand-200)] text-[var(--primary-text)] rounded-xl text-[11px] md:text-[11px] font-bold cursor-pointer hover:bg-[var(--brand-100)]/80 transition-colors">
                      <Upload className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      <span>{isUploadingPhoto ? 'Mengunggah...' : 'Upload Foto'}</span>
                      <input type="file" accept="image/*" className="hidden" disabled={isUploadingPhoto} onChange={handleUploadMenuPhoto} />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">KATEGORI</label>
                  <select
                    value={editingMenu.category || 'BAKSO'}
                    onChange={(e) => setEditingMenu({ ...editingMenu, category: e.target.value as any })}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)]"
                  >
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">HARGA</label>
                    <input
                      type="number"
                      required
                      value={editingMenu.price ?? 28000}
                      onChange={(e) => setEditingMenu({ ...editingMenu, price: Number(e.target.value) })}
                      className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">DESKRIPSI</label>
                    <input
                      type="text"
                      placeholder="Deskripsi..."
                      value={editingMenu.description || ''}
                      onChange={(e) => setEditingMenu({ ...editingMenu, description: e.target.value })}
                      className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)]"
                    />
                  </div>
                </div>

                <div className="bg-[var(--surface-secondary)] border border-[var(--panel-border)] p-2.5 md:p-3 rounded-2xl flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-stock-chk"
                    checked={editingMenu.isAutoStock !== false}
                    onChange={(e) => setEditingMenu({ ...editingMenu, isAutoStock: e.target.checked })}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                  <label htmlFor="auto-stock-chk" className="text-[11px] md:text-xs font-bold text-[var(--text-primary)] cursor-pointer uppercase">
                    GUNAKAN RESEP (AUTO-STOCK)
                  </label>
                </div>
              </div>

              {/* RIGHT: RESEP & KOMPOSISI */}
              <div className="space-y-3 md:space-y-4">
                <label className="text-xs font-bold text-[var(--primary-text)] uppercase tracking-wider block border-b border-[var(--brand-200)] pb-1">
                  RESEP & KOMPOSISI
                </label>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedRecipeMaterialId}
                    onChange={(e) => setSelectedRecipeMaterialId(e.target.value)}
                    className="flex-1 bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)] text-[var(--text-primary)]"
                  >
                    <option value="">Pilih Bahan...</option>
                    {(['MENU', 'DAPUR', 'KEMASAN'] as MaterialGroup[]).map((group) => {
                      const groupItems = rawMaterials.filter((r) => resolveMaterialGroup(r) === group);
                      if (groupItems.length === 0) return null;
                      return (
                        <optgroup key={group} label={GROUP_TAB_LABEL[group]}>
                          {groupItems.map((r) => (
                            <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>

                  <input
                    type="number"
                    value={selectedRecipeQty}
                    onChange={(e) => setSelectedRecipeQty(Number(e.target.value))}
                    className="w-14 md:w-16 bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-center outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)] text-[var(--text-primary)]"
                  />

                  <button
                    type="button"
                    onClick={handleAddIngredientToRecipe}
                    className="w-8 h-8 md:w-9 md:h-9 bg-[var(--primary-solid)] hover:bg-[var(--primary-pressed)] text-white rounded-2xl flex items-center justify-center font-bold cursor-pointer shadow-sm shrink-0"
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>

                <div className="bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 md:p-3 space-y-2 min-h-40 md:min-h-48 max-h-56 overflow-y-auto">
                  {editingMenu.ingredients && editingMenu.ingredients.length > 0 ? (
                    editingMenu.ingredients.map((ing) => (
                      <div
                        key={ing.rawMaterialId}
                        className="bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-xl p-2 md:p-2.5 flex items-center justify-between shadow-sm"
                      >
                        <span className="font-bold text-[11px] md:text-xs text-[var(--text-primary)]">{ing.rawMaterialName}</span>
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className="font-bold text-[11px] md:text-xs text-[var(--text-secondary)] font-mono">
                            {ing.amountNeeded} {ing.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredientFromRecipe(ing.rawMaterialId)}
            className="p-1 cursor-pointer rounded transition-colors"
                          style={{ color: 'var(--accent-red)' }}
                          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--danger-soft)'}
                          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
                          >
                            <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-36 md:h-40 flex items-center justify-center text-[11px] md:text-xs font-bold text-[var(--text-tertiary)] italic">
                      Belum ada bahan baku dikonfigurasi pada resep ini.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rincian HPP dihitung DARI RESEP (bukan angka manual). */}
            {(() => {
              const hpp = calculateMenuHpp(editingMenu as MenuItem, rawMaterials);
              const m = marginOf(Number(editingMenu.price) || 0, hpp.total);
              return (
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-[var(--primary-text)]">Rincian HPP dari Resep</p>
                    {canViewCost && (
                      <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                        HPP <b className="text-[var(--text-primary)]">Rp {hpp.total.toLocaleString('id-ID')}</b>
                        {Number(editingMenu.price) > 0 && (
                          <> &middot; Margin <b style={{ color: m.margin >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>Rp {m.margin.toLocaleString('id-ID')} ({m.percent}%)</b></>
                        )}
                      </span>
                    )}
                  </div>
                  {hpp.lines.length === 0 ? (
                    <p className="mt-2 text-[11px] font-semibold text-[var(--text-tertiary)]">Belum ada bahan pada resep. Tambahkan bahan di panel Resep &amp; Komposisi.</p>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {hpp.lines.map((line) => (
                        <div key={line.rawMaterialId} className="flex items-center justify-between text-[11px]">
                          <span className="text-[var(--text-primary)]">
                            {line.name} <span className="text-[var(--text-tertiary)]">{line.amount} {line.unit}</span>
                            {line.missing && <span className="ml-1 rounded bg-[var(--warning-soft)] px-1.5 py-0.5 text-[9px] font-black text-[#b45309]">harga belum diisi</span>}
                          </span>
                          {canViewCost && <span className="font-mono font-bold text-[var(--text-secondary)]">Rp {line.subtotal.toLocaleString('id-ID')}</span>}
                        </div>
                      ))}
                      {canViewCost && (
                        <div className="flex items-center justify-between border-t border-[var(--panel-border)] pt-1.5 text-[12px] font-black">
                          <span>TOTAL HPP / PORSI</span>
                          <span className="font-mono">Rp {hpp.total.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {hpp.missingCount > 0 && (
                    <p className="mt-2 text-[10px] font-semibold text-[#b45309]">
                      {hpp.missingCount} bahan belum punya harga per satuan &mdash; HPP belum akurat. Isi lewat form bahan (ada kalkulator harga kemasan).
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 md:py-3.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-95 text-white font-bold text-xs rounded-2xl shadow-sm uppercase tracking-wider transition-all cursor-pointer"
              >
                Simpan Perubahan Menu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RIWAYAT PERGERAKAN STOK */}
      {ledgerMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 backdrop-blur-md md:p-4"
          style={{ background: 'rgba(24,24,27,0.38)' }}>          <div className="bg-[var(--surface-card)] w-full max-w-2xl rounded-2xl p-4 md:p-6 shadow-[var(--shadow-md)] font-sans text-[var(--text-primary)] border border-[var(--panel-border)] max-h-[88vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-[var(--panel-border-light)] pb-3 gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight truncate">
                  Riwayat Stok — {ledgerMaterial.name}
                </h2>
                <p className="text-[11px] font-bold text-[var(--text-tertiary)] mt-0.5">
                  Stok sekarang {ledgerMaterial.stockQuantity.toLocaleString('id-ID')} {ledgerMaterial.unit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLedgerMaterial(null)}
                className="w-7 h-7 bg-[var(--surface-secondary)] hover:bg-slate-200 rounded-full flex items-center justify-center text-[var(--text-secondary)] cursor-pointer shrink-0"
                aria-label="Tutup riwayat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pt-3">
              {ledgerState === 'LOADING' && (
                <p className="py-10 text-center text-xs font-bold text-[var(--text-tertiary)]">Memuat riwayat…</p>
              )}

              {ledgerState === 'ERROR' && (
                <p className="py-10 text-center text-[12px] font-bold" style={{ color: 'var(--accent-red)' }}>{ledgerError}</p>
              )}

              {ledgerState === 'IDLE' && ledgerRows.length === 0 && (
                <p className="py-10 px-4 text-center text-xs font-bold text-[var(--text-tertiary)] leading-relaxed">
                  Belum ada pergerakan tercatat untuk bahan ini.<br />
                  Riwayat mulai terisi setelah ada penjualan, belanja masuk, atau koreksi stok.
                </p>
              )}

              {ledgerState === 'IDLE' && ledgerRows.length > 0 && (
                <div className="divide-y" style={{ borderColor: 'var(--panel-border-light)' }}>
                  {ledgerRows.map((row) => {
                    const isIn = row.quantity > 0;
                    return (
                      <div key={row.id} className="py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] md:text-xs font-bold text-[var(--text-primary)]">
                            {STOCK_MOVEMENT_LABELS[row.type] || row.type}
                          </p>
                          <p className="text-[11px] font-bold text-[var(--text-tertiary)]">
                            {new Date(row.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            {row.reason ? ` · ${row.reason}` : ''}
                          </p>
                        </div>

        <span className={`shrink-0 text-[12px] font-bold tabular-nums md:text-sm ${isIn ? '' : ''}`}
          style={{ color: isIn ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {isIn ? '+' : ''}{row.quantity.toLocaleString('id-ID')}
                        </span>

                        <span className="text-[11px] font-bold text-[var(--text-tertiary)] tabular-nums shrink-0 w-24 text-right">
                          {row.stockBefore.toLocaleString('id-ID')} → {row.stockAfter.toLocaleString('id-ID')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT / TAMBAH BAHAN BAKU Modal */}
      {isRawModalOpen && editingRaw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 backdrop-blur-md md:p-4"
          style={{ background: 'rgba(24,24,27,0.38)' }}>          <form
            onSubmit={handleSaveRawForm}
            className="bg-[var(--surface-card)] w-full max-w-md rounded-2xl p-4 md:p-6 shadow-[var(--shadow-md)] space-y-3 md:space-y-4 font-sans text-[var(--text-primary)] border border-[var(--panel-border)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--panel-border-light)] pb-3">
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">
                {editingRaw.id ? 'EDIT BAHAN BAKU' : 'TAMBAH BAHAN BAKU'}
              </h2>
              <button
                type="button"
                onClick={() => setIsRawModalOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">KELOMPOK STOK</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { key: 'MENU' as const, label: 'Bahan Menu' },
                    { key: 'DAPUR' as const, label: 'Stok Dapur' },
                    { key: 'KEMASAN' as const, label: 'Kemasan' }
                  ]).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditingRaw({ ...editingRaw, group: key, takeAwayUsagePerItem: key === 'KEMASAN' ? (editingRaw.takeAwayUsagePerItem || 1) : undefined })}
                      className={`py-2 rounded-xl text-[11px] font-bold uppercase border transition-colors cursor-pointer ${
                        (editingRaw.group || 'DAPUR') === key
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--panel-border)] hover:bg-[var(--surface-secondary)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">NAMA BAHAN BAKU</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Daging Sapi Urat, Keju, Minyak..."
                  value={editingRaw.name || ''}
                  onChange={(e) => setEditingRaw({ ...editingRaw, name: e.target.value })}
                  className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">SATUAN</label>
                  <select
                    value={editingRaw.unit || 'pcs'}
                    onChange={(e) => setEditingRaw({ ...editingRaw, unit: e.target.value as any })}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)]"
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
                  <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">STOK SAAT INI</label>
                  <input
                    type="number"
                    step="any"
                    value={editingRaw.stockQuantity ?? 10}
                    onChange={(e) => setEditingRaw({ ...editingRaw, stockQuantity: Number(e.target.value) })}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">BATAS MINIMUM</label>
                  <input
                    type="number"
                    step="any"
                    value={editingRaw.minStockThreshold ?? 5}
                    onChange={(e) => setEditingRaw({ ...editingRaw, minStockThreshold: Number(e.target.value) })}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)]"
                  />
                </div>

                {canViewCost && (
                <div className="sm:col-span-2 rounded-2xl border border-dashed border-[var(--brand-200)] bg-[var(--brand-50)] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary-text)]">Kalkulator Harga Kemasan &rarr; Per Satuan</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">
                    Untuk bahan yang dibeli per kemasan tapi dipakai sedikit (kecap pouch, mie pack, saus botol).
                    Isi harga beli dan isi kemasan dalam satuan <b>{editingRaw.unit || 'satuan'}</b> &mdash; biaya per satuan terisi otomatis.
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Harga beli kemasan (Rp)</label>
                      <input type="number" min={0} value={packPrice} placeholder="mis. 15000"
                        onChange={(e) => setPackPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full rounded-xl border border-[var(--panel-border)] bg-white p-2 text-xs font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Isi kemasan ({editingRaw.unit || 'satuan'})</label>
                      <input type="number" min={0} value={packContent} placeholder="mis. 600"
                        onChange={(e) => setPackContent(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full rounded-xl border border-[var(--panel-border)] bg-white p-2 text-xs font-bold text-[var(--text-primary)] outline-none" />
                    </div>
                    <div className="flex items-end">
                      <button type="button" disabled={!packPrice || !packContent || Number(packContent) <= 0}
                        onClick={() => setEditingRaw({ ...editingRaw, costPerUnit: Math.round((Number(packPrice) / Number(packContent)) * 100) / 100 })}
                        className="w-full rounded-xl bg-[var(--primary)] p-2 text-xs font-bold text-white disabled:opacity-50">Hitung &amp; Isi</button>
                    </div>
                  </div>
                  {Boolean(packPrice) && Number(packContent) > 0 && (
                    <p className="mt-1.5 text-[11px] font-bold text-[var(--primary-text)]">
                      = Rp {(Math.round((Number(packPrice) / Number(packContent)) * 100) / 100).toLocaleString('id-ID')} per {editingRaw.unit || 'satuan'}
                    </p>
                  )}
                </div>
                )}

                {canViewCost && (
                <div>
                  <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">BIAYA (RP/SATUAN)</label>
                  <input
                    type="number"
                    value={editingRaw.costPerUnit ?? 10000}
                    onChange={(e) => setEditingRaw({ ...editingRaw, costPerUnit: Number(e.target.value) })}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)]"
                  />
                </div>
                )}
              </div>

              {editingRaw.group === 'KEMASAN' && (
                <div>
                  <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">PEMAKAIAN PER ITEM BAWA PULANG</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editingRaw.takeAwayUsagePerItem ?? 1}
                    onChange={(e) => setEditingRaw({ ...editingRaw, takeAwayUsagePerItem: Number(e.target.value) })}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)]"
                  />
                  <p className="text-[11px] font-bold text-[var(--text-tertiary)] mt-1">
                    Stok berkurang otomatis sebanyak angka ini untuk setiap item pesanan bawa pulang.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 md:py-3.5 bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs rounded-2xl shadow-sm uppercase tracking-wider transition-all cursor-pointer"
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
