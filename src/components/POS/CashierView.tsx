import React, { useState } from 'react';
import { isGroupApplicable } from '../../utils/condimentUtils';
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
        return { bg: 'from-amber-500 to-orange-500', icon: '🍲' };
      case 'MIE AYAM':
        return { bg: 'from-yellow-500 to-amber-500', icon: '🍜' };
      case 'MAKANAN':
        return { bg: 'from-orange-500 to-red-500', icon: '🍱' };
      case 'TAMBAHAN':
        return { bg: 'from-neutral-500 to-neutral-700', icon: '🥟' };
      case 'KRIUK':
        return { bg: 'from-yellow-600 to-amber-600', icon: '🥨' };
      case 'MINUMAN':
        return { bg: 'from-neutral-500 to-neutral-700', icon: '🥤' };
      case 'BUNDLING':
        return { bg: 'from-orange-500 to-orange-700', icon: '🎁' };
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
      className={`bg-white rounded-xl border transition-all duration-200 p-2.5 flex flex-col justify-between group overflow-hidden relative select-none h-full ${
        isPaidOrder
          ? 'opacity-60 cursor-not-allowed border-[#E8E0D8]'
          : 'border-[#E2DFDA] hover:border-[#BEB8B0] cursor-pointer hover:shadow-md'
      }`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="relative -mx-2.5 -mt-2.5 h-32 sm:h-36 bg-[#F1EFEC] overflow-hidden mb-2.5 flex items-center justify-center shrink-0">
        {item.image && !imgError ? (
          <img
            src={item.image}
            alt={item.name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${theme.bg} flex flex-col items-center justify-center text-white p-2 text-center`}>
            <span className="text-2xl mb-0.5">{theme.icon}</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider opacity-90 line-clamp-1">{item.category}</span>
          </div>
        )}

        <span className="absolute top-1.5 left-1.5 bg-white/92 text-[#56514B] text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-md backdrop-blur-sm border border-white/70 tracking-wider">
          {item.category}
        </span>

        <span className="absolute top-1.5 right-1.5 bg-white/90 text-[#1A1714] text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm border border-white/50">
          {item.stockCount !== undefined ? item.stockCount : '∞'}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-between gap-1.5">
        <h3 className="font-black text-sm text-[#181715] line-clamp-2 leading-tight tracking-tight group-hover:text-black transition-colors">
          {item.name}
        </h3>

        <div className="flex items-center justify-between pt-1.5 border-t border-[#F0E8E0] shrink-0">
          <span className="font-bold text-xs sm:text-sm text-[#181715] tracking-tight tabular-nums">
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
                ? 'bg-[#E8E0D8] text-[#9C9590] cursor-not-allowed'
                : 'bg-gradient-to-br from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 active:scale-95 text-white'
            }`}
            style={isPaidOrder ? {} : { boxShadow: '0 2px 6px rgba(234,88,12,0.2)' }}
            title={shouldTriggerCondiments ? 'Pilih Isian & Topping' : 'Tambah ke Keranjang'}
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
  onOpenShiftTab
}) => {
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
  const [discountPercent, setDiscountPercent] = useState<number>(0);
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
        <p className="font-black text-xs md:text-sm tracking-widest text-[#475569] uppercase">
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
    setDiscountPercent(0);
    setCurrentEditingOrderId(null);
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
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
    const initialDiscPercent = order.subtotal > 0 ? Math.round((order.discount / order.subtotal) * 100) : 0;
    setDiscountPercent(initialDiscPercent);
    setCartItems(order.items);
  };

  const activeOrdersList = orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
  const historyOrdersList = orders.filter((o) => o.status === 'COMPLETED' || o.status === 'CANCELLED');

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row h-full overflow-hidden bg-transparent select-none font-sans text-[#1A1714]">
      
      {/* LEFT + CENTER AREA WRAPPER */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden p-1.5 md:p-2 pr-0 gap-1.5 md:gap-2">
        {/* Header Bar embedded at top of Left+Center area */}
        {headerElement}

        <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 gap-1.5 md:gap-2 overflow-hidden">
          {/* 1. LEFT PANEL: Queue & Active Orders */}
          <div className="w-full md:w-44 lg:w-48 xl:w-52 bg-white rounded-xl border border-[#E8E0D8] p-2 flex flex-col shrink-0 max-h-60 md:max-h-none h-full min-h-0 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

            {/* Queue Header */}
            <div className="flex items-center justify-between bg-[#FAFAF8] p-1.5 rounded-lg mb-1.5 border border-[#E8E0D8]">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-[#1A1714] text-white flex items-center justify-center font-bold text-[9px]">
                  Q
                </div>
                <span className="text-[11px] font-bold text-[#1A1714]">Queue POS</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#F05A1F] animate-pulse" />
            </div>

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 bg-[#F3F3F3] p-0.5 rounded-lg mb-1.5 text-[9px] font-semibold border border-[#E2E2E2]">
              <button
                onClick={() => setQueueTab('ACTIVE')}
                className={`py-1 rounded-md transition-all ${
                  queueTab === 'ACTIVE'
                    ? 'bg-[#1A1714] text-white font-bold'
                    : 'text-[#9C9590] hover:text-[#1A1714]'
                }`}
              >
                Active ({activeOrdersList.length})
              </button>
              <button
                onClick={() => setQueueTab('HISTORY')}
                className={`py-1 rounded-md transition-all ${
                  queueTab === 'HISTORY'
                    ? 'bg-[#1A1714] text-white font-bold'
                    : 'text-[#9C9590] hover:text-[#1A1714]'
                }`}
              >
                History
              </button>
            </div>

            {/* Order Cards Scroll List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
              {(queueTab === 'ACTIVE' ? activeOrdersList : historyOrdersList).length === 0 ? (
                <div className="py-12 text-center text-[#B8B0A8] text-xs font-medium">
                  Tidak ada order antrean
                </div>
              ) : (
                (queueTab === 'ACTIVE' ? activeOrdersList : historyOrdersList).map((order) => {
                  const isEditingThis = currentEditingOrderId === order.id;
                  const itemCount = order.items.reduce((a, b) => a + b.quantity, 0);
                  const orderIsPaid = order.paymentStatus === 'PAID' || order.status === 'COMPLETED';

                  return (
                    <div
                      key={order.id}
                      onClick={() => handleLoadExistingOrder(order)}
                      className={`p-2 rounded-lg border border-l-[3px] border-l-[#F05A1F] transition-all cursor-pointer relative ${
                        isEditingThis
                          ? 'bg-[#FFF7F3] border-[#F05A1F] ring-2 ring-[#F05A1F]/10 shadow-sm'
                          : 'bg-white border-[#E2E2E2] hover:border-[#F2B59B] hover:bg-[#FFF9F6] hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-[#D94B15] tracking-tight">
                          {order.orderNumber}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <span className={`text-[7px] font-semibold px-1.5 py-0.5 rounded-md ${
                            orderIsPaid ? 'bg-[#F1F1F1] text-[#333333]' : 'bg-[#FFF2EB] text-[#C54515]'
                          }`}>
                            {orderIsPaid ? 'PAID' : 'UNPAID'}
                          </span>
                          <span className="text-[7px] bg-[#1A1714] text-white font-semibold px-1.5 py-0.5 rounded-md">
                            {order.type === 'DINE_IN' ? 'DINE IN' : 'TAKE AWAY'}
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] space-y-0.5">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-bold text-[11px] text-[#252525] truncate max-w-[90px]">
                            {order.customerName}
                          </span>
                          <span className="text-[9px] text-[#363636] font-bold whitespace-nowrap">Meja: {order.tableNumber || '-'}</span>
                        </div>

                        <div className="pt-0.5 flex items-center justify-between border-t border-[#F0E8E0]">
                          <span className="font-medium text-[#9C9590] text-[8px]">{itemCount} menu</span>
                          <span className="font-bold text-[10px] text-[#181715]">
                            Rp {order.total.toLocaleString('id-ID')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPrintPreBill(order);
                          }}
                          className="mt-1 p-1 text-[#C94A1A] bg-[#FFF9F6] hover:bg-[#FFF1EA] rounded-md border border-[#F0D4C8] transition-all self-end"
                          title="Cetak Struk"
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
          <div className="flex-1 min-w-0 h-full min-h-0 flex flex-col overflow-hidden bg-white rounded-xl border border-[#E8E0D8] p-2 md:p-2.5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 border-b border-[#F0E8E0] scrollbar-none shrink-0">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all uppercase tracking-wide cursor-pointer ${
                      isSelected
                        ? cat.id === 'ALL'
                          ? 'bg-[#1A1714] text-white'
                          : 'bg-[#1C1B19] text-white'
                        : 'bg-[#F4F4F4] hover:bg-[#EAEAEA] text-[#5F5F5F] border border-[#E1E1E1]'
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
                <div className="col-span-full py-16 text-center text-[#B8B0A8] text-xs font-medium space-y-2">
                  <Utensils className="w-10 h-10 text-[#D5CFC8] mx-auto" />
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
      <div className="w-full md:w-80 lg:w-88 xl:w-96 h-full min-h-0 bg-white border-l border-[#E8E0D8] p-3 md:p-3.5 flex flex-col justify-between shrink-0 overflow-hidden rounded-l-2xl rounded-r-none" style={{ boxShadow: '-4px 0 16px rgba(0,0,0,0.03)' }}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F0E8E0] shrink-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-xs text-[#1A1714]">
                Order
              </h3>
              {currentEditingOrder && (
                <span className="text-[9px] font-semibold text-[#EA580C] bg-orange-50 px-1.5 py-0.5 rounded-md border border-orange-100">
                  {currentEditingOrder.orderNumber}
                </span>
              )}

            </div>

            <div className="flex items-center gap-1">
              <div className="flex items-center bg-[#F3F3F3] border border-[#E1E1E1] p-0.5 rounded-lg text-[9px] font-semibold">
                <button
                  type="button"
                  disabled={isPaidOrder}
                  onClick={() => setOrderType('DINE_IN')}
                  className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    orderType === 'DINE_IN' ? 'bg-[#1C1B19] text-white font-bold' : 'text-[#9C9590] hover:text-[#1A1714]'
                  } ${isPaidOrder ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Utensils className="w-3 h-3" />
                  <span>DINE IN</span>
                </button>
                <button
                  type="button"
                  disabled={isPaidOrder}
                  onClick={() => setOrderType('TAKE_AWAY')}
                  className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    orderType === 'TAKE_AWAY' ? 'bg-[#1C1B19] text-white font-bold' : 'text-[#9C9590] hover:text-[#1A1714]'
                  } ${isPaidOrder ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>TAKE AWAY</span>
                </button>
              </div>

              <button
                onClick={handleClearCart}
                className="p-1 text-[#B8B0A8] hover:text-rose-500 transition-colors"
                title={isPaidOrder ? 'Tutup View Order' : 'Kosongkan'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isPaidOrder && (
            <div className="bg-[#FFF7F3] border border-[#F2B59B] rounded-lg p-2 mb-2 flex items-center justify-between text-[#B83C0F] shrink-0">
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#F05A1F] shrink-0" />
                <span>LUNAS (PAID)</span>
              </div>
              <span className="text-[8px] font-semibold bg-[#FFE9DE] text-[#A8370C] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                DIKUNCI
              </span>
            </div>
          )}

          {!isShiftActiveForCurrentContext && (
            <div className="mb-2 rounded-xl border border-[#F2C9B6] bg-[#FFF7F3] p-3 text-[#A53A12] shrink-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em]">Shift wajib aktif</p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed">
                Buka shift untuk outlet {currentBranch.name} sebelum menyimpan order atau menerima pembayaran.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5 mb-2 shrink-0">
            <div className="col-span-2">
              <label className="text-[9px] font-bold text-[#6B6B6B] uppercase block mb-1 tracking-wider">
                NAMA
              </label>
              <input
                type="text"
                disabled={isPaidOrder}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full border rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#1A1A1A] outline-none ${
                  isPaidOrder ? 'bg-[#FAFAFA] border-[#E2E2E2] text-[#929292] cursor-not-allowed' : 'bg-[#F5F5F5] border-[#E1E1E1] focus:border-[#AFAFAF] focus:bg-white focus:ring-1 focus:ring-black/5'
                }`}
                placeholder="Name"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-[#6B6B6B] uppercase block mb-1 tracking-wider">
                MEJA
              </label>
              <select
                disabled={isPaidOrder}
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className={`w-full border rounded-lg px-2 py-1.5 text-sm font-bold text-[#1A1A1A] outline-none ${
                  isPaidOrder ? 'bg-[#FAFAFA] border-[#E2E2E2] text-[#929292] cursor-not-allowed' : 'bg-[#F5F5F5] border-[#E1E1E1] focus:border-[#AFAFAF] focus:bg-white focus:ring-1 focus:ring-black/5 cursor-pointer'
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

          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5 border-t border-[#F0E8E0] pt-2 scrollbar-thin">
            {cartItems.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-11 h-11 rounded-xl bg-[#F3F1EE] border border-[#E2DFDA] flex items-center justify-center mx-auto text-[#F05A1F]">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#9C9590]">Keranjang Kosong</p>
                <p className="text-[10px] text-[#B8B0A8] font-medium">Pilih menu di sebelah kiri</p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-lg bg-[#FAFAF8] border border-[#E8E0D8] space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-[#1A1714] leading-snug">
                      {item.menuName}
                    </span>
                    <span className="font-bold text-xs text-[#181818] shrink-0">
                      Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] font-medium text-[#9C9590]">
                      Rp {item.price.toLocaleString('id-ID')} x {item.quantity}
                    </span>

                    {!isPaidOrder && (
                      <div className="flex items-center gap-0.5 bg-white border border-[#E8E0D8] rounded-lg p-0.5">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-5 h-5 rounded-md bg-[#F5EFE8] hover:bg-[#EDE5DC] text-[#6B6560] flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="font-bold text-[11px] px-1.5 text-[#1A1714]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-5 h-5 rounded-md bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white flex items-center justify-center transition-all"
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

          <div className="pt-2.5 border-t border-[#F0E8E0] shrink-0 space-y-2 mt-auto">
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <input
                type="number"
                disabled={isPaidOrder}
                placeholder="Disc %"
                value={discountPercent || ''}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none ${
                  isPaidOrder ? 'bg-[#FAFAFA] border-[#E2E2E2] text-[#A3A3A3] cursor-not-allowed' : 'bg-[#F5F5F5] border-[#E1E1E1] text-[#1A1A1A] focus:border-[#AFAFAF] focus:bg-white'
                }`}
              />
              <select
                disabled={isPaidOrder}
                className={`w-full border rounded-lg px-2 py-1.5 text-xs font-semibold outline-none ${
                  isPaidOrder ? 'bg-[#FAFAFA] border-[#E2E2E2] text-[#A3A3A3] cursor-not-allowed' : 'bg-[#F5F5F5] border-[#E1E1E1] text-[#1A1A1A] focus:border-[#AFAFAF] focus:bg-white cursor-pointer'
                }`}
              >
                <option value="IDR">IDR</option>
              </select>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-[#9C9590] uppercase tracking-wider text-[9px]">
                <span>SUBTOTAL</span>
                <span className="text-[#1A1714] font-semibold text-xs">
                  Rp {subtotal.toLocaleString('id-ID')}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-[#9C9590] uppercase tracking-wider text-[9px]">
                  <span>DISCOUNT</span>
                  <span className="text-rose-500 font-semibold text-xs">
                    - Rp {discountAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-[#1A1714] pt-0.5">
                <span>TOTAL</span>
                <span className="text-base font-bold text-[#EA580C]">
                  Rp {total.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {isPaidOrder ? (
                <div className="space-y-2">
                  <button
                    onClick={() => onPrintPreBill(currentEditingOrder || (buildCurrentOrderDraft() as Order))}
                    className="w-full py-2.5 bg-orange-50 hover:bg-orange-100 text-[#EA580C] font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-orange-200"
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
                    className="w-full py-2.5 bg-[#1C1B19] hover:bg-black active:scale-95 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                    style={{ boxShadow: '0 2px 8px rgba(28,27,25,0.18)' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> SELESAI ORDER
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    disabled={cartItems.length === 0}
                    onClick={() => onPrintPreBill(buildCurrentOrderDraft() as Order)}
                    className="w-full py-2 bg-white hover:bg-[#F3F1EE] text-[#68645F] font-semibold text-xs rounded-xl border border-[#D9D5CF] flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> CETAK TAGIHAN
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={cartItems.length === 0 || !isShiftActiveForCurrentContext}
                      onClick={() => {
                        const draft = buildCurrentOrderDraft() as Order;
                        onSaveHoldOrder(draft);
                        handleClearCart();
                      }}
                      className="py-2.5 bg-white border border-[#E8E0D8] hover:bg-[#FAFAF8] disabled:opacity-40 text-[#6B6560] font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5 text-[#9C9590]" /> SIMPAN
                    </button>

                    <button
                      disabled={cartItems.length === 0 || !isShiftActiveForCurrentContext}
                      onClick={() => onOpenCheckoutModal(buildCurrentOrderDraft())}
                      className="py-2.5 bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 active:scale-95 disabled:opacity-40 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      style={{ boxShadow: '0 2px 8px rgba(234,88,12,0.25)' }}
                    >
                      <CreditCard className="w-3.5 h-3.5" /> BAYAR
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#DEDAD5] bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#1A1917] px-5 py-4 text-white">
              <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-300">Item manual non-stok</p><h3 className="text-lg font-black">Lainnya</h3></div>
              <button type="button" onClick={() => setManualItemSource(null)} className="rounded-full bg-white/10 p-2 hover:bg-white/20"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Nama item / penjualan<input autoFocus value={manualItemDraft.name} onChange={(event) => setManualItemDraft({ ...manualItemDraft, name: event.target.value })} placeholder="Contoh: Alpukat tambahan" className="mt-1.5 w-full rounded-2xl border border-[#DEDAD5] bg-[#F7F7F6] p-3 text-sm font-bold text-slate-900 outline-none focus:border-orange-400 focus:bg-white" /></label>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Harga jual<input type="number" min="1" inputMode="numeric" value={manualItemDraft.price} onChange={(event) => setManualItemDraft({ ...manualItemDraft, price: event.target.value })} placeholder="Rp 0" className="mt-1.5 w-full rounded-2xl border border-[#DEDAD5] bg-[#F7F7F6] p-3 text-sm font-black text-slate-900 outline-none focus:border-orange-400 focus:bg-white" /></label>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Keterangan <span className="normal-case text-slate-400">(opsional)</span><textarea value={manualItemDraft.notes} onChange={(event) => setManualItemDraft({ ...manualItemDraft, notes: event.target.value })} placeholder="Catatan untuk struk / dapur" className="mt-1.5 min-h-20 w-full rounded-2xl border border-[#DEDAD5] bg-[#F7F7F6] p-3 text-xs font-semibold text-slate-900 outline-none focus:border-orange-400 focus:bg-white" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#EEEAE6] bg-[#FAFAF9] p-4"><button type="button" onClick={() => setManualItemSource(null)} className="rounded-xl border border-[#DEDAD5] bg-white px-4 py-2.5 text-xs font-black text-slate-600">BATAL</button><button type="button" disabled={!manualItemDraft.name.trim() || Number(manualItemDraft.price) <= 0} onClick={handleConfirmManualItem} className="rounded-xl bg-[#EA580C] px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">TAMBAH KE ORDER</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
