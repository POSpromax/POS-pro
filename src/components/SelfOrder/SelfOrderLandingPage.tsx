import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Clock3,
  Home,
  Info,
  Instagram,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Minus,
  Pencil,
  PhoneCall,
  Plus,
  QrCode,
  Receipt,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserRound,
  Utensils,
  Wifi,
  X,
} from 'lucide-react';
import {isGroupApplicable} from '../../utils/condimentUtils';
import {optimizeCloudinaryImage} from '../../utils/imageUrl';
import {
  Branch,
  CategoryType,
  CondimentGroup,
  MenuItem,
  Order,
  OrderItem,
  RestaurantProfile,
  RestaurantTable,
  SelectedCondimentGroup,
} from '../../types/pos';
import {CondimentSelectionModal} from '../POS/CondimentSelectionModal';

export type SelfOrderStep = 'LANDING' | 'TABLE_INPUT' | 'MENU' | 'CART' | 'ORDER_SUCCESS';

interface SelfOrderLandingPageProps {
  tables: RestaurantTable[];
  menuItems: MenuItem[];
  profile: RestaurantProfile;
  condimentGroups: CondimentGroup[];
  isSelfOrderSystemEnabled?: boolean;
  orders?: Order[];
  onSubmitCustomerOrder: (order: Order) => Promise<Order>;
  initialTableNumber?: string;
  currentBranch: Branch;
  onShowToast?: (title: string, message: string) => void;
  isShiftActive?: boolean;
}

const formatMoney = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

