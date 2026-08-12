import React, { useState } from 'react';
import { Printer, Bluetooth, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { PrinterConfig } from '../../types/pos';
import { BluetoothPrinterService } from '../../services/bluetoothPrinter';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PrinterConfig;
  onSaveConfig: (config: PrinterConfig) => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig
}) => {
  const [formConfig, setFormConfig] = useState<PrinterConfig>(config);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleConnectBluetooth = async () => {
    setIsConnecting(true);
    setErrorMsg('');
    const res = await BluetoothPrinterService.connectBluetoothDevice();
    setIsConnecting(false);

    if (res.success) {
      const updated: PrinterConfig = {
        ...formConfig,
        deviceName: res.deviceName || 'Thermal BT 58mm',
        isConnected: true
      };
      setFormConfig(updated);
      onSaveConfig(updated);
    } else {
      setErrorMsg(res.error || 'Gagal terhubung dengan Bluetooth printer');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-600/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface-card)] w-full max-w-md rounded-2xl p-6 shadow-xl space-y-5 border border-[var(--panel-border)]">
        <div className="flex justify-between items-center border-b border-[var(--panel-border-light)] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-[var(--text-primary)] text-base">Setup Printer Thermal Bluetooth</h2>
              <p className="text-[11px] font-bold text-[var(--text-secondary)]">Pencetakan Struk Otomatis Kasir</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connection Status Box */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
          formConfig.isConnected
            ? 'bg-[var(--success-soft)] border-[#bbf7d0] text-[var(--accent-green)]'
            : 'bg-[var(--warning-soft)] border-[#fde68a] text-[#b45309]'
        }`}>
          <div>
            <p className="font-bold text-xs">{formConfig.deviceName}</p>
            <p className="text-[11px] font-bold opacity-80">
              {formConfig.isConnected ? 'Terhubung via Web Bluetooth' : 'Belum Terhubung'}
            </p>
          </div>
          <button
            onClick={handleConnectBluetooth}
            disabled={isConnecting}
            className="ui-button ui-button-primary px-3.5 py-2 text-xs font-bold shadow-sm"
          >
            <Bluetooth className="w-3.5 h-3.5" />
            <span>{isConnecting ? 'Mencari...' : 'Hubungkan'}</span>
          </button>
        </div>

        {errorMsg && (
          <p className="text-xs font-bold text-[var(--accent-red)] bg-[var(--danger-soft)] p-2.5 rounded-xl border border-[#fecaca]">
            {errorMsg}
          </p>
        )}

        {/* Paper Format & Auto-Print Settings */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Ukuran Kertas Thermal:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFormConfig({ ...formConfig, paperSize: '58mm' })}
                className={`py-2.5 rounded-xl border font-bold text-xs transition-all ${
                  formConfig.paperSize === '58mm'
                    ? 'bg-[var(--brand-50)] border-[var(--primary)] text-[var(--primary-hover)] ring-2 ring-[var(--primary)]/20'
                    : 'bg-[var(--surface-secondary)] border-[var(--panel-border)] text-[var(--text-secondary)]'
                }`}
              >
                58mm (Standar Portable)
              </button>
              <button
                onClick={() => setFormConfig({ ...formConfig, paperSize: '80mm' })}
                className={`py-2.5 rounded-xl border font-bold text-xs transition-all ${
                  formConfig.paperSize === '80mm'
                    ? 'bg-[var(--brand-50)] border-[var(--primary)] text-[var(--primary-hover)] ring-2 ring-[var(--primary)]/20'
                    : 'bg-[var(--surface-secondary)] border-[var(--panel-border)] text-[var(--text-secondary)]'
                }`}
              >
                80mm (Desktop Resto)
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-[var(--surface-secondary)] p-3 rounded-2xl border border-[var(--panel-border)]">
            <div>
              <p className="font-extrabold text-xs text-[var(--text-primary)]">Cetak Otomatis Setelah Bayar</p>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">Kirim perintah cetak langsung saat checkout</p>
            </div>
            <button
              onClick={() => setFormConfig({ ...formConfig, autoPrintOnPayment: !formConfig.autoPrintOnPayment })}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                formConfig.autoPrintOnPayment ? 'bg-[var(--primary)]' : 'bg-[var(--panel-border-strong)]'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                formConfig.autoPrintOnPayment ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              onSaveConfig(formConfig);
              onClose();
            }}
            className="ui-button ui-button-primary w-full py-3 text-xs font-bold shadow-md"
          >
            Simpan Konfigurasi
          </button>
        </div>
      </div>
    </div>
  );
};
