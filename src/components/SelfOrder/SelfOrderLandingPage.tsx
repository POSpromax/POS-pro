import React, { useState } from 'react';
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

export type SelfOrderStep = 'LANDING' | 'TABLE_INPUT' | 'MENU' | 'CART' | 'ORDER_SUCCESS';

interface SelfOrderLandingPageProps {
  tables: RestaurantTable[];
  menuItems: MenuItem[];
  profile: RestaurantProfile;
  condimentGroups: CondimentGroup[];
  isSelfOrderSystemEnabled?: boolean;
  orders?: Order[];
  onSubmitCustomerOrder: (order: Order & { qrToken?: string }) => void;
  initialTableNumber?: string;
  currentBranch: Branch;
  onShowToast?: (title: string, message: string) => void;
  qrToken?: string;
}

export const SelfOrderLandingPage: React.FC<SelfOrderLandingPageProps> = ({
  tables,
  menuItems,
  profile,
  condimentGroups,
  isSelfOrderSystemEnabled = true,
  orders = [],
  onSubmitCustomerOrder,
  initialTableNumber = '11',
  currentBranch,
  onShowToast,
  qrToken
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

  // Submitted Order Tracking State
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const [localToast, setLocalToast] = useState<string | null>(null);

  const toast = (title: string, message: string) => {
    if (onShowToast) { onShowToast(title, message); return; }
    setLocalToast(message);
    setTimeout(() => setLocalToast(null), 3000);
  };

  // Find active live order from global state
  const liveSubmittedOrder = orders.find((o) => o.id === submittedOrderId) || null;

  const normalizeTableNum = (str: string) => {
    if (!str) return '';
    const digits = str.trim().toUpperCase().replace(/^M-?/i, '').replace(/^0+/, '');
    return digits || str.trim().toUpperCase();
  };

  // Table status check
  const selectedTableObj = tables.find((t) => normalizeTableNum(t.number) === normalizeTableNum(selectedTable));
  const isSelectedTableEnabled = selectedTableObj
    ? selectedTableObj.isSelfOrderEnabled !== false && (!selectedTableObj.branchId || selectedTableObj.branchId === currentBranch.id)
    : true;

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
    if (!isSelfOrderSystemEnabled) {
      toast('Sistem Nonaktif', 'Sistem Self-Order QR sedang dinonaktifkan sementara oleh Kasir.');
      return;
    }
    setActiveStep('TABLE_INPUT');
  };

  const handleProceedToMenu = () => {
    setTableErrorMsg('');
    if (!customerName.trim()) {
      setTableErrorMsg('Silakan masukkan nama pemesan terlebih dahulu.');
      return;
    }
    if (!selectedTable || !selectedTable.trim()) {
      setTableErrorMsg('Silakan masukkan nomor meja Anda.');
      return;
    }

    const inputNormalized = normalizeTableNum(selectedTable);
    const foundTable = tables.find((t) => {
      const storedNormalized = normalizeTableNum(t.number);
      return (
        storedNormalized === inputNormalized ||
        t.number.trim().toUpperCase() === selectedTable.trim().toUpperCase()
      );
    });

    if (!foundTable) {
      setTableErrorMsg(`Meja "${selectedTable}" tidak ditemukan. Silakan periksa nomor yang tertera di meja Anda.`);
      return;
    }

    if (foundTable.isSelfOrderEnabled === false) {
      setTableErrorMsg(`Meja ${foundTable.number} saat ini sedang dinonaktifkan oleh Kasir.`);
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

    const orderId = crypto.randomUUID();
    const newOrder: Order = {
      id: orderId,
      orderNumber: '#' + Math.floor(100 + Math.random() * 900),
      customerName: customerName.trim(),
      tableNumber: selectedTable || '11',
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
      parentOrderId: selectedTableObj?.activeOrderId,
      qrToken: qrToken || undefined
    } as Order & { qrToken?: string };

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
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col items-center font-sans text-slate-800 antialiased select-none w-full">
      {localToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg animate-pulse">
          {localToast}
        </div>
      )}
      {/* Clean Responsive Web App Wrapper */}
      <div className="w-full max-w-lg min-h-screen bg-[#F4F5F7] flex flex-col relative shadow-sm">
        
        {/* =========================================
            STEP 1: LANDING PAGE (Screenshot 1 Match)
           ========================================= */}
        {activeStep === 'LANDING' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F4F5F7]">
            <div className="space-y-4">
              
              {/* Top Restaurant Profile Header Card */}
              <div className="bg-white rounded-[28px] p-4.5 shadow-sm border border-slate-200/60 flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-black text-xl flex items-center justify-center shadow-md overflow-hidden border border-slate-100">
                    {profile.logoUrl ? (
                      <img src={profile.logoUrl} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                      'BU'
                    )}
                  </div>
                  <span className="w-4 h-4 bg-emerald-500 border-2 border-white rounded-full absolute -bottom-0.5 -right-0.5 shadow-xs" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-black text-base text-slate-900 tracking-tight leading-tight uppercase truncate">
                    {profile.name || 'BAKSO UJO'}
                  </h1>
                  <p className="text-[11px] font-bold text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    📍 {currentBranch.address || profile.address || 'Jl. Re. Abdullah No.7-9, RT.01/RW.07, Pasirmulya BOGOR BARAT'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full border border-emerald-200/60">
                      OPEN NOW
                    </span>
                  </div>
                </div>
              </div>

              {/* Disabled System Banner Notice */}
              {!isSelfOrderSystemEnabled && (
                <div className="bg-red-600 text-white text-xs font-black p-3.5 rounded-2xl text-center space-y-1 shadow-md flex items-center justify-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Sistem Self-Order QR sedang dinonaktifkan oleh Kasir.</span>
                </div>
              )}

              {/* Featured Promo Card */}
              <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/70 border border-amber-200/80 rounded-[28px] p-5 space-y-1.5 relative overflow-hidden shadow-2xs">
                <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-orange-600" />
                  <span>FEATURED</span>
                </div>
                <h3 className="font-black text-base text-slate-900 leading-tight">
                  FREE ICE CREAM ATAU ES TEH MANIS
                </h3>
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  TUNJUKAN REVIEW GMAPS DIKASIR
                </p>
              </div>

              {/* Primary Call-to-Action Button Card (MENU TERSEDIA - Pesan Makan) */}
              <button
                type="button"
                onClick={handleStartOrder}
                className="w-full bg-[#EA580C] hover:bg-orange-600 text-white rounded-[28px] p-5 px-6 shadow-xl shadow-orange-500/30 flex items-center justify-between transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div className="text-left space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-100 block opacity-90">
                    MENU TERSEDIA
                  </span>
                  <span className="text-2xl font-black text-white tracking-tight">
                    Pesan Makan
                  </span>
                </div>
                <div className="w-13 h-13 rounded-2xl bg-white text-orange-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <ArrowRight className="w-6 h-6 stroke-[3]" />
                </div>
              </button>

              {/* Info Grid (Clock & Phone) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-[24px] p-4.5 border border-slate-200/80 shadow-2xs text-center flex flex-col items-center justify-center space-y-1">
                  <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-1">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">JAM BUKA</span>
                  <span className="text-xs font-black text-slate-900">10:00 - 22:00</span>
                </div>

                <a
                  href={`https://wa.me/${profile.phone?.replace(/[^0-9]/g, '') || '628123456789'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white rounded-[24px] p-4.5 border border-slate-200/80 shadow-2xs text-center flex flex-col items-center justify-center space-y-1 hover:border-orange-200 transition-all cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-1">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">WHATSAPP</span>
                  <span className="text-xs font-black text-slate-900">Hubungi</span>
                </a>
              </div>

              {/* Review Google Maps Card */}
              <div className="bg-white rounded-[28px] p-5 border border-slate-200/80 shadow-2xs text-center space-y-1.5">
                <div className="flex justify-center gap-1 text-orange-500">
                  {'★'.repeat(5).split('').map((_, i) => (
                    <span key={i} className="text-lg">⭐</span>
                  ))}
                </div>
                <h4 className="font-black text-base text-slate-900">Ulas Kami</h4>
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
                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs hover:bg-slate-50 hover:text-orange-600 transition-all"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <button
                type="button"
                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs hover:bg-slate-50 hover:text-orange-600 transition-all"
              >
                <span className="font-black text-xs">🎵</span>
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
                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs hover:bg-slate-50 hover:text-orange-600 transition-all"
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
          <div className="flex-1 bg-[#F4F5F7] p-6 overflow-y-auto animate-fadeIn">
            {/* Pemusatan dipindah ke pembungkus dalam: kalau container yang
                men-scroll ikut memusatkan, isinya menyusut dan tidak bisa digulir. */}
            <div className="min-h-full flex flex-col justify-center space-y-6">
            <div className="text-center space-y-2">
              {/* Orange Chef Hat Icon Box */}
              <div className="w-20 h-20 bg-[#EA580C] text-white rounded-[24px] flex items-center justify-center shadow-xl shadow-orange-500/30 mx-auto">
                <ChefHat className="w-10 h-10 stroke-[2.2]" />
              </div>

              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Smart Order
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Welcome to intelligent dining
              </p>
            </div>

            {/* Form Container Box */}
            <div className="bg-white rounded-[32px] p-6 sm:p-7 shadow-xl border border-slate-100 space-y-5">
              {tableErrorMsg && (
                <div className="bg-red-50 text-red-600 text-xs font-black p-3.5 rounded-2xl border border-red-200">
                  ⚠️ {tableErrorMsg}
                </div>
              )}

              {/* Customer Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama pemesan"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-slate-900 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Table Number Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Table Number
                </label>
                <input
                  type="text"
                  value={selectedTable}
                  onChange={(e) => { if (!qrToken) setSelectedTable(e.target.value); }}
                  readOnly={Boolean(qrToken)}
                  placeholder="Nomor meja"
                  className={`w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-slate-900 transition-all placeholder:text-slate-400 ${qrToken ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
                {qrToken && (
                  <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Meja terverifikasi dari QR
                  </p>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleProceedToMenu}
                className="w-full py-4 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 mt-2"
              >
                <span>Start Order</span>
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
            <div className="bg-slate-900 text-white p-4 pt-5 pb-3 shrink-0 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setActiveStep('LANDING')}
                  className="flex items-center gap-1 bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold hover:text-white"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Beranda</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-xl">
                    Meja #{selectedTable}
                  </span>
                  <span className="text-xs font-extrabold text-white bg-slate-800 px-2.5 py-1 rounded-xl">
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
                  className="w-full bg-slate-800 text-white placeholder-slate-400 text-xs pl-9 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 border border-slate-700/60 font-medium"
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
            <div className="bg-white border-b border-slate-200 p-2 overflow-x-auto scrollbar-none shrink-0 shadow-2xs">
              <div className="flex gap-1.5 min-w-max px-2">
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat.key
                        ? 'bg-orange-500 text-white shadow-xs'
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
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                {categories.find((c) => c.key === selectedCategory)?.label || 'Daftar Menu'} ({filteredMenu.length})
              </h2>

              {filteredMenu.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center text-slate-400 space-y-2 border border-slate-200/80">
                  <span className="text-3xl block">🔍</span>
                  <p className="text-xs font-bold text-slate-700">Menu tidak ditemukan</p>
                  <p className="text-[10px] text-slate-400">Silakan gunakan kata kunci pencarian lain.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredMenu.map((item) => {
                    const qtyInCart = getItemCartQty(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="bg-white rounded-3xl p-2.5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                      >
                        <div>
                          <div className="relative aspect-4/3 rounded-2xl overflow-hidden mb-2 bg-slate-100 flex items-center justify-center">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-600 flex flex-col items-center justify-center text-white p-2 text-center">
                                <span className="text-2xl mb-0.5">🍲</span>
                                <span className="text-[9px] font-black uppercase tracking-wider">{item.category}</span>
                              </div>
                            )}

                            <div className="absolute top-1.5 right-1.5 bg-slate-900/90 backdrop-blur-xs text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                              Rp {item.price.toLocaleString('id-ID')}
                            </div>

                            {qtyInCart > 0 && (
                              <div className="absolute top-1.5 left-1.5 bg-orange-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-scaleUp">
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
                              ? 'bg-orange-600 text-white shadow-xs'
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

            {/* Sticky Cart Bar Footer */}
            {cartItems.length > 0 && (
              <div className="absolute bottom-3 left-3 right-3 z-30 animate-slideUp">
                <button
                  type="button"
                  onClick={() => setActiveStep('CART')}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/80 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      {totalCartQty}
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase leading-tight">KERANJANG PESANAN</span>
                      <span className="text-xs font-black text-white leading-none">
                        Rp {totalAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all">
                    <span>Lihat Keranjang</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              </div>
            )}

          </div>
        )}

        {/* =========================================
            STEP 4: CART CHECKOUT SCREEN
           ========================================= */}
        {activeStep === 'CART' && (
          <div className="flex-1 bg-white flex flex-col justify-between overflow-hidden animate-fadeIn">
            
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-600" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                    Konfirmasi Keranjang
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500">
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

            {/* Cart Items List */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <h4 className="text-xs font-black uppercase text-slate-400">Item Pesanan ({cartItems.length}):</h4>
              
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start justify-between gap-2"
                >
                  <div className="flex-1 space-y-0.5">
                    <h5 className="text-xs font-extrabold text-slate-900">{item.menuName}</h5>
                    
                    {item.selectedCondiments && item.selectedCondiments.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {item.selectedCondiments.flatMap((g) => g.options).map((opt, i) => (
                          <span
                            key={i}
                            className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded-md uppercase"
                          >
                            + {opt.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.notes && (
                      <p className="text-[10px] font-medium text-amber-600 italic pt-0.5">
                        "{item.notes}"
                      </p>
                    )}

                    <span className="text-xs font-black text-orange-600 block pt-1">
                      Rp {item.price.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, -1)}
                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-black text-slate-900 w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, 1)}
                      className="w-6 h-6 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="bg-orange-50/70 border border-orange-200/80 p-3 rounded-2xl text-[11px] text-orange-900 font-semibold space-y-1">
                <p className="font-extrabold">ℹ️ Informasi Pembayaran:</p>
                <p>Pesanan akan langsung dikirim ke Dapur & Kasir. Pembayaran dilakukan di Kasir saat hidangan selesai / sebelum pulang.</p>
              </div>
            </div>

            {/* Cart Footer */}
            <div className="p-4 border-t border-slate-100 bg-white space-y-3">
              <div className="flex justify-between text-sm font-black text-slate-900">
                <span>TOTAL BAYAR</span>
                <span className="text-orange-600 text-base font-mono">Rp {totalAmount.toLocaleString('id-ID')}</span>
              </div>

              <button
                type="button"
                onClick={handleSubmitOrder}
                className="w-full py-4 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-2xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
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
          <div className="flex-1 bg-[#F4F5F7] p-5 overflow-y-auto animate-fadeIn space-y-5">
            <div className="space-y-5 pt-2">
              
              {/* Big Green Checkmark Badge Header */}
              <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 mx-auto">
                  <Check className="w-10 h-10 stroke-[3.5]" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Pesanan Terkirim!
                </h3>
                <p className="text-xs font-bold text-slate-500">
                  Pesanan <span className="font-black text-slate-900">{liveSubmittedOrder?.orderNumber || '#001'}</span> sedang diproses dapur.
                </p>
              </div>

              {/* Action Buttons Grid (WhatsApp & Simpan Struk) */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`https://wa.me/${profile.phone?.replace(/[^0-9]/g, '') || '628123456789'}?text=Halo%20Kasir,%20saya%20sudah%20memesan%20order%20${liveSubmittedOrder?.orderNumber}%20di%20Meja%20${selectedTable}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    toast('Struk Tersimpan', 'Struk digital pesanan Anda berhasil disimpan!');
                  }}
                  className="py-3.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Simpan Struk</span>
                </button>
              </div>

              {/* Receipt Card (RINCIAN PESANAN) */}
              <div className="bg-white rounded-[28px] p-5 border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Receipt className="w-4 h-4 text-slate-400" />
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    RINCIAN PESANAN
                  </h4>
                </div>

                <div className="space-y-3">
                  {(liveSubmittedOrder?.items || cartItems).map((it) => (
                    <div key={it.id} className="flex items-start justify-between text-xs">
                      <div className="space-y-0.5">
                        <p className="font-black text-slate-900">{it.menuName}</p>
                        {it.selectedCondiments && it.selectedCondiments.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {it.selectedCondiments.flatMap((g) => g.options).map((opt, i) => (
                              <span key={i} className="text-[9px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md uppercase">
                                {opt.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold block">{it.quantity}x</span>
                        <span className="font-black text-slate-900 font-mono">Rp {(it.price * it.quantity).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500 font-bold">
                    <span>Subtotal</span>
                    <span className="font-mono">Rp {totalAmount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-slate-900 pt-1">
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
                className="w-full py-4 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-800 font-black text-xs rounded-2xl shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
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
        onClose={() => setActiveItemForCondiment(null)}
        menuItem={activeItemForCondiment}
        condimentGroups={condimentGroups}
        onConfirm={handleConfirmCondiments}
      />

    </div>
  );
};
