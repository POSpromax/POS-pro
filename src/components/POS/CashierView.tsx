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
  Grid2X2,
  FileText,
  MoreVertical,
  Percent,
  Bookmark,
  MessageSquare,
  Smartphone,
  Ban
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

// Cart Consolidation Helper — Automatically merges identical products into a single row with combined quantity (e.g. 2x, 3x)
const consolidateCartItems = (items: OrderItem[]): OrderItem[] => {
  if (!items || items.length === 0) return [];
  const map = new Map<string, OrderItem>();

  for (const item of items) {
    const key = item.menuId ? String(item.menuId) : item.menuName;
    const existing = map.get(key);

    if (existing) {
      map.set(key, {
        ...existing,
        quantity: existing.quantity + (item.quantity || 1),
        notes: item.notes || existing.notes
      });
    } else {
      map.set(key, {
        ...item,
        quantity: item.quantity || 1
      });
    }
  }
  return Array.from(map.values());
};

// Ultra-Compact & Zoomed Emerald Green POS Menu Item Card Component
const POSMenuItemCard: React.FC<{
  item: MenuItem;
  isSelectedInCart?: boolean;
  onAddToCart: (item: MenuItem) => void;
  onOpenCondiments?: (item: MenuItem) => void;
  hasCondiments?: boolean;
  isPaidOrder?: boolean;
  onUnlockNewOrder?: () => void;
}> = ({
  item,
  isSelectedInCart = false,
  onAddToCart,
  onOpenCondiments,
  hasCondiments = false,
  isPaidOrder = false,
  onUnlockNewOrder,
}) => {
  const [imgError, setImgError] = useState(false);

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case 'BAKSO':
        return { bg: 'from-emerald-100 to-emerald-200', icon: '🍲' };
      case 'MIE AYAM':
        return { bg: 'from-emerald-100 to-emerald-200', icon: '🍜' };
      case 'MAKANAN':
        return { bg: 'from-emerald-100 to-emerald-200', icon: '🍱' };
      case 'TAMBAHAN':
        return { bg: 'from-emerald-500 to-emerald-700', icon: '🥟' };
      case 'KRIUK':
        return { bg: 'from-emerald-100 to-emerald-200', icon: '🥨' };
      case 'MINUMAN':
        return { bg: 'from-emerald-500 to-emerald-700', icon: '🥤' };
      case 'BUNDLING':
        return { bg: 'from-emerald-100 to-emerald-200', icon: '🎁' };
      default:
        return { bg: 'from-emerald-500 to-emerald-700', icon: '🍽️' };
    }
  };

  const theme = getCategoryTheme(item.category);
  const shouldTriggerCondiments = hasCondiments;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPaidOrder && onUnlockNewOrder) {
      onUnlockNewOrder();
    }
    if (shouldTriggerCondiments && onOpenCondiments) {
      onOpenCondiments(item);
    } else {
      onAddToCart(item);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border p-2.5 transition-all duration-200 select-none cursor-pointer ${
        isSelectedInCart
          ? 'shadow-md border-[#059669]'
          : 'border-slate-200 bg-white hover:border-[#059669] hover:shadow-sm'
      }`}
      style={
        isSelectedInCart
          ? { background: '#F0FDF4', borderColor: '#059669' }
          : { background: '#ffffff', borderColor: '#E5E7EB' }
      }
    >
      {/* Product Image Container — Zoomed Photo & Prominent Presentation */}
      <div className="relative flex h-22 sm:h-26 lg:h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
        {item.image && !imgError ? (
          <img
            src={optimizeCloudinaryImage(item.image, 420)}
            alt={item.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover scale-125 transition-transform duration-300 group-hover:scale-135"
          />
        ) : (
          <div className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br p-2 text-center text-white ${theme.bg}`}>
            <span className="text-3xl">{theme.icon}</span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest opacity-80 line-clamp-1">{item.category}</span>
          </div>
        )}
      </div>

      {/* Product Details — Tight Gaps, Clean Spacing */}
      <div className="flex flex-1 flex-col gap-0.5 pt-1.5">
        <h3 className="line-clamp-2 text-[11px] sm:text-xs font-extrabold text-[#111827] leading-snug min-h-[28px]">
          {item.name}
        </h3>

        {/* PRICE IS ALWAYS EMERALD GREEN #047857 WITH INLINE STYLE */}
        <div className="text-xs sm:text-sm font-extrabold font-mono leading-none" style={{ color: '#047857' }}>
          {item.isManualPrice ? 'Input Harga Custom' : `Rp ${item.price.toLocaleString('id-ID')}`}
        </div>

        <div className="mt-auto flex items-center justify-between gap-1 pt-1">
          <span className="text-[10px] font-bold text-slate-400">
            Stok {item.stockCount !== undefined ? item.stockCount : '∞'}
          </span>

          <button
            type="button"
            onClick={handleClick}
            className="flex shrink-0 items-center justify-center h-6 w-6 rounded-full transition-all cursor-pointer"
            style={
              isSelectedInCart
                ? { background: '#047857', color: '#ffffff' }
                : { background: '#F0FDF4', color: '#047857' }
            }
            title={shouldTriggerCondiments ? 'Pilih Isian & Topping' : 'Tambah ke Keranjang'}
          >
            <Plus className="h-3.5 w-3.5 stroke-[3]" style={{ color: isSelectedInCart ? '#ffffff' : '#047857' }} />
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
  onCompleteOrder?: (orderId: string) => void;
  onVoidOrder?: (orderId: string, reason: string) => void | Promise<void>;
  onPrintPreBill: (order: Order) => void;
  onSelectExistingOrderToEdit: (order: Order) => void;
  onOpenTableModal?: () => void;
  currentBranch: Branch;
  currentShift: Shift;
  isShiftStatusLoading?: boolean;
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
  onCompleteOrder,
  onVoidOrder,
  onPrintPreBill,
  onSelectExistingOrderToEdit,
  onOpenTableModal,
  currentBranch,
  currentShift,
  isShiftStatusLoading = false,
  headerElement,
  onOpenShiftTab,
  confirmBeforeSaveOrder = false,
  confirmBeforePayment = false
}) => {
  // Two-stage confirmation timer
  const [pendingConfirm, setPendingConfirm] = useState<'SAVE' | 'PAY' | null>(null);

  useEffect(() => {
    if (!pendingConfirm) return;
    const timer = window.setTimeout(() => setPendingConfirm(null), 4000);
    return () => window.clearTimeout(timer);
  }, [pendingConfirm]);

  // State for POS Queue Tab & Global Topping Saklar Switch
  const [queueTab, setQueueTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isCondimentsEnabled, setIsCondimentsEnabled] = useState<boolean>(true); // Saklar ON/OFF Condiment Global di Panel Kasir

  // Active Order Builder State — Starts with null editing ID for a fresh active order!
  const [customerName, setCustomerName] = useState<string>('Guest');
  const [selectedTable, setSelectedTable] = useState<string>('-');
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxValue, setTaxValue] = useState<number>(0);
  const [currentEditingOrderId, setCurrentEditingOrderId] = useState<string | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  // Condiment Selection Modal State
  const [activeItemForCondiment, setActiveItemForCondiment] = useState<MenuItem | null>(null);
  const [isCondimentModalOpen, setIsCondimentModalOpen] = useState<boolean>(false);
  const [manualItemSource, setManualItemSource] = useState<MenuItem | null>(null);
  const [manualItemDraft, setManualItemDraft] = useState({ name: '', price: '', notes: '' });

  const categories = [
    { id: 'ALL', label: 'Semua' },
    { id: 'BAKSO', label: 'Bakso' },
    { id: 'MIE AYAM', label: 'Mie Ayam' },
    { id: 'MAKANAN', label: 'Makanan' },
    { id: 'TAMBAHAN', label: 'Tambahan' },
    { id: 'KRIUK', label: 'Kriuk' },
    { id: 'MINUMAN', label: 'Minuman' }
  ];

  // Current loaded order check (for Paid / Read-Only handling)
  const currentEditingOrder = orders.find((o) => o.id === currentEditingOrderId);
  const loadedStatus = String(currentEditingOrder?.status || '').toUpperCase();
  const isLoadedPaid = currentEditingOrder?.paymentStatus === 'PAID';
  const isLoadedClosed = loadedStatus === 'CANCELLED' || (loadedStatus === 'COMPLETED' && isLoadedPaid);
  const isLoadedPaidActive = currentEditingOrder?.paymentStatus === 'PAID' && !isLoadedClosed; // LUNAS, menunggu diselesaikan
  // Order terkunci (tidak bisa diedit/bayar ulang) bila sudah dibayar atau selesai.
  const isPaidOrder = Boolean(currentEditingOrder && (isLoadedPaidActive || isLoadedClosed));
  const isShiftActiveForCurrentContext = currentShift.status === 'OPEN' && currentShift.branchId === currentBranch.id;

  if (!isShiftActiveForCurrentContext) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-[#F8FAFC]">
        {headerElement}
        <div className="flex flex-1 items-center justify-center select-none">
          <div className="rounded-2xl border border-slate-200 bg-white px-7 py-5 text-center shadow-sm">
            <p className="font-extrabold text-xs md:text-sm tracking-widest uppercase text-slate-600">
              {isShiftStatusLoading ? 'MEMASTIKAN STATUS SHIFT…' : 'POS TERKUNCI – BUKA SHIFT DULU'}
            </p>
            {!isShiftStatusLoading && onOpenShiftTab && (
              <button type="button" onClick={onOpenShiftTab} className="ui-button ui-button-primary mt-3 px-4 py-2 text-xs">Buka halaman shift</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Filtered Menu Items
  const filteredMenu = menuItems.filter((item) => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleUnlockNewOrder = () => {
    setCurrentEditingOrderId(null);
  };

  // Handlers for Table Selection & Customer Name
  const handleCustomerNameChange = (name: string) => {
    setCustomerName(name);
  };

  const handleSelectTable = (tblNum: string) => {
    setSelectedTable(tblNum);
  };

  // Cart Handlers — Consolidates identical items into a single row with combined quantity (2x, 3x)
  const handleAddToCart = (item: MenuItem, selectedCondiments?: { groupName: string; options: string[] }[]) => {
    if (isPaidOrder) handleUnlockNewOrder();

    setCartItems((prevItems) => {
      const newItem: OrderItem = {
        id: 'cart-' + Date.now() + Math.random().toString(36).substring(2, 4),
        menuId: item.id,
        menuName: item.name,
        price: item.price,
        quantity: 1,
        category: item.category,
        selectedCondiments: selectedCondiments
      };
      return consolidateCartItems([...prevItems, newItem]);
    });
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    if (isPaidOrder) handleUnlockNewOrder();

    setCartItems((prevItems) => {
      return prevItems
        .map((item) => {
          if (item.id === itemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as OrderItem[];
    });
  };

  const handleUpdateNotes = (itemId: string, notes: string) => {
    if (isPaidOrder) handleUnlockNewOrder();
    setCartItems((prevItems) =>
      prevItems.map((item) => (item.id === itemId ? { ...item, notes } : item))
    );
  };

  const handleClearCart = () => {
    setCartItems([]);
    setCustomerName('Guest');
    setSelectedTable('-');
    setDiscountValue(0);
    setTaxValue(0);
    setCurrentEditingOrderId(null);
  };

  const handleLoadExistingOrder = (order: Order) => {
    setCurrentEditingOrderId(order.id);
    setCartItems(consolidateCartItems(order.items || []));
    setCustomerName(order.customerName || 'Guest');
    setSelectedTable(order.tableNumber && order.tableNumber !== '-' ? order.tableNumber : '-');
    setOrderType(order.type || 'DINE_IN');
    setDiscountValue(order.discount || 0);
    setIsCondimentsEnabled(order.condimentsEnabled !== false);
    onSelectExistingOrderToEdit(order);
  };

  // Condiments Trigger Modal Handler
  const handleOpenCondimentModal = (item: MenuItem) => {
    if (isPaidOrder) handleUnlockNewOrder();
    setActiveItemForCondiment(item);
    setIsCondimentModalOpen(true);
  };

  const handleOpenManualItem = (item: MenuItem) => {
    if (isPaidOrder) handleUnlockNewOrder();
    setManualItemSource(item);
    setManualItemDraft({ name: item.name, price: item.price ? String(item.price) : '', notes: '' });
  };

  const handleConfirmManualItem = () => {
    if (!manualItemDraft.name.trim() || Number(manualItemDraft.price) <= 0) return;
    setCartItems((prev) => consolidateCartItems([
      ...prev,
      {
        id: 'cart-manual-' + Date.now(),
        menuId: manualItemSource?.id || 'manual-' + Date.now(),
        menuName: manualItemDraft.name.trim(),
        price: Number(manualItemDraft.price),
        quantity: 1,
        category: manualItemSource?.category || 'TAMBAHAN',
        notes: manualItemDraft.notes.trim() || undefined
      }
    ]));
    setManualItemSource(null);
  };

  // Calculation Math Audit — Sum, Discount, Tax, Total
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Math.min(subtotal, (subtotal * discountValue) / 100);
  const taxAmount = Math.round(((subtotal - discountAmount) * taxValue) / 100);
  const total = Math.max(0, subtotal - discountAmount + taxAmount);

  // Order masuk Riwayat hanya bila SUDAH SELESAI (dapur menyelesaikan / kasir
  // menekan "Selesai Pesanan") atau dibatalkan. Order yang baru dibayar (LUNAS)
  // tetap di antrean aktif dalam keadaan terkunci — kasir belum bisa mengedit,
  // tetapi masih terlihat sampai pesanannya benar-benar diselesaikan.
  const isOrderPaid = (o: Order) => String(o.paymentStatus || '').toUpperCase() === 'PAID';
  const isOrderClosed = (o: Order) => {
    const st = String(o.status || '').toUpperCase();
    return st === 'CANCELLED' || (st === 'COMPLETED' && isOrderPaid(o));
  };

  // `orders` sudah dibatasi ke SHIFT BERJALAN dari App (prop shiftOrders), jadi
  // antrean & riwayat kasir otomatis mulai dari 0 tiap buka shift baru. Riwayat
  // lengkap lintas shift ada di menu Laporan.
  const activeHoldOrders = orders.filter((o) => !isOrderClosed(o));
  const historyShiftOrders = orders.filter((o) => isOrderClosed(o));
  const displayedOrders = queueTab === 'ACTIVE' ? activeHoldOrders : historyShiftOrders;

  const queueListToRender = displayedOrders;

  const buildCurrentOrderDraft = (): Partial<Order> => ({
    id: currentEditingOrderId || `ord-${Date.now().toString().slice(-6)}`,
    orderNumber: currentEditingOrder?.orderNumber || `POS-${Date.now().toString().slice(-4)}`,
    branchId: currentBranch.id,
    shiftId: currentShift.id,
    customerName,
    notes: currentEditingOrder?.notes,
    tableNumber: selectedTable !== '-' && selectedTable.trim() !== '' ? selectedTable.trim() : undefined,
    type: orderType,
    status: currentEditingOrder?.status || 'NEW',
    paymentStatus: currentEditingOrder?.paymentStatus || 'UNPAID',
    items: cartItems,
    subtotal,
    discount: discountAmount,
    tax: taxAmount,
    total,
    createdAt: currentEditingOrder?.createdAt || new Date().toISOString(),
    cashierName: activeUser.name,
    condimentsEnabled: isCondimentsEnabled,
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#F8FAFC] font-sans select-none text-[#111827]">
      {/* Clone header element with orderType, onSelectOrderType, onClearCart, isCondimentsEnabled */}
      {React.isValidElement(headerElement)
        ? React.cloneElement(headerElement as React.ReactElement<any>, {
            orderType,
            onSelectOrderType: setOrderType,
            onClearCart: handleClearCart,
            isCondimentsEnabled,
            onToggleCondiments: () => setIsCondimentsEnabled(!isCondimentsEnabled)
          })
        : headerElement}

      <div className="flex flex-1 flex-col md:flex-row min-h-0 overflow-hidden p-3 md:p-4 gap-3">
        {/* Left Side Container (Queue + Menu Catalog) */}
        <div className="flex flex-1 min-w-0 min-h-0 gap-3">
          
          {/* 1. LEFT PANEL: ANTREAN POS (Active Orders Queue Sidebar matching Emerald Green Mockup) */}
          <div className="hidden lg:flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            {/* Panel Title Header */}
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl text-white flex items-center justify-center shadow-sm" style={{ background: '#047857' }}>
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-extrabold text-[#111827]">Antrian POS</h2>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" title="Online" />
            </div>

            {/* Prominent Buat Order Baru Button at TOP of Left Sidebar Panel */}
            <button
              type="button"
              onClick={handleClearCart}
              className="mb-3 w-full flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-extrabold text-white shadow-sm active:scale-95 transition-all cursor-pointer"
              style={{ background: 'linear-gradient(180deg, #059669 0%, #047857 100%)', color: '#ffffff' }}
            >
              <Plus className="w-4 h-4 text-white stroke-[3]" />
              <span>Buat Order Baru</span>
            </button>

            {/* Segmented Queue Switcher (Renamed 'Shift' to 'Riwayat' as requested) */}
            <div className="flex items-center rounded-full bg-slate-100 p-1 mb-3">
              <button
                type="button"
                onClick={() => setQueueTab('ACTIVE')}
                className="flex-1 rounded-full py-1.5 text-center text-xs font-extrabold transition-all cursor-pointer"
                style={
                  queueTab === 'ACTIVE'
                    ? { background: '#ffffff', color: '#047857', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                    : { color: '#64748B' }
                }
              >
                Aktif ({activeHoldOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('HISTORY')}
                className="flex-1 rounded-full py-1.5 text-center text-xs font-extrabold transition-all cursor-pointer"
                style={
                  queueTab === 'HISTORY'
                    ? { background: '#ffffff', color: '#047857', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                    : { color: '#64748B' }
                }
              >
                Riwayat ({historyShiftOrders.length})
              </button>
            </div>

            {/* Order Cards List — Ultra Compact & High-Density Sleek Queue Cards */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
              {queueListToRender.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 gap-1.5 select-none">
                  <Receipt className="w-7 h-7 text-slate-300" />
                  <p className="text-[11px] font-bold">
                    {queueTab === 'ACTIVE' ? 'Belum ada pesanan aktif' : 'Belum ada riwayat pesanan'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {queueTab === 'ACTIVE' ? 'Pesanan baru akan muncul di sini' : 'Pesanan selesai/batal muncul di sini'}
                  </p>
                </div>
              )}
              {queueListToRender.map((order) => {
                const isSelected = currentEditingOrderId === order.id;
                const paid = isOrderPaid(order);
                const closed = isOrderClosed(order);
                const kitchenDone = String(order.status).toUpperCase() === 'COMPLETED';
                const locked = paid || closed; // Terkunci: tidak bisa diedit lagi
                const originShiftId = order.createdShiftId || order.shiftId;
                const isCarryOver = Boolean(
                  originShiftId && currentShift.id && originShiftId !== currentShift.id
                  && new Date(order.createdAt).getTime() < new Date(currentShift.startTime).getTime()
                );
                // Status pill: SELESAI (hijau tua), LUNAS (abu-abu, menunggu dapur),
                // atau BELUM BAYAR (masih bisa dibayar/diedit).
                const statusLabel = closed
                  ? (String(order.status).toUpperCase() === 'CANCELLED' ? 'BATAL' : 'SELESAI')
                  : kitchenDone ? 'SIAP · TAGIH' : paid ? 'LUNAS · DAPUR' : 'BELUM BAYAR';
                const statusStyle = closed
                  ? { background: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' }
                  : kitchenDone
                  ? { background: '#FFF7ED', color: '#C2410C', borderColor: '#FDBA74' }
                  : paid
                  ? { background: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1' }
                  : { background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' };
                const orderSeqNum = formatOrderLabel(order, orders);
                const tableDisplay = order.tableNumber && order.tableNumber !== '-' ? order.tableNumber : '-';

                return (
                  <div
                    key={order.id}
                    onClick={() => handleLoadExistingOrder(order)}
                    className={`group relative rounded-xl border p-2 transition-all cursor-pointer space-y-1 border-l-4 shadow-2xs ${
                      locked ? '' : 'hover:border-[#059669]'
                    } ${isSelected ? 'ring-2 ring-[#047857]/30 border-[#059669]' : ''}`}
                    style={
                      isSelected
                        ? { background: '#ECFDF5', borderColor: '#059669', borderLeftColor: '#047857' }
                        : locked
                        ? { background: '#F8FAFC', borderColor: '#E5E7EB', borderLeftColor: '#94A3B8', opacity: 0.85 }
                        : { background: '#ffffff', borderColor: '#E5E7EB', borderLeftColor: '#059669' }
                    }
                    title={locked ? 'Pesanan terkunci — sudah dibayar / selesai' : undefined}
                  >
                    {/* Identitas dan satu status utama dipisahkan agar tidak bertumpuk. */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        {order.source === 'SELF_ORDER' && (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700" title="Pesanan dari HP customer">
                            <Smartphone className="h-3 w-3" />
                          </span>
                        )}
                        <span className={`shrink-0 font-mono text-xs font-black ${locked ? 'text-slate-500' : 'text-[#111827]'}`}>
                          {orderSeqNum}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide" style={statusStyle} title={statusLabel}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-1.5">
                      <span className={`min-w-0 truncate text-[10px] font-black ${locked ? 'text-slate-500' : 'text-slate-800'}`} title={order.customerName || 'Guest'}>
                        {order.customerName || 'Guest'}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {isCarryOver && (
                          <span className="rounded-md border border-amber-200 bg-amber-50 px-1 py-0.5 text-[7px] font-black uppercase text-amber-700" title="Order dari shift sebelumnya">Shift lalu</span>
                        )}
                        <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-black ${locked ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-emerald-200 bg-emerald-100/80 text-[#047857]'}`}>
                          Meja {tableDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Line 2: Items count, Total Price, Aksi (Selesai / Cetak) */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 text-[10px]">
                          {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} item
                        </span>
                        <span className={`font-black font-mono ${locked ? 'text-slate-500' : 'text-[#111827]'}`}>
                          Rp {(order.total || 0).toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Selesai Pesanan: hanya untuk order LUNAS yang belum selesai.
                            Memindahkan order ke Riwayat (status COMPLETED). */}
                        {paid && kitchenDone && !closed && onCompleteOrder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCompleteOrder(order.id);
                            }}
                            className="flex items-center gap-1 h-5 px-2 rounded-md text-white text-[10px] font-black transition-colors cursor-pointer"
                            style={{ background: '#047857' }}
                            title="Selesai Pesanan — pindahkan ke Riwayat"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Selesai
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPrintPreBill(order);
                          }}
                          className="w-5 h-5 rounded-md border border-[#A7F3D0] bg-white text-[#047857] flex items-center justify-center hover:bg-[#047857] hover:text-white transition-colors cursor-pointer"
                          title="Cetak Struk"
                        >
                          <Printer className="w-3 h-3" style={{ color: '#047857' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. CENTER PANEL: Category Pills & Product Grid matching Emerald Green Mockup */}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            {/* Category Pills Slider matching Mockup */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 border-b border-slate-100 scrollbar-none shrink-0">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="shrink-0 cursor-pointer whitespace-nowrap rounded-full px-5 py-2 text-xs font-extrabold tracking-wide transition-all active:scale-95"
                    style={
                      isSelected
                        ? { background: '#047857', color: '#ffffff', boxShadow: '0 2px 8px rgba(4,120,87,0.2)' }
                        : { background: '#F3F4F6', color: '#374151' }
                    }
                  >
                    {cat.label}
                  </button>
                );
              })}

              <div className="ml-auto shrink-0 pl-1">
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Product Catalog Grid (4 cols x 2 rows on desktop) — Ultra Compact Card Heights */}
            <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 p-0.5 content-start auto-rows-max scrollbar-thin">
              {filteredMenu.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 text-xs font-bold space-y-2">
                  <Utensils className="w-10 h-10 text-slate-300 mx-auto" />
                  <p>Menu tidak ditemukan</p>
                </div>
              ) : (
                filteredMenu.map((item) => {
                  const hasCondiments = isCondimentsEnabled && (condimentGroups || []).some(
                    (g) => isGroupApplicable(g, item)
                  );
                  const isItemInCart = cartItems.some((ci) => ci.menuId === item.id);

                  return (
                    <POSMenuItemCard
                      key={item.id}
                      item={item}
                      isSelectedInCart={isItemInCart}
                      onAddToCart={item.isManualPrice ? handleOpenManualItem : handleAddToCart}
                      onOpenCondiments={item.isManualPrice ? undefined : handleOpenCondimentModal}
                      hasCondiments={!item.isManualPrice && hasCondiments}
                      isPaidOrder={isPaidOrder}
                      onUnlockNewOrder={handleUnlockNewOrder}
                    />
                  );
                })
              )}
            </div>

            {/* Bottom Catalog Pagination matching Mockup */}
            <div className="pt-2 text-center shrink-0 border-t border-slate-100">
              <button type="button" className="text-xs font-extrabold text-slate-500 hover:text-[#047857] flex items-center justify-center gap-1 mx-auto cursor-pointer">
                <span>Tampilkan lebih banyak</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. RIGHT PANEL: ORDER CART SIDEBAR (Ultra Compact & Minimalist Layout) */}
        <div className="flex min-h-[54vh] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white md:h-full md:min-h-0 md:w-80 lg:w-[340px] xl:w-96 shadow-sm">
          <div className="flex h-full flex-col overflow-hidden">

            {/* Cart Header Top Row with Live Customer Name & Pure Text Table Number Input */}
            <div className="shrink-0 p-3 border-b border-slate-100 space-y-2">
              {/* Top Row: identity only. Topping has one source of control in HeaderBar. */}
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-1 rounded-xl font-extrabold text-xs font-mono shrink-0" style={{ background: '#DCFCE7', color: '#166534' }}>
                  {currentEditingOrder ? formatOrderLabel(currentEditingOrder, orders) : 'Baru'}
                </span>

                <span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${isCondimentsEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                  Topping {isCondimentsEnabled ? 'aktif' : 'nonaktif'}
                </span>
              </div>

              {/* Bottom Row: Customer Name & Table Number Inputs (Matching Pill Aesthetic, Smooth Emerald Focus) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 transition-all focus-within:bg-white focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-[#047857]/20">
                  <User className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                  <input
                    type="text"
                    placeholder="Nama..."
                    value={customerName}
                    onChange={(e) => handleCustomerNameChange(e.target.value)}
                    className="w-full text-xs font-extrabold text-[#111827] bg-transparent placeholder:text-slate-400 outline-none border-none ring-0 shadow-none focus:outline-none focus:border-none focus:ring-0"
                    style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                    title="Nama Pelanggan"
                  />
                </div>

                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 transition-all focus-within:bg-white focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-[#047857]/20">
                  <span className="text-[11px] font-extrabold text-[#047857] mr-1.5 shrink-0 select-none">Meja</span>
                  <input
                    type="text"
                    placeholder="-"
                    value={selectedTable === '-' ? '' : selectedTable}
                    onChange={(e) => handleSelectTable(e.target.value)}
                    className="w-full text-xs font-extrabold text-[#111827] bg-transparent placeholder:text-slate-400 outline-none border-none ring-0 shadow-none focus:outline-none focus:border-none focus:ring-0"
                    style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                    title="Ketik nomor meja (misal: 1, 2, 5, 12B)"
                  />
                </div>
              </div>
            </div>

            {/* Cart Items List — Tight, Minimalist Row Height & Inline Price/Notes */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 scrollbar-thin">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#047857] shadow-inner">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h4 className="text-xs font-extrabold text-[#111827]">Keranjang Kosong</h4>
                  <p className="text-[11px] font-bold text-slate-400">Pilih menu di sebelah kiri</p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="pb-1.5 border-b border-slate-100 last:border-0 space-y-1">
                    {/* Top Row: Item Name + Stepper Controls */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-extrabold text-[#111827] truncate leading-tight flex-1">
                        {item.menuName}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, -1)}
                            className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                          >
                            <Minus className="w-2.5 h-2.5 stroke-[2.5]" />
                          </button>
                          <span className="text-xs font-extrabold min-w-[14px] text-center font-mono text-[#111827]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, 1)}
                            className="w-5 h-5 rounded-md text-white flex items-center justify-center cursor-pointer"
                            style={{ background: '#047857', color: '#ffffff' }}
                          >
                            <Plus className="w-2.5 h-2.5 stroke-[2.5] text-white" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.id, -item.quantity)}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                          title="Hapus item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Price & Inline Note Input side-by-side */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-extrabold font-mono shrink-0" style={{ color: '#047857' }}>
                        Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                      </p>
                      <input
                        type="text"
                        placeholder="+ Catatan item..."
                        value={item.notes || ''}
                        onChange={(e) => handleUpdateNotes(item.id, e.target.value)}
                        className="flex-1 bg-slate-50/80 border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-[#111827] placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#047857] transition-all"
                        title="Catatan pesanan"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer Breakdown — Minimalist Footer & No Duplicate Subtotal */}
            <div className="shrink-0 p-3 border-t border-slate-100 space-y-2 bg-white">
              {/* Discount and Tax inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700">
                  <Percent className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="number"
                    min="0"
                    placeholder="Diskon %"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-transparent font-extrabold outline-none text-[#111827] text-xs"
                  />
                </div>

                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <span className="text-slate-500">Pajak</span>
                  <span className="text-slate-700 font-extrabold text-[11px]">0% ∨</span>
                </div>
              </div>

              {/* Subtotal row ONLY rendered if discount or tax > 0 */}
              {(discountAmount > 0 || taxAmount > 0) && (
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono text-[#111827] text-xs font-extrabold">
                    Rp {subtotal.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {/* Highlighted Total Box */}
              <div className="p-3 rounded-2xl flex items-center justify-between" style={{ background: '#F0FDF4', borderColor: '#A7F3D0', borderWidth: '1px' }}>
                <span className="text-sm font-extrabold text-[#111827]">Total</span>
                <span className="text-xl sm:text-2xl font-extrabold font-mono" style={{ color: '#047857' }}>
                  Rp {total.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Bottom Action Buttons */}
              <div className="flex items-center gap-2 pt-0.5">
                {currentEditingOrder && !isLoadedClosed && onVoidOrder && ['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(activeUser.role) && (
                  <button
                    type="button"
                    onClick={() => setIsVoidModalOpen(true)}
                    className="flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-700 hover:bg-rose-100"
                    title="Void pesanan dengan persetujuan"
                    aria-label="Void pesanan"
                  >
                    <Ban className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={cartItems.length === 0}
                  onClick={() => onPrintPreBill(buildCurrentOrderDraft() as Order)}
                  className="p-3 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                  title="Cetak Tagihan"
                >
                  <Printer className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  disabled={cartItems.length === 0 || !isShiftActiveForCurrentContext || isPaidOrder}
                  onClick={() => {
                    if (confirmBeforeSaveOrder && pendingConfirm !== 'SAVE') { setPendingConfirm('SAVE'); return; }
                    setPendingConfirm(null);
                    const draft = buildCurrentOrderDraft() as Order;
                    onSaveHoldOrder(draft);
                    handleClearCart();
                  }}
                  className="flex items-center justify-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-[#111827] font-extrabold text-xs py-3 px-3.5 rounded-2xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" style={{ color: '#047857' }} />
                  <span>Simpan</span>
                </button>

                {isLoadedClosed ? (
                  /* Order sudah selesai/batal: hanya penanda, tidak ada aksi. */
                  <div className="flex-1 flex items-center justify-center gap-2 font-extrabold text-xs py-3 px-4 rounded-2xl bg-slate-100 text-slate-500 select-none">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{loadedStatus === 'CANCELLED' ? 'Pesanan Dibatalkan' : 'Pesanan Selesai'}</span>
                  </div>
                ) : isLoadedPaidActive ? (
                  <div className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-extrabold text-amber-800">
                    <Clock className="h-4 w-4" />
                    <span>Lunas · Menunggu Kitchen Selesai</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={cartItems.length === 0 || !isShiftActiveForCurrentContext}
                    onClick={() => {
                      if (confirmBeforePayment && pendingConfirm !== 'PAY') { setPendingConfirm('PAY'); return; }
                      setPendingConfirm(null);
                      onOpenCheckoutModal(buildCurrentOrderDraft());
                    }}
                    className="flex-1 flex items-center justify-center gap-2 text-white font-extrabold text-xs py-3 px-4 rounded-2xl shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(180deg, #059669 0%, #047857 100%)',
                      color: '#ffffff',
                      boxShadow: '0 4px 14px rgba(4, 120, 87, 0.28)'
                    }}
                  >
                    <CreditCard className="w-4 h-4 text-white" />
                    <span className="text-[#ffffff]">Bayar</span>
                  </button>
                )}
              </div>
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
          setCartItems((prev) => consolidateCartItems([
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
          ]));
        }}
      />

      {isVoidModalOpen && currentEditingOrder && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><Ban className="h-5 w-5" /></div>
              <div><h3 className="font-extrabold text-slate-900">Void {formatOrderLabel(currentEditingOrder, orders)}</h3><p className="mt-1 text-xs text-slate-500">Stok akan dikembalikan dan tindakan dicatat atas akun approver.</p></div>
            </div>
            <textarea autoFocus value={voidReason} onChange={(event) => setVoidReason(event.target.value)} className="ui-input mt-4 min-h-24 resize-none" placeholder="Alasan void wajib diisi…" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setIsVoidModalOpen(false); setVoidReason(''); }} className="ui-button ui-button-secondary px-4 py-2 text-xs">Batal</button>
              <button type="button" disabled={!voidReason.trim()} onClick={() => { void Promise.resolve(onVoidOrder(currentEditingOrder.id, voidReason.trim())); setIsVoidModalOpen(false); setVoidReason(''); handleClearCart(); }} className="ui-button ui-button-danger px-4 py-2 text-xs disabled:opacity-40">Konfirmasi Void</button>
            </div>
          </div>
        </div>
      )}

      {manualItemSource && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 text-white" style={{ background: '#047857' }}>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-80">Item manual non-stok</p>
                <h3 className="text-base font-extrabold">Tambah Item Lainnya</h3>
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
                <span className="ui-form-label">Keterangan <span className="normal-case font-normal text-slate-400">(opsional)</span></span>
                <textarea value={manualItemDraft.notes}
                  onChange={(e) => setManualItemDraft({ ...manualItemDraft, notes: e.target.value })}
                  placeholder="Catatan untuk struk / dapur"
                  className="ui-input resize-none"
                  style={{ minHeight: '80px', paddingTop: '10px', paddingBottom: '10px' }} />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-4 bg-slate-50">
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
