import React, { useEffect, useState } from 'react';
import { CreditCard, QrCode, Banknote, Printer, X, Check } from 'lucide-react';
import { Order, PaymentMethod, RestaurantProfile } from '../../types/pos';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Partial<Order> | null;
  profile: RestaurantProfile;
  onProcessPayment: (paymentMethod: PaymentMethod, cashPaid: number, shouldPrint: boolean) => void | Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  order,
  profile,
  onProcessPayment
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashPaid, setCashPaid] = useState<number>(order?.total || 0);
  // Mencegah klik ganda / double-submit selama pembayaran diproses async,
  // yang sebelumnya bisa membuat order terbayar dua kali (duplicate order).
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPaymentMethod('CASH');
    setCashPaid(order?.total || 0);
    setIsSubmitting(false);
  }, [isOpen, order?.id, order?.total]);

  if (!isOpen || !order) return null;

  const totalAmount = order.total || 0;
  const changeAmount = Math.max(0, cashPaid - totalAmount);
  const canProcessPayment = (paymentMethod !== 'CASH' || cashPaid >= totalAmount) && !isSubmitting;

  const handlePay = async (shouldPrint: boolean) => {
    if (isSubmitting || !canProcessPayment) return;
    setIsSubmitting(true);
    try {
      await onProcessPayment(paymentMethod, cashPaid, shouldPrint);
    } finally {
      // Jika modal masih terbuka (pembayaran gagal), izinkan coba lagi.
      // Jika sukses, modal akan ditutup oleh parent sehingga state ini di-reset oleh effect di atas.
      setIsSubmitting(false);
    }
  };

  // Quick Nominals matching Image 5
  const nominals = [
    { label: 'PAS', value: totalAmount },
    { label: '20K', value: 20000 },
    { label: '50K', value: 50000 },
    { label: '100K', value: 100000 },
    { label: '150K', value: 150000 },
    { label: '200K', value: 200000 },
    { label: '250K', value: 250000 },
    { label: '500K', value: 500000 }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3 font-sans text-[var(--text-primary)] backdrop-blur-sm select-none">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-[var(--surface-card)] shadow-2xl">
        {/* Top Header Banner */}
        <div className="relative shrink-0 border-b border-emerald-800 bg-gradient-to-r from-emerald-800 to-emerald-700 px-6 py-4 text-center text-white">
          <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-extrabold">Konfirmasi Pembayaran</h2>
          <p className="my-0.5 text-2xl font-black text-amber-200">
            Rp {totalAmount.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-[var(--brand-300)] font-bold">
            {order.items?.reduce((a, b) => a + b.quantity, 0) || 1} item • {order.customerName || 'Guest'} • Meja {order.tableNumber || '-'}
          </p>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-5">
          {/* Left Column: Payment Configuration (2 cols) */}
          <div className="space-y-4 md:col-span-3">
            {/* Payment Method Tabs */}
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
                METODE PEMBAYARAN
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setPaymentMethod('CASH');
                    setCashPaid(totalAmount);
                  }}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-hover)] font-bold'
                      : 'bg-[var(--surface-card)] border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]'
                  }`}
                >
                  <Banknote className="w-6 h-6 text-[var(--primary-hover)]" />
                  <span className="text-xs font-bold">TUNAI (CASH)</span>
                </button>

                <button
                  onClick={() => {
                    setPaymentMethod('QRIS');
                    setCashPaid(totalAmount);
                  }}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'QRIS'
                      ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-hover)] font-bold'
                      : 'bg-[var(--surface-card)] border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]'
                  }`}
                >
                  <QrCode className="w-6 h-6 text-[var(--primary-hover)]" />
                  <span className="text-xs font-bold">QRIS</span>
                </button>

                <button
                  onClick={() => {
                    setPaymentMethod('DEBIT');
                    setCashPaid(totalAmount);
                  }}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'DEBIT'
                      ? 'bg-[var(--brand-50)] border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--primary-text)] font-bold'
                      : 'bg-[var(--surface-card)] border-[var(--panel-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]'
                  }`}
                >
                  <CreditCard className="w-6 h-6 text-[var(--text-primary)]" />
                  <span className="text-xs font-bold">DEBIT / EDC</span>
                </button>
              </div>
            </div>

            {/* Cash Paid Input & Quick Nominals */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">
                    UANG DITERIMA
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg text-[var(--text-tertiary)]">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={cashPaid}
                      onChange={(e) => setCashPaid(Number(e.target.value))}
                      className="ui-input w-full !pl-12 !pr-4 py-3 text-2xl font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
                    PILIH NOMINAL PAS / CEPAT
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {nominals.map((nom) => (
                      <button
                        key={nom.label}
                        onClick={() => setCashPaid(nom.value)}
                        className={`py-2.5 rounded-full border font-bold text-xs transition-all cursor-pointer ${
                          cashPaid === nom.value
                            ? 'bg-[var(--primary-solid)] text-white border-[var(--primary)] shadow-sm'
                            : 'bg-[var(--surface-secondary)] text-[var(--text-primary)] border-[var(--panel-border)] hover:bg-[var(--panel-border-light)]'
                        }`}
                      >
                        {nom.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kembalian Box */}
                <div className="bg-[var(--brand-50)] border border-[var(--brand-200)] p-3.5 rounded-2xl flex justify-between items-center">
                  <span className="font-bold text-xs text-[var(--primary-text)]">UANG KEMBALIAN</span>
                  <span className="font-bold text-xl text-[var(--primary-text)] font-mono">
                    Rp {changeAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'QRIS' && (
              <div className="bg-[var(--surface-secondary)] p-6 rounded-2xl border border-[var(--panel-border)] text-center space-y-2">
                <div className="w-32 h-32 bg-[var(--surface-card)] p-2 border border-[var(--panel-border)] rounded-2xl mx-auto flex items-center justify-center shadow-sm">
                  <QrCode className="w-24 h-24 text-[var(--text-primary)]" />
                </div>
                <p className="font-bold text-xs text-[var(--text-primary)]">Tampilkan QRIS ke Pelanggan</p>
                <p className="text-[11px] text-[var(--text-secondary)] font-bold">Dukungan GoPay, OVO, ShopeePay, Dana, BCA, Mandiri</p>
              </div>
            )}

            {paymentMethod === 'DEBIT' && (
              <div className="bg-[var(--surface-secondary)] p-6 rounded-2xl border border-[var(--panel-border)] text-center space-y-2">
                <CreditCard className="w-12 h-12 text-[var(--primary-text)] mx-auto" />
                <p className="font-bold text-xs text-[var(--text-primary)]">Gesek atau Tap Kartu Debit/Kredit pada Mesin EDC</p>
              </div>
            )}
          </div>

          {/* Right Column: Live Receipt Preview */}
          <div className="flex flex-col justify-between rounded-2xl border border-[var(--panel-border)] bg-white p-4 font-mono text-[11px] leading-relaxed shadow-sm md:col-span-2">
            <div className="space-y-2">
              <div className="text-center pb-2 border-b border-dashed border-[var(--panel-border-strong)]">
                {profile.logoUrl && <img src={profile.logoUrl} alt="Logo" className="mx-auto mb-1.5 h-10 w-10 object-contain" />}
                <p className="font-bold text-sm text-[var(--text-primary)]">{profile.name}</p>
                <p className="text-[10px] font-bold text-[var(--text-tertiary)]">NOTA {order.orderNumber || ''}</p>
                <p className="text-[10px] text-[var(--text-secondary)] font-sans">{profile.address}</p>
                <p className="text-[11px] text-[var(--text-secondary)] font-sans">{profile.phone}</p>
              </div>

              <div className="py-1 border-b border-dashed border-[var(--panel-border-strong)] space-y-0.5">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>TGL / JAM</span>
                  <span>{new Date().toLocaleDateString('id-ID')} · {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>KASIR</span>
                  <span>{order.cashierName || 'SUPER ADMIN'}</span>
                </div>
              </div>

              {/* Items */}
              <div className="py-1 border-b border-dashed border-[var(--panel-border-strong)] space-y-1">
                {order.items?.map((it) => (
                  <div key={it.id}>
                    <p className="font-bold text-[var(--text-primary)]">{it.menuName}</p>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>{it.quantity} x {it.price.toLocaleString('id-ID')}</span>
                      <span className="font-bold text-[var(--text-primary)]">{(it.quantity * it.price).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="pt-1 space-y-0.5 font-bold">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>SUBTOTAL</span>
                  <span>{order.subtotal?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-[var(--primary-hover)] text-xs font-bold pt-1">
                  <span>TOTAL</span>
                  <span>{totalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="text-center pt-4 border-t border-dashed border-[var(--panel-border-strong)] text-[11px] text-[var(--text-tertiary)] font-sans font-bold">
              TERIMA KASIH ATAS KUNJUNGAN ANDA
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 bg-[var(--surface-secondary)] border-t border-[var(--panel-border)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="ui-button ui-button-secondary px-5 py-3 text-xs flex items-center gap-1.5"
          >
            <X className="w-4 h-4" /> Tutup
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handlePay(false)}
              disabled={!canProcessPayment}
              className="ui-button ui-button-secondary px-5 py-3 text-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 text-[var(--text-secondary)]" /> {isSubmitting ? 'Memproses...' : 'Bayar Tanpa Cetak'}
            </button>

            <button
              onClick={() => void handlePay(true)}
              disabled={!canProcessPayment}
              className="ui-button ui-button-primary px-6 py-3 text-xs flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> {isSubmitting ? 'Memproses...' : 'Bayar & Cetak Struk'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
