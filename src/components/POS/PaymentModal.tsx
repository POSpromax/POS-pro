import React, { useState } from 'react';
import { CreditCard, QrCode, Banknote, Printer, X, Check } from 'lucide-react';
import { Order, PaymentMethod, RestaurantProfile } from '../../types/pos';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Partial<Order> | null;
  profile: RestaurantProfile;
  onProcessPayment: (paymentMethod: PaymentMethod, cashPaid: number, shouldPrint: boolean) => void;
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

  if (!isOpen || !order) return null;

  const totalAmount = order.total || 0;
  const changeAmount = Math.max(0, cashPaid - totalAmount);

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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans select-none text-slate-900">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-[#EAE3DB] flex flex-col max-h-[90vh]">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-tr from-[#EA580C] to-[#F97316] p-6 text-white text-center relative shrink-0 border-b-2 border-orange-600">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-2">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black">Konfirmasi Pembayaran</h2>
          <p className="text-3xl font-black text-amber-200 my-1">
            Rp {totalAmount.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-orange-100 font-bold">
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
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto">
          {/* Left Column: Payment Configuration (2 cols) */}
          <div className="md:col-span-2 space-y-4">
            {/* Payment Method Tabs */}
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2">
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
                      ? 'bg-[#FFF4ED] border-[#EA580C] ring-2 ring-orange-500/20 text-[#C2410C] font-black'
                      : 'bg-white border-[#EAE3DB] text-slate-600 hover:bg-[#F6EFE7]'
                  }`}
                >
                  <Banknote className="w-6 h-6 text-[#C2410C]" />
                  <span className="text-xs font-black">TUNAI (CASH)</span>
                </button>

                <button
                  onClick={() => {
                    setPaymentMethod('QRIS');
                    setCashPaid(totalAmount);
                  }}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'QRIS'
                      ? 'bg-[#FFF4ED] border-[#EA580C] ring-2 ring-orange-500/20 text-[#C2410C] font-black'
                      : 'bg-white border-[#EAE3DB] text-slate-600 hover:bg-[#F6EFE7]'
                  }`}
                >
                  <QrCode className="w-6 h-6 text-[#C2410C]" />
                  <span className="text-xs font-black">QRIS</span>
                </button>

                <button
                  onClick={() => {
                    setPaymentMethod('DEBIT');
                    setCashPaid(totalAmount);
                  }}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'DEBIT'
                      ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-500/20 text-orange-700 font-black'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-6 h-6 text-slate-800" />
                  <span className="text-xs font-black">DEBIT / EDC</span>
                </button>
              </div>
            </div>

            {/* Cash Paid Input & Quick Nominals */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    UANG DITERIMA
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={cashPaid}
                      onChange={(e) => setCashPaid(Number(e.target.value))}
                      className="w-full bg-slate-50 border-2 border-slate-200 focus:border-slate-900 focus:bg-white rounded-2xl pl-12 pr-4 py-3 text-2xl font-black text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    PILIH NOMINAL PAS / CEPAT
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {nominals.map((nom) => (
                      <button
                        key={nom.label}
                        onClick={() => setCashPaid(nom.value)}
                        className={`py-2.5 rounded-full border font-black text-xs transition-all cursor-pointer ${
                          cashPaid === nom.value
                            ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {nom.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kembalian Box */}
                <div className="bg-orange-50 border border-orange-200 p-3.5 rounded-2xl flex justify-between items-center">
                  <span className="font-black text-xs text-orange-700">UANG KEMBALIAN</span>
                  <span className="font-black text-xl text-orange-700 font-mono">
                    Rp {changeAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'QRIS' && (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center space-y-2">
                <div className="w-32 h-32 bg-white p-2 border border-slate-200 rounded-2xl mx-auto flex items-center justify-center shadow-xs">
                  <QrCode className="w-24 h-24 text-slate-800" />
                </div>
                <p className="font-black text-xs text-slate-800">Tampilkan QRIS ke Pelanggan</p>
                <p className="text-[11px] text-slate-500 font-bold">Dukungan GoPay, OVO, ShopeePay, Dana, BCA, Mandiri</p>
              </div>
            )}

            {paymentMethod === 'DEBIT' && (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center space-y-2">
                <CreditCard className="w-12 h-12 text-orange-600 mx-auto" />
                <p className="font-black text-xs text-slate-800">Gesek atau Tap Kartu Debit/Kredit pada Mesin EDC</p>
              </div>
            )}
          </div>

          {/* Right Column: Live Receipt Preview */}
          <div className="bg-white p-4 rounded-2xl border border-[#EAE3DB] shadow-2xs flex flex-col justify-between font-mono text-[11px] leading-relaxed">
            <div className="space-y-2">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <p className="font-black text-sm text-[#1A1714]">{profile.name}</p>
                <p className="text-[9px] text-slate-500 font-sans">{profile.address}</p>
                <p className="text-[9px] text-slate-500 font-sans">{profile.phone}</p>
              </div>

              <div className="py-1 border-b border-dashed border-slate-300 space-y-0.5">
                <div className="flex justify-between text-slate-500">
                  <span>TGL</span>
                  <span>{new Date().toLocaleDateString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>JAM</span>
                  <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>KASIR</span>
                  <span>{order.cashierName || 'SUPER ADMIN'}</span>
                </div>
              </div>

              {/* Items */}
              <div className="py-1 border-b border-dashed border-slate-300 space-y-1">
                {order.items?.map((it) => (
                  <div key={it.id}>
                    <p className="font-bold text-slate-800">{it.menuName}</p>
                    <div className="flex justify-between text-slate-500">
                      <span>{it.quantity} x {it.price.toLocaleString('id-ID')}</span>
                      <span className="font-black text-slate-800">{(it.quantity * it.price).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="pt-1 space-y-0.5 font-bold">
                <div className="flex justify-between text-slate-600">
                  <span>SUBTOTAL</span>
                  <span>{order.subtotal?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-[#C2410C] text-xs font-black pt-1">
                  <span>TOTAL</span>
                  <span>{totalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="text-center pt-4 border-t border-dashed border-slate-300 text-[9px] text-slate-400 font-sans font-bold">
              TERIMA KASIH ATAS KUNJUNGAN ANDA
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 bg-[#F8F2EC] border-t border-[#EAE3DB] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-full bg-white border border-[#EAE3DB] text-slate-700 font-bold text-xs hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" /> Tutup
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onProcessPayment(paymentMethod, cashPaid, false)}
              className="px-5 py-3 rounded-full bg-white border border-slate-300 text-slate-800 font-black text-xs hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4 text-slate-600" /> Bayar Tanpa Cetak
            </button>

            <button
              onClick={() => onProcessPayment(paymentMethod, cashPaid, true)}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 active:scale-95 text-white font-black text-xs shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Bayar & Cetak Struk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
