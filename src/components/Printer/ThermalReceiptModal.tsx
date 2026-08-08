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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-100">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-base">Setup Printer Thermal Bluetooth</h2>
              <p className="text-[10px] font-bold text-slate-400">Pencetakan Struk Otomatis Kasir</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connection Status Box */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
          formConfig.isConnected
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div>
            <p className="font-black text-xs">{formConfig.deviceName}</p>
            <p className="text-[10px] font-bold opacity-80">
              {formConfig.isConnected ? 'Terhubung via Web Bluetooth' : 'Belum Terhubung'}
            </p>
          </div>
          <button
            onClick={handleConnectBluetooth}
            disabled={isConnecting}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1 transition-all disabled:opacity-50"
          >
            <Bluetooth className="w-3.5 h-3.5" />
            <span>{isConnecting ? 'Mencari...' : 'Hubungkan'}</span>
          </button>
        </div>

        {errorMsg && (
          <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            {errorMsg}
          </p>
        )}

        {/* Paper Format & Auto-Print Settings */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Ukuran Kertas Thermal:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFormConfig({ ...formConfig, paperSize: '58mm' })}
                className={`py-2.5 rounded-xl border font-black text-xs transition-all ${
                  formConfig.paperSize === '58mm'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                58mm (Standar Portable)
              </button>
              <button
                onClick={() => setFormConfig({ ...formConfig, paperSize: '80mm' })}
                className={`py-2.5 rounded-xl border font-black text-xs transition-all ${
                  formConfig.paperSize === '80mm'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                80mm (Desktop Resto)
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div>
              <p className="font-extrabold text-xs text-slate-900">Cetak Otomatis Setelah Bayar</p>
              <p className="text-[10px] text-slate-400 font-medium">Kirim perintah cetak langsung saat checkout</p>
            </div>
            <button
              onClick={() => setFormConfig({ ...formConfig, autoPrintOnPayment: !formConfig.autoPrintOnPayment })}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                formConfig.autoPrintOnPayment ? 'bg-blue-600' : 'bg-slate-300'
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md transition-all"
          >
            Simpan Konfigurasi
          </button>
        </div>
      </div>
    </div>
  );
};
