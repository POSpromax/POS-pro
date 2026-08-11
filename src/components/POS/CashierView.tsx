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
        return { bg: 'from-[var(--primary-solid)] to-[var(--primary-light)]', icon: '🍲' };
      case 'MIE AYAM':
        return { bg: 'from-[var(--primary-solid)] to-[var(--primary-light)]', icon: '🍜' };
      case 'MAKANAN':
        return { bg: 'from-[var(--primary-solid)] to-red-500', icon: '🍱' };
      case 'TAMBAHAN':
        return { bg: 'from-neutral-500 to-neutral-700', icon: '🥟' };
      case 'KRIUK':
        return { bg: 'from-[var(--primary-solid)] to-[var(--primary-light)]', icon: '🥨' };
      case 'MINUMAN':
        return { bg: 'from-neutral-500 to-neutral-700', icon: '🥤' };
      case 'BUNDLING':
        return { bg: 'from-[var(--primary-solid)] to-[var(--primary-light)]', icon: '🎁' };
      default:
        return { bg: 'from-slate-600 to-slate-800', icon: '🍽️' };
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
      className={`bg-[var(--surface-card)] rounded-xl border transition-all duration-200 p-2.5 flex flex-col justify-between group overflow-hidden relative select-none h-full ${
        isPaidOrder
          ? 'opacity-60 cursor-not-allowed border-[var(--panel-border)]'
          : 'border-[var(--panel-border)] hover:border-[var(--primary-border)] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(234,88,12,0.10)]'
      }`}
      style={{ boxShadow: '0 2px 8px rgba(26,23,20,0.045)' }}
    >
      <div className="relative -mx-2.5 -mt-2.5 mb-2.5 flex h-24 shrink-0 items-center justify-center overflow-hidden bg-[var(--surface-secondary)] sm:h-28 lg:h-32">
        {item.image && !imgError ? (
          <img
            src={optimizeCloudinaryImage(item.image, 520)}
            alt={item.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${theme.bg} flex flex-col items-center justify-center text-white p-2 text-center`}>
            <span className="text-2xl mb-0.5">{theme.icon}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90 line-clamp-1">{item.category}</span>
          </div>
        )}

        <span className="absolute top-1.5 left-1.5 bg-white/92 text-[var(--text-secondary)] text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-lg backdrop-blur-sm border border-white/70 tracking-wider">
          {item.category}
        </span>

        <span className="absolute top-1.5 right-1.5 bg-white/90 text-[var(--text-primary)] text-[11px] font-bold px-1.5 py-0.5 rounded-lg backdrop-blur-sm border border-white/50">
          {item.stockCount !== undefined ? item.stockCount : '∞'}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-between gap-1.5">
        <h3 className="font-extrabold text-sm text-[var(--text-primary)] line-clamp-2 leading-tight tracking-tight transition-colors">
          {item.name}
        </h3>

        <div className="flex items-center justify-between pt-1.5 border-t border-[var(--panel-border-light)] shrink-0">
          <span className="font-bold text-xs sm:text-sm text-[var(--text-primary)] tracking-tight tabular-nums">
            Rp {item.price.toLocaleString('id-ID')}
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
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 cursor-pointer ${
              isPaidOrder
                ? 'bg-[var(--panel-border)] text-[var(--text-tertiary)] cursor-not-allowed'
                : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-95 text-white shadow-[0_5px_12px_rgba(234,88,12,0.22)]'
            }`}
            title={shouldTriggerCondiments ? 'Pilih Isian & Topping' : 'Tambah ke Keranjang'}
            aria-label={`${shouldTriggerCondiments ? 'Pilih isian dan topping untuk' : 'Tambah'} ${item.name}`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
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
      <div className="flex-1 bg-[#F1F5FA] flex items-center justify-center font-sans select-none text-slate-700 min-h-0">
        <p className="font-bold text-xs md:text-sm tracking-widest text-[var(--text-secondary)] uppercase">
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
          <div className="flex h-full min-h-0 max-h-60 w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white p-2 shadow-[0_2px_10px_rgba(26,23,20,0.05)] md:max-h-none md:w-44 lg:w-48 xl:w-52">

            {/* Queue Header */}
            <div className="flex items-center justify-between bg-[var(--surface-secondary)] p-1.5 rounded-lg mb-1.5 border border-[var(--panel-border)]">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-bold text-[10px]">
                  Q
                </div>
                <span className="text-[11px] font-bold text-[var(--text-primary)]">Antrean POS</span>
              </div>
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#22A96B]" />
            </div>

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 bg-[var(--surface-secondary)] p-0.5 rounded-lg mb-1.5 text-[10px] font-semibold border border-[var(--panel-border)]">
              <button
                onClick={() => setQueueTab('ACTIVE')}
                className={`py-1 rounded-lg transition-all ${
                  queueTab === 'ACTIVE'
                    ? 'bg-white text-[var(--primary-hover)] font-bold shadow-sm ring-1 ring-[var(--primary-border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Aktif ({activeOrdersList.length})
              </button>
              <button
                onClick={() => setQueueTab('HISTORY')}
                className={`py-1 rounded-lg transition-all ${
                  queueTab === 'HISTORY'
                    ? 'bg-white text-[var(--primary-hover)] font-bold shadow-sm ring-1 ring-[var(--primary-border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Shift Ini ({historyOrdersList.length})
              </button>
            </div>

            {/* Order Cards Scroll List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
              {(queueTab === 'ACTIVE' ? activeOrdersList : historyOrdersList).length === 0 ? (
                <div className="py-12 px-3 text-center text-[var(--text-tertiary)] text-xs font-medium leading-relaxed">
                  {queueTab === 'ACTIVE'
                    ? 'Tidak ada order antrean'
                    : 'Belum ada order selesai di shift ini. Riwayat per tanggal, minggu, atau bulan ada di menu Laporan.'}
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
                      // Order batal hanya untuk dilihat; memuatnya ke keranjang
                      // berisiko tertagih ulang.
                      onClick={() => { if (!isVoided) handleLoadExistingOrder(order); }}
                      className={`p-2 rounded-lg border border-l-[3px] transition-all relative ${
                        isVoided
                          ? 'bg-[var(--surface-main)] border-[var(--panel-border)] border-l-[var(--text-tertiary)] opacity-75 cursor-default'
                          : isEditingThis
                            ? 'bg-[var(--primary-soft)] border-[var(--primary)] border-l-[var(--primary-solid)] ring-2 ring-[var(--primary)]/10 shadow-sm cursor-pointer'
                            : 'bg-white border-[var(--panel-border)] border-l-[var(--primary-solid)] hover:border-[var(--primary-border)] hover:bg-[#F2F6FF] hover:shadow-sm cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="font-bold text-sm text-[var(--primary-hover)] tracking-tight tabular-nums"
                          title={order.orderNumber}
                        >
                          {formatOrderLabel(order)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${
                            isVoided
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : orderIsPaid ? 'bg-[#EAF8F1] text-[#168253]' : 'bg-[var(--primary-soft)] text-[var(--primary-hover)]'
                          }`}>
                            {isVoided ? 'VOID' : orderIsPaid ? 'PAID' : 'UNPAID'}
                          </span>
                          <span className="text-[10px] bg-[var(--primary)] text-white font-semibold px-1.5 py-0.5 rounded-lg">
                            {order.type === 'DINE_IN' ? 'DINE IN' : 'TAKE AWAY'}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] space-y-0.5">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-bold text-[11px] text-[var(--text-primary)] truncate max-w-[90px]">
                            {order.customerName}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)] font-bold whitespace-nowrap">Meja: {order.tableNumber || '-'}</span>
                        </div>

                        <div className="pt-0.5 flex items-center justify-between border-t border-[var(--panel-border-light)]">
                          <span className="font-medium text-[var(--text-tertiary)] text-[10px]">{itemCount} menu</span>
                          <span className="font-bold text-[11px] text-[var(--text-primary)]">
                            Rp {order.total.toLocaleString('id-ID')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPrintPreBill(order);
                          }}
                          className="mt-1 p-1 text-[var(--primary-hover)] bg-[var(--primary-soft)] hover:bg-[#E6EEFF] rounded-lg border border-[var(--primary-border)] transition-all self-end"
                          title="Cetak Struk"
                          aria-label={`Cetak struk ${formatOrderLabel(order)}`}
                        >
                          <Printer className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. CENTER PANEL: Category Pills & Product Grid */}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white p-2 shadow-[0_2px_10px_rgba(26,23,20,0.05)] md:p-2.5">

            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 border-b border-[var(--panel-border-light)] scrollbar-none shrink-0">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`min-h-11 min-w-[94px] cursor-pointer whitespace-nowrap rounded-xl px-3 py-2 text-left text-[11px] font-semibold transition-all ${
                      isSelected
                        ? cat.id === 'ALL'
                          ? 'bg-[var(--primary)] text-white shadow-sm'
                          : 'bg-[var(--primary)] text-white shadow-sm'
                        : 'bg-white hover:bg-[#F2F6FF] text-[var(--text-secondary)] border border-[var(--panel-border)] hover:border-[var(--primary-border)]'
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
                  <Utensils className="w-10 h-10 text-[#CDD3DA] mx-auto" />
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
      <div className="flex min-h-[54vh] w-full shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white p-3 shadow-[0_3px_16px_rgba(26,23,20,0.06)] md:h-full md:min-h-0 md:w-80 md:p-3.5 lg:w-88 xl:w-96">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--panel-border-light)] shrink-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-xs text-[var(--text-primary)]">
                Ringkasan Order
              </h3>
              {currentEditingOrder && (
                <span
                  className="text-[11px] font-bold text-[var(--primary-hover)] bg-[var(--primary-soft)] px-1.5 py-0.5 rounded-lg border border-[var(--primary-border)] tabular-nums"
                  title={currentEditingOrder.orderNumber}
                >
                  {formatOrderLabel(currentEditingOrder)}
                </span>
              )}

            </div>

            <div className="flex items-center gap-1">
              <div className="flex items-center bg-[var(--surface-secondary)] border border-[var(--panel-border)] p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  type="button"
                  disabled={isPaidOrder}
                  onClick={() => setOrderType('DINE_IN')}
                  className={`px-2 py-0.5 rounded-lg transition-all flex items-center gap-1 ${
                    orderType === 'DINE_IN' ? 'bg-[var(--primary)] text-white font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  } ${isPaidOrder ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Utensils className="w-3 h-3" />
                  <span>Makan di Tempat</span>
                </button>
                <button
                  type="button"
                  disabled={isPaidOrder}
                  onClick={() => setOrderType('TAKE_AWAY')}
                  className={`px-2 py-0.5 rounded-lg transition-all flex items-center gap-1 ${
                    orderType === 'TAKE_AWAY' ? 'bg-[var(--primary)] text-white font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  } ${isPaidOrder ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>Bawa Pulang</span>
                </button>
              </div>

              <button
                onClick={handleClearCart}
                className="p-1 text-[var(--text-tertiary)] hover:text-[#E5484D] transition-colors"
                title={isPaidOrder ? 'Tutup View Order' : 'Kosongkan'}
                aria-label={isPaidOrder ? 'Tutup tampilan order' : 'Kosongkan keranjang'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isPaidOrder && (
            <div className="bg-[var(--primary-soft)] border border-[#F2B59B] rounded-lg p-2 mb-2 flex items-center justify-between text-[#B83C0F] shrink-0">
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--primary-hover)] shrink-0" />
                <span>LUNAS (PAID)</span>
              </div>
              <span className="text-[10px] font-semibold bg-[#FFE9DE] text-[#A8370C] px-1.5 py-0.5 rounded-lg uppercase tracking-wider">
                DIKUNCI
              </span>
            </div>
          )}

          {!isShiftActiveForCurrentContext && (
            <div className="mb-2 rounded-xl border border-[#F2C9B6] bg-[var(--primary-soft)] p-3 text-[#A53A12] shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]">Shift wajib aktif</p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed">
                Buka shift untuk outlet {currentBranch.name} sebelum menyimpan order atau menerima pembayaran.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5 mb-2 shrink-0">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-[#6B6B6B] uppercase block mb-1 tracking-wider">
                NAMA
              </label>
              <input
                type="text"
                disabled={isPaidOrder}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full border rounded-lg px-2.5 py-1.5 text-sm font-bold text-[var(--text-primary)] outline-none ${
                  isPaidOrder ? 'bg-[var(--surface-main)] border-[var(--panel-border)] text-[var(--text-tertiary)] cursor-not-allowed' : 'bg-[var(--surface-secondary)] border-[var(--panel-border)] focus:border-[var(--brand-300)] focus:bg-white focus:ring-2 focus:ring-[var(--primary)]/10'
                }`}
                placeholder="Nama pelanggan"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#6B6B6B] uppercase block mb-1 tracking-wider">
                MEJA
              </label>
              <select
                disabled={isPaidOrder}
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className={`w-full border rounded-lg px-2 py-1.5 text-sm font-bold text-[var(--text-primary)] outline-none ${
                  isPaidOrder ? 'bg-[var(--surface-main)] border-[var(--panel-border)] text-[var(--text-tertiary)] cursor-not-allowed' : 'bg-[var(--surface-secondary)] border-[var(--panel-border)] focus:border-[var(--brand-300)] focus:bg-white focus:ring-2 focus:ring-[var(--primary)]/10 cursor-pointer'
                }`}
              >
                <option value="-">Pilih meja</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.number}>
                    {t.number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5 border-t border-[var(--panel-border-light)] pt-2 scrollbar-thin">
            {cartItems.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-11 h-11 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary-border)] flex items-center justify-center mx-auto text-[var(--primary-hover)]">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Keranjang Kosong</p>
                <p className="text-[11px] text-[var(--text-tertiary)] font-medium">Pilih menu di sebelah kiri</p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-lg bg-[var(--surface-main)] border border-[var(--panel-border)] space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-[var(--text-primary)] leading-snug">
                      {item.menuName}
                    </span>
                    <span className="font-bold text-xs text-[var(--text-primary)] shrink-0">
                      Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                      Rp {item.price.toLocaleString('id-ID')} x {item.quantity}
                    </span>

                    {!isPaidOrder && (
                      <div className="flex items-center gap-0.5 bg-white border border-[var(--panel-border)] rounded-lg p-0.5">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-5 h-5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[#E6EEFF] text-[var(--text-secondary)] flex items-center justify-center transition-colors"
                          aria-label={`Kurangi ${item.menuName}`}
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="font-bold text-[11px] px-1.5 text-[var(--text-primary)]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-5 h-5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white flex items-center justify-center transition-all"
                          aria-label={`Tambah ${item.menuName}`}
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2.5 border-t border-[var(--panel-border-light)] shrink-0 space-y-2 mt-auto">
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <input
                type="number"
                disabled={isPaidOrder}
                min="0"
                max={discountMode === 'PERCENT' ? 100 : undefined}
                placeholder={discountMode === 'PERCENT' ? 'Diskon %' : 'Diskon Rp'}
                value={discountValue || ''}
                onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none ${
                  isPaidOrder ? 'bg-[var(--surface-main)] border-[var(--panel-border)] text-[var(--text-tertiary)] cursor-not-allowed' : 'bg-[var(--surface-secondary)] border-[var(--panel-border)] text-[var(--text-primary)] focus:border-[var(--brand-300)] focus:bg-white'
                }`}
              />
              <select
                disabled={isPaidOrder}
                value={discountMode}
                onChange={(e) => setDiscountMode(e.target.value as 'PERCENT' | 'IDR')}
                aria-label="Satuan diskon"
                className={`w-full border rounded-lg px-2 py-1.5 text-xs font-semibold outline-none ${
                  isPaidOrder ? 'bg-[var(--surface-main)] border-[var(--panel-border)] text-[var(--text-tertiary)] cursor-not-allowed' : 'bg-[var(--surface-secondary)] border-[var(--panel-border)] text-[var(--text-primary)] focus:border-[var(--brand-300)] focus:bg-white cursor-pointer'
                }`}
              >
                <option value="PERCENT">Persen (%)</option>
                <option value="IDR">Rupiah (Rp)</option>
              </select>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-[var(--text-tertiary)] uppercase tracking-wider text-[10px]">
                <span>SUBTOTAL</span>
                <span className="text-[var(--text-primary)] font-semibold text-xs">
                  Rp {subtotal.toLocaleString('id-ID')}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-[var(--text-tertiary)] uppercase tracking-wider text-[10px]">
                  <span>DISCOUNT</span>
                  <span className="text-rose-500 font-semibold text-xs">
                    - Rp {discountAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-[var(--text-primary)] pt-0.5">
                <span>TOTAL</span>
                <span className="text-base font-bold text-[var(--primary-hover)]">
                  Rp {total.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {isPaidOrder ? (
                <div className="space-y-2">
                  <button
                    onClick={() => onPrintPreBill(currentEditingOrder || (buildCurrentOrderDraft() as Order))}
                    className="w-full py-2.5 bg-[var(--brand-50)] hover:bg-[var(--brand-100)] text-[var(--primary-hover)] font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-[var(--brand-200)]"
                  >
                    <Printer className="w-3.5 h-3.5" /> CETAK STRUK LUNAS
                  </button>
                  <button
                    onClick={() => {
                      if (currentEditingOrder && currentEditingOrder.status !== 'COMPLETED') {
                        onSaveHoldOrder({ ...currentEditingOrder, status: 'COMPLETED' });
                      }
                      handleClearCart();
                    }}
                    className="w-full py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-pressed)] active:scale-95 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                    style={{ boxShadow: '0 2px 8px rgba(234,88,12,0.18)' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> SELESAI ORDER
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    disabled={cartItems.length === 0}
                    onClick={() => onPrintPreBill(buildCurrentOrderDraft() as Order)}
                    className="w-full py-2 bg-white hover:bg-[var(--surface-card)] text-[var(--text-secondary)] font-semibold text-xs rounded-xl border border-[var(--panel-border-strong)] flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> CETAK TAGIHAN
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={cartItems.length === 0 || !isShiftActiveForCurrentContext}
                      onClick={() => {
                        if (confirmBeforeSaveOrder && pendingConfirm !== 'SAVE') {
                          setPendingConfirm('SAVE');
                          return;
                        }
                        setPendingConfirm(null);
                        const draft = buildCurrentOrderDraft() as Order;
                        onSaveHoldOrder(draft);
                        handleClearCart();
                      }}
                      className={`py-2.5 border disabled:opacity-40 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        pendingConfirm === 'SAVE'
                          ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                          : 'bg-white border-[var(--panel-border)] hover:bg-[var(--surface-main)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {pendingConfirm === 'SAVE' ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> YAKIN SIMPAN?</>
                      ) : (
                        <><Save className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> SIMPAN</>
                      )}
                    </button>

                    <button
                      disabled={cartItems.length === 0 || !isShiftActiveForCurrentContext}
                      onClick={() => {
                        if (confirmBeforePayment && pendingConfirm !== 'PAY') {
                          setPendingConfirm('PAY');
                          return;
                        }
                        setPendingConfirm(null);
                        onOpenCheckoutModal(buildCurrentOrderDraft());
                      }}
                      className={`py-2.5 active:scale-95 disabled:opacity-40 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        pendingConfirm === 'PAY'
                          ? 'bg-[var(--primary)]'
                          : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]'
                      }`}
                      style={{ boxShadow: '0 2px 8px rgba(234,88,12,0.25)' }}
                    >
                      {pendingConfirm === 'PAY' ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> YAKIN BAYAR?</>
                      ) : (
                        <><CreditCard className="w-3.5 h-3.5" /> BAYAR</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-600/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white shadow-xl">
            <div className="flex items-center justify-between bg-[var(--primary)] px-5 py-4 text-white">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--primary-text)]">Item manual non-stok</p><h3 className="text-lg font-bold">Lainnya</h3></div>
              <button type="button" onClick={() => setManualItemSource(null)} className="rounded-full bg-white/10 p-2 hover:bg-white/20"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Nama item / penjualan<input autoFocus value={manualItemDraft.name} onChange={(event) => setManualItemDraft({ ...manualItemDraft, name: event.target.value })} placeholder="Contoh: Alpukat tambahan" className="mt-1.5 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-main)] p-3 text-sm font-bold text-slate-900 outline-none focus:border-[var(--primary)] focus:bg-white" /></label>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Harga jual<input type="number" min="1" inputMode="numeric" value={manualItemDraft.price} onChange={(event) => setManualItemDraft({ ...manualItemDraft, price: event.target.value })} placeholder="Rp 0" className="mt-1.5 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-main)] p-3 text-sm font-bold text-slate-900 outline-none focus:border-[var(--primary)] focus:bg-white" /></label>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Keterangan <span className="normal-case text-slate-400">(opsional)</span><textarea value={manualItemDraft.notes} onChange={(event) => setManualItemDraft({ ...manualItemDraft, notes: event.target.value })} placeholder="Catatan untuk struk / dapur" className="mt-1.5 min-h-20 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-main)] p-3 text-xs font-semibold text-slate-900 outline-none focus:border-[var(--primary)] focus:bg-white" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--panel-border)] bg-[var(--surface-card)] p-4"><button type="button" onClick={() => setManualItemSource(null)} className="rounded-xl border border-[var(--panel-border)] bg-white px-4 py-2.5 text-xs font-bold text-slate-600">BATAL</button><button type="button" disabled={!manualItemDraft.name.trim() || Number(manualItemDraft.price) <= 0} onClick={handleConfirmManualItem} className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40">TAMBAH KE ORDER</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
