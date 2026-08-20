import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  Home,
  Info,
  Instagram,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
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
import {getPublicOrderStatus} from '../../services/orderService';
import {CondimentSelectionModal} from '../POS/CondimentSelectionModal';

export type SelfOrderStep = 'LANDING' | 'TABLE_INPUT' | 'MENU' | 'CART' | 'SENDING' | 'ORDER_SUCCESS';

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

const normalizeWhatsappNumber = (value: string) => {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
};

const normalizeTableNum = (value: string) => {
  if (!value) return '';
  const normalized = value.trim().toUpperCase().replace(/^M-?/i, '').replace(/^0+/, '');
  return normalized || value.trim().toUpperCase();
};


const normalizeCondimentLabel = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const resolveSelfOrderRole = (group: CondimentGroup): 'NONE' | 'BROTH' | 'FILLING' => {
  if (group.selfOrderRole === 'BROTH' || group.selfOrderRole === 'FILLING') {
    return group.selfOrderRole;
  }

  // Canonical groups self-heal even when an older branch config stored NONE.
  const normalized = normalizeCondimentLabel(group.name);
  if (normalized.includes('KUAH')) return 'BROTH';
  if (normalized.includes('ISIAN')) return 'FILLING';
  return 'NONE';
};

const SelfOrderStepProgress = ({step}: {step: 1 | 2 | 3}) => (
  <div className="so-step-progress" aria-label={`Langkah ${step} dari 3`}>
    {[1, 2, 3].map((item) => (
      <span key={item} data-active={item <= step ? 'true' : 'false'} />
    ))}
  </div>
);

