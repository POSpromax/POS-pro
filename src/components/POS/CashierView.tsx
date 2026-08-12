import React, { useState, useEffect } from 'react';
import { isGroupApplicable } from '../../utils/condimentUtils';
import { formatOrderLabel } from '../../utils/orderNumber';
import { optimizeCloudinaryImage } from '../../utils/imageUrl';
import {
  Plus,
  Minus,
  Trash2,
  Receipt,
  Save,
  CreditCard,
  Utensils,
  ShoppingBag,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  User,
  Hash,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Grid2X2
} from 'lucide-react';
import {
  MenuItem,
  Order,
  OrderItem,
  OrderType,
  CategoryType,
  RestaurantTable,
  UserAccount,
  CondimentGroup,
  Branch,
  Shift
} from '../../types/pos';
import { CondimentSelectionModal } from './CondimentSelectionModal';

// Optimized Menu Item Card Component with Fallback Image, Clean Grid Layout, and Condiment Support
const POSMenuItemCard: React.FC<{
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
  onOpenCondiments?: (item: MenuItem) => void;
  hasCondiments?: boolean;
  isPaidOrder?: boolean;
}> = ({
  item,
  onAddToCart,
  onOpenCondiments,
  hasCondiments = false,
  isPaidOrder = false
}) => {
  const [imgError, setImgError] = useState(false);

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case 'BAKSO':
        return { bg: 'from-neutral-200 to-neutral-300', icon: '🍲' };
      case 'MIE AYAM':
        return { bg: 'from-neutral-200 to-neutral-300', icon: '🍜' };
      case 'MAKANAN':
        return { bg: 'from-neutral-200 to-neutral-300', icon: '🍱' };
      case 'TAMBAHAN':
        return { bg: 'from-neutral-500 to-neutral-700', icon: '🥟' };
      case 'KRIUK':
        return { bg: 'from-neutral-200 to-neutral-300', icon: '🥨' };
      case 'MINUMAN':
        return { bg: 'from-neutral-500 to-neutral-700', icon: '🥤' };
      case 'BUNDLING':
        return { bg: 'from-neutral-200 to-neutral-300', icon: '🎁' };
      default:
        return { bg: 'from-zinc-500 to-zinc-700', icon: '🍽️' };
    }
  };

  const theme = getCategoryTheme(item.category);
  const shouldTriggerCondiments = hasCondiments;

  return (
    <div
      onClick={() => {
        if (isPaidOrder) return;
        if (shouldTriggerCondiments && onOpenCondiments) {
          onOpenCondiments(item);
        } else {
          onAddToCart(item);
        }
      }}
      // Kartu dipisahkan garis tipis, bukan bayangan — itu yang membuatnya
      // terbaca bersih di atas latar putih, seperti pada referensi.
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border bg-[var(--surface-card)] transition-all duration-200 select-none ${
        isPaidOrder
          ? 'cursor-not-allowed border-[var(--panel-border)] opacity-60'
          : 'cursor-pointer border-[var(--panel-border)] hover:border-[var(--primary-border)] hover:shadow-[var(--shadow-sm)]'
      }`}
    >
      {/* Image area — taller, aspect-ratio consistent */}
      <div className="relative flex h-28 shrink-0 items-center justify-center overflow-hidden bg-[var(--surface-secondary)] sm:h-32 lg:h-36">
        {item.image && !imgError ? (
          <img
            src={optimizeCloudinaryImage(item.image, 520)}
            alt={item.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br p-3 text-center text-white ${theme.bg}`}>
            <span className="text-3xl">{theme.icon}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-80 line-clamp-1">{item.category}</span>
          </div>
        )}

        {/* Referensi membiarkan foto bersih tanpa badge menumpuk; kategori
            sudah terbaca dari filter di atas dan stok pindah ke baris aksi. */}
      </div>

      {/* Body — mengikuti susunan referensi: nama di kiri dan harga di kanan
          pada baris yang sama, lalu baris aksi di bawahnya. */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[13px] font-bold leading-snug tracking-tight"
            style={{ color: 'var(--text-primary)' }}>
            {item.name}
          </h3>
          <span className="shrink-0 tabular-nums text-[13px] font-bold"
            style={{ color: 'var(--primary)' }}>
            Rp {item.price.toLocaleString('id-ID')}
          </span>
        </div>

        <p className="line-clamp-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          {item.description || item.category}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <span className="tabular-nums text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Stok {item.stockCount !== undefined ? item.stockCount : '∞'}
          </span>

          <button
            type="button"
            disabled={isPaidOrder}
            onClick={(e) => {
              e.stopPropagation();
              if (isPaidOrder) return;
              if (shouldTriggerCondiments && onOpenCondiments) {
                onOpenCondiments(item);
              } else {
                onAddToCart(item);
              }
            }}
            className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${
              isPaidOrder
                ? 'cursor-not-allowed bg-[var(--panel-border)] text-[var(--text-tertiary)]'
                : 'cursor-pointer bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:scale-95'
            }`}
            title={shouldTriggerCondiments ? 'Pilih Isian & Topping' : 'Tambah ke Keranjang'}
            aria-label={`${shouldTriggerCondiments ? 'Pilih isian dan topping untuk' : 'Tambah'} ${item.name}`}
          >
            <Plus className="h-3 w-3 stroke-[3]" />
            Tambah
          </button>
        </div>
      </div>
    </div>
  );
};

interface CashierViewProps {
  menuItems: MenuItem[];
  orders: Order[];
  tables: RestaurantTable[];
  activeUser: UserAccount;
  searchTerm: string;
  condimentGroups?: CondimentGroup[];
  onOpenCheckoutModal: (order: Partial<Order>) => void;
  onSaveHoldOrder: (order: Order) => void;
  onPrintPreBill: (order: Order) => void;
  onSelectExistingOrderToEdit: (order: Order) => void;
  onOpenTableModal?: () => void;
  currentBranch: Branch;
  currentShift: Shift;
  headerElement?: React.ReactNode;
  onOpenShiftTab?: () => void;
  confirmBeforeSaveOrder?: boolean;
  confirmBeforePayment?: boolean;
}

export const CashierView: React.FC<CashierViewProps> = ({
  menuItems,
  orders,
  tables,
  activeUser,
  searchTerm,
  condimentGroups,
  onOpenCheckoutModal,
  onSaveHoldOrder,
  onPrintPreBill,
  onSelectExistingOrderToEdit,
  onOpenTableModal,
  currentBranch,
  currentShift,
  headerElement,
  onOpenShiftTab,
  confirmBeforeSaveOrder = false,
  confirmBeforePayment = false
}) => {
  // Konfirmasi dua tahap; direset otomatis kalau kasir tidak jadi menekan.
  const [pendingConfirm, setPendingConfirm] = useState<'SAVE' | 'PAY' | null>(null);

  useEffect(() => {
    if (!pendingConfirm) return;
    const timer = window.setTimeout(() => setPendingConfirm(null), 4000);
    return () => window.clearTimeout(timer);
  }, [pendingConfirm]);

  // Top Table Panel State
  const [isTablePanelExpanded, setIsTablePanelExpanded] = useState<boolean>(true);
  const [tableFilter, setTableFilter] = useState<'ALL' | 'KOSONG' | 'TERISI'>('ALL');

  // State for POS Queue Tab
  const [queueTab, setQueueTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Active Order Builder State
  const [customerName, setCustomerName] = useState<string>('Guest');
  const [selectedTable, setSelectedTable] = useState<string>('-');
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountMode, setDiscountMode] = useState<'PERCENT' | 'IDR'>('PERCENT');
  const [currentEditingOrderId, setCurrentEditingOrderId] = useState<string | null>(null);

  // Condiment Selection Modal State
  const [activeItemForCondiment, setActiveItemForCondiment] = useState<MenuItem | null>(null);
  const [isCondimentModalOpen, setIsCondimentModalOpen] = useState<boolean>(false);
  const [manualItemSource, setManualItemSource] = useState<MenuItem | null>(null);
  const [manualItemDraft, setManualItemDraft] = useState({ name: '', price: '', notes: '' });

  const categories = [
    { id: 'ALL', label: 'SEMUA' },
    { id: 'BAKSO', label: 'BAKSO' },
    { id: 'MIE AYAM', label: 'MIE AYAM' },
    { id: 'MAKANAN', label: 'MAKANAN' },
    { id: 'TAMBAHAN', label: 'TAMBAHAN' },
    { id: 'KRIUK', label: 'KRIUK' },
    { id: 'MINUMAN', label: 'MINUMAN' },
    { id: 'BUNDLING', label: 'BUNDLING' }
  ];

  // Current loaded order check (for Paid / Read-Only handling)
  const currentEditingOrder = orders.find((o) => o.id === currentEditingOrderId);
  const isPaidOrder = currentEditingOrder?.paymentStatus === 'PAID' || currentEditingOrder?.status === 'COMPLETED';
  const isShiftActiveForCurrentContext = currentShift.status === 'OPEN';

  if (!isShiftActiveForCurrentContext) {
    return (
      <div className="flex-1 flex items-center justify-center select-none min-h-0"
        style={{ background: 'var(--surface-secondary)' }}>
        <p className="font-bold text-xs md:text-sm tracking-widest uppercase"
          style={{ color: 'var(--text-secondary)' }}>
          POS TERKUNCI – BUKA SHIFT DULU
        </p>
      </div>
    );
  }

  // Filtered Menu Items
  const filteredMenu = menuItems.filter((item) => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Cart Handlers
  const handleAddToCart = (item: MenuItem, selectedCondiments?: { groupName: string; options: string[] }[]) => {
    if (isPaidOrder) return;

    setCartItems((prevItems) => {
      const isSameCondiments = (a?: { groupName: string; options: string[] }[], b?: { groupName: string; options: string[] }[]) => {
        if (!a && !b) return true;
        if (!a || !b) return false;
        if (a.length !== b.length) return false;
        return a.every((cgA) => {
          const cgB = b.find((x) => x.groupName === cgA.groupName);
          if (!cgB) return false;
          if (cgA.options.length !== cgB.options.length) return false;
          return cgA.options.every((opt) => cgB.options.includes(opt));
        });
      };

      const existingIndex = prevItems.findIndex(
        (i) => i.menuId === item.id && isSameCondiments(i.selectedCondiments, selectedCondiments)
      );

      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1
        };
        return updated;
      }

      const newItem: OrderItem = {
        id: `cart-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        menuId: item.id,
        menuName: item.name,
        price: item.price,
        quantity: 1,
        category: item.category,
        selectedCondiments: selectedCondiments
      };
      return [...prevItems, newItem];
    });
  };

  const handleOpenCondimentModal = (item: MenuItem) => {
    if (isPaidOrder) return;
    setActiveItemForCondiment(item);
    setIsCondimentModalOpen(true);
  };

  const handleOpenManualItem = (item: MenuItem) => {
    if (isPaidOrder) return;
    setManualItemSource(item);
    setManualItemDraft({ name: '', price: '', notes: '' });
  };

  const handleConfirmManualItem = () => {
    if (!manualItemSource) return;
    const price = Math.round(Number(manualItemDraft.price));
    if (!manualItemDraft.name.trim() || !Number.isFinite(price) || price <= 0) return;
    setCartItems((current) => [...current, {
      id: `manual-${crypto.randomUUID()}`,
      menuId: manualItemSource.id,
      menuName: manualItemDraft.name.trim(),
      price,
      quantity: 1,
      category: manualItemSource.category,
      notes: manualItemDraft.notes.trim() || 'Item manual non-stok',
    }]);
    setManualItemSource(null);
  };

  const handleUpdateQuantity = (cartItemId: string, delta: number) => {
    if (isPaidOrder) return;
    setCartItems((prevItems) =>
      prevItems
        .map((item) => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    if (isPaidOrder) return;
    setCartItems((prevItems) => prevItems.filter((i) => i.id !== cartItemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setCustomerName('Guest');
    setSelectedTable('-');
    setDiscountValue(0);
    setDiscountMode('PERCENT');
    setCurrentEditingOrderId(null);
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Diskon tidak boleh melebihi subtotal, apa pun satuannya.
  const discountAmount = Math.min(
    subtotal,
    Math.max(0, discountMode === 'IDR' ? Math.round(discountValue) : Math.round((subtotal * discountValue) / 100))
  );
  const total = subtotal - discountAmount;

  const buildCurrentOrderDraft = (): Partial<Order> => {
    return {
      id: currentEditingOrderId || crypto.randomUUID(),
      orderNumber: currentEditingOrder ? currentEditingOrder.orderNumber : `#${Math.floor(100 + Math.random() * 900)}`,
      customerName: customerName.trim() || 'Guest',
      tableNumber: selectedTable !== '-' ? selectedTable : undefined,
      type: orderType,
      items: cartItems,
      subtotal,
      discount: discountAmount,
      total,
      status: currentEditingOrder ? currentEditingOrder.status : 'NEW',
      paymentStatus: currentEditingOrder ? currentEditingOrder.paymentStatus : 'UNPAID',
      createdAt: currentEditingOrder ? currentEditingOrder.createdAt : new Date().toISOString(),
      shiftId: currentEditingOrder?.shiftId || currentShift.id,
      branchId: currentEditingOrder?.branchId || currentBranch.id,
      cashierName: currentEditingOrder?.cashierName || activeUser.name,
      source: currentEditingOrder?.source || 'POS'
    };
  };

  const handleLoadExistingOrder = (order: Order) => {
    setCurrentEditingOrderId(order.id);
    setCustomerName(order.customerName);
    setSelectedTable(order.tableNumber || '-');
    setOrderType(order.type);
    // Order menyimpan diskon sebagai nominal. Mengubahnya kembali jadi persen
    // akan dibulatkan dan menggeser angkanya, jadi muat apa adanya dalam rupiah.
    setDiscountMode('IDR');
    setDiscountValue(order.discount || 0);
    setCartItems(order.items);
  };

  const activeOrdersList = orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
  // Antrean kasir hanya melayani shift berjalan; riwayat lintas hari ada di Laporan.
  const historyOrdersList = orders.filter(
    (o) => (o.status === 'COMPLETED' || o.status === 'CANCELLED') && o.shiftId === currentShift.id
  );

  return (
    <div className="flex h-full min-h-0 flex-1 select-none flex-col gap-2 overflow-y-auto bg-[var(--canvas-bg)] p-2 font-sans text-[var(--text-primary)] md:flex-row md:overflow-hidden">
      
      {/* LEFT + CENTER AREA WRAPPER */}
      <div className="flex min-h-[62vh] min-w-0 flex-1 flex-col gap-2 overflow-hidden md:h-full md:min-h-0">
        {/* Header Bar embedded at top of Left+Center area */}
        {headerElement}

        <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 gap-1.5 md:gap-2 overflow-hidden">
          {/* 1. LEFT PANEL: Queue & Active Orders */}
          <div className="flex h-full min-h-0 max-h-60 w-full shrink-0 flex-col overflow-hidden rounded-2xl border bg-[var(--surface-card)] md:max-h-none md:w-44 lg:w-48 xl:w-52"
            style={{ borderColor: 'var(--panel-border)', boxShadow: '0 2px 10px rgba(26,23,20,0.05)' }}>

            {/* Queue Header */}
            <div className="shrink-0 border-b px-3 py-2.5" style={{ borderColor: 'var(--panel-border-light)', background: 'var(--surface-secondary)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                    style={{ background: 'var(--primary)' }}>
                    Q
                  </div>
                  <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Antrean POS</span>
                </div>
                <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--accent-green)' }} />
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="shrink-0 border-b p-2" style={{ borderColor: 'var(--panel-border-light)' }}>
              <div className="flex items-center gap-1 rounded-full border p-0.5 text-[11px] font-bold"
                style={{ background: 'var(--surface-secondary)', borderColor: 'var(--panel-border)' }}>
                <button
                  onClick={() => setQueueTab('ACTIVE')}
                  className={`flex-1 rounded-full py-1.5 text-center transition-all ${
                    queueTab === 'ACTIVE'
                      ? 'bg-[var(--surface-card)] font-bold shadow-sm'
                      : 'hover:text-[var(--text-primary)]'
                  }`}
                  style={{ color: queueTab === 'ACTIVE' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  Aktif ({activeOrdersList.length})
                </button>
                <button
                  onClick={() => setQueueTab('HISTORY')}
                  className={`flex-1 rounded-full py-1.5 text-center transition-all ${
                    queueTab === 'HISTORY'
                      ? 'bg-[var(--surface-card)] font-bold shadow-sm'
                      : 'hover:text-[var(--text-primary)]'
                  }`}
                  style={{ color: queueTab === 'HISTORY' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  Shift ({historyOrdersList.length})
                </button>
              </div>
            </div>

            {/* Order Cards Scroll List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              {(queueTab === 'ACTIVE' ? activeOrdersList : historyOrdersList).length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-[11px] font-medium leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    {queueTab === 'ACTIVE'
                      ? 'Tidak ada order antrean'
                      : 'Belum ada order selesai di shift ini.'}
                  </p>
                </div>
              ) : (
                (queueTab === 'ACTIVE' ? activeOrdersList : historyOrdersList).map((order) => {
                  const isEditingThis = currentEditingOrderId === order.id;
                  const itemCount = order.items.reduce((a, b) => a + b.quantity, 0);
                  const isVoided = order.status === 'CANCELLED';
                  const orderIsPaid = order.paymentStatus === 'PAID' || order.status === 'COMPLETED';

                  return (
                    <div
                      key={order.id}
                      onClick={() => { if (!isVoided) handleLoadExistingOrder(order); }}
                      className={`rounded-xl border-l-[3px] border p-2 transition-all relative ${
                        isVoided
                          ? 'cursor-default opacity-70'
                          : isEditingThis
                            ? 'cursor-pointer shadow-sm'
                            : 'cursor-pointer hover:shadow-sm'
                      }`}
                      style={{
                        borderLeftColor: isVoided ? 'var(--text-tertiary)' : 'var(--primary-solid)',
                        borderColor: isEditingThis ? 'var(--primary)' : 'var(--panel-border)',
                        background: isEditingThis ? 'var(--primary-soft)' : isVoided ? 'var(--surface-secondary)' : 'var(--surface-card)',
                        boxShadow: isEditingThis ? '0 0 0 2px rgb(234 88 12 / 10%)' : undefined,
                      }}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="tabular-nums text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}
                          title={order.orderNumber}>
                          {formatOrderLabel(order)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <span className={`rounded-lg px-1.5 py-0.5 text-[10px] font-bold ${
                            isVoided ? 'bg-[var(--danger-soft)] text-[var(--accent-red)]'
                              : orderIsPaid ? 'bg-[var(--success-soft)] text-[var(--accent-green)]'
                              : 'bg-[var(--warning-soft)] text-[#8a5a00]'
                          }`}>
                            {isVoided ? 'VOID' : orderIsPaid ? 'PAID' : 'UNPAID'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-0.5 text-[11px]">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="truncate max-w-[80px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {order.customerName}
                          </span>
                          <span className="shrink-0 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            M:{order.tableNumber || '-'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-t pt-1" style={{ borderColor: 'var(--panel-border-light)' }}>
                          <span className="font-medium" style={{ color: 'var(--text-tertiary)' }}>{itemCount} menu</span>
                          <span className="tabular-nums font-bold" style={{ color: 'var(--text-primary)' }}>
                            Rp {order.total.toLocaleString('id-ID')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onPrintPreBill(order); }}
                          className="mt-1 flex items-center justify-center rounded-lg border p-1 transition-colors"
                          style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-border)', color: 'var(--primary-hover)' }}
                          title="Cetak Struk"
                          aria-label={`Cetak struk ${formatOrderLabel(order)}`}
                        >
                          <Printer className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. CENTER PANEL: Category Pills & Product Grid */}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-[var(--surface-card)] p-3"
            style={{ borderColor: 'var(--panel-border)', boxShadow: '0 2px 10px rgba(26,23,20,0.05)' }}>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 border-b border-[var(--panel-border-light)] scrollbar-none shrink-0">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-bold tracking-wide transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-[var(--surface-inverse)] text-white'
                        : 'border border-[var(--panel-border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary-text)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Product Catalog Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 p-0.5 content-start auto-rows-max scrollbar-thin">
              {filteredMenu.length === 0 ? (
                <div className="col-span-full py-16 text-center text-[var(--text-tertiary)] text-xs font-medium space-y-2">
                  <Utensils className="w-10 h-10 text-[var(--panel-border-strong)] mx-auto" />
                  <p>Menu tidak ditemukan</p>
                </div>
              ) : (
                filteredMenu.map((item) => {
                  const hasCondiments = (condimentGroups || []).some(
                    (g) => isGroupApplicable(g, item)
                  );

                  return (
                    <POSMenuItemCard
                      key={item.id}
                      item={item}
                      onAddToCart={item.isManualPrice ? handleOpenManualItem : handleAddToCart}
                      onOpenCondiments={item.isManualPrice ? undefined : handleOpenCondimentModal}
                      hasCondiments={!item.isManualPrice && hasCondiments}
                      isPaidOrder={isPaidOrder}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. RIGHT PANEL: ORDER CART */}
      <div className="flex min-h-[54vh] w-full shrink-0 flex-col overflow-hidden rounded-2xl border bg-[var(--surface-card)] md:h-full md:min-h-0 md:w-80 lg:w-[340px] xl:w-96"
        style={{ borderColor: 'var(--panel-border)', boxShadow: '0 4px 20px rgba(26,23,20,0.07)' }}>
        <div className="flex h-full flex-col overflow-hidden">

          {/* ── Cart Header ───────────────────────────────────── */}
          {/* Satu baris: nomor order, pilihan tipe, dan tombol kosongkan.
              Judul "Order Baru" dibuang — keranjang kosong sudah menyatakannya,
              dan barisnya dipakai untuk menambah ruang daftar belanja. */}
          <div className="shrink-0 border-b px-3 py-2" style={{ borderColor: 'var(--panel-border-light)' }}>
            <div className="flex items-center gap-2">
              {currentEditingOrder && (
                <span
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums"
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary-text)' }}
                  title={currentEditingOrder.orderNumber}
                >
                  {formatOrderLabel(currentEditingOrder)}
                </span>
              )}

              <div className="flex flex-1 items-center gap-0.5 rounded-full border p-0.5 text-[11px] font-bold"
                style={{ background: 'var(--surface-secondary)', borderColor: 'var(--panel-border)' }}>
                <button
                  type="button"
                  disabled={isPaidOrder}
                  onClick={() => setOrderType('DINE_IN')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1 transition-all ${
                    orderType === 'DINE_IN'
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text-secondary)]'
                  } ${isPaidOrder ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <Utensils className="h-3 w-3" />
                  Dine In
                </button>
                <button
                  type="button"
                  disabled={isPaidOrder}
                  onClick={() => setOrderType('TAKE_AWAY')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1 transition-all ${
                    orderType === 'TAKE_AWAY'
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text-secondary)]'
                  } ${isPaidOrder ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <ShoppingBag className="h-3 w-3" />
                  Take Away
                </button>
              </div>

              <button
                onClick={handleClearCart}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors"
                style={{ borderColor: 'var(--panel-border)', color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                title={isPaidOrder ? 'Tutup View Order' : 'Kosongkan keranjang'}
                aria-label={isPaidOrder ? 'Tutup tampilan order' : 'Kosongkan keranjang'}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Status banners ────────────────────────────────── */}
          {isPaidOrder && (
            <div className="mx-4 mt-3 shrink-0 flex items-center justify-between rounded-xl border px-3 py-2"
              style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-border)', color: 'var(--primary-text)' }}>
              <div className="flex items-center gap-1.5 text-[12px] font-bold">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--primary-hover)' }} />
                LUNAS (PAID)
              </div>
              <span className="rounded-lg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'var(--brand-100)', color: 'var(--primary-pressed)' }}>
                DIKUNCI
              </span>
            </div>
          )}

          {!isShiftActiveForCurrentContext && (
            <div className="mx-4 mt-3 shrink-0 rounded-xl border px-3 py-2"
              style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-border)', color: 'var(--primary-pressed)' }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]">Shift wajib aktif</p>
              <p className="mt-0.5 text-[11px] font-medium leading-relaxed">
                Buka shift untuk outlet {currentBranch.name} sebelum menyimpan order.
              </p>
            </div>
          )}

          {/* Label "Nama" dan "Meja" dibuang: placeholder sudah menjelaskan
              isinya, dan dua baris label itu memakan ruang daftar belanja. */}
          <div className="shrink-0 grid grid-cols-3 gap-2 px-3 pt-2">
            <input
              type="text"
              disabled={isPaidOrder}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              aria-label="Nama pelanggan"
              className={`col-span-2 w-full rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold outline-none transition-all ${
                isPaidOrder
                  ? 'cursor-not-allowed text-[var(--text-tertiary)]'
                  : 'focus:ring-2 focus:ring-[var(--primary)]/10'
              }`}
              style={{
                background: 'var(--surface-secondary)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-primary)',
              }}
              placeholder="Nama pelanggan"
            />
            <select
              disabled={isPaidOrder}
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              aria-label="Nomor meja"
              className={`w-full rounded-lg border px-2 py-1.5 text-[12px] font-semibold outline-none transition-all ${
                isPaidOrder
                  ? 'cursor-not-allowed text-[var(--text-tertiary)]'
                  : 'cursor-pointer focus:ring-2 focus:ring-[var(--primary)]/10'
              }`}
              style={{
                background: 'var(--surface-secondary)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="-">Meja</option>
              {tables.map((t) => (
                <option key={t.id} value={t.number}>{t.number}</option>
              ))}
            </select>
          </div>

          {/* ── Cart Items ────────────────────────────────────── */}
          <div className="mx-3 mt-2 flex-1 min-h-0 overflow-y-auto space-y-1 scrollbar-thin border-t pt-1.5"
            style={{ borderColor: 'var(--panel-border-light)' }}>
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border"
                  style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-border)', color: 'var(--primary-hover)' }}>
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Keranjang Kosong</p>
                <p className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Pilih menu di sebelah kiri</p>
              </div>
            ) : (
              cartItems.map((item) => (
                /* Susunan referensi: nama di kiri dengan harga oranye di
                   bawahnya, stepper di kanan — tanpa kotak berlatar. */
                <div key={item.id} className="border-b pb-2" style={{ borderColor: 'var(--panel-border-light)' }}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {item.menuName}
                      </p>
                      <p className="tabular-nums text-[11px] font-bold" style={{ color: 'var(--primary)' }}>
                        Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                        {item.quantity > 1 && (
                          <span className="ml-1 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                            ({item.quantity}×)
                          </span>
                        )}
                      </p>
                    </div>

                    {!isPaidOrder && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg border transition-colors"
                          style={{ borderColor: 'var(--panel-border)', color: 'var(--text-secondary)' }}
                          aria-label={`Kurangi ${item.menuName}`}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-[18px] text-center text-[12px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg transition-all"
                          style={{ background: 'var(--primary)', color: '#fff' }}
                          aria-label={`Tambah ${item.menuName}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {item.notes && (
                    <p className="mt-0.5 text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>📝 {item.notes}</p>
                  )}
                  {item.selectedCondiments && item.selectedCondiments.length > 0 && (
                    <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      {item.selectedCondiments.flatMap((g) => g.options).join(', ')}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* ── Summary + Checkout Footer ─────────────────────── */}
          <div className="shrink-0 border-t px-4 pb-4 pt-3 space-y-3 mt-auto"
            style={{ borderColor: 'var(--panel-border-light)' }}>

            {/* Discount row */}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                disabled={isPaidOrder}
                min="0"
                max={discountMode === 'PERCENT' ? 100 : undefined}
                placeholder={discountMode === 'PERCENT' ? 'Diskon %' : 'Diskon Rp'}
                value={discountValue || ''}
                onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                className={`w-full rounded-xl border px-3 py-2 text-[12px] font-semibold outline-none transition-all ${
                  isPaidOrder ? 'cursor-not-allowed' : ''
                }`}
                style={{
                  background: 'var(--surface-secondary)',
                  borderColor: 'var(--panel-border)',
                  color: isPaidOrder ? 'var(--text-tertiary)' : 'var(--text-primary)',
                }}
              />
              <select
                disabled={isPaidOrder}
                value={discountMode}
                onChange={(e) => setDiscountMode(e.target.value as 'PERCENT' | 'IDR')}
                aria-label="Satuan diskon"
                className={`w-full rounded-xl border px-2 py-2 text-[12px] font-semibold outline-none transition-all ${
                  isPaidOrder ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  background: 'var(--surface-secondary)',
                  borderColor: 'var(--panel-border)',
                  color: isPaidOrder ? 'var(--text-tertiary)' : 'var(--text-primary)',
                }}
              >
                <option value="PERCENT">Persen (%)</option>
                <option value="IDR">Rupiah (Rp)</option>
              </select>
            </div>

            {/* Totals */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>Subtotal</span>
                <span className="tabular-nums text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Rp {subtotal.toLocaleString('id-ID')}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>Diskon</span>
                  <span className="tabular-nums text-[13px] font-semibold" style={{ color: 'var(--accent-red)' }}>
                    − Rp {discountAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {/* Total — big and prominent */}
              <div className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-border)' }}>
                <span className="text-[13px] font-bold" style={{ color: 'var(--primary-text)' }}>Total</span>
                <span className="tabular-nums text-[20px] font-extrabold" style={{ color: 'var(--primary-solid)' }}>
                  Rp {total.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            {isPaidOrder ? (
              <div className="grid grid-cols-[auto_1fr] gap-1.5">
                <button
                  onClick={() => onPrintPreBill(currentEditingOrder || (buildCurrentOrderDraft() as Order))}
                  className="ui-button ui-button-soft px-2.5"
                  style={{ minHeight: '34px' }}
                  title="Cetak struk lunas"
                  aria-label="Cetak struk lunas"
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (currentEditingOrder && currentEditingOrder.status !== 'COMPLETED') {
                      onSaveHoldOrder({ ...currentEditingOrder, status: 'COMPLETED' });
                    }
                    handleClearCart();
                  }}
                  className="ui-button ui-button-primary w-full gap-1 px-2"
                  style={{ minHeight: '34px', fontSize: '12px' }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Selesai Order
                </button>
              </div>
            ) : (
              /* Tiga aksi dirapatkan ke satu baris supaya sisa tinggi panel
                 jatuh ke daftar belanja, bukan ke tombol. */
              <div className="grid grid-cols-[auto_1fr_1.2fr] gap-1.5">
                <button
                  disabled={cartItems.length === 0}
                  onClick={() => onPrintPreBill(buildCurrentOrderDraft() as Order)}
                  className="ui-button ui-button-secondary px-2.5"
                  style={{ minHeight: '34px' }}
                  title="Cetak tagihan"
                  aria-label="Cetak tagihan"
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>

                <button
                  disabled={cartItems.length === 0 || !isShiftActiveForCurrentContext}
                  onClick={() => {
                    if (confirmBeforeSaveOrder && pendingConfirm !== 'SAVE') { setPendingConfirm('SAVE'); return; }
                    setPendingConfirm(null);
                    const draft = buildCurrentOrderDraft() as Order;
                    onSaveHoldOrder(draft);
                    handleClearCart();
                  }}
                  className={`ui-button w-full gap-1 px-2 ${pendingConfirm === 'SAVE' ? 'ui-button-primary' : 'ui-button-secondary'}`}
                  style={{ minHeight: '34px', fontSize: '12px' }}
                >
                  {pendingConfirm === 'SAVE'
                    ? <><CheckCircle2 className="h-3.5 w-3.5" />Yakin?</>
                    : <><Save className="h-3.5 w-3.5" />Simpan</>}
                </button>

                <button
                  disabled={cartItems.length === 0 || !isShiftActiveForCurrentContext}
                  onClick={() => {
                    if (confirmBeforePayment && pendingConfirm !== 'PAY') { setPendingConfirm('PAY'); return; }
                    setPendingConfirm(null);
                    onOpenCheckoutModal(buildCurrentOrderDraft());
                  }}
                  className="ui-button ui-button-primary w-full gap-1 px-2"
                  style={{ minHeight: '34px', fontSize: '12px' }}
                >
                  {pendingConfirm === 'PAY'
                    ? <><CheckCircle2 className="h-3.5 w-3.5" />Yakin?</>
                    : <><CreditCard className="h-3.5 w-3.5" />Bayar</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Condiment / Topping Selection Modal */}
      <CondimentSelectionModal
        isOpen={isCondimentModalOpen}
        onClose={() => {
          setIsCondimentModalOpen(false);
          setActiveItemForCondiment(null);
        }}
        menuItem={activeItemForCondiment}
        condimentGroups={condimentGroups || []}
        onConfirm={(menuItem, selectedCondiments, notes, extraPrice) => {
          setCartItems((prev) => [
            ...prev,
            {
              id: 'cart-' + Date.now() + Math.random().toString(36).substring(2, 4),
              menuId: menuItem.id,
              menuName: menuItem.name,
              price: menuItem.price + extraPrice,
              quantity: 1,
              category: menuItem.category,
              notes: notes || undefined,
              selectedCondiments: selectedCondiments.length > 0 ? selectedCondiments : undefined
            }
          ]);
        }}
      />

      {manualItemSource && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: 'rgba(24,24,27,0.35)' }}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-2xl"
            style={{ borderColor: 'var(--panel-border)' }}>
            <div className="flex items-center justify-between px-5 py-4 text-white"
              style={{ background: 'var(--primary)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">Item manual non-stok</p>
                <h3 className="text-[16px] font-bold">Tambah Item Lainnya</h3>
              </div>
              <button type="button" onClick={() => setManualItemSource(null)}
                className="rounded-full p-2 transition-colors hover:bg-white/20">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="ui-form-group">
                <span className="ui-form-label">Nama item / penjualan</span>
                <input autoFocus value={manualItemDraft.name}
                  onChange={(e) => setManualItemDraft({ ...manualItemDraft, name: e.target.value })}
                  placeholder="Contoh: Alpukat tambahan"
                  className="ui-input" />
              </label>
              <label className="ui-form-group">
                <span className="ui-form-label">Harga jual</span>
                <input type="number" min="1" inputMode="numeric" value={manualItemDraft.price}
                  onChange={(e) => setManualItemDraft({ ...manualItemDraft, price: e.target.value })}
                  placeholder="Rp 0"
                  className="ui-input" />
              </label>
              <label className="ui-form-group">
                <span className="ui-form-label">Keterangan <span className="normal-case font-normal" style={{ color: 'var(--text-tertiary)' }}>(opsional)</span></span>
                <textarea value={manualItemDraft.notes}
                  onChange={(e) => setManualItemDraft({ ...manualItemDraft, notes: e.target.value })}
                  placeholder="Catatan untuk struk / dapur"
                  className="ui-input resize-none"
                  style={{ minHeight: '80px', paddingTop: '10px', paddingBottom: '10px' }} />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t p-4"
              style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)' }}>
              <button type="button" onClick={() => setManualItemSource(null)}
                className="ui-button ui-button-secondary">
                Batal
              </button>
              <button type="button"
                disabled={!manualItemDraft.name.trim() || Number(manualItemDraft.price) <= 0}
                onClick={handleConfirmManualItem}
                className="ui-button ui-button-primary">
                Tambah ke Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
