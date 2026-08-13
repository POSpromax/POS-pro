import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isGroupApplicable } from '../../utils/condimentUtils';
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  CheckCircle2,
  ArrowRight,
  Search,
  Sparkles,
  QrCode,
  ChevronRight,
  Clock,
  ChevronDown,
  Info,
  PhoneCall,
  Instagram,
  Share2,
  ArrowLeft,
  Utensils,
  UserCheck,
  ChefHat,
  MessageCircle,
  Download,
  Home,
  Check,
  Receipt
} from 'lucide-react';
import {
  MenuItem,
  Order,
  OrderItem,
  RestaurantProfile,
  CategoryType,
  CondimentGroup,
  SelectedCondimentGroup,
  RestaurantTable,
  Branch
} from '../../types/pos';
import { CondimentSelectionModal } from '../POS/CondimentSelectionModal';
import { optimizeCloudinaryImage } from '../../utils/imageUrl';

export type SelfOrderStep = 'LANDING' | 'TABLE_INPUT' | 'MENU' | 'CART' | 'ORDER_SUCCESS';

interface SelfOrderLandingPageProps {
  tables: RestaurantTable[];
  menuItems: MenuItem[];
  profile: RestaurantProfile;
  condimentGroups: CondimentGroup[];
  isSelfOrderSystemEnabled?: boolean;
  orders?: Order[];
  onSubmitCustomerOrder: (order: Order) => void;
  initialTableNumber?: string;
  currentBranch: Branch;
  onShowToast?: (title: string, message: string) => void;
  isShiftActive?: boolean;
}