const categoryOptions: Array<{key: CategoryType; label: string}> = [
  {key: 'ALL', label: 'Semua'},
  {key: 'BAKSO', label: 'Bakso'},
  {key: 'MIE AYAM', label: 'Mie Ayam'},
  {key: 'MAKANAN', label: 'Makanan'},
  {key: 'TAMBAHAN', label: 'Topping'},
  {key: 'KRIUK', label: 'Kriuk'},
  {key: 'MINUMAN', label: 'Minuman'},
  {key: 'BUNDLING', label: 'Paket'},
];

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
  const [activeStep, setActiveStep] = useState<SelfOrderStep>('LANDING');
  const [selectedTable, setSelectedTable] = useState(initialTableNumber);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [tableErrorMsg, setTableErrorMsg] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [activeItemForCondiment, setActiveItemForCondiment] = useState<MenuItem | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const [submittedOrderSnapshot, setSubmittedOrderSnapshot] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localToast, setLocalToast] = useState<string | null>(null);
  const localToastTimerRef = useRef<number | null>(null);

  const toast = (title: string, message: string) => {
    if (onShowToast) {
      onShowToast(title, message);
      return;
    }
    if (localToastTimerRef.current) window.clearTimeout(localToastTimerRef.current);
    setLocalToast(message);
    localToastTimerRef.current = window.setTimeout(() => setLocalToast(null), 3200);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTable = params.get('table');
    if (urlTable) setSelectedTable(urlTable.trim().replace(/^0+(?=\d)/, ''));
  }, []);

  useEffect(() => () => {
    if (localToastTimerRef.current) window.clearTimeout(localToastTimerRef.current);
  }, []);

  const normalizeTableNum = (value: string) => {
    if (!value) return '';
    const normalized = value.trim().toUpperCase().replace(/^M-?/i, '').replace(/^0+/, '');
    return normalized || value.trim().toUpperCase();
  };

  const availableTables = useMemo(() => tables
    .filter((table) => (
      (!table.branchId || table.branchId === currentBranch.id)
      && table.isSelfOrderEnabled !== false
      && table.status === 'READY'
    ))
    .sort((a, b) => a.number.localeCompare(b.number, 'id', {numeric: true})), [tables, currentBranch.id]);

  const selectedTableObj = availableTables.find(
    (table) => normalizeTableNum(table.number) === normalizeTableNum(selectedTable),
  );
  const liveSubmittedOrder = orders.find((order) => order.id === submittedOrderId) || submittedOrderSnapshot;

  const filteredMenu = useMemo(() => menuItems.filter((item) => {
    if (item.isManualPrice) return false;
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const keyword = searchQuery.trim().toLowerCase();
    return matchesCategory && (!keyword
      || item.name.toLowerCase().includes(keyword)
      || item.category.toLowerCase().includes(keyword));
  }), [menuItems, searchQuery, selectedCategory]);

  const totalCartQty = cartItems.reduce((total, item) => total + item.quantity, 0);
  const totalAmount = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const getItemCartQty = (menuId: string) => cartItems
    .filter((item) => item.menuId === menuId)
    .reduce((total, item) => total + item.quantity, 0);

  const handleStartOrder = () => {
    if (!isShiftActive) {
      toast('Shift Kasir Tutup', 'Outlet belum menerima Self-order. Silakan hubungi kasir.');
      return;
    }
    setActiveStep('TABLE_INPUT');
  };

  const handleProceedToMenu = () => {
    setTableErrorMsg('');
    if (!isShiftActive) {
      setTableErrorMsg('Shift kasir outlet ini sedang tutup. Silakan hubungi kasir.');
      return;
    }
    if (!customerName.trim()) {
      setTableErrorMsg('Masukkan nama pemesan agar kasir mudah mengenali pesanan Anda.');
      return;
    }
    if (!selectedTable.trim()) {
      setTableErrorMsg('Pilih nomor meja yang diberikan oleh kasir.');
      return;
    }
    
    // Validasi awal: cek apakah meja tersedia di list
    const tableObj = tables.find(
      (table) => normalizeTableNum(table.number) === normalizeTableNum(selectedTable) 
        && table.branchId === currentBranch.id
    );
    
    if (!tableObj) {
      setTableErrorMsg(`Meja ${selectedTable} tidak tersedia atau belum diaktifkan oleh kasir. Silakan periksa nomor meja atau hubungi kasir.`);
      return;
    }
    
    if (tableObj.status !== 'READY') {
      if (tableObj.status === 'OCCUPIED') {
        setTableErrorMsg(`Meja ${selectedTable} sedang digunakan pelanggan lain. Minta nomor meja lain kepada kasir.`);
      } else {
        setTableErrorMsg(`Meja ${selectedTable} belum dapat digunakan. Silakan hubungi kasir.`);
      }
      return;
    }
    
    if (!tableObj.isSelfOrderEnabled) {
      setTableErrorMsg(`Meja ${selectedTable} belum diaktifkan untuk self-order. Silakan hubungi kasir.`);
      return;
    }
    
    // Semua validasi lolos - lanjut ke menu
    setActiveStep('MENU');
  };

  const handleItemClick = (item: MenuItem) => {
    if (!item.isAvailable) {
      toast('Menu Sedang Habis', `${item.name} belum tersedia. Silakan pilih menu lain.`);
      return;
    }
    if (condimentGroups.some((group) => isGroupApplicable(group, item))) {
      setActiveItemForCondiment(item);
      return;
    }
    setCartItems((current) => {
      const existingIndex = current.findIndex(
        (cartItem) => cartItem.menuId === item.id && !cartItem.selectedCondiments?.length && !cartItem.notes,
      );
      if (existingIndex >= 0) {
        return current.map((cartItem, index) => index === existingIndex
          ? {...cartItem, quantity: cartItem.quantity + 1}
          : cartItem);
      }
      return [...current, {
        id: `cust-${crypto.randomUUID()}`,
        menuId: item.id,
        menuName: item.name,
        price: item.price,
        quantity: 1,
        category: item.category,
      }];
    });
  };

  const handleConfirmCondiments = (
    item: MenuItem,
    selectedCondiments: SelectedCondimentGroup[],
    notes: string,
    extraPrice: number,
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
    setCartItems((current) => [...current, {
      id: `cust-${crypto.randomUUID()}`,
      menuId: item.id,
      menuName: item.name,
      price: item.price + extraPrice,
      quantity: 1,
      category: item.category,
      notes: notes || undefined,
      selectedCondiments: selectedCondiments.length ? selectedCondiments : undefined,
    }]);
  };

  const handleConfigureItem = (cartItem: OrderItem) => {
    if (cartItem.quantity > 1) {
      setCartItems((current) => current.flatMap((item) => item.id !== cartItem.id ? [item] : Array.from(
        {length: item.quantity},
        (_, index) => ({...item, id: `${item.id}-p${index + 1}-${Date.now()}`, quantity: 1}),
      )));
      toast('Porsi Dipisahkan', 'Setiap porsi kini dapat memiliki varian dan catatan berbeda.');
      return;
    }
    const menuItem = menuItems.find((item) => item.id === cartItem.menuId);
    if (!menuItem) return;
    setEditingCartItemId(cartItem.id);
    setActiveItemForCondiment(menuItem);
    setIsCartModalOpen(false);
  };

  const handleUpdateQty = (cartItemId: string, delta: number) => {
    setCartItems((current) => current
      .map((item) => item.id === cartItemId
        ? (item.quantity + delta > 0 ? {...item, quantity: item.quantity + delta} : null)
        : item)
      .filter(Boolean) as OrderItem[]);
  };

  const handleSubmitOrder = async () => {
    if (isSubmitting) return;
    if (!isShiftActive) {
      toast('Pesanan Belum Dapat Dikirim', 'Shift kasir sedang tutup. Silakan hubungi kasir.');
      return;
    }
    if (!customerName.trim() || !selectedTableObj || cartItems.length === 0) {
      toast('Periksa Pesanan', 'Nama, nomor meja, dan isi keranjang wajib tersedia sebelum pesanan dikirim.');
      return;
    }
    
    // CRITICAL: Re-validate with FRESH data from tables state (not memoized availableTables)
    // Real-time subscription may have updated table status after user started filling cart
    const freshTable = tables.find(
      (t) => t.branchId === currentBranch.id && normalizeTableNum(t.number) === normalizeTableNum(selectedTable)
    );
    
    if (!freshTable) {
      toast('Meja Tidak Ditemukan', `Meja ${selectedTable} tidak tersedia. Silakan hubungi kasir.`);
      return;
    }
    
    if (freshTable.status !== 'READY') {
      toast('Meja Sudah Terpakai', `Meja ${selectedTable} baru saja digunakan pelanggan lain. Silakan pilih meja lain.`);
      return;
    }
    
    if (!freshTable.isSelfOrderEnabled) {
      toast('Meja Belum Diaktifkan', `Meja ${selectedTable} belum diaktifkan untuk self-order. Silakan hubungi kasir.`);
      return;
    }
    
    const draftOrder: Order = {
      id: crypto.randomUUID(),
      orderNumber: `#${Math.floor(100 + Math.random() * 900)}`,
      customerName: customerName.trim(),
      notes: orderNotes.trim() || undefined,
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
      cashierName: `Self Order - ${currentBranch.code || currentBranch.name}`,
      source: 'SELF_ORDER',
      parentOrderId: freshTable.activeOrderId,
    };
    setIsSubmitting(true);
    try {
      const savedOrder = await onSubmitCustomerOrder(draftOrder);
      setSubmittedOrderId(savedOrder.id);
      setSubmittedOrderSnapshot(savedOrder);
      setActiveStep('ORDER_SUCCESS');
    } catch (error) {
      // Detailed logging untuk debugging
      console.error('[SelfOrder] Submit Error:', {
        error: error instanceof Error ? error.message : String(error),
        table: selectedTable,
        tableObj: freshTable ? {
          id: freshTable.id,
          status: freshTable.status,
          enabled: freshTable.isSelfOrderEnabled
        } : null,
        branch: currentBranch.id,
        items: cartItems.length,
        total: totalAmount,
        draftOrder: {
          tableNumber: draftOrder.tableNumber,
          branchId: draftOrder.branchId,
          source: draftOrder.source
        }
      });
      
      const errorMsg = error instanceof Error ? error.message : 'Silakan coba kirim ulang.';
      if (!onShowToast) {
        toast('Pesanan Belum Terkirim', errorMsg);
      }
      
      // Specific error handling
      if (errorMsg.includes('sudah digunakan') || errorMsg.includes('sedang digunakan')) {
        toast('Meja Sudah Terpakai', 'Meja ini baru saja digunakan pelanggan lain. Silakan pilih meja lain atau hubungi kasir.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToLanding = () => {
    setSubmittedOrderId(null);
    setSubmittedOrderSnapshot(null);
    setCartItems([]);
    setOrderNotes('');
    setActiveStep('LANDING');
  };

  const handleShare = async () => {
    const order = liveSubmittedOrder;
    const text = order
      ? `${profile.name} - ${order.orderNumber} - Meja ${selectedTable} - ${formatMoney(order.total)}`
      : `${profile.name} - ${currentBranch.name}`;
    if (navigator.share) {
      await navigator.share({title: order ? 'Ringkasan pesanan' : profile.name, text, url: order ? undefined : window.location.href}).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(order ? text : window.location.href);
    toast(order ? 'Ringkasan Disalin' : 'Link Disalin', order ? 'Ringkasan pesanan berhasil disalin.' : 'Link outlet berhasil disalin.');
  };

  const serviceOpen = isShiftActive;
  const supportPhone = (currentBranch.phone || profile.phone || '').replace(/[^0-9]/g, '');
  const statusIndex = liveSubmittedOrder?.status === 'NEW' ? 0
    : liveSubmittedOrder?.status === 'COOKING' ? 1
      : liveSubmittedOrder?.status === 'READY' || liveSubmittedOrder?.status === 'COMPLETED' ? 2 : 0;

  return (
    <div className="theme-self-order min-h-[100dvh] w-full bg-[#fff7ed] font-sans text-slate-950 antialiased">
      {localToast && (
        <div role="status" className="fixed left-1/2 top-4 z-[100] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-center text-xs font-bold text-slate-700 shadow-[0_16px_50px_rgba(124,45,18,.18)] animate-fadeIn">
          {localToast}
        </div>
      )}

      <div className="relative mx-auto min-h-[100dvh] w-full max-w-[520px] overflow-hidden bg-[#fffaf5] shadow-[0_0_80px_rgba(124,45,18,.12)]">
        {activeStep === 'LANDING' && (
          <main className="min-h-[100dvh] pb-8 animate-fadeIn">
            <section className="relative overflow-hidden rounded-b-[2.5rem] bg-[#17130f] px-5 pb-7 pt-5 text-white">
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-orange-500/30 blur-3xl motion-safe:animate-pulse" />
              <div className="pointer-events-none absolute -bottom-28 -left-20 h-52 w-52 rounded-full border-[36px] border-orange-400/10" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-orange-100">
                  <QrCode className="h-3.5 w-3.5 text-orange-400" />
                  Smart Self-order
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black ${serviceOpen ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${serviceOpen ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  {serviceOpen ? 'MENERIMA ORDER' : 'BELUM TERSEDIA'}
                </span>
              </div>

              <div className="relative mt-8 flex items-center gap-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.6rem] border border-white/15 bg-gradient-to-br from-orange-400 to-orange-600 text-2xl font-black shadow-[0_16px_40px_rgba(234,88,12,.3)]">
                  {profile.logoUrl ? <img src={optimizeCloudinaryImage(profile.logoUrl, 200)} alt={profile.name} decoding="async" className="h-full w-full object-cover" /> : (profile.name || 'BU').slice(0, 2).toUpperCase()}
                  <span className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#17130f] bg-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-400">{currentBranch.code}</p>
                  <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight">{profile.name || currentBranch.name}</h1>
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium leading-relaxed text-white/55">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
                    <span className="line-clamp-2">{currentBranch.address || profile.address}</span>
                  </p>
                </div>
              </div>

              <div className="relative mt-7 rounded-[1.8rem] border border-white/10 bg-white/[.07] p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-950/40">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-black">Pesan tanpa menunggu</p>
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-white/55">Pilih meja, atur menu, lalu pesanan langsung diterima kasir dan dapur.</p>
                  </div>
                </div>
                <button type="button" onClick={handleStartOrder} disabled={!serviceOpen} className="mt-4 flex w-full items-center justify-between rounded-2xl bg-orange-500 px-4 py-3.5 text-left text-white shadow-[0_14px_30px_rgba(234,88,12,.28)] transition hover:bg-orange-400 active:scale-[.985] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none">
                  <span>
                    <span className="block text-[10px] font-black uppercase tracking-[.16em] opacity-70">Mulai dari sini</span>
                    <span className="mt-0.5 block text-sm font-black">Pesan menu sekarang</span>
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-orange-600">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </button>
              </div>
            </section>

            <section className="space-y-4 px-5 pt-5">
              {!serviceOpen && (
                <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <div><p className="text-xs font-black">Self-order sedang berhenti</p><p className="mt-1 text-[11px] font-medium leading-relaxed">Shift kasir outlet ini belum aktif. Hubungi petugas untuk bantuan.</p></div>
                </div>
              )}

              <div className="rounded-[1.7rem] border border-orange-100 bg-white p-4 shadow-[0_10px_35px_rgba(124,45,18,.06)]">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-600">Alur cepat</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[['01', 'Pilih meja'], ['02', 'Pilih menu'], ['03', 'Kirim order']].map(([number, label]) => (
                    <div key={number} className="rounded-2xl bg-orange-50 p-3 text-center">
                      <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white">{number}</span>
                      <p className="mt-2 text-[10px] font-black text-slate-700">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Tanpa pembayaran online · bayar langsung di kasir
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a href={supportPhone ? `https://wa.me/${supportPhone}` : undefined} aria-disabled={!supportPhone} onClick={(event) => {if (!supportPhone) event.preventDefault();}} target="_blank" rel="noreferrer" className={`flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-3.5 text-slate-800 transition ${supportPhone ? 'hover:border-orange-300' : 'cursor-not-allowed opacity-55'}`}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><PhoneCall className="h-4 w-4" /></span>
                  <span><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Bantuan</span><span className="text-xs font-black">WhatsApp</span></span>
                </a>
                <button type="button" onClick={() => void handleShare()} className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-3.5 text-left text-slate-800 transition hover:border-orange-300">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Share2 className="h-4 w-4" /></span>
                  <span><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Bagikan</span><span className="text-xs font-black">Link outlet</span></span>
                </button>
              </div>

              {profile.instagram && <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-slate-400"><Instagram className="h-3.5 w-3.5" /> {profile.instagram}</a>}
            </section>
          </main>
        )}

        {activeStep === 'TABLE_INPUT' && (
          <main className="min-h-[100dvh] px-5 pb-8 pt-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setActiveStep('LANDING')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-100 bg-white text-slate-700"><ArrowLeft className="h-4 w-4" /></button>
              <div className="flex items-center gap-1.5">{[0, 1, 2].map((step) => <span key={step} className={`h-1.5 rounded-full ${step === 0 ? 'w-8 bg-orange-500' : 'w-3 bg-orange-100'}`} />)}</div>
              <span className="rounded-full bg-orange-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-orange-700">Langkah 1/3</span>
            </div>

            <div className="pb-6 pt-9 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-2xl shadow-orange-500/50 ring-4 ring-orange-100">
                <UserRound className="h-9 w-9" />
              </div>
              <p className="mt-6 text-[11px] font-black uppercase tracking-[.24em] text-orange-600">Langkah 1 dari 3</p>
              <h2 className="mt-2 text-[28px] font-black leading-tight tracking-tight">Siapa dan di<br/>meja mana?</h2>
              <p className="mx-auto mt-3 max-w-[280px] text-[13px] font-semibold leading-relaxed text-slate-500">Kasir akan antar pesanan ke meja yang Anda pilih</p>
            </div>

            <section className="space-y-6 rounded-[2.5rem] border border-orange-100 bg-white p-6 shadow-[0_24px_60px_rgba(124,45,18,.12)]">
              {tableErrorMsg && (
                <div role="alert" className="flex gap-3 rounded-[1.5rem] border-2 border-rose-300 bg-rose-50 p-4 animate-shake">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                  <p className="text-[12px] font-bold leading-relaxed text-rose-700">{tableErrorMsg}</p>
                </div>
              )}
              
              <label className="block">
                <span className="mb-3 flex items-center gap-2.5 text-[12px] font-black text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50">
                    <UserRound className="h-4 w-4 text-orange-600" />
                  </div>
                  Nama Pemesan
                </span>
                <input 
                  autoComplete="name" 
                  value={customerName} 
                  onChange={(event) => setCustomerName(event.target.value.slice(0, 60))} 
                  placeholder="Contoh: Rere" 
                  className="w-full rounded-[1.25rem] border-2 border-orange-100 bg-orange-50/40 px-5 py-4 text-[15px] font-bold outline-none transition-all placeholder:text-slate-300 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/50" 
                />
              </label>

              <label className="block">
                <span className="mb-3 flex items-center gap-2.5 text-[12px] font-black text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50">
                    <Store className="h-4 w-4 text-orange-600" />
                  </div>
                  Nomor Meja dari Kasir
                </span>
                <div className="relative">
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={selectedTable}
                    onChange={(event) => {
                      setSelectedTable(event.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                      setTableErrorMsg('');
                    }}
                    placeholder="Masukkan nomor meja"
                    aria-describedby="self-order-table-help"
                    className="w-full rounded-[1.25rem] border-2 border-orange-100 bg-orange-50/40 px-5 py-4 pr-28 text-[18px] font-black outline-none transition-all placeholder:text-[15px] placeholder:font-bold placeholder:text-slate-300 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100/50"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">Meja</span>
                </div>
                <p id="self-order-table-help" className="mt-3 flex items-start gap-2 text-[11px] font-semibold leading-relaxed text-slate-400">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                  Server akan validasi ketersediaan meja saat pesanan dikirim
                </p>
              </label>

              <button 
                type="button" 
                onClick={handleProceedToMenu} 
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[1.25rem] bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 bg-size-200 py-5 text-[15px] font-black text-white shadow-2xl shadow-orange-500/40 transition-all duration-300 hover:bg-pos-100 hover:shadow-orange-500/60 active:scale-[.98]"
              >
                <span className="relative z-10">Lanjut Pilih Menu</span>
                <ArrowRight className="relative z-10 h-5 w-5 transition-transform group-hover:translate-x-1" />
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-700 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </section>
          </main>
        )}

        {activeStep === 'MENU' && (
          <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#fffaf5] animate-fadeIn">
            <header className="z-20 shrink-0 border-b border-orange-100 bg-white/95 px-4 pb-3 pt-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setActiveStep('TABLE_INPUT')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-700"><ArrowLeft className="h-4 w-4" /></button>
                <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.16em] text-orange-600">{currentBranch.code} · Meja {selectedTable}</p><h2 className="truncate text-base font-black">Mau makan apa, {customerName}?</h2></div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#17130f] text-orange-400"><Utensils className="h-4 w-4" /></div>
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari menu favorit..." className="w-full rounded-2xl border border-orange-100 bg-orange-50/50 py-3 pl-10 pr-10 text-xs font-bold outline-none transition focus:border-orange-300 focus:bg-white" />
                {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="h-4 w-4" /></button>}
              </div>
            </header>

            <div className="shrink-0 overflow-x-auto border-b border-orange-100 bg-white px-4 py-2.5 scrollbar-none">
              <div className="flex min-w-max gap-2">{categoryOptions.map((category) => <button key={category.key} type="button" onClick={() => setSelectedCategory(category.key)} className={`rounded-full px-4 py-2 text-[10px] font-black transition ${selectedCategory === category.key ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'bg-orange-50 text-slate-600 hover:bg-orange-100'}`}>{category.label}</button>)}</div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4">
              <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">{categoryOptions.find((category) => category.key === selectedCategory)?.label}</p><span className="text-[10px] font-bold text-slate-400">{filteredMenu.length} menu</span></div>
              {filteredMenu.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {filteredMenu.map((item) => {
                    const quantity = getItemCartQty(item.id);
                    return <button key={item.id} type="button" onClick={() => handleItemClick(item)} className={`group relative overflow-hidden rounded-[1.5rem] border bg-white p-2.5 text-left shadow-[0_8px_28px_rgba(124,45,18,.06)] transition active:scale-[.98] ${item.isAvailable ? 'border-orange-100 hover:-translate-y-0.5 hover:border-orange-300' : 'cursor-not-allowed border-slate-100 opacity-60'}`}>
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.1rem] bg-orange-50">
                        {item.image ? <img src={optimizeCloudinaryImage(item.image, 480)} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-orange-200"><Utensils className="h-8 w-8" /></div>}
                        {!item.isAvailable && <span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-[10px] font-black uppercase tracking-widest text-white">Habis</span>}
                        {quantity > 0 && <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-orange-500 px-2 text-[10px] font-black text-white shadow-lg">{quantity}</span>}
                      </div>
                      <div className="px-1 pb-1 pt-2.5"><p className="line-clamp-2 min-h-8 text-[11px] font-black leading-snug text-slate-900">{item.name}</p><div className="mt-2 flex items-end justify-between gap-1"><span className="text-xs font-black text-orange-600">{formatMoney(item.price)}</span><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#17130f] text-orange-400"><Plus className="h-3.5 w-3.5" /></span></div></div>
                    </button>;
                  })}
                </div>
              ) : <div className="rounded-[1.7rem] border border-dashed border-orange-200 bg-white p-10 text-center"><Search className="mx-auto h-7 w-7 text-orange-200" /><p className="mt-3 text-xs font-black">Menu tidak ditemukan</p><p className="mt-1 text-[10px] font-medium text-slate-400">Coba kategori atau kata kunci lainnya.</p></div>}
            </div>

            {totalCartQty > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 py-4 pb-6"><button type="button" onClick={() => setIsCartModalOpen(true)} className="pointer-events-auto flex w-full items-center gap-3 rounded-[1.4rem] bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 p-3 text-white shadow-[0_20px_50px_rgba(234,88,12,.4)] transition hover:shadow-[0_25px_60px_rgba(234,88,12,.5)] active:scale-[.985]"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-orange-600 text-base font-black shadow-lg">{totalCartQty}</span><span className="min-w-0 flex-1 text-left"><span className="block text-[10px] font-black uppercase tracking-widest opacity-90">Keranjang</span><span className="block text-base font-black">{formatMoney(totalAmount)}</span></span><span className="flex items-center gap-1 text-xs font-black">Periksa <ChevronRight className="h-5 w-5" /></span></button></div>}
          </main>
        )}

        {activeStep === 'CART' && (
          <main className="flex min-h-[100dvh] flex-col bg-[#fffaf5] animate-fadeIn">
            <header className="flex items-center gap-3 border-b border-orange-100 bg-white px-4 py-4">
              <button type="button" onClick={() => setActiveStep('MENU')} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-700"><ArrowLeft className="h-4 w-4" /></button>
              <div className="flex-1"><p className="text-[9px] font-black uppercase tracking-[.16em] text-orange-600">Langkah terakhir</p><h2 className="text-base font-black">Periksa pesanan</h2></div>
              <span className="rounded-full bg-orange-100 px-3 py-1.5 text-[9px] font-black text-orange-700">Meja {selectedTable}</span>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-32">
              <div className="rounded-[1.7rem] border border-orange-100 bg-white p-4 shadow-[0_10px_35px_rgba(124,45,18,.06)]">
                <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{totalCartQty} item dipilih</p><button type="button" onClick={() => setActiveStep('MENU')} className="text-[10px] font-black text-orange-600">+ Tambah menu</button></div>
                <div className="divide-y divide-orange-50">{cartItems.map((item) => <div key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0"><span className="flex h-8 min-w-8 items-center justify-center rounded-xl bg-orange-50 text-[10px] font-black text-orange-700">{item.quantity}×</span><div className="min-w-0 flex-1"><p className="text-xs font-black">{item.menuName}</p>{item.selectedCondiments?.map((group) => <p key={`${item.id}-${group.groupName}`} className="mt-1 text-[9px] font-medium leading-relaxed text-slate-400">{group.groupName}: {group.options.join(', ')}</p>)}{item.notes && <p className="mt-1 text-[9px] font-bold text-orange-600">Catatan: {item.notes}</p>}</div><span className="shrink-0 text-[11px] font-black">{formatMoney(item.price * item.quantity)}</span></div>)}</div>
                <button type="button" onClick={() => setIsCartModalOpen(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-50 py-2.5 text-[10px] font-black text-orange-700"><Pencil className="h-3.5 w-3.5" /> Ubah jumlah atau varian</button>
              </div>

              <label className="block rounded-[1.7rem] border border-orange-100 bg-white p-4">
                <span className="flex items-center justify-between text-[11px] font-black"><span>Catatan untuk dapur</span><span className="text-[9px] font-bold text-slate-300">Opsional · {orderNotes.length}/500</span></span>
                <textarea value={orderNotes} onChange={(event) => setOrderNotes(event.target.value.slice(0, 500))} rows={3} placeholder="Contoh: antar bersamaan, tanpa bawang..." className="mt-3 w-full resize-none rounded-2xl border border-orange-100 bg-orange-50/50 px-3.5 py-3 text-xs font-semibold outline-none focus:border-orange-300 focus:bg-white" />
              </label>

              <div className="flex gap-3 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4 text-emerald-900"><Wifi className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-[11px] font-black">Langsung masuk ke kasir dan dapur</p><p className="mt-1 text-[10px] font-medium leading-relaxed text-emerald-800/70">Tidak ada pembayaran online. Pembayaran dilakukan kepada kasir sebelum atau setelah makan.</p></div></div>
            </div>

            <footer className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] border-t border-orange-100 bg-white/95 p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-end justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total pesanan</span><span className="text-xl font-black tracking-tight text-orange-600">{formatMoney(totalAmount)}</span></div>
              <button type="button" onClick={() => void handleSubmitOrder()} disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-4 text-sm font-black text-white shadow-[0_14px_35px_rgba(234,88,12,.3)] transition hover:bg-orange-600 active:scale-[.985] disabled:cursor-wait disabled:bg-orange-300">{isSubmitting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Mengirim pesanan...</> : <>Konfirmasi &amp; kirim pesanan <ArrowRight className="h-4 w-4" /></>}</button>
            </footer>
          </main>
        )}

        {activeStep === 'ORDER_SUCCESS' && (
          <main className="min-h-[100dvh] bg-[#fffaf5] px-5 pb-8 pt-6 animate-fadeIn">
            <section className="relative overflow-hidden rounded-[2rem] bg-[#17130f] p-5 text-white shadow-[0_22px_60px_rgba(23,19,15,.25)]">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-orange-500/25 blur-2xl" />
              <div className="relative flex items-start justify-between"><div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-emerald-400 text-[#17130f]"><Check className="h-7 w-7 stroke-[3]" /></div><span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-orange-200">{liveSubmittedOrder?.orderNumber}</span></div>
              <div className="relative mt-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Pesanan diterima server</p><h2 className="mt-1 text-2xl font-black tracking-tight">Berhasil dikirim!</h2><p className="mt-2 text-xs font-medium leading-relaxed text-white/55">Pantau progres di layar ini. Pesanan Anda sudah masuk ke outlet {currentBranch.name}.</p></div>
            </section>

            <section className="mt-4 rounded-[1.7rem] border border-orange-100 bg-white p-4 shadow-[0_10px_35px_rgba(124,45,18,.06)]">
              <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status pesanan</p><p className="mt-1 text-sm font-black">{statusIndex === 0 ? 'Menunggu diterima dapur' : statusIndex === 1 ? 'Sedang dimasak' : 'Dapur selesai'}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><ChefHat className="h-5 w-5" /></span></div>
              <div className="mt-5 grid grid-cols-3 gap-2">{['Diterima', 'Dimasak', 'Selesai'].map((label, index) => <div key={label} className="text-center"><span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border-4 border-white text-[10px] font-black shadow-sm ${index <= statusIndex ? 'bg-orange-500 text-white ring-2 ring-orange-100' : 'bg-slate-100 text-slate-300'}`}>{index < statusIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><p className={`mt-2 text-[9px] font-black ${index <= statusIndex ? 'text-slate-800' : 'text-slate-300'}`}>{label}</p></div>)}</div>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] font-bold text-amber-800"><Clock3 className="h-3.5 w-3.5 shrink-0" /> Pembayaran dilakukan langsung kepada kasir.</div>
            </section>

            <section className="mt-4 rounded-[1.7rem] border border-orange-100 bg-white p-4">
              <div className="flex items-center justify-between border-b border-orange-50 pb-3"><div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-orange-500" /><p className="text-[10px] font-black uppercase tracking-widest">Ringkasan order</p></div><span className="text-[10px] font-black text-orange-600">Meja {selectedTable}</span></div>
              <div className="divide-y divide-orange-50">{(liveSubmittedOrder?.items || cartItems).map((item) => <div key={item.id} className="flex items-start gap-3 py-3"><span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-orange-50 text-[9px] font-black text-orange-700">{item.quantity}×</span><div className="min-w-0 flex-1"><p className="text-[11px] font-black">{item.menuName}</p>{item.selectedCondiments?.map((group) => <p key={`${item.id}-${group.groupName}`} className="mt-1 text-[9px] font-medium text-slate-400">{group.groupName}: {group.options.join(', ')}</p>)}{item.notes && <p className="mt-1 text-[9px] font-medium text-orange-600">Catatan: {item.notes}</p>}</div><span className="text-[10px] font-black">{formatMoney(item.price * item.quantity)}</span></div>)}</div>
              {liveSubmittedOrder?.notes && <div className="rounded-xl bg-orange-50 px-3 py-2 text-[10px] font-medium text-orange-800">Catatan: {liveSubmittedOrder.notes}</div>}
              <div className="mt-3 flex items-end justify-between border-t border-dashed border-orange-200 pt-3"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span><span className="text-lg font-black text-orange-600">{formatMoney(liveSubmittedOrder?.total || totalAmount)}</span></div>
            </section>

            <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => void handleShare()} className="flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white py-3.5 text-[11px] font-black text-orange-700"><Share2 className="h-4 w-4" /> Bagikan</button><a href={supportPhone ? `https://wa.me/${supportPhone}` : undefined} aria-disabled={!supportPhone} onClick={(event) => {if (!supportPhone) event.preventDefault();}} target="_blank" rel="noreferrer" className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[11px] font-black text-white ${supportPhone ? 'bg-emerald-500' : 'cursor-not-allowed bg-slate-300'}`}><MessageCircle className="h-4 w-4" /> {supportPhone ? 'Hubungi kasir' : 'Nomor belum tersedia'}</a></div>
            <button type="button" onClick={handleResetToLanding} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[11px] font-black text-slate-400"><Home className="h-4 w-4" /> Kembali ke beranda</button>
          </main>
        )}

        {isCartModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm animate-fadeIn sm:p-4">
            <section className="flex max-h-[88dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl animate-slideUp sm:rounded-[2rem]">
              <header className="flex items-center gap-3 border-b border-orange-100 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-white"><ShoppingBag className="h-4 w-4" /></span><div className="flex-1"><p className="text-sm font-black">Keranjang pesanan</p><p className="text-[9px] font-bold text-slate-400">{totalCartQty} item · Meja {selectedTable}</p></div><button type="button" onClick={() => setIsCartModalOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><X className="h-4 w-4" /></button></header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-[#fffaf5] p-4">{cartItems.map((item) => <article key={item.id} className="rounded-[1.4rem] border border-orange-100 bg-white p-3.5"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-black">{item.menuName}</p><p className="mt-1 text-[10px] font-black text-orange-600">{formatMoney(item.price * item.quantity)}</p></div><div className="flex items-center gap-1 rounded-xl bg-orange-50 p-1"><button type="button" onClick={() => handleUpdateQty(item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-600"><Minus className="h-3 w-3" /></button><span className="w-7 text-center text-[11px] font-black">{item.quantity}</span><button type="button" onClick={() => handleUpdateQty(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white"><Plus className="h-3 w-3" /></button></div></div>{item.selectedCondiments?.map((group) => <p key={`${item.id}-${group.groupName}`} className="mt-2 text-[9px] font-medium leading-relaxed text-slate-500"><span className="font-black">{group.groupName}:</span> {group.options.join(', ')}</p>)}{item.notes && <p className="mt-2 rounded-lg bg-orange-50 px-2 py-1.5 text-[9px] font-bold text-orange-700">Catatan: {item.notes}</p>}<button type="button" onClick={() => handleConfigureItem(item)} className="mt-3 flex items-center gap-1 text-[9px] font-black text-orange-600"><Pencil className="h-3 w-3" /> {item.quantity > 1 ? 'Pisahkan untuk atur per porsi' : 'Ubah varian / catatan'}</button></article>)}</div>
              <footer className="border-t border-orange-100 bg-white p-4"><div className="mb-3 flex items-end justify-between"><span className="text-[10px] font-black text-slate-400">Total keranjang</span><span className="text-lg font-black text-orange-600">{formatMoney(totalAmount)}</span></div><button type="button" disabled={!cartItems.length} onClick={() => {setIsCartModalOpen(false); setActiveStep('CART');}} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#17130f] py-3.5 text-xs font-black text-white disabled:bg-slate-200">Lanjut periksa pesanan <ArrowRight className="h-4 w-4" /></button></footer>
            </section>
          </div>
        )}
      </div>

      <CondimentSelectionModal
        isOpen={Boolean(activeItemForCondiment)}
        onClose={() => {setActiveItemForCondiment(null); setEditingCartItemId(null);}}
        menuItem={activeItemForCondiment}
        condimentGroups={condimentGroups}
        onConfirm={handleConfirmCondiments}
        initialSelectedCondiments={cartItems.find((item) => item.id === editingCartItemId)?.selectedCondiments}
        initialNotes={cartItems.find((item) => item.id === editingCartItemId)?.notes}
        onShowToast={toast}
        visualMode="SELF_ORDER"
      />
    </div>
  );
};