export const SelfOrderLandingPage: React.FC<SelfOrderLandingPageProps> = ({
  tables,
  menuItems,
  profile,
  condimentGroups,
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
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const [submittedOrderSnapshot, setSubmittedOrderSnapshot] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localToast, setLocalToast] = useState<string | null>(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
  const [showGeneralNote, setShowGeneralNote] = useState(false);
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

  const selectedTableState = tables.find(
    (table) => (!table.branchId || table.branchId === currentBranch.id)
      && normalizeTableNum(table.number) === normalizeTableNum(selectedTable),
  );
  const tableInputStatus = !selectedTable.trim()
    ? { label: 'Belum diisi', className: 'bg-[var(--so-brand-soft)] text-[var(--so-brand)]' }
    : !selectedTableState
      ? { label: 'Tidak ditemukan', className: 'bg-rose-50 text-rose-700' }
      : selectedTableState.status === 'OCCUPIED' || Boolean(selectedTableState.activeOrderId)
        ? { label: 'Terpakai', className: 'bg-rose-50 text-rose-700' }
        : selectedTableState.status === 'READY' && selectedTableState.isSelfOrderEnabled
          ? { label: 'Siap', className: 'bg-emerald-50 text-emerald-700' }
          : { label: 'Belum aktif', className: 'bg-slate-100 text-slate-600' };
  const canProceedToMenu = Boolean(customerName.trim() && selectedTableObj && isShiftActive);

  const liveSubmittedOrder = orders.find((order) => order.id === submittedOrderId) || submittedOrderSnapshot;

  useEffect(() => {
    if (activeStep !== 'ORDER_SUCCESS' || !submittedOrderId || !currentBranch.id) return;
    if (submittedOrderSnapshot?.status === 'READY' || submittedOrderSnapshot?.status === 'COMPLETED' || submittedOrderSnapshot?.status === 'CANCELLED') return;
    let active = true;
    let refreshing = false;

    const refreshSubmittedOrder = () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      void getPublicOrderStatus(currentBranch.id, submittedOrderId)
        .then((order) => {
          if (active && order) {
            setSubmittedOrderSnapshot((current) => current ? {
              ...current,
              status: order.status,
              paymentStatus: order.paymentStatus,
              updatedAt: order.updatedAt,
            } : order);
          }
        })
        .catch(() => undefined)
        .finally(() => { refreshing = false; });
    };

    refreshSubmittedOrder();
    const timer = window.setInterval(refreshSubmittedOrder, 15_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshSubmittedOrder();
    };
    window.addEventListener('focus', refreshSubmittedOrder);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshSubmittedOrder);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [activeStep, submittedOrderId, currentBranch.id, submittedOrderSnapshot?.status]);

  const filteredMenu = useMemo(() => menuItems.filter((item) => {
    if (item.isManualPrice) return false;
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const keyword = searchQuery.trim().toLowerCase();
    return matchesCategory && (!keyword
      || item.name.toLowerCase().includes(keyword)
      || item.category.toLowerCase().includes(keyword));
  }), [menuItems, searchQuery, selectedCategory]);
  const filteredAvailableCount = filteredMenu.filter((item) => item.isAvailable !== false).length;

  const totalCartQty = cartItems.reduce((total, item) => total + item.quantity, 0);
  const totalAmount = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const getItemCartQty = (menuId: string) => cartItems
    .filter((item) => item.menuId === menuId)
    .reduce((total, item) => total + item.quantity, 0);

  const serviceOpen = isShiftActive;
  const supportPhone = normalizeWhatsappNumber(currentBranch.phone || profile.phone || '');
  const googleReviewUrl = profile.googleReviewUrl?.trim() || '';
  const wallpaperUrl = profile.wallpaperBackgroundUrl
    ? optimizeCloudinaryImage(profile.wallpaperBackgroundUrl, 1100)
    : '';
  const statusIndex = liveSubmittedOrder?.status === 'NEW' ? 0
    : liveSubmittedOrder?.status === 'COOKING' ? 1
      : liveSubmittedOrder?.status === 'READY' || liveSubmittedOrder?.status === 'COMPLETED' ? 2 : 0;

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
      setTableErrorMsg('Masukkan nomor meja yang diberikan oleh kasir.');
      return;
    }

    const tableObj = tables.find(
      (table) => normalizeTableNum(table.number) === normalizeTableNum(selectedTable)
        && (!table.branchId || table.branchId === currentBranch.id),
    );

    if (!tableObj) {
      setTableErrorMsg(`Meja ${selectedTable} tidak tersedia atau belum diaktifkan oleh kasir.`);
      return;
    }
    if (tableObj.status !== 'READY') {
      setTableErrorMsg(tableObj.status === 'OCCUPIED'
        ? `Meja ${selectedTable} sedang memiliki pesanan aktif. Silakan hubungi kasir.`
        : `Meja ${selectedTable} belum dapat digunakan. Silakan hubungi kasir.`);
      return;
    }
    if (!tableObj.isSelfOrderEnabled) {
      setTableErrorMsg(`Meja ${selectedTable} belum diaktifkan untuk self-order. Silakan hubungi kasir.`);
      return;
    }

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

  const splitCartItemIntoSinglePortions = (cartItemId: string) => {
    setCartItems((current) => current.flatMap((item) => {
      if (item.id !== cartItemId || item.quantity <= 1) return [item];
      return Array.from({length: item.quantity}, (_, index) => ({
        ...item,
        id: `${item.id}-p${index + 1}-${Date.now()}`,
        quantity: 1,
      }));
    }));
    toast('Porsi Dipisahkan', 'Setiap porsi sekarang dapat memiliki catatan yang berbeda.');
  };

  const handleConfigureItem = (cartItem: OrderItem) => {
    if (cartItem.quantity > 1) {
      splitCartItemIntoSinglePortions(cartItem.id);
      return;
    }
    const menuItem = menuItems.find((item) => item.id === cartItem.menuId);
    if (!menuItem) return;
    setEditingCartItemId(cartItem.id);
    setActiveItemForCondiment(menuItem);
  };

  const handleUpdateQty = (cartItemId: string, delta: number) => {
    setCartItems((current) => current
      .map((item) => item.id === cartItemId
        ? (item.quantity + delta > 0 ? {...item, quantity: item.quantity + delta} : null)
        : item)
      .filter(Boolean) as OrderItem[]);
  };

  const handleUpdateItemNote = (cartItemId: string, value: string) => {
    setCartItems((current) => current.map((item) => item.id === cartItemId
      ? {...item, notes: value.slice(0, 240) || undefined}
      : item));
  };

  const toggleItemNote = (cartItemId: string) => {
    setExpandedNoteIds((current) => {
      const next = new Set(current);
      if (next.has(cartItemId)) next.delete(cartItemId);
      else next.add(cartItemId);
      return next;
    });
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

    const unavailableCartItem = cartItems.find((cartItem) => (
      menuItems.find((menu) => menu.id === cartItem.menuId)?.isAvailable === false
    ));
    if (unavailableCartItem) {
      toast('Menu Baru Saja Habis', `${unavailableCartItem.menuName} tidak lagi tersedia. Hapus item tersebut atau pilih menu lain.`);
      setActiveStep('MENU');
      return;
    }

    // Guard kedua di level checkout. Walaupun item pernah masuk dari state lama,
    // KUAH / ISIAN yang berlaku untuk menu tidak boleh kosong.
    for (const cartItem of cartItems) {
      const menu = menuItems.find((item) => item.id === cartItem.menuId);
      if (!menu) continue;

      const applicableGroups = condimentGroups.filter((group) =>
        group.isActive !== false && isGroupApplicable(group, menu),
      );

      const selectedGroups = cartItem.selectedCondiments || [];
      const missingGroup = applicableGroups.find((group) => {
        const normalizedGroup = normalizeCondimentLabel(group.name);
        const role = resolveSelfOrderRole(group);
        const mustChoose = group.required === true
          || group.isRequired === true
          || (group.minSelect || 0) > 0
          || role === 'BROTH'
          || role === 'FILLING';

        if (!mustChoose) return false;

        const selected = selectedGroups.find(
          (selection) => normalizeCondimentLabel(selection.groupName) === normalizedGroup,
        );
        const selectedCount = selected?.options?.filter(Boolean).length || 0;
        return selectedCount === 0 || selectedCount < Number(group.minSelect || 0);
      });

      if (missingGroup) {
        toast('Condiment Belum Lengkap', `${cartItem.menuName}: ${missingGroup.name} wajib dipilih.`);
        setEditingCartItemId(cartItem.id);
        setActiveItemForCondiment(menu);
        return;
      }
    }

    const freshTable = tables.find(
      (table) => (!table.branchId || table.branchId === currentBranch.id)
        && normalizeTableNum(table.number) === normalizeTableNum(selectedTable),
    );

    if (!freshTable) {
      toast('Meja Tidak Ditemukan', `Meja ${selectedTable} tidak tersedia. Silakan hubungi kasir.`);
      return;
    }
    if (freshTable.status !== 'READY') {
      toast('Meja Sudah Terpakai', `Meja ${selectedTable} baru saja digunakan. Silakan hubungi kasir.`);
      return;
    }
    if (!freshTable.isSelfOrderEnabled) {
      toast('Meja Belum Diaktifkan', `Meja ${selectedTable} belum diaktifkan untuk self-order.`);
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
    setActiveStep('SENDING');

    try {
      const savedOrder = await onSubmitCustomerOrder(draftOrder);
      setSubmittedOrderId(savedOrder.id);
      setSubmittedOrderSnapshot(savedOrder);
      setActiveStep('ORDER_SUCCESS');
    } catch (error) {
      console.error('[SelfOrder] Submit Error:', {
        error: error instanceof Error ? error.message : String(error),
        table: selectedTable,
        branch: currentBranch.id,
        items: cartItems.length,
        total: totalAmount,
      });

      const errorMsg = error instanceof Error ? error.message : 'Silakan coba kirim ulang.';
      setActiveStep('CART');
      toast('Pesanan Belum Terkirim', errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToLanding = () => {
    setSubmittedOrderId(null);
    setSubmittedOrderSnapshot(null);
    setCartItems([]);
    setOrderNotes('');
    setCustomerName('');
    setSearchQuery('');
    setSelectedCategory('ALL');
    setActiveStep('LANDING');
  };

  const handleShare = async () => {
    const order = liveSubmittedOrder;
    const text = order
      ? `${profile.name} · ${order.orderNumber} · Meja ${selectedTable} · ${formatMoney(order.total)}`
      : `${profile.name} · ${currentBranch.name}`;

    if (navigator.share) {
      await navigator.share({title: order ? 'Ringkasan pesanan' : profile.name, text, url: order ? undefined : window.location.href}).catch(() => undefined);
      return;
    }

    await navigator.clipboard.writeText(order ? text : window.location.href);
    toast('Berhasil Disalin', order ? 'Ringkasan pesanan disalin.' : 'Link outlet disalin.');
  };

  const handleSaveReceiptPng = () => {
    const order = liveSubmittedOrder;
    if (!order) {
      toast('Struk Belum Tersedia', 'Tunggu sampai data pesanan selesai dimuat.');
      return;
    }

    const items = order.items || [];
    const canvasWidth = 900;
    const itemHeight = (item: OrderItem) => 96
      + (item.selectedCondiments?.length || 0) * 32
      + (item.notes ? 42 : 0);
    const canvasHeight = 560 + items.reduce((sum, item) => sum + itemHeight(item), 0) + (order.notes ? 70 : 0);
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast('Gagal Membuat Struk', 'Browser tidak mendukung pembuatan gambar struk.');
      return;
    }

    const left = 70;
    const right = canvasWidth - 70;
    const drawLine = (y: number, color = '#fed7aa') => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    };

    ctx.fillStyle = '#fffaf5';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, 0, canvasWidth, 180);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 44px Arial, sans-serif';
    ctx.fillText(profile.name || 'BAKSO UJO', left, 78);
    ctx.font = '600 22px Arial, sans-serif';
    ctx.fillText(currentBranch.name, left, 116);
    ctx.font = '500 18px Arial, sans-serif';
    ctx.fillText('SELF ORDER · DINE IN', left, 150);

    let y = 235;
    ctx.fillStyle = '#1f2937';
    ctx.font = '800 27px Arial, sans-serif';
    ctx.fillText(`Order ${order.orderNumber}`, left, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f97316';
    ctx.fillText(`Meja ${selectedTable}`, right, y);
    ctx.textAlign = 'left';

    y += 42;
    ctx.fillStyle = '#64748b';
    ctx.font = '500 18px Arial, sans-serif';
    ctx.fillText(`Nama: ${order.customerName || customerName}`, left, y);
    ctx.textAlign = 'right';
    ctx.fillText(new Date(order.createdAt).toLocaleString('id-ID'), right, y);
    ctx.textAlign = 'left';

    y += 38;
    drawLine(y);
    y += 42;

    items.forEach((item, index) => {
      ctx.fillStyle = '#111827';
      ctx.font = '800 22px Arial, sans-serif';
      ctx.fillText(`${index + 1}. ${item.quantity}× ${item.menuName}`, left, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ea580c';
      ctx.fillText(formatMoney(item.price * item.quantity), right, y);
      ctx.textAlign = 'left';
      y += 32;

      ctx.font = '500 17px Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      item.selectedCondiments?.forEach((group) => {
        ctx.fillText(`${group.groupName}: ${group.options.join(', ')}`, left + 24, y);
        y += 28;
      });
      if (item.notes) {
        ctx.fillStyle = '#c2410c';
        ctx.fillText(`Catatan: ${item.notes}`, left + 24, y);
        y += 34;
      }
      y += 28;
      drawLine(y, '#ffedd5');
      y += 34;
    });

    if (order.notes) {
      ctx.fillStyle = '#7c2d12';
      ctx.font = '600 18px Arial, sans-serif';
      ctx.fillText(`Catatan umum: ${order.notes}`, left, y);
      y += 48;
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillText('TOTAL', left, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f97316';
    ctx.font = '800 34px Arial, sans-serif';
    ctx.fillText(formatMoney(order.total), right, y + 5);
    ctx.textAlign = 'left';
    y += 72;
    drawLine(y);
    y += 50;

    ctx.fillStyle = '#111827';
    ctx.font = '800 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Terima kasih sudah pesan di Bakso Ujo', canvasWidth / 2, y);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 16px Arial, sans-serif';
    ctx.fillText('Simpan struk ini sebagai referensi pesanan Anda.', canvasWidth / 2, y + 32);
    ctx.textAlign = 'left';

    canvas.toBlob((blob) => {
      if (!blob) {
        toast('Gagal Membuat Struk', 'Coba ulangi beberapa saat lagi.');
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `Bakso-Ujo-${order.orderNumber.replace(/[^a-zA-Z0-9-]/g, '')}-Meja-${selectedTable}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast('Struk Tersimpan', 'Struk PNG berhasil dibuat.');
    }, 'image/png');
  };

  const whatsappOrderUrl = supportPhone
    ? `https://wa.me/${supportPhone}?text=${encodeURIComponent(
      liveSubmittedOrder
        ? `Halo Bakso Ujo, saya ${liveSubmittedOrder.customerName || customerName}, order ${liveSubmittedOrder.orderNumber} Meja ${selectedTable}.`
        : `Halo ${profile.name}, saya ingin bertanya mengenai self-order.`,
    )}`
    : '';

  return (
    <div className="theme-self-order min-h-[100dvh] w-full font-sans text-[var(--so-text)] antialiased">
      {localToast && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-[100] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-[var(--so-border)] bg-white/95 px-4 py-3 text-center text-xs font-bold text-[var(--so-text-soft)] shadow-[0_18px_55px_rgba(15,23,42,.10)] backdrop-blur-xl animate-slideUp"
        >
          {localToast}
        </div>
      )}

      <div className="relative mx-auto min-h-[100dvh] w-full max-w-[540px] overflow-hidden bg-[var(--so-canvas)] shadow-[0_0_70px_rgba(15,23,42,.08)]">
        {activeStep === 'LANDING' && (
          <main className="min-h-[100dvh] pb-8 animate-fadeIn">
            <section className="relative min-h-[43dvh] overflow-hidden bg-[#111315] px-5 pb-11 pt-5 text-white">
              {wallpaperUrl && (
                <img
                  src={wallpaperUrl}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover opacity-46 motion-safe:animate-[selfOrderHeroZoom_18s_ease-in-out_infinite_alternate]"
                />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,12,15,.34)_0%,rgba(10,12,15,.58)_46%,rgba(10,12,15,.94)_100%)]" />

              <div className="relative z-10 flex items-center justify-between gap-3 so-reveal-1">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.18em] text-white/85 backdrop-blur-md">
                  <QrCode className="h-3.5 w-3.5 text-[#ff8a55]" /> Dine-in Self Order
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-wider backdrop-blur-md ${serviceOpen ? 'border-emerald-300/20 bg-emerald-400/12 text-emerald-200' : 'border-rose-300/20 bg-rose-400/12 text-rose-200'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${serviceOpen ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  {serviceOpen ? 'Online' : 'Tutup'}
                </span>
              </div>

              <div className="relative z-10 mx-auto mt-10 max-w-[360px] text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.65rem] border border-white/15 bg-white/10 shadow-[0_18px_45px_rgba(0,0,0,.18)] backdrop-blur-md so-reveal-2">
                  {profile.logoUrl
                    ? <img src={optimizeCloudinaryImage(profile.logoUrl, 220)} alt={profile.name} decoding="async" className="h-full w-full object-contain p-2" />
                    : <Store className="h-8 w-8 text-[#ffb08b]" />}
                </div>
                <p className="mt-5 text-[9px] font-black uppercase tracking-[.26em] text-[#ffb08b] so-reveal-3">{currentBranch.code || 'Bakso Ujo'}</p>
                <h1 className="mt-2 text-[30px] font-black leading-none tracking-[-.04em] so-reveal-3">{profile.name || 'BAKSO UJO'}</h1>
                <p className="mx-auto mt-3 max-w-[310px] text-[12px] font-semibold leading-relaxed text-white/68 so-reveal-4">Pesan langsung dari meja kamu. Cepat, praktis, dan langsung masuk ke kasir &amp; dapur.</p>
                <div className="mt-6 inline-flex items-center gap-2 text-[9px] font-bold text-white/42 so-reveal-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a3d]" /> Scan · Pilih · Kirim · Santai
                </div>
              </div>
            </section>

            <section className="relative z-20 -mt-5 space-y-3.5 px-[18px] sm:px-5">
              <div className="so-card p-4 so-reveal-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--so-brand-soft)]">
                    {profile.logoUrl
                      ? <img src={optimizeCloudinaryImage(profile.logoUrl, 120)} alt="" className="h-full w-full object-contain p-1.5" />
                      : <Store className="h-5 w-5 text-[var(--so-brand)]" />}
                    <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-[13px] font-black">{currentBranch.name}</h2>
                      <span className={`rounded-full px-2 py-1 text-[7px] font-black uppercase ${serviceOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{serviceOpen ? 'Menerima order' : 'Shift tutup'}</span>
                    </div>
                    <p className="mt-1 flex items-start gap-1.5 text-[9px] font-semibold leading-relaxed text-[var(--so-text-muted)]">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-[var(--so-brand)]" />
                      <span className="line-clamp-2">{currentBranch.address || profile.address}</span>
                    </p>
                  </div>
                </div>
              </div>

              {(profile.promoBannerTitle || profile.promoBannerDescription) && (
                <div className="so-card p-4 so-reveal-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--so-brand-soft)] px-2.5 py-1 text-[7px] font-black uppercase tracking-wider text-[var(--so-brand)]">
                    <Sparkles className="h-3 w-3" /> Featured
                  </span>
                  <p className="mt-3 text-[13px] font-black uppercase leading-snug text-[var(--so-text)]">{profile.promoBannerTitle || 'Promo spesial hari ini'}</p>
                  <p className="mt-1.5 text-[9px] font-bold uppercase leading-relaxed text-[var(--so-text-muted)]">{profile.promoBannerDescription || 'Tanyakan promo yang tersedia kepada kasir.'}</p>
                </div>
              )}

              <button type="button" onClick={handleStartOrder} disabled={!serviceOpen} className="so-primary-cta group so-reveal-4">
                <span className="text-left">
                  <span className="block text-[8px] font-black uppercase tracking-[.18em] text-white/72">Menu tersedia</span>
                  <span className="mt-1 block text-[22px] font-black leading-none text-white">Pesan Makan</span>
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[var(--so-brand)] shadow-sm transition group-active:translate-x-0.5"><ArrowRight className="h-5 w-5" /></span>
              </button>

              {!serviceOpen && (
                <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <div><p className="text-xs font-black">Self-order sedang berhenti</p><p className="mt-1 text-[10px] font-medium leading-relaxed">Shift kasir outlet belum aktif. Hubungi petugas untuk bantuan.</p></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 so-reveal-5">
                <div className="so-card p-4 text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--so-brand-soft)] text-[var(--so-brand)]"><Wifi className="h-4 w-4" /></span>
                  <p className="mt-3 text-[8px] font-black uppercase tracking-wider text-[var(--so-text-faint)]">Status outlet</p>
                  <p className={`mt-1 text-[10px] font-black ${serviceOpen ? '' : 'text-rose-600'}`}>{serviceOpen ? `${availableTables.length} meja siap` : 'Belum menerima order'}</p>
                </div>
                <a href={whatsappOrderUrl || undefined} onClick={(event) => {if (!whatsappOrderUrl) event.preventDefault();}} target="_blank" rel="noreferrer" className={`so-card p-4 text-center ${whatsappOrderUrl ? '' : 'pointer-events-none opacity-50'}`}>
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><MessageCircle className="h-4 w-4" /></span>
                  <p className="mt-3 text-[8px] font-black uppercase tracking-wider text-[var(--so-text-faint)]">WhatsApp</p>
                  <p className="mt-1 text-[10px] font-black">Hubungi Kami</p>
                </a>
              </div>

              <a href={googleReviewUrl || undefined} onClick={(event) => {if (!googleReviewUrl) event.preventDefault();}} target="_blank" rel="noreferrer" className={`so-card flex items-center gap-3 p-4 ${googleReviewUrl ? '' : 'pointer-events-none opacity-50'}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f5f2ee] text-[var(--so-text-soft)]"><ExternalLink className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[11px] font-black">Beri Ulasan di Google</span><span className="mt-0.5 block text-[9px] font-semibold text-[var(--so-text-muted)]">Bagikan pengalaman makanmu.</span></span>
                <ChevronRight className="h-4 w-4 text-[var(--so-text-faint)]" />
              </a>

              <div className="flex items-center justify-center gap-3 pb-2 pt-1">
                {profile.instagram && <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="so-icon-button"><Instagram className="h-4 w-4" /></a>}
                {profile.tiktok && <a href={`https://www.tiktok.com/@${profile.tiktok.replace('@', '')}`} target="_blank" rel="noreferrer" className="so-icon-button min-w-11 px-3 text-[9px] font-black">TikTok</a>}
                <button type="button" onClick={() => void handleShare()} aria-label="Bagikan tautan self-order" className="so-icon-button"><Share2 className="h-4 w-4" /></button>
              </div>
            </section>
          </main>
        )}

        {activeStep === 'TABLE_INPUT' && (
          <main className="min-h-[100dvh] bg-[var(--so-canvas)] px-[18px] pb-8 pt-5 sm:px-5 animate-fadeIn">
            <header className="flex items-center justify-between">
              <button type="button" onClick={() => setActiveStep('LANDING')} aria-label="Kembali ke halaman awal" className="so-icon-button"><ArrowLeft className="h-4 w-4" /></button>
              <span className="text-[9px] font-black uppercase tracking-[.2em] text-[var(--so-brand)]">Identitas Pesanan</span>
              <span className="rounded-full border border-[var(--so-border)] bg-white px-3 py-1.5 text-[8px] font-black text-[var(--so-brand)]">1 / 3</span>
            </header>
            <SelfOrderStepProgress step={1} />

            <section className="pb-7 pt-10 text-center">
              <span className="mx-auto flex h-[52px] w-13 items-center justify-center rounded-[1.1rem] bg-[var(--so-brand)] text-white shadow-[0_12px_28px_rgba(237,95,30,.24)]"><UserRound className="h-5 w-5" /></span>
              <h2 className="mt-5 text-[25px] font-black leading-tight tracking-[-.04em]">Siap pesan dari meja kamu?</h2>
              <p className="mx-auto mt-2 max-w-[310px] text-[11px] font-semibold leading-relaxed text-[var(--so-text-muted)]">Isi nama dan nomor meja sesuai QR atau nomor yang diberikan kasir.</p>
            </section>

            <section className="so-card so-tint-card space-y-4 p-5">
              {tableErrorMsg && (
                <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 animate-shake"><Info className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /><p className="text-[10px] font-bold leading-relaxed text-rose-700">{tableErrorMsg}</p></div>
              )}

              <label className="block">
                <span className="so-field-label">Nama kamu</span>
                <div className="so-field-shell"><UserRound className="h-4 w-4 shrink-0 text-[var(--so-brand)]" /><input autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value.slice(0, 60))} placeholder="Contoh: Gugun" className="so-native-input min-w-0 flex-1 border-0 bg-transparent py-4 text-[13px] font-bold outline-none ring-0 placeholder:text-[var(--so-text-faint)]" /></div>
              </label>

              <label className="block">
                <span className="so-field-label">Nomor meja</span>
                <div className="so-field-shell p-2 pl-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--so-brand-soft)] text-sm font-black text-[var(--so-brand)]">#</span>
                  <input inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={selectedTable} onChange={(event) => {setSelectedTable(event.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setTableErrorMsg('');}} placeholder="Nomor meja" className="so-native-input min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-[16px] font-black outline-none ring-0 placeholder:text-[12px] placeholder:font-semibold placeholder:text-[var(--so-text-faint)]" />
                  <span className={`mr-1 rounded-full px-2.5 py-1.5 text-[7px] font-black uppercase ${tableInputStatus.className}`}>{tableInputStatus.label}</span>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-[8px] font-semibold leading-relaxed text-[var(--so-text-muted)]"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> Ketersediaan meja diperiksa lagi saat pesanan dikirim.</p>
              </label>

              <button type="button" onClick={handleProceedToMenu} disabled={!canProceedToMenu} className="so-primary-button group disabled:cursor-not-allowed disabled:opacity-45">Mulai pilih menu <ArrowRight className="h-4 w-4 transition group-active:translate-x-0.5" /></button>
            </section>
            <p className="mt-5 text-center text-[8px] font-semibold leading-relaxed text-[var(--so-text-muted)]">Khusus dine-in. Untuk item yang ingin dibungkus, tulis pada <span className="font-black text-[var(--so-brand)]">catatan item</span>.</p>
          </main>
        )}

        {activeStep === 'MENU' && (
          <main className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--so-canvas)] animate-fadeIn">
            <header className="z-20 shrink-0 border-b border-[var(--so-border)] bg-white/[.96] px-4 pb-3 pt-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setActiveStep('TABLE_INPUT')} aria-label="Kembali ke identitas pesanan" className="so-icon-button"><ArrowLeft className="h-4 w-4" /></button>
                <div className="min-w-0 flex-1"><p className="text-[8px] font-black uppercase tracking-[.16em] text-[var(--so-brand)]">{profile.name}</p><h2 className="truncate text-[14px] font-black">Hai {customerName}, mau makan apa?</h2></div>
                <span className="rounded-full bg-[var(--so-brand-soft)] px-3 py-2 text-[8px] font-black text-[var(--so-brand)]">Meja {selectedTable}</span>
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--so-text-faint)]" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari menu favorit..." className="so-native-input w-full rounded-2xl border border-[var(--so-border)] bg-[var(--so-surface-soft)] py-3 pl-10 pr-10 text-[11px] font-bold outline-none transition focus:border-[var(--so-brand-weak)] focus:bg-white" />
                {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Hapus pencarian menu" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--so-text-muted)]"><X className="h-4 w-4" /></button>}
              </div>
              <SelfOrderStepProgress step={2} />
            </header>

            <div className="shrink-0 overflow-x-auto border-b border-[var(--so-border)] bg-white px-4 py-2.5 scrollbar-none">
              <div className="flex min-w-max gap-2">{categoryOptions.map((category) => <button key={category.key} type="button" onClick={() => setSelectedCategory(category.key)} className={`rounded-full px-4 py-2 text-[9px] font-black transition active:scale-95 ${selectedCategory === category.key ? 'bg-[var(--so-brand)] text-white shadow-[0_6px_18px_rgba(237,95,30,.18)]' : 'bg-[var(--so-surface-soft)] text-[var(--so-text-soft)]'}`}>{category.label}</button>)}</div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4">
              <div className="mb-3 flex items-end justify-between"><div className="so-section-accent"><p className="text-[8px] font-black uppercase tracking-[.16em] text-[var(--so-brand)]">Menu</p><p className="mt-0.5 text-[10px] font-bold text-[var(--so-text-muted)]">{categoryOptions.find((category) => category.key === selectedCategory)?.label || 'Semua'} · {filteredAvailableCount} tersedia</p></div></div>

              <div className="grid grid-cols-2 gap-3">
                {filteredMenu.map((item) => {
                  const qty = getItemCartQty(item.id);
                  return (
                    <article key={item.id} className={`so-product-card group ${item.isAvailable === false ? 'opacity-65' : ''}`}>
                      <button type="button" onClick={() => handleItemClick(item)} disabled={item.isAvailable === false} className="block w-full text-left disabled:cursor-not-allowed">
                        <div className="so-product-image-wrap">
                          {item.image ? <img src={optimizeCloudinaryImage(item.image, 520)} alt={item.name} loading="lazy" decoding="async" className="so-menu-photo h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center"><Utensils className="h-8 w-8 text-[var(--so-text-faint)]" /></div>}
                          {item.isAvailable === false && <span className="absolute inset-x-3 bottom-3 rounded-full bg-slate-950/85 px-2 py-1.5 text-center text-[8px] font-black uppercase tracking-wider text-white backdrop-blur">Habis</span>}
                        </div>
                        <div className="p-3 pt-2.5">
                          <h3 className="min-h-[40px] line-clamp-2 text-[15px] font-black leading-[1.26] tracking-[-.018em] text-[var(--so-text)]">{item.name}</h3>
                          <div className="mt-3 flex items-center justify-between gap-2"><span className={`text-[13px] font-black tracking-[-.01em] ${item.isAvailable === false ? 'text-slate-400' : 'text-[var(--so-brand)]'}`}>{formatMoney(item.price)}</span><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.isAvailable === false ? 'bg-slate-200 text-slate-400' : 'bg-[var(--so-brand)] text-white shadow-[0_7px_18px_rgba(237,95,30,.18)]'}`}>{item.isAvailable === false ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span></div>
                        </div>
                      </button>
                      {qty > 0 && <span className="absolute right-2.5 top-2.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-[var(--so-brand)] px-1.5 text-[9px] font-black text-white shadow-sm so-cart-pop">{qty}</span>}
                    </article>
                  );
                })}
              </div>

              {filteredMenu.length === 0 && <div className="py-16 text-center"><Search className="mx-auto h-7 w-7 text-[var(--so-text-faint)]" /><p className="mt-3 text-[11px] font-black">Menu tidak ditemukan</p><p className="mt-1 text-[9px] font-semibold text-[var(--so-text-muted)]">Coba kata kunci atau kategori lain.</p></div>}
            </div>

            {totalCartQty > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"><button type="button" onClick={() => setActiveStep('CART')} className="pointer-events-auto flex w-full items-center gap-3 rounded-[1.35rem] bg-[var(--so-brand)] p-3 text-white shadow-[0_18px_44px_rgba(255,100,34,.24)] transition active:scale-[.988] animate-slideUp"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[13px] font-black text-[var(--so-brand)]">{totalCartQty}</span><span className="min-w-0 flex-1 text-left"><span className="block text-[8px] font-black uppercase tracking-widest text-white/55">Keranjang</span><span className="block text-[14px] font-black">{formatMoney(totalAmount)}</span></span><span className="flex items-center gap-1 text-[10px] font-black">Lihat <ChevronRight className="h-4 w-4" /></span></button></div>}
          </main>
        )}

        {activeStep === 'CART' && (
          <main className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--so-canvas)] animate-fadeIn">
            <header className="z-20 shrink-0 border-b border-[var(--so-border)] bg-white/[.96] px-4 py-3.5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setActiveStep('MENU')} aria-label="Kembali ke daftar menu" className="so-icon-button"><ArrowLeft className="h-4 w-4" /></button>
                <div className="min-w-0 flex-1"><p className="text-[8px] font-black uppercase tracking-[.18em] text-[var(--so-brand)]">Konfirmasi Pesanan</p><h2 className="text-[17px] font-black tracking-[-.02em]">Cek sekali lagi</h2></div>
                <span className="rounded-full bg-[var(--so-brand-soft)] px-3 py-2 text-[8px] font-black text-[var(--so-brand)]">Meja {selectedTable}</span>
              </div>
              <SelfOrderStepProgress step={3} />
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-36">
              <section className="so-card so-tint-card p-3.5"><div className="grid grid-cols-3 gap-2 text-center"><div><p className="so-meta-label">Nama</p><p className="mt-1 truncate text-[10px] font-black">{customerName}</p></div><div className="border-x border-[var(--so-border)]"><p className="so-meta-label">Meja</p><p className="mt-1 text-[10px] font-black text-[var(--so-brand)]">{selectedTable}</p></div><div><p className="so-meta-label">Outlet</p><p className="mt-1 truncate text-[10px] font-black">{currentBranch.code || currentBranch.name}</p></div></div></section>

              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[.16em] text-[var(--so-brand)]">Ringkasan Pesanan</p><p className="text-[9px] font-semibold text-[var(--so-text-muted)]">Periksa pilihan dan catatan item.</p></div><button type="button" onClick={() => setActiveStep('MENU')} className="text-[9px] font-black text-[var(--so-brand)]">+ Tambah menu</button></div>

                {cartItems.map((item) => {
                  const menu = menuItems.find((menuItem) => menuItem.id === item.menuId);
                  const noteExpanded = Boolean(item.notes) || expandedNoteIds.has(item.id);
                  return (
                    <article key={item.id} className="so-card p-3.5">
                      <div className="flex items-start gap-3">
                        <div className="h-[60px] w-15 shrink-0 overflow-hidden rounded-2xl bg-[var(--so-surface-soft)]">{menu?.image ? <img src={optimizeCloudinaryImage(menu.image, 220)} alt="" loading="lazy" className="h-full w-full object-contain p-1" /> : <div className="flex h-full items-center justify-center"><Utensils className="h-5 w-5 text-[var(--so-text-faint)]" /></div>}</div>
                        <div className="min-w-0 flex-1"><p className="text-[12px] font-black leading-snug">{item.menuName}</p><p className="mt-1 text-[11px] font-black text-[var(--so-brand)]">{formatMoney(item.price * item.quantity)}</p></div>
                        <div className="flex items-center gap-1 rounded-xl bg-[var(--so-surface-soft)] p-1"><button type="button" onClick={() => handleUpdateQty(item.id, -1)} aria-label={`Kurangi ${item.menuName}`} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[var(--so-text-soft)]"><Minus className="h-3 w-3" /></button><span className="w-6 text-center text-[10px] font-black">{item.quantity}</span><button type="button" onClick={() => handleUpdateQty(item.id, 1)} aria-label={`Tambah ${item.menuName}`} className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--so-brand)] text-white"><Plus className="h-3 w-3" /></button></div>
                      </div>

                      {item.selectedCondiments?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{item.selectedCondiments.map((group) => <span key={`${item.id}-${group.groupName}`} className="rounded-lg bg-[var(--so-surface-soft)] px-2.5 py-1.5 text-[8px] font-bold text-[var(--so-text-soft)]"><strong className="font-black text-[var(--so-text)]">{group.groupName}:</strong> {group.options.join(', ')}</span>)}</div> : null}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--so-border)] pt-3">
                        <button type="button" onClick={() => handleConfigureItem(item)} className="flex items-center gap-1.5 text-[9px] font-black text-[var(--so-brand)]"><Pencil className="h-3 w-3" /> Ubah pilihan</button>
                        <button type="button" onClick={() => toggleItemNote(item.id)} className="text-[9px] font-black text-[var(--so-text-soft)]">{noteExpanded ? 'Tutup catatan' : '+ Tambah catatan item'}</button>
                      </div>

                      {item.quantity > 1 && <button type="button" onClick={() => splitCartItemIntoSinglePortions(item.id)} className="mt-3 w-full rounded-xl border border-dashed border-[var(--so-border)] bg-[var(--so-surface-soft)] px-3 py-2 text-[8px] font-black text-[var(--so-text-soft)]">Pisahkan {item.quantity} porsi untuk catatan berbeda</button>}

                      {noteExpanded && <label className="mt-3 block"><span className="mb-1.5 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-[var(--so-text-faint)]"><span>Catatan item</span><span>{item.notes?.length || 0}/240</span></span><textarea value={item.notes || ''} onChange={(event) => handleUpdateItemNote(item.id, event.target.value)} rows={2} placeholder="Contoh: dibungkus, kuah dipisah, tanpa sawi..." className="so-native-textarea w-full resize-none rounded-xl border border-[var(--so-border)] bg-[var(--so-surface-soft)] px-3 py-2.5 text-[10px] font-semibold outline-none transition focus:border-[var(--so-brand-weak)] focus:bg-white" /></label>}
                    </article>
                  );
                })}
              </section>

              <section className="so-card p-4">
                <button type="button" onClick={() => setShowGeneralNote((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left"><span><span className="block text-[10px] font-black">Catatan umum pesanan</span><span className="mt-0.5 block text-[8px] font-semibold text-[var(--so-text-muted)]">Opsional · misalnya antar bersamaan.</span></span><ChevronRight className={`h-4 w-4 text-[var(--so-text-faint)] transition ${showGeneralNote ? 'rotate-90' : ''}`} /></button>
                {(showGeneralNote || orderNotes) && <textarea value={orderNotes} onChange={(event) => setOrderNotes(event.target.value.slice(0, 500))} rows={2} placeholder="Contoh: antar bersamaan..." className="so-native-textarea mt-3 w-full resize-none rounded-xl border border-[var(--so-border)] bg-[var(--so-surface-soft)] px-3 py-2.5 text-[10px] font-semibold outline-none focus:border-[var(--so-brand-weak)] focus:bg-white" />}
              </section>

              <div className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-emerald-900"><Wifi className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-[10px] font-black">Langsung masuk ke kasir &amp; dapur</p><p className="mt-1 text-[8px] font-medium leading-relaxed text-emerald-800/70">Self-order khusus dine-in. Pembayaran dilakukan kepada kasir.</p></div></div>
            </div>

            <footer className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[540px] border-t border-[var(--so-border)] bg-white/[.96] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl"><div className="mb-3 flex items-end justify-between"><span className="text-[8px] font-black uppercase tracking-widest text-[var(--so-text-faint)]">Total pesanan</span><span className="text-[20px] font-black tracking-tight text-[var(--so-text)]">{formatMoney(totalAmount)}</span></div><button type="button" onClick={() => void handleSubmitOrder()} disabled={isSubmitting || !cartItems.length} className="so-primary-button disabled:cursor-wait disabled:opacity-55">Ya, kirim pesanan <ArrowRight className="h-4 w-4" /></button></footer>
          </main>
        )}

        {activeStep === 'SENDING' && (
          <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[var(--so-canvas)] px-6 text-center animate-fadeIn" aria-live="polite">
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--so-brand-soft)]/60 blur-3xl" />
            <div className="relative"><div className="absolute inset-[-22px] rounded-full border border-[var(--so-border)] motion-safe:animate-[selfOrderOrbit_6s_linear_infinite]" /><span className="relative flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[var(--so-brand)] text-white shadow-[0_20px_50px_rgba(237,95,30,.24)]"><ChefHat className="h-8 w-8" /></span></div>
            <p className="mt-12 text-[9px] font-black uppercase tracking-[.22em] text-[var(--so-brand)]">Menghubungkan ke outlet</p><h2 className="mt-2 text-[22px] font-black tracking-[-.04em]">Mengirim pesanan...</h2><p className="mt-2 max-w-[280px] text-[10px] font-semibold leading-relaxed text-[var(--so-text-muted)]">Mohon tunggu sebentar. Jangan tutup halaman sampai pesanan berhasil diterima.</p><div className="mt-7 flex items-center gap-2">{[0, 1, 2].map((index) => <span key={index} className="h-2.5 w-2.5 rounded-full bg-[var(--so-brand)] motion-safe:animate-[selfOrderDot_1.2s_ease-in-out_infinite]" style={{animationDelay: `${index * 150}ms`}} />)}</div><div className="mt-9 flex items-center gap-2 rounded-full border border-[var(--so-border)] bg-white px-4 py-2.5 text-[8px] font-bold text-[var(--so-text-muted)] shadow-sm"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Proteksi duplikasi aktif</div>
          </main>
        )}

        {activeStep === 'ORDER_SUCCESS' && (
          <main className="min-h-[100dvh] bg-[var(--so-canvas)] px-[18px] pb-8 pt-5 sm:px-5 animate-fadeIn">
            <section className="relative overflow-hidden rounded-[1.8rem] bg-[var(--so-text)] p-5 text-white shadow-[0_20px_55px_rgba(28,28,30,.18)]"><span className="absolute inset-x-0 top-0 h-1 bg-[var(--so-brand)]" />
              <div className="flex items-start justify-between gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400 text-[#173020] so-success-pop"><Check className="h-7 w-7 stroke-[3]" /></span><span className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-white/65">{liveSubmittedOrder?.orderNumber}</span></div>
              <p className="mt-5 text-[8px] font-black uppercase tracking-[.18em] text-emerald-300">Pesanan diterima</p><h2 className="mt-1 text-[25px] font-black tracking-[-.04em]">Pesanan berhasil!</h2><p className="mt-2 text-[10px] font-medium leading-relaxed text-white/58">Pesanan sudah masuk ke {currentBranch.name}. Silakan tetap di meja dan pantau statusnya.</p>
              <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-2xl border border-white/10 bg-white/[.07] p-3"><p className="text-[7px] font-black uppercase tracking-widest text-white/35">Order</p><p className="mt-1 text-[12px] font-black text-[#ffb08b]">{liveSubmittedOrder?.orderNumber}</p></div><div className="rounded-2xl border border-white/10 bg-white/[.07] p-3"><p className="text-[7px] font-black uppercase tracking-widest text-white/35">Meja</p><p className="mt-1 text-[12px] font-black text-[#ffb08b]">{selectedTable}</p></div></div>
            </section>

            <section className="so-card mt-4 p-4">
              <div className="flex items-center justify-between"><div><p className="so-meta-label">Status pesanan · Live</p><p className="mt-1 text-[13px] font-black">{statusIndex === 0 ? 'Pesanan diterima' : statusIndex === 1 ? 'Sedang disiapkan' : 'Siap disajikan'}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${statusIndex === 2 ? 'bg-emerald-50 text-emerald-600' : 'bg-[var(--so-brand-soft)] text-[var(--so-brand)]'}`}><ChefHat className="h-5 w-5" /></span></div>
              <div className="mt-5 grid grid-cols-3 gap-2">{['Diterima', 'Disiapkan', 'Siap'].map((label, index) => <div key={label} className="text-center"><span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[9px] font-black transition ${index <= statusIndex ? 'bg-[var(--so-brand)] text-white' : 'bg-[var(--so-surface-soft)] text-[var(--so-text-faint)]'}`}>{index < statusIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><p className={`mt-2 text-[8px] font-black ${index <= statusIndex ? 'text-[var(--so-text)]' : 'text-[var(--so-text-faint)]'}`}>{label}</p></div>)}</div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--so-border)] bg-[var(--so-surface-soft)] px-3 py-2.5 text-[8px] font-bold text-[var(--so-text-soft)]"><Clock3 className="h-3.5 w-3.5 shrink-0" /> Pembayaran dilakukan langsung kepada kasir.</div>
            </section>

            <section className="so-card mt-4 p-4">
              <div className="flex items-center justify-between border-b border-[var(--so-border)] pb-3"><div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-[var(--so-brand)]" /><p className="text-[9px] font-black uppercase tracking-widest">Struk Pesanan</p></div><span className="text-[8px] font-black text-[var(--so-text-muted)]">{totalCartQty} item</span></div>
              <div className="divide-y divide-[var(--so-border)]">{(liveSubmittedOrder?.items || cartItems).map((item) => <div key={item.id} className="flex items-start gap-3 py-3"><span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-[var(--so-surface-soft)] text-[8px] font-black text-[var(--so-text-soft)]">{item.quantity}×</span><div className="min-w-0 flex-1"><p className="text-[10px] font-black">{item.menuName}</p>{item.selectedCondiments?.map((group) => <p key={`${item.id}-${group.groupName}`} className="mt-1 text-[8px] font-medium text-[var(--so-text-muted)]">{group.groupName}: {group.options.join(', ')}</p>)}{item.notes && <p className="mt-1 text-[8px] font-bold text-[var(--so-brand)]">Catatan: {item.notes}</p>}</div><span className="text-[9px] font-black">{formatMoney(item.price * item.quantity)}</span></div>)}</div>
              {liveSubmittedOrder?.notes && <div className="rounded-xl bg-[var(--so-surface-soft)] px-3 py-2 text-[8px] font-medium text-[var(--so-text-soft)]">Catatan umum: {liveSubmittedOrder.notes}</div>}
              <div className="mt-3 flex items-end justify-between border-t border-dashed border-[var(--so-border)] pt-3"><span className="so-meta-label">Total</span><span className="text-[17px] font-black text-[var(--so-text)]">{formatMoney(liveSubmittedOrder?.total || totalAmount)}</span></div>
            </section>

            <section className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={handleSaveReceiptPng} className="so-action-card"><Download className="h-5 w-5 text-[var(--so-brand)]" /><span>Simpan Struk PNG</span></button>
              <a href={whatsappOrderUrl || undefined} onClick={(event) => {if (!whatsappOrderUrl) event.preventDefault();}} target="_blank" rel="noreferrer" className={`so-action-card ${whatsappOrderUrl ? '' : 'pointer-events-none opacity-50'}`}><MessageCircle className="h-5 w-5 text-emerald-600" /><span>WhatsApp Kami</span></a>
              <a href={googleReviewUrl || undefined} onClick={(event) => {if (!googleReviewUrl) event.preventDefault();}} target="_blank" rel="noreferrer" className={`so-action-card ${googleReviewUrl ? '' : 'pointer-events-none opacity-50'}`}><ExternalLink className="h-5 w-5 text-[#4d5560]" /><span>Ulas Bakso Ujo di Google</span></a>
              <button type="button" onClick={() => void handleShare()} className="so-action-card"><Share2 className="h-5 w-5 text-[#4d5560]" /><span>Bagikan Pesanan</span></button>
            </section>

            <button type="button" onClick={handleResetToLanding} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[1.25rem] bg-[#111827] py-4 text-[10px] font-black text-white shadow-[0_10px_24px_rgba(15,23,42,.12)] transition active:scale-[.988]"><Home className="h-4 w-4" /> Kembali ke Landing Page</button>
            {googleReviewUrl && <a href={googleReviewUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 py-2 text-[8px] font-bold text-[var(--so-text-muted)]">Bagikan pengalaman makanmu <ExternalLink className="h-3 w-3" /></a>}
          </main>
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