export const SelfOrderLandingPage: React.FC<SelfOrderLandingPageProps> = ({
  tables,
  menuItems,
  profile,
  condimentGroups,
  isSelfOrderSystemEnabled = true,
  orders = [],
  onSubmitCustomerOrder,
  initialTableNumber = '',
  currentBranch,
  onShowToast,
  isShiftActive = true,
}) => {
  // Navigation State Flow
  const [activeStep, setActiveStep] = useState<SelfOrderStep>('LANDING');

  // Customer Data State
  const [selectedTable, setSelectedTable] = useState<string>(initialTableNumber);
  const [customerName, setCustomerName] = useState<string>('');
  const [tableErrorMsg, setTableErrorMsg] = useState<string>('');

  // Menu Search & Filter State
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [activeItemForCondiment, setActiveItemForCondiment] = useState<MenuItem | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [isCartModalOpen, setIsCartModalOpen] = useState<boolean>(false);

  // Submitted Order Tracking State
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const [localToast, setLocalToast] = useState<string | null>(null);
  const localToastTimerRef = useRef<number | null>(null);

  const toast = (title: string, message: string) => {
    if (onShowToast) { onShowToast(title, message); return; }
    if (localToastTimerRef.current) window.clearTimeout(localToastTimerRef.current);
    setLocalToast(message);
    localToastTimerRef.current = window.setTimeout(() => setLocalToast(null), 3000);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlTable = params.get('table');
    if (urlTable) {
      const cleanTable = urlTable.trim().replace(/^0+(?=\d)/, '');
      setSelectedTable(cleanTable);
    }
  }, []);

  useEffect(() => () => {
    if (localToastTimerRef.current) window.clearTimeout(localToastTimerRef.current);
  }, []);

  // Find active live order from global state
  const liveSubmittedOrder = orders.find((o) => o.id === submittedOrderId) || null;

  const normalizeTableNum = (str: string) => {
    if (!str) return '';
    const digits = str.trim().toUpperCase().replace(/^M-?/i, '').replace(/^0+/, '');
    return digits || str.trim().toUpperCase();
  };

  const availableTables = useMemo(
    () => tables
      .filter((table) =>
        (!table.branchId || table.branchId === currentBranch.id)
        && table.isSelfOrderEnabled !== false
        && table.status !== 'DISABLED')
      .sort((a, b) => a.number.localeCompare(b.number, 'id', { numeric: true })),
    [tables, currentBranch.id],
  );

  // Table status check
  const selectedTableObj = availableTables.find((t) => normalizeTableNum(t.number) === normalizeTableNum(selectedTable));
  const isSelectedTableEnabled = selectedTableObj
    ? selectedTableObj.isSelfOrderEnabled !== false && (!selectedTableObj.branchId || selectedTableObj.branchId === currentBranch.id)
    : false;

  const categories: { key: CategoryType; label: string; icon: string }[] = [
    { key: 'ALL', label: 'Semua Menu', icon: '🔥' },
    { key: 'BAKSO', label: 'Bakso Utama', icon: '🍲' },
    { key: 'MIE AYAM', label: 'Mie Ayam', icon: '🍜' },
    { key: 'MAKANAN', label: 'Makanan', icon: '🍱' },
    { key: 'TAMBAHAN', label: 'Topping', icon: '🥟' },
    { key: 'KRIUK', label: 'Kriuk', icon: '🥨' },
    { key: 'MINUMAN', label: 'Minuman', icon: '🥤' },
    { key: 'BUNDLING', label: 'Paket Hemat', icon: '🎁' }
  ];

  const filteredMenu = menuItems.filter((m) => {
    if (m.isManualPrice) return false;
    const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleStartOrder = () => {
    if (!isShiftActive) {
      toast('Shift Kasir Tutup', 'Shift kasir di outlet ini sedang tutup. Self-Order QR tidak dapat menerima pesanan saat shift tutup.');
      return;
    }
    if (!isSelfOrderSystemEnabled) {
      toast('Sistem Nonaktif', 'Sistem Self-Order QR sedang dinonaktifkan sementara oleh Kasir.');
      return;
    }
    setActiveStep('TABLE_INPUT');
  };

  const handleProceedToMenu = () => {
    setTableErrorMsg('');
    if (!isShiftActive) {
      setTableErrorMsg('Shift kasir di outlet ini sedang tutup. Self-order tidak dapat menerima pesanan saat toko/shift kasir tutup.');
      return;
    }
    if (!customerName.trim()) {
      setTableErrorMsg('Silakan masukkan nama pemesan terlebih dahulu.');
      return;
    }
    if (!selectedTable || !selectedTable.trim()) {
      setTableErrorMsg('Silakan masukkan nomor meja Anda.');
      return;
    }

    const inputNormalized = normalizeTableNum(selectedTable);
    const foundTable = availableTables.find((t) => {
      const storedNormalized = normalizeTableNum(t.number);
      return (
        storedNormalized === inputNormalized ||
        t.number.trim().toUpperCase() === selectedTable.trim().toUpperCase()
      );
    });

    if (!foundTable) {
      setTableErrorMsg(`Meja "${selectedTable}" tidak tersedia untuk self-order. Silakan pilih meja aktif atau hubungi kasir.`);
      return;
    }

    if (foundTable.isSelfOrderEnabled === false || foundTable.status === 'DISABLED') {
      setTableErrorMsg(`Meja ${foundTable.number} saat ini sedang NONAKTIF. Silakan hubungi kasir.`);
      return;
    }

    setSelectedTable(foundTable.number);
    setActiveStep('MENU');
  };

  const handleItemClick = (item: MenuItem) => {
    const hasCondiments = condimentGroups.some((g) => isGroupApplicable(g, item));

    if (hasCondiments) {
      setActiveItemForCondiment(item);
    } else {
      setCartItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.menuId === item.id && !i.selectedCondiments?.length && !i.notes);
        if (existingIdx > -1) {
          const updated = [...prev];
          updated[existingIdx].quantity += 1;
          return updated;
        }
        return [
          ...prev,
          {
            id: 'cust-' + Date.now() + Math.random().toString(36).substring(2, 4),
            menuId: item.id,
            menuName: item.name,
            price: item.price,
            quantity: 1,
            category: item.category
          }
        ];
      });
    }
  };

  const handleConfirmCondiments = (
    item: MenuItem,
    selectedCondiments: SelectedCondimentGroup[],
    notes: string,
    extraPrice: number
  ) => {
    if (editingCartItemId) {
      setCartItems((current) => current.map((cartItem) => cartItem.id === editingCartItemId ? {
        ...cartItem,
        price: item.price + extraPrice,
        notes: notes || undefined,
        selectedCondiments: selectedCondiments.length ? selectedCondiments : undefined,
      } : cartItem));
      setEditingCartItemId(null);
      return;
    }
    setCartItems((prev) => [
      ...prev,
      {
        id: 'cust-' + Date.now() + Math.random().toString(36).substring(2, 4),
        menuId: item.id,
        menuName: item.name,
        price: item.price + extraPrice,
        quantity: 1,
        category: item.category,
        notes: notes,
        selectedCondiments: selectedCondiments
      }
    ]);
  };

  const handleConfigurePerPortion = (cartItem: OrderItem) => {
    if (cartItem.quantity <= 1) {
      const menu = menuItems.find((item) => item.id === cartItem.menuId);
      if (menu) {
        setEditingCartItemId(cartItem.id);
        setActiveItemForCondiment(menu);
      }
      return;
    }
    setCartItems((current) => current.flatMap((item) => item.id !== cartItem.id
      ? [item]
      : Array.from({ length: item.quantity }, (_, index) => ({
          ...item,
          id: `${item.id}-portion-${index + 1}-${Date.now()}`,
          quantity: 1,
        }))));
    toast('Atur per Porsi', `${cartItem.menuName} dipisah menjadi ${cartItem.quantity} porsi. Pilih Ubah pada tiap porsi yang berbeda.`);
  };

  const handleUpdateQty = (cartItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === cartItemId) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  const getItemCartQty = (menuId: string) => {
    return cartItems
      .filter((i) => i.menuId === menuId)
      .reduce((sum, curr) => sum + curr.quantity, 0);
  };

  const totalCartQty = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalAmount = cartItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

  const handleSubmitOrder = () => {
    if (!isShiftActive) {
      toast('Shift Kasir Tutup', 'Shift kasir di outlet ini sedang tutup. Self-Order QR tidak dapat menerima pesanan saat shift tutup.');
      return;
    }
    if (!isSelfOrderSystemEnabled) {
      toast('Sistem Nonaktif', 'Sistem Self-Order QR sedang dinonaktifkan sementara oleh Kasir.');
      return;
    }
    if (!customerName.trim()) {
      toast('Data Belum Lengkap', 'Silakan masukkan nama pemesan.');
      return;
    }
    if (cartItems.length === 0) {
      toast('Keranjang Kosong', 'Keranjang belanja masih kosong!');
      return;
    }
    if (!selectedTable || !selectedTable.trim()) {
      toast('Pilih Meja', 'Silakan pilih nomor meja Anda terlebih dahulu.');
      return;
    }
    if (!selectedTableObj || !isSelectedTableEnabled) {
      toast('Meja Tidak Tersedia', `Meja ${selectedTable} sedang tidak aktif untuk self-order. Silakan pilih ulang atau hubungi kasir.`);
      return;
    }

    const orderId = crypto.randomUUID();
    const newOrder: Order = {
      id: orderId,
      orderNumber: '#' + Math.floor(100 + Math.random() * 900),
      customerName: customerName.trim(),
      tableNumber: selectedTable,
      type: 'DINE_IN',
      items: cartItems,
      subtotal: totalAmount,
      tax: 0,
      discount: 0,
      total: totalAmount,
      paymentMethod: 'CASH',
      paymentStatus: 'UNPAID',
      status: 'NEW',
      createdAt: new Date().toISOString(),
      shiftId: 'shift-self',
      branchId: currentBranch.id,
      cashierName: `Self Order • ${currentBranch.code || currentBranch.name}`,
      source: 'SELF_ORDER',
      parentOrderId: selectedTableObj.activeOrderId,
    };

    onSubmitCustomerOrder(newOrder);
    setSubmittedOrderId(orderId);
    setActiveStep('ORDER_SUCCESS');
  };

  const handleResetToLanding = () => {
    setSubmittedOrderId(null);
    setCartItems([]);
    setActiveStep('LANDING');
  };

  return (
    <div className="theme-self-order flex min-h-screen w-full select-none flex-col items-center bg-[var(--primary-soft)] font-sans text-slate-800 antialiased">
      {localToast && (
        <div className="animate-fadeIn fixed left-1/2 top-4 z-[9999] -translate-x-1/2 rounded-2xl border border-orange-100 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-md">
          {localToast}
        </div>
      )}
      {/* Clean Responsive Web App Wrapper */}
      <div className="relative flex min-h-screen w-full max-w-lg flex-col bg-[var(--primary-soft)] shadow-sm">
        
        {/* =========================================
            STEP 1: LANDING PAGE (Screenshot 1 Match)
           ========================================= */}
        {activeStep === 'LANDING' && (
          <div className="flex-1 space-y-4 overflow-y-auto bg-[var(--primary-soft)] p-5">
            <div className="space-y-4">
              
              {/* Top Restaurant Profile Header Card */}
              <div className="bg-white rounded-2xl p-4.5 shadow-sm border border-slate-200/60 flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-bold text-xl flex items-center justify-center shadow-md overflow-hidden border border-slate-100">
                    {profile.logoUrl ? (
                      <img src={profile.logoUrl} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                      'BU'
                    )}
                  </div>
                  <span className="w-4 h-4 bg-emerald-500 border-2 border-white rounded-full absolute -bottom-0.5 -right-0.5 shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-bold text-base text-slate-900 tracking-tight leading-tight uppercase truncate">
                    {profile.name || 'BAKSO UJO'}
                  </h1>
                  <p className="text-[11px] font-bold text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    📍 {currentBranch.address || profile.address || 'Jl. Re. Abdullah No.7-9, RT.01/RW.07, Pasirmulya BOGOR BARAT'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {isShiftActive ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full border border-emerald-200/60">
                        OPEN NOW
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-800 text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full border border-red-200">
                        KASIR TUTUP
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Disabled System / Closed Shift Banner Notice */}
              {!isShiftActive ? (
                <div className="bg-red-600 text-white text-xs font-bold p-3.5 rounded-2xl text-center space-y-1 shadow-md flex items-center justify-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Shift Kasir Tutup. Layanan Self-order QR tidak dapat menerima pesanan saat shift tutup. Silakan hubungi kasir.</span>
                </div>
              ) : !isSelfOrderSystemEnabled ? (
                <div className="bg-red-600 text-white text-xs font-bold p-3.5 rounded-2xl text-center space-y-1 shadow-md flex items-center justify-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Sistem Self-Order QR sedang dinonaktifkan oleh Kasir.</span>
                </div>
              ) : null}

              {/* Featured Promo Card */}
              <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/70 border border-amber-200/80 rounded-2xl p-5 space-y-1.5 relative overflow-hidden shadow-sm">
                <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-orange-600" />
                  <span>FEATURED</span>
                </div>
                <h3 className="font-bold text-base text-slate-900 leading-tight">
                  FREE ICE CREAM ATAU ES TEH MANIS
                </h3>
                <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  TUNJUKAN REVIEW GMAPS DIKASIR
                </p>
              </div>

              {/* Primary Call-to-Action Button Card (MENU TERSEDIA - Pesan Makan) */}
              <button
                type="button"
                onClick={handleStartOrder}
                disabled={!isShiftActive || !isSelfOrderSystemEnabled}
                className={`w-full rounded-2xl p-5 px-6 shadow-xl flex items-center justify-between transition-all cursor-pointer group active:scale-[0.98] ${
                  isShiftActive && isSelfOrderSystemEnabled
                    ? 'bg-[var(--primary)] hover:bg-orange-600 text-white shadow-orange-500/30'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-75 shadow-none'
                }`}
              >
                <div className="text-left space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-orange-100 block opacity-90">
                    MENU TERSEDIA
                  </span>
                  <span className="text-2xl font-bold text-white tracking-tight">
                    Pesan Makan
                  </span>
                </div>
                <div className="w-13 h-13 rounded-2xl bg-white text-orange-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <ArrowRight className="w-6 h-6 stroke-[3]" />
                </div>
              </button>

              {/* Info Grid (Clock & Phone) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-sm text-center flex flex-col items-center justify-center space-y-1">
                  <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-1">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">JAM BUKA</span>
                  <span className="text-xs font-bold text-slate-900">10:00 - 22:00</span>
                </div>

                <a
                  href={`https://wa.me/${profile.phone?.replace(/[^0-9]/g, '') || '628123456789'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-sm text-center flex flex-col items-center justify-center space-y-1 hover:border-orange-200 transition-all cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-1">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">WHATSAPP</span>
                  <span className="text-xs font-bold text-slate-900">Hubungi</span>
                </a>
              </div>

              {/* Review Google Maps Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm text-center space-y-1.5">
                <div className="flex justify-center gap-1 text-orange-500">
                  {'★'.repeat(5).split('').map((_, i) => (
                    <span key={i} className="text-lg">⭐</span>
                  ))}
                </div>
                <h4 className="font-bold text-base text-slate-900">Ulas Kami</h4>
                <p className="text-xs font-semibold text-slate-400">
                  Bagikan pengalaman makanmu disini
                </p>
              </div>

            </div>

            {/* Social Icons Footer */}
            <div className="flex items-center justify-center gap-4 pt-6 pb-2">
              <a
                href={profile.instagram ? `https://instagram.com/${profile.instagram.replace('@', '')}` : '#'}
                target="_blank"
                rel="noreferrer"
                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 hover:text-orange-600 transition-all"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <button
                type="button"
                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 hover:text-orange-600 transition-all"
              >
                <span className="font-bold text-xs">🎵</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: profile.name, url: window.location.href }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    toast('Link Disalin', 'Link e-order berhasil disalin!');
                  }
                }}
                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 hover:text-orange-600 transition-all"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>

          </div>
        )}

        {/* =========================================
            STEP 2: TABLE & NAME INPUT SCREEN (Screenshot 2 Match)
           ========================================= */}
        {activeStep === 'TABLE_INPUT' && (
          <div className="animate-fadeIn flex-1 overflow-y-auto bg-[var(--primary-soft)] p-6">
            {/* Pemusatan dipindah ke pembungkus dalam: kalau container yang
                men-scroll ikut memusatkan, isinya menyusut dan tidak bisa digulir. */}
            <div className="min-h-full flex flex-col justify-center space-y-6">
            <div className="text-center space-y-2">
              {/* Orange Chef Hat Icon Box */}
              <div className="w-20 h-20 bg-[var(--primary)] text-white rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/30 mx-auto">
                <ChefHat className="w-10 h-10 stroke-[2.2]" />
              </div>

              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Smart Order
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Pesan mudah langsung dari meja Anda
              </p>
            </div>

            {/* Form Container Box */}
            <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-xl border border-slate-100 space-y-5">
              {tableErrorMsg && (
                <div className="bg-red-50 text-red-600 text-xs font-bold p-3.5 rounded-2xl border border-red-200">
                  ⚠️ {tableErrorMsg}
                </div>
              )}

              {/* Customer Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Nama Pemesan
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama pemesan"
                  className="w-full rounded-2xl border border-orange-100 bg-orange-50/50 p-4 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>

              {/* Table Number Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Nomor Meja
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  disabled={availableTables.length === 0}
                  className="w-full rounded-2xl border border-orange-100 bg-orange-50/50 p-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">{availableTables.length ? 'Pilih meja yang diberikan kasir' : 'Belum ada meja aktif'}</option>
                  {availableTables.map((table) => (
                    <option key={table.id} value={table.number}>Meja {table.number}</option>
                  ))}
                </select>
                <p className="text-[11px] font-medium text-slate-500">
                  Hanya meja yang diaktifkan kasir yang dapat dipilih.
                </p>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleProceedToMenu}
                disabled={availableTables.length === 0}
                className="w-full py-4 bg-[var(--primary)] hover:bg-orange-600 text-white font-bold text-sm rounded-2xl shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 mt-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>Mulai Pesan</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
            </div>
          </div>
        )}

        {/* =========================================
            STEP 3: MENU GRID SCREEN
           ========================================= */}
        {activeStep === 'MENU' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden animate-fadeIn">
            
            {/* Header Menu Bar */}
            <div className="shrink-0 border-b border-orange-100 bg-white p-4 pb-3 pt-5 text-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setActiveStep('LANDING')}
                  className="flex items-center gap-1 rounded-xl border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Beranda</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-xl">
                    Meja #{selectedTable}
                  </span>
                  <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {customerName}
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari bakso, mie, minuman..."
                  className="w-full rounded-xl border border-orange-100 bg-orange-50/50 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Slider */}
            <div className="bg-white border-b border-slate-200 p-2 overflow-x-auto scrollbar-none shrink-0 shadow-sm">
              <div className="flex gap-1.5 min-w-max px-2">
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat.key
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 bg-slate-100/60">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                {categories.find((c) => c.key === selectedCategory)?.label || 'Daftar Menu'} ({filteredMenu.length})
              </h2>

              {filteredMenu.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-slate-400 space-y-2 border border-slate-200/80">
                  <span className="text-3xl block">🔍</span>
                  <p className="text-xs font-bold text-slate-700">Menu tidak ditemukan</p>
                  <p className="text-[11px] text-slate-400">Silakan gunakan kata kunci pencarian lain.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredMenu.map((item) => {
                    const qtyInCart = getItemCartQty(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                      >
                        <div>
                          <div className="relative aspect-4/3 rounded-2xl overflow-hidden mb-2 bg-slate-100 flex items-center justify-center">
                            {item.image ? (
                              <img
                                src={optimizeCloudinaryImage(item.image, 480)}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-600 flex flex-col items-center justify-center text-white p-2 text-center">
                                <span className="text-2xl mb-0.5">🍲</span>
                                <span className="text-[11px] font-bold uppercase tracking-wider">{item.category}</span>
                              </div>
                            )}

                            <div className="absolute right-1.5 top-1.5 rounded-full border border-white/70 bg-white/95 px-2 py-0.5 text-[11px] font-bold text-slate-800 shadow-sm backdrop-blur-xs">
                              Rp {item.price.toLocaleString('id-ID')}
                            </div>

                            {qtyInCart > 0 && (
                              <div className="absolute top-1.5 left-1.5 bg-orange-600 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-scaleUp">
                                {qtyInCart}
                              </div>
                            )}
                          </div>

                          <h3 className="font-extrabold text-xs text-slate-900 leading-snug line-clamp-2">
                            {item.name}
                          </h3>
                        </div>

                        <button
                          type="button"
                          className={`mt-2.5 w-full py-1.5 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            qtyInCart > 0
                              ? 'bg-orange-600 text-white shadow-sm'
                              : 'bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{qtyInCart > 0 ? `Tambah (${qtyInCart})` : 'Tambah'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky Floating Freeze Cart Bar Footer */}
            {cartItems.length > 0 && (
              <div className="sticky bottom-3 left-3 right-3 z-40 px-3 pb-3 animate-slideUp">
                <button
                  type="button"
                  onClick={() => setIsCartModalOpen(true)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-orange-500 bg-gradient-to-r from-orange-600 to-amber-600 p-3.5 text-white shadow-2xl shadow-orange-600/30 hover:brightness-105 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 text-white font-extrabold text-xs flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-inner">
                      {totalCartQty}
                    </div>
                    <div className="text-left">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-orange-100">KERANJANG BELANJA</span>
                      <span className="text-sm font-extrabold text-white leading-none">
                        Rp {totalAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white text-orange-600 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md transition-all hover:bg-orange-50">
                    <span>Detil Pesanan ({cartItems.length})</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              </div>
            )}

            {/* MODAL DETIL KERANJANG & Rincian Kondiment */}
            {isCartModalOpen && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-xs animate-fadeIn">
                <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl animate-slideUp">
                  {/* Header Modal Detil Keranjang */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-white shadow-sm">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">Detil Keranjang Pesanan</h3>
                        <p className="text-[11px] font-bold text-slate-500">Meja #{selectedTable} • {cartItems.length} Jenis Menu</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCartModalOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* List Item & DETIL KONDIMENT LENGKAP */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                    {cartItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <h5 className="text-xs font-black text-slate-900">{item.menuName}</h5>
                            <span className="text-xs font-bold text-orange-600 block">
                              @ Rp {item.price.toLocaleString('id-ID')} &nbsp;•&nbsp; Total: Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                            </span>
                          </div>

                          {/* Tombol Kuantitas */}
                          <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-slate-200 shrink-0 shadow-xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, -1)}
                              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold text-slate-900 w-4 text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, 1)}
                              className="w-6 h-6 rounded-lg bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center transition-all cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* RINCIAN DETIL KONDIMENT */}
                        {item.selectedCondiments && item.selectedCondiments.length > 0 && (
                          <div className="mt-1 space-y-1.5 rounded-xl border border-amber-200/80 bg-amber-50/60 p-2.5">
                            <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-900 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600" /> Pilihan Kondiment / Varian:
                            </p>
                            <div className="space-y-1">
                              {item.selectedCondiments.map((grp, gIdx) => (
                                <div key={gIdx} className="text-[11px] font-medium text-amber-950">
                                  <span className="font-extrabold text-amber-900">{grp.groupName}: </span>
                                  {grp.options.map((opt) => `${opt.name}${opt.price ? ` (+Rp ${opt.price.toLocaleString('id-ID')})` : ''}`).join(', ')}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Catatan Item */}
                        {item.notes && (
                          <div className="text-[11px] font-medium text-slate-600 italic bg-slate-100 px-2.5 py-1 rounded-lg">
                            📝 Catatan: "{item.notes}"
                          </div>
                        )}

                        {(item.quantity > 1 || condimentGroups.some((group) => isGroupApplicable(group, menuItems.find((menu) => menu.id === item.menuId)!))) && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsCartModalOpen(false);
                              handleConfigurePerPortion(item);
                            }}
                            className="mt-1 self-start text-[11px] font-bold text-orange-600 hover:underline cursor-pointer"
                          >
                            ✏️ Ubah Varian / Kondiment Porsi Ini
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Modal Footer */}
                  <div className="border-t border-slate-100 bg-white p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm font-black text-slate-900">
                      <span>Total Biaya ({totalCartQty} Item)</span>
                      <span className="text-orange-600 text-base font-mono">Rp {totalAmount.toLocaleString('id-ID')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCartModalOpen(false);
                        setActiveStep('CART');
                      }}
                      className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <span>Lanjut ke Pembayaran</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* =========================================
            STEP 4: CART CHECKOUT SCREEN (Ringkasan Pembayaran)
           ========================================= */}
        {activeStep === 'CART' && (
          <div className="flex-1 bg-white flex flex-col justify-between overflow-hidden animate-fadeIn">
            
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-600" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                    Ringkasan & Konfirmasi Pembayaran
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500">
                    Meja #{selectedTable} • {customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep('MENU')}
                className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cart Items List — Tampilan Ringkas & Bersih untuk Kasir/Pembayaran */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-slate-400">Ringkasan Pesanan ({cartItems.length}):</h4>
                <button
                  type="button"
                  onClick={() => setIsCartModalOpen(true)}
                  className="text-[11px] font-bold text-orange-600 hover:underline cursor-pointer"
                >
                  Lihat Detil Kondiment
                </button>
              </div>
              
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/50 p-1">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-black text-slate-900 truncate">{item.menuName}</h5>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {item.quantity} x Rp {item.price.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <span className="text-xs font-black text-slate-900 font-mono shrink-0">
                      Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-orange-50/80 border border-orange-200 p-3.5 rounded-2xl text-[11px] text-orange-900 font-semibold space-y-1">
                <p className="font-extrabold flex items-center gap-1">
                  ℹ️ Informasi Pengiriman & Pembayaran:
                </p>
                <p>Pesanan akan langsung terkirim secara **real-time ke Kasir & Dapur**. Pembayaran dilakukan di Kasir.</p>
              </div>
            </div>

            {/* Cart Footer */}
            <div className="p-4 border-t border-slate-100 bg-white space-y-3">
              <div className="flex justify-between text-sm font-black text-slate-900">
                <span>TOTAL PEMBAYARAN</span>
                <span className="text-orange-600 text-base font-mono">Rp {totalAmount.toLocaleString('id-ID')}</span>
              </div>

              <button
                type="button"
                onClick={handleSubmitOrder}
                className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Kirim Pesanan ke Dapur & Kasir</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

        {/* =========================================
            STEP 5: ORDER SUCCESS (Screenshot 5 Match)
           ========================================= */}
        {activeStep === 'ORDER_SUCCESS' && (
          <div className="animate-fadeIn flex-1 space-y-5 overflow-y-auto bg-[var(--primary-soft)] p-5">
            <div className="space-y-5 pt-2">
              
              {/* Big Green Checkmark Badge Header */}
              <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 mx-auto">
                  <Check className="w-10 h-10 stroke-[3.5]" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Pesanan Terkirim!
                </h3>
                <p className="text-xs font-bold text-slate-500">
                  Pesanan <span className="font-bold text-slate-900">{liveSubmittedOrder?.orderNumber || '#001'}</span> sedang diproses dapur.
                </p>
              </div>

              {/* Action Buttons Grid (WhatsApp & Simpan Struk) */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`https://wa.me/${profile.phone?.replace(/[^0-9]/g, '') || '628123456789'}?text=Halo%20Kasir,%20saya%20sudah%20memesan%20order%20${liveSubmittedOrder?.orderNumber}%20di%20Meja%20${selectedTable}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    toast('Struk Tersimpan', 'Struk digital pesanan Anda berhasil disimpan!');
                  }}
                  className="py-3.5 bg-[var(--primary)] hover:bg-orange-600 text-white font-bold text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Simpan Struk</span>
                </button>
              </div>

              {/* Receipt Card (RINCIAN PESANAN) */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Receipt className="w-4 h-4 text-slate-400" />
                  <h4 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                    RINCIAN PESANAN
                  </h4>
                </div>

                <div className="space-y-3">
                  {(liveSubmittedOrder?.items || cartItems).map((it) => (
                    <div key={it.id} className="flex items-start justify-between text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-900">{it.menuName}</p>
                        {it.selectedCondiments && it.selectedCondiments.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {it.selectedCondiments.flatMap((g) => g.options).map((opt, i) => (
                              <span key={i} className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-lg uppercase">
                                {opt.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-slate-400 font-bold block">{it.quantity}x</span>
                        <span className="font-bold text-slate-900 font-mono">Rp {(it.price * it.quantity).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500 font-bold">
                    <span>Subtotal</span>
                    <span className="font-mono">Rp {totalAmount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
                    <span>Total</span>
                    <span className="text-orange-600 font-mono text-base">Rp {totalAmount.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Back Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetToLanding}
                className="w-full py-4 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4 text-slate-400" />
                <span>Kembali ke Halaman Utama</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Condiment Selection Modal */}
      <CondimentSelectionModal
        isOpen={!!activeItemForCondiment}
        onClose={() => { setActiveItemForCondiment(null); setEditingCartItemId(null); }}
        menuItem={activeItemForCondiment}
        condimentGroups={condimentGroups}
        onConfirm={handleConfirmCondiments}
        initialSelectedCondiments={cartItems.find((item) => item.id === editingCartItemId)?.selectedCondiments}
        initialNotes={cartItems.find((item) => item.id === editingCartItemId)?.notes}
      />

    </div>
  );
};
