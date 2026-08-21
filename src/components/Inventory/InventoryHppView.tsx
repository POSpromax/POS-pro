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
  Circle,
  MoreHorizontal,
  TrendingDown
} from 'lucide-react';
import { RawMaterial, MenuItem, Branch, CategoryType, MaterialGroup } from '../../types/pos';
import { uploadImage } from '../../services/cloudinaryMedia';
import { filterMaterialsByGroup, resolveMaterialGroup } from '../../utils/materialGroup';
import { listStockMovements, STOCK_MOVEMENT_LABELS, type StockMovement, type StockMovementType } from '../../services/stockLedgerService';
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
  onUpdateRawMaterial: (
    material: RawMaterial,
    stockMovementType?: StockMovementType,
    stockReason?: string,
    stockDelta?: number
  ) => Promise<void> | void;
  onDeleteRawMaterial: (id: string) => void;
  onSaveMenuItem: (menu: MenuItem) => void;
  onDeleteMenuItem: (id: string) => void;
  onResetCatalogDefaults: () => void;
  onRefreshCatalog?: () => Promise<void> | void;
  // canViewCost=false (mis. KASIR): sembunyikan HPP, harga modal, & nilai aset;
  // batasi hanya ke daftar menu + stok opname. canDeleteCatalog=false: sembunyikan hapus.
  canViewCost?: boolean;
  canDeleteCatalog?: boolean;
  canResetCatalog?: boolean;
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
  canResetCatalog = true,
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
  const [isSavingRaw, setIsSavingRaw] = useState<boolean>(false);
  // Draft numerik tetap berupa teks selama operator mengetik. Mengubah string
  // kosong langsung menjadi Number('') membuat field kembali ke 0, sehingga
  // input 225 tampil sebagai 0225 dan tombol Backspace terasa tidak bekerja.
  const [rawStockInput, setRawStockInput] = useState<string>('0');
  const [rawMinStockInput, setRawMinStockInput] = useState<string>('5');
  // Kalkulator harga kemasan -> harga per satuan (mis. kecap pouch 600 ml).
  const [packPrice, setPackPrice] = useState<number | ''>('');
  const [packContent, setPackContent] = useState<number | ''>('');

  // Recipe Builder inside Edit Menu Modal
  const [selectedRecipeMaterialId, setSelectedRecipeMaterialId] = useState<string>('');
  const [selectedRecipeQty, setSelectedRecipeQty] = useState<number>(1);
  // Bahan CUSTOM: komponen HPP yang tidak terikat master bahan/stok, karena
  // pemakaian seperti garam/saus tertakar (gram/ml) sedangkan stok dapur
  // dihitung per pack/karton.
  const [customIng, setCustomIng] = useState({ name: '', qty: '', unit: 'gram', cost: '' });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isSetupPanelOpen, setIsSetupPanelOpen] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);
  const [showOnlyMissingRecipes, setShowOnlyMissingRecipes] = useState<boolean>(false);

  // Riwayat pergerakan stok per bahan
  const [ledgerMaterial, setLedgerMaterial] = useState<RawMaterial | null>(null);
  const [ledgerRows, setLedgerRows] = useState<StockMovement[]>([]);
  const [ledgerState, setLedgerState] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [ledgerError, setLedgerError] = useState<string>('');
  // Jumlah mutasi cepat disimpan per bahan agar operator dapat memasukkan
  // 100 unit sekali jalan tanpa menghasilkan 100 request/ledger terpisah.
  const [quickStockAmounts, setQuickStockAmounts] = useState<Record<string, string>>({});
  const [adjustingStockIds, setAdjustingStockIds] = useState<Set<string>>(new Set());

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
  const existingEditingRaw = editingRaw?.id
    ? rawMaterials.find((material) => material.id === editingRaw.id)
    : undefined;

  const filteredMenuItems = menuItems.filter((m) => (
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  ) && (!showOnlyMissingRecipes || (!m.isManualPrice && (m.ingredients?.length || 0) === 0)));

  // Quantities & Restock calculation
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

  const quickStockAmount = (materialId: string) => quickStockAmounts[materialId] ?? '1';

  const handleAdjustStock = async (material: RawMaterial, direction: -1 | 1) => {
    if (adjustingStockIds.has(material.id)) return;

    const amount = Number(quickStockAmount(material.id));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast('Jumlah Tidak Valid', 'Masukkan jumlah stok lebih dari 0.');
      return;
    }
    if (direction < 0 && amount > material.stockQuantity) {
      toast('Stok Tidak Cukup', `Stok ${material.name} hanya ${material.stockQuantity.toLocaleString('id-ID')} ${material.unit}.`);
      return;
    }

    const updatedQty = material.stockQuantity + (direction * amount);
    const movementType: StockMovementType = direction > 0 ? 'PURCHASE' : 'WASTE';
    const movementLabel = direction > 0 ? 'Stok masuk cepat' : 'Stok keluar cepat';

    setAdjustingStockIds((current) => new Set(current).add(material.id));
    try {
      await onUpdateRawMaterial(
        { ...material, stockQuantity: updatedQty },
        movementType,
        `${movementLabel}: ${amount} ${material.unit}`,
        direction * amount
      );
      setQuickStockAmounts((current) => ({ ...current, [material.id]: '1' }));
    } catch {
      // Pemilik mutation menampilkan pesan cloud yang spesifik. Nilai input
      // dipertahankan agar operator dapat mencoba ulang tanpa mengetik lagi.
    } finally {
      setAdjustingStockIds((current) => {
        const next = new Set(current);
        next.delete(material.id);
        return next;
      });
    }
  };

  const renderRawActions = (raw: RawMaterial) => (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setExpandedStockId((current) => current === raw.id ? null : raw.id)}
        aria-label={`Tindakan untuk ${raw.name}`}
        aria-expanded={expandedStockId === raw.id}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-800"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {expandedStockId === raw.id && (
        <div className="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
          <button type="button" onClick={() => { handleOpenLedger(raw); setExpandedStockId(null); }} className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-100">
            <History className="h-3.5 w-3.5" /> Riwayat stok
          </button>
          {canDeleteCatalog && (
            <>
              <button type="button" onClick={() => { handleOpenRawModal(raw); setExpandedStockId(null); }} className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-100">
                <Edit2 className="h-3.5 w-3.5" /> Ubah master item
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmingDeleteId === raw.id) {
                    onDeleteRawMaterial(raw.id);
                    setConfirmingDeleteId(null);
                    setExpandedStockId(null);
                    toast('Dihapus', `${raw.name} berhasil dihapus.`);
                  } else {
                    setConfirmingDeleteId(raw.id);
                    setTimeout(() => setConfirmingDeleteId(null), 3000);
                  }
                }}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold transition ${confirmingDeleteId === raw.id ? 'bg-rose-600 text-white' : 'text-rose-600 hover:bg-rose-50'}`}
              >
                {confirmingDeleteId === raw.id ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                {confirmingDeleteId === raw.id ? 'Konfirmasi hapus' : 'Hapus item'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  const renderRawStepper = (raw: RawMaterial) => {
    const amount = quickStockAmount(raw.id);
    const isAdjusting = adjustingStockIds.has(raw.id);
    return (
    <div className="flex items-center gap-1.5" aria-label={`Mutasi cepat stok ${raw.name}`}>
      <button
        onClick={() => handleAdjustStock(raw, -1)}
        disabled={isAdjusting}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition-colors hover:bg-slate-200 disabled:cursor-wait disabled:opacity-50"
          style={{ background: 'var(--surface-secondary)', borderColor: 'var(--panel-border)', color: 'var(--text-secondary)' }}
        title={`Stok keluar ${amount || 0} ${raw.unit}`}
        aria-label={`Keluarkan ${amount || 0} ${raw.unit} ${raw.name}`}
      >
        <Minus className="h-3 w-3" />
      </button>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={amount}
          disabled={isAdjusting}
          onChange={(event) => setQuickStockAmounts((current) => ({ ...current, [raw.id]: event.target.value }))}
          onBlur={() => {
            const value = Number(quickStockAmount(raw.id));
            if (!Number.isFinite(value) || value <= 0) {
              setQuickStockAmounts((current) => ({ ...current, [raw.id]: '1' }));
            }
          }}
          className="h-9 w-16 rounded-xl border border-slate-200 bg-white px-1 text-center text-[12px] font-extrabold tabular-nums text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-60"
          aria-label={`Jumlah mutasi stok ${raw.name}`}
          title={`Masukkan jumlah dalam ${raw.unit}`}
        />
        {isAdjusting && <RefreshCw className="pointer-events-none absolute right-1 top-3 h-3 w-3 animate-spin text-[var(--primary)]" />}
      </div>
      <button
        onClick={() => handleAdjustStock(raw, 1)}
        disabled={isAdjusting}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50"
        title={`Stok masuk ${amount || 0} ${raw.unit}`}
        aria-label={`Masukkan ${amount || 0} ${raw.unit} ${raw.name}`}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
    );
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
    if (!canDeleteCatalog) {
      toast('Akses Master Terbatas', 'Pembuatan dan perubahan master bahan hanya tersedia untuk Owner, Manager, atau Admin cabang.');
      return;
    }
    if (raw) {
      setEditingRaw({ ...raw });
      setRawStockInput(String(raw.stockQuantity ?? 0));
      setRawMinStockInput(String(raw.minStockThreshold ?? 0));
    } else {
      setEditingRaw({
        id: 'raw-' + Date.now().toString().slice(-4),
        name: '',
        unit: 'pcs',
        stockQuantity: 0,
        minStockThreshold: 5,
        costPerUnit: 10000,
        branchId: currentBranch?.id || branches[0]?.id || '00000000-0000-4000-a000-000000000010',
        branchName: currentBranch?.name || branches[0]?.name || 'Pasirmulya Bogor',
        group: activeGroup || 'DAPUR',
        takeAwayUsagePerItem: activeGroup === 'KEMASAN' ? 1 : undefined
      });
      setRawStockInput('0');
      setRawMinStockInput('5');
    }
    setIsRawModalOpen(true);
  };

  const handleSaveRawForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingRaw) return;
    if (!editingRaw?.name?.trim()) {
      toast('Validasi', 'Nama bahan baku wajib diisi!');
      return;
    }
    const stockQuantity = rawStockInput.trim() === '' ? 0 : Number(rawStockInput);
    const minStockThreshold = rawMinStockInput.trim() === '' ? 0 : Number(rawMinStockInput);
    if (!Number.isFinite(stockQuantity) || !Number.isFinite(minStockThreshold)) {
      toast('Validasi', 'Stok dan batas minimum harus berupa angka yang valid.');
      return;
    }
    if (stockQuantity < 0 || minStockThreshold < 0 || (Number(editingRaw.costPerUnit) || 0) < 0) {
      toast('Validasi', 'Stok, batas minimum, dan biaya tidak boleh bernilai negatif.');
      return;
    }
    const duplicate = rawMaterials.some((material) => (
      material.id !== editingRaw.id
      && material.name.trim().toLocaleLowerCase('id-ID') === editingRaw.name?.trim().toLocaleLowerCase('id-ID')
    ));
    if (duplicate) {
      toast('Nama Sudah Digunakan', 'Gunakan nama bahan yang berbeda dalam cabang ini.');
      return;
    }
    const targetBranch = branches.find((b) => b.id === editingRaw.branchId) || currentBranch;
    const finalMaterial: RawMaterial = {
      id: editingRaw.id || 'raw-' + Date.now().toString().slice(-4),
      name: editingRaw.name.trim(),
      unit: (editingRaw.unit as any) || 'pcs',
      // Saldo item lama hanya boleh berubah melalui mutasi beralasan agar
      // ledger tidak tercampur dengan perubahan master data.
      stockQuantity: existingEditingRaw?.stockQuantity ?? stockQuantity,
      minStockThreshold,
      costPerUnit: Number(editingRaw.costPerUnit) || 0,
      branchId: editingRaw.branchId || targetBranch?.id || '00000000-0000-4000-a000-000000000010',
      branchName: targetBranch?.name || 'Pasirmulya Bogor',
      group: editingRaw.group || 'DAPUR',
      takeAwayUsagePerItem: editingRaw.group === 'KEMASAN' ? Number(editingRaw.takeAwayUsagePerItem) || 1 : undefined
    };
    setIsSavingRaw(true);
    try {
      await onUpdateRawMaterial(finalMaterial);
      setIsRawModalOpen(false);
      setEditingRaw(null);
    } catch {
      // Toast kegagalan ditampilkan oleh pemilik mutation. Modal tetap dibuka
      // agar input operator tidak hilang dan dapat dicoba kembali.
    } finally {
      setIsSavingRaw(false);
    }
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

  const isStockWorkspace = subTab === 'BAHAN' || subTab === 'DAPUR' || subTab === 'KEMASAN';
  const activeWorkspace = isStockWorkspace ? 'STOCK' : subTab;
  const activeLowStockCount = activeRawList.filter((material) => material.stockQuantity <= material.minStockThreshold).length;
  const activeStockTotal = activeRawList.reduce((sum, material) => sum + material.stockQuantity, 0);

  return (
    <div className="ui-surface flex-1 overflow-y-auto font-sans text-[var(--text-primary)] select-none">
      <div className="mx-auto w-full max-w-[1680px] p-3 md:p-5 lg:p-6">
      {/* Workspace header: satu tujuan, satu aksi utama, tanpa deretan kontrol setara. */}
      <header className="mb-4 rounded-3xl border border-slate-200/90 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-[0_8px_18px_rgba(4,120,87,0.22)]">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">Inventory cabang</p>
              <h1 className="text-xl font-black tracking-tight text-slate-950 md:text-2xl">Kontrol persediaan</h1>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{currentBranch?.name || 'Outlet aktif'} · data cloud per cabang</p>
            </div>
          </div>

          <nav className="-mx-1 overflow-x-auto px-1 scrollbar-none" aria-label="Area kerja inventory">
            <div className="flex w-max items-center gap-1 rounded-2xl bg-slate-100 p-1">
              {([
                { key: 'MENU', icon: Utensils, label: 'Master menu', target: 'MENU' as SubTab },
                { key: 'STOCK', icon: Boxes, label: 'Persediaan', target: (isStockWorkspace ? subTab : 'BAHAN') as SubTab },
                { key: 'OPNAME', icon: ClipboardCheck, label: 'Opname', target: 'OPNAME' as SubTab },
                ...(canViewCost ? [{ key: 'LAPORAN', icon: FileText, label: 'Laporan', target: 'LAPORAN' as SubTab }] : []),
              ]).map(({ key, icon: Icon, label, target }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSubTab(target)}
                  className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-[11px] font-extrabold transition md:px-4 ${activeWorkspace === key ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  aria-current={activeWorkspace === key ? 'page' : undefined}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </nav>
        </div>

        {isStockWorkspace && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
            <span className="mr-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Kelompok</span>
            {([
              { key: 'BAHAN' as const, icon: Package, label: 'Bahan menu' },
              { key: 'DAPUR' as const, icon: ChefHat, label: 'Dapur' },
              { key: 'KEMASAN' as const, icon: ShoppingBag, label: 'Kemasan' },
            ]).map(({ key, icon: Icon, label }) => (
              <button key={key} type="button" onClick={() => setSubTab(key)} className={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[10px] font-extrabold transition ${subTab === key ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`}>
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {subTab !== 'OPNAME' && (
        <section className="relative z-20 mb-4 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" placeholder={subTab === 'MENU' ? 'Cari menu atau kategori…' : 'Cari nama item…'} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="ui-input min-h-10 pl-9 text-[12px]" />
            </div>

            <div className="flex items-center gap-2">
              {activeGroup && (
                <div className="flex shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                  {([{ key: 'GRID' as const, icon: LayoutGrid, label: 'Kotak' }, { key: 'LIST' as const, icon: List, label: 'Daftar' }]).map(({ key, icon: Icon, label }) => (
                    <button key={key} type="button" onClick={() => setViewMode(key)} aria-label={`Tampilan ${label.toLowerCase()}`} aria-pressed={viewMode === key} className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition ${viewMode === key ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              )}

              {(subTab === 'MENU' || canDeleteCatalog) && (
                <button type="button" onClick={subTab === 'MENU' ? () => handleOpenEditMenuModal() : () => handleOpenRawModal()} className="ui-button ui-button-primary min-h-10 flex-1 gap-1.5 whitespace-nowrap px-3 text-[11px] sm:flex-none">
                  <Plus className="h-3.5 w-3.5" /> {subTab === 'MENU' ? 'Tambah menu' : 'Tambah item'}
                </button>
              )}

              <div className="relative">
                <button type="button" onClick={() => setIsMoreMenuOpen((open) => !open)} aria-label="Tindakan lainnya" aria-expanded={isMoreMenuOpen} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {isMoreMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
                    {canViewCost && <button type="button" onClick={() => { handleExportCSV(); setIsMoreMenuOpen(false); }} className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-100"><Download className="h-3.5 w-3.5" /> Export CSV</button>}
                    {canResetCatalog && <button type="button" onClick={() => { onResetCatalogDefaults(); setIsMoreMenuOpen(false); }} className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold text-rose-600 hover:bg-rose-50"><RotateCcw className="h-3.5 w-3.5" /> Muat data standar</button>}
                  </div>
                )}
              </div>
            </div>
          </div>
          {activeGroup && (
            <p className="mt-2 px-1 text-[10px] font-semibold text-slate-400">
              Mutasi cepat: masukkan jumlah, lalu pilih keluar atau masuk. Setiap aksi membuat satu catatan ledger.
              {!canDeleteCatalog && ' Master bahan dikelola kepala outlet.'}
            </p>
          )}
        </section>
      )}

      {/* Panel kesiapan inventory — hitungan kesiapan, tanpa nilai rupiah, jadi
          aman ditampilkan untuk kasir yang memantau stok. */}
      {(subTab === 'MENU' || activeGroup) && (
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
      )}

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

      {/* Ringkasan kontekstual. Hanya metrik yang relevan dengan area kerja aktif. */}
      {(subTab === 'MENU' || activeGroup) && (
        <section className="mb-4 grid grid-cols-3 gap-2 md:gap-3" aria-label="Ringkasan inventory">
          {(subTab === 'MENU' ? [
            { label: 'Menu aktif', value: menuItems.length, helper: `${categoriesList.length} kategori`, icon: Utensils, tone: 'emerald' },
            { label: 'Resep siap', value: recipeLinkedCount, helper: `dari ${recipeEligibleItems.length} menu`, icon: ShieldCheck, tone: 'slate' },
            { label: 'Perlu dilengkapi', value: recipeMissingCount, helper: 'resep belum terhubung', icon: AlertTriangle, tone: recipeMissingCount > 0 ? 'amber' : 'slate' },
          ] : [
            { label: 'Jumlah item', value: activeRawList.length, helper: GROUP_TAB_LABEL[activeGroup!], icon: Boxes, tone: 'emerald' },
            { label: 'Stok menipis', value: activeLowStockCount, helper: 'di bawah batas minimum', icon: TrendingDown, tone: activeLowStockCount > 0 ? 'amber' : 'slate' },
            { label: 'Total unit', value: activeStockTotal.toLocaleString('id-ID'), helper: 'akumulasi kelompok aktif', icon: Layers, tone: 'slate' },
          ]).map(({ label, value, helper, icon: Icon, tone }) => (
            <div key={label} className={`min-w-0 rounded-2xl border p-3 md:flex md:items-center md:gap-3 md:p-4 ${tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/70' : tone === 'amber' ? 'border-amber-200 bg-amber-50/80' : 'border-slate-200 bg-white'}`}>
              <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl md:mb-0 md:h-9 md:w-9 ${tone === 'emerald' ? 'bg-emerald-700 text-white' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="truncate text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-slate-950 md:text-xl">{value}</p>
                <p className="hidden truncate text-[9px] font-semibold text-slate-400 sm:block">{helper}</p>
              </div>
            </div>
          ))}
        </section>
      )}

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
            {canDeleteCatalog ? (
              <button type="button" onClick={() => handleOpenRawModal()} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold shadow-md hover:bg-emerald-700" style={{ color: '#ffffff' }}>
                <Plus className="h-4 w-4" /> Tambah item pertama
              </button>
            ) : (
              <p className="mt-4 text-[11px] font-bold text-slate-500">Hubungi Owner/Manager/Admin untuk membuat master bahan pertama.</p>
            )}
          </div>
        ) : viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredRawList.map((raw) => {
              const isLow = raw.stockQuantity <= raw.minStockThreshold;

              return (
                <div
                  key={raw.id}
                  className={`relative flex min-h-40 flex-col rounded-2xl border bg-white p-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] ${isLow ? 'border-amber-200' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate text-[12px] font-extrabold text-slate-950">{raw.name}</h3>
                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">Batas minimum {raw.minStockThreshold.toLocaleString('id-ID')} {raw.unit}</p>
                    </div>
                    {renderRawActions(raw)}
                  </div>

                  <div className="my-4 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Stok tersedia</p>
                      <div className="mt-0.5 flex items-baseline gap-1.5">
                        <span className="text-2xl font-black tracking-tight text-slate-950">{raw.stockQuantity.toLocaleString('id-ID')}</span>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400">{raw.unit}</span>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${isLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{isLow ? 'Perlu belanja' : 'Aman'}</span>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[9px] font-bold text-slate-400">Keluar · jumlah · masuk</span>
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
                <div key={raw.id} className="flex flex-col gap-3 p-3 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center md:p-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate text-[12px] font-extrabold text-slate-950">{raw.name}</span>
                      {isLow && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">Perlu belanja</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                      {raw.unit} <span className="text-[var(--text-tertiary)]">Min: {raw.minStockThreshold}</span>
                      {canViewCost && <span className="text-[var(--text-tertiary)]"> · Rp {raw.costPerUnit.toLocaleString('id-ID')}</span>}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1 sm:w-24 sm:justify-end"><span className="text-lg font-black tabular-nums text-slate-950">{raw.stockQuantity.toLocaleString('id-ID')}</span><span className="text-[9px] font-bold uppercase text-slate-400">{raw.unit}</span></div>

                  <div className="flex items-center justify-between gap-2 sm:justify-end">
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
      {/* ── KESIAPAN HPP: daftar kerja setup (bahan tanpa harga, menu tanpa resep) ── */}
      {subTab === 'LAPORAN' && canViewCost && (() => {
        const materialsNoPrice = rawMaterials.filter((m) => !(Number(m.costPerUnit) > 0));
        const recipeMenus = menuItems.filter((m) => m.trackStock !== false && !m.isManualPrice);
        const noRecipe = recipeMenus.filter((m) => (m.ingredients?.length || 0) === 0);
        const withRecipe = recipeMenus.filter((m) => (m.ingredients?.length || 0) > 0);
        const incomplete = withRecipe
          .map((m) => ({ menu: m, hpp: calculateMenuHpp(m, rawMaterials) }))
          .filter((r) => r.hpp.missingCount > 0);
        const ready = withRecipe.length - incomplete.length;
        const percent = recipeMenus.length > 0 ? Math.round((ready / recipeMenus.length) * 100) : 0;
        return (
          <div className="mb-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4 md:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm md:text-base font-bold text-[var(--text-primary)]">Kesiapan HPP</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-tertiary)]">Daftar kerja untuk menyetel HPP: isi harga bahan dulu, lalu lengkapi resep menu.</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-[11px] font-black ${percent === 100 ? 'bg-[var(--primary-soft)] text-[var(--primary-text)]' : 'bg-[var(--warning-soft)] text-[#b45309]'}`}>
                {ready}/{recipeMenus.length} menu siap ({percent}%)
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--panel-border)] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">1. Bahan tanpa harga</p>
                <p className="mt-1 text-2xl font-black tabular-nums" style={{ color: materialsNoPrice.length ? 'var(--accent-red)' : 'var(--accent-green)' }}>{materialsNoPrice.length}</p>
                <div className="mt-1 max-h-28 space-y-0.5 overflow-y-auto">
                  {materialsNoPrice.slice(0, 40).map((m) => (
                    <button key={m.id} type="button" onClick={() => handleOpenRawModal(m)} className="block w-full truncate text-left text-[11px] font-semibold text-[var(--primary-hover)] hover:underline">{m.name}</button>
                  ))}
                  {materialsNoPrice.length === 0 && <p className="text-[11px] font-semibold text-[var(--text-tertiary)]">Semua bahan sudah berharga.</p>}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--panel-border)] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">2. Menu tanpa resep</p>
                <p className="mt-1 text-2xl font-black tabular-nums" style={{ color: noRecipe.length ? 'var(--accent-amber)' : 'var(--accent-green)' }}>{noRecipe.length}</p>
                <div className="mt-1 max-h-28 space-y-0.5 overflow-y-auto">
                  {noRecipe.slice(0, 60).map((m) => (
                    <button key={m.id} type="button" onClick={() => handleOpenEditMenuModal(m)} className="block w-full truncate text-left text-[11px] font-semibold text-[var(--primary-hover)] hover:underline">{m.name}</button>
                  ))}
                  {noRecipe.length === 0 && <p className="text-[11px] font-semibold text-[var(--text-tertiary)]">Semua menu punya resep.</p>}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--panel-border)] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">3. Resep ada, harga belum lengkap</p>
                <p className="mt-1 text-2xl font-black tabular-nums" style={{ color: incomplete.length ? 'var(--accent-amber)' : 'var(--accent-green)' }}>{incomplete.length}</p>
                <div className="mt-1 max-h-28 space-y-0.5 overflow-y-auto">
                  {incomplete.slice(0, 60).map(({ menu, hpp }) => (
                    <button key={menu.id} type="button" onClick={() => handleOpenEditMenuModal(menu)} className="block w-full truncate text-left text-[11px] font-semibold text-[var(--primary-hover)] hover:underline">
                      {menu.name} <span className="text-[var(--text-tertiary)]">({hpp.missingCount} bahan)</span>
                    </button>
                  ))}
                  {incomplete.length === 0 && <p className="text-[11px] font-semibold text-[var(--text-tertiary)]">Semua resep sudah berharga.</p>}
                </div>
              </div>
            </div>
            <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">Klik nama pada daftar untuk langsung membuka formnya. Menu harga manual &amp; item non-stok tidak dihitung.</p>
          </div>
        );
      })()}

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

                {/* Bahan CUSTOM: untuk pemakaian tertakar (garam, saus, bumbu)
                    yang tidak praktis diikat ke stok pack/karton. */}
                <div className="rounded-2xl border border-dashed border-[var(--brand-200)] bg-[var(--brand-50)] p-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--primary-text)]">Tambah Bahan Custom</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">Untuk pemakaian tertakar (garam, saus, bumbu) yang tidak diikat ke stok. Tidak memotong stok, hanya menambah komponen HPP.</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <input type="text" value={customIng.name} placeholder="Nama (mis. Garam)"
                      onChange={(e) => setCustomIng({ ...customIng, name: e.target.value })}
                      className="col-span-2 rounded-xl border border-[var(--panel-border)] bg-white p-2 text-xs font-bold text-[var(--text-primary)] outline-none" />
                    <input type="number" min={0} value={customIng.qty} placeholder="Jumlah"
                      onChange={(e) => setCustomIng({ ...customIng, qty: e.target.value })}
                      className="rounded-xl border border-[var(--panel-border)] bg-white p-2 text-xs font-bold text-[var(--text-primary)] outline-none" />
                    <input type="text" value={customIng.unit} placeholder="Satuan"
                      onChange={(e) => setCustomIng({ ...customIng, unit: e.target.value })}
                      className="rounded-xl border border-[var(--panel-border)] bg-white p-2 text-xs font-bold text-[var(--text-primary)] outline-none" />
                    {canViewCost && (
                      <div className="relative col-span-2">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-tertiary)]">Rp</span>
                        <input type="number" min={0} value={customIng.cost} placeholder="Biaya per satuan"
                          onChange={(e) => setCustomIng({ ...customIng, cost: e.target.value })}
                          className="w-full rounded-xl border border-[var(--panel-border)] bg-white p-2 pl-7 text-xs font-bold text-[var(--text-primary)] outline-none" />
                      </div>
                    )}
                    <button type="button"
                      disabled={!customIng.name.trim() || !(Number(customIng.qty) > 0)}
                      onClick={() => {
                        const line = {
                          rawMaterialId: '',
                          rawMaterialName: customIng.name.trim(),
                          amountNeeded: Number(customIng.qty) || 0,
                          unit: customIng.unit.trim() || 'gram',
                          isCustom: true,
                          customCost: Number(customIng.cost) || 0,
                        };
                        setEditingMenu({ ...editingMenu, ingredients: [ ...(editingMenu.ingredients || []), line ] });
                        setCustomIng({ name: '', qty: '', unit: customIng.unit, cost: '' });
                      }}
                      className={`${canViewCost ? 'col-span-2' : 'col-span-4'} rounded-xl bg-[var(--primary)] p-2 text-xs font-bold text-white disabled:opacity-50`}>
                      Tambah Bahan Custom
                    </button>
                  </div>
                </div>

                <div className="bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 md:p-3 space-y-2 min-h-40 md:min-h-48 max-h-56 overflow-y-auto">
                  {editingMenu.ingredients && editingMenu.ingredients.length > 0 ? (
                    editingMenu.ingredients.map((ing) => (
                      <div
                        key={ing.rawMaterialId}
                        className="bg-[var(--surface-card)] border border-[var(--panel-border)] rounded-xl p-2 md:p-2.5 flex items-center justify-between shadow-sm"
                      >
                        <span className="font-bold text-[11px] md:text-xs text-[var(--text-primary)]">{ing.rawMaterialName}{ing.isCustom && <span className="ml-1.5 rounded bg-[var(--brand-100)] px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--primary-text)]">custom</span>}</span>
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
                {existingEditingRaw ? 'EDIT BAHAN BAKU' : 'TAMBAH BAHAN BAKU'}
              </h2>
              <button
                type="button"
                disabled={isSavingRaw}
                onClick={() => setIsRawModalOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer disabled:cursor-wait disabled:opacity-50"
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
                    min={0}
                    value={rawStockInput}
                    disabled={Boolean(existingEditingRaw)}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setRawStockInput(e.target.value)}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--panel-border)] rounded-2xl p-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface-card)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {existingEditingRaw && (
                    <p className="mt-1 text-[10px] font-semibold text-[var(--text-tertiary)]">Ubah saldo melalui kontrol cepat atau Stok Opname agar tercatat di ledger.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">BATAS MINIMUM</label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={rawMinStockInput}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setRawMinStockInput(e.target.value)}
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
                disabled={isSavingRaw}
                className="w-full py-3 md:py-3.5 bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs rounded-2xl shadow-sm uppercase tracking-wider transition-all cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {isSavingRaw ? 'Menyimpan ke Cloud...' : 'Simpan Bahan Baku'}
              </button>
            </div>
          </form>
        </div>
      )}
      </div>
    </div>
  );
};
