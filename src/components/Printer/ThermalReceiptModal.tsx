import React, { useEffect, useState } from 'react';
import { Bluetooth, CheckCircle2, PlugZap, Printer, RefreshCw, ShieldAlert, Smartphone, Unplug, X } from 'lucide-react';
import { PrinterConfig } from '../../types/pos';
import { BluetoothPrinterService, PrinterRuntimeStatus } from '../../services/bluetoothPrinter';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PrinterConfig;
  onSaveConfig: (config: PrinterConfig) => void;
}

const IDLE_STATUS: PrinterRuntimeStatus = { connected: false, connecting: false, transport: null };

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({ isOpen, onClose, config, onSaveConfig }) => {
  const [formConfig, setFormConfig] = useState<PrinterConfig>(config);
  const [runtimeStatus, setRuntimeStatus] = useState<PrinterRuntimeStatus>(IDLE_STATUS);
  const [capabilities, setCapabilities] = useState({ webBle: false, androidNative: false, secureContext: false });
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ERROR' | 'SUCCESS'; text: string } | null>(null);

  useEffect(() => BluetoothPrinterService.subscribe(setRuntimeStatus), []);

  useEffect(() => {
    if (!isOpen) return;
    setFormConfig(config);
    setMessage(null);
    void BluetoothPrinterService.getCapabilities().then(setCapabilities);
    void BluetoothPrinterService.getStatus().then((status) => {
      if (status.connected) setFormConfig((current) => ({ ...current, isConnected: true }));
    });
  }, [isOpen, config]);

  if (!isOpen) return null;

  const saveRuntimeConfig = (next: PrinterConfig) => {
    setFormConfig(next);
    onSaveConfig(next);
  };

  const handleConnectBluetooth = async () => {
    setMessage(null);
    const result = await BluetoothPrinterService.connectBluetoothDevice(formConfig);
    if (!result.success) {
      setMessage({ type: 'ERROR', text: result.error || 'Gagal terhubung dengan printer Bluetooth.' });
      return;
    }
    const updated: PrinterConfig = {
      ...formConfig,
      ...result.configPatch,
      deviceName: result.deviceName || formConfig.deviceName,
      isConnected: true,
    };
    saveRuntimeConfig(updated);
    setMessage({
      type: 'SUCCESS',
      text: result.transport === 'ANDROID_NATIVE'
        ? 'Printer terhubung melalui driver Android Classic/SPP.'
        : 'Printer terhubung melalui Web Bluetooth BLE.',
    });
  };

  const handleReconnect = async () => {
    setMessage(null);
    const connected = await BluetoothPrinterService.reconnect(formConfig);
    if (connected) {
      const updated = { ...formConfig, isConnected: true, lastConnectedAt: new Date().toISOString() };
      saveRuntimeConfig(updated);
      setMessage({ type: 'SUCCESS', text: 'Koneksi printer berhasil dipulihkan.' });
    } else {
      setMessage({ type: 'ERROR', text: 'Reconnect gagal. Nyalakan printer lalu gunakan tombol Pilih Printer.' });
    }
  };

  const handleDisconnect = async () => {
    await BluetoothPrinterService.disconnect();
    saveRuntimeConfig({ ...formConfig, isConnected: false });
    setMessage({ type: 'SUCCESS', text: 'Printer telah diputuskan dari terminal ini.' });
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setMessage(null);
    const result = await BluetoothPrinterService.testPrint(formConfig);
    setIsTesting(false);
    setMessage(result.success
      ? { type: 'SUCCESS', text: 'Test print berhasil dikirim.' }
      : { type: 'ERROR', text: result.error || 'Test print gagal.' });
  };

  const actualConnected = runtimeStatus.connected;
  const environmentLabel = capabilities.androidNative
    ? 'APK Android · Classic/SPP + BLE'
    : capabilities.webBle
      ? 'PWA · BLE/GATT'
      : 'Browser tanpa dukungan Bluetooth';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-md sm:p-4">
      <div className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface-card)] shadow-2xl">
        <header className="flex items-start justify-between border-b border-[var(--panel-border-light)] bg-[var(--primary)] p-5 text-white">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><Printer className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Printer operasional</p>
              <h2 className="mt-0.5 text-base font-extrabold">Thermal ESC/POS</h2>
              <p className="mt-1 text-[11px] font-semibold text-white/65">{environmentLabel}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20" aria-label="Tutup setup printer"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
          <section className={`rounded-2xl border p-4 ${actualConnected ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${actualConnected ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  {actualConnected ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold text-slate-900">{runtimeStatus.deviceName || formConfig.deviceName}</p>
                  <p className={`mt-0.5 text-[11px] font-bold ${actualConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {runtimeStatus.connecting ? 'Menghubungkan…' : actualConnected ? `Aktif · ${runtimeStatus.transport === 'ANDROID_NATIVE' ? 'Android SPP' : 'Web BLE'}` : 'Belum terhubung pada sesi ini'}
                  </p>
                </div>
              </div>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${actualConnected ? 'bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,.12)]' : 'bg-amber-400'}`} />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-3.5">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)]">Mode koneksi</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['AUTO', PlugZap, 'Otomatis'],
                ['WEB_BLE', Bluetooth, 'PWA BLE'],
                ['ANDROID_NATIVE', Smartphone, 'Android SPP'],
              ] as const).map(([value, Icon, label]) => {
                const disabled = value === 'ANDROID_NATIVE' && !capabilities.androidNative;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setFormConfig({ ...formConfig, transport: value })}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-bold transition ${formConfig.transport === value ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-text)]' : 'border-[var(--panel-border)] bg-white text-[var(--text-secondary)]'} disabled:cursor-not-allowed disabled:opacity-35`}
                  >
                    <Icon className="h-4 w-4" />{label}
                  </button>
                );
              })}
            </div>
            {!capabilities.secureContext && !capabilities.androidNative && <p className="mt-2 text-[10px] font-bold text-rose-600">PWA Bluetooth memerlukan HTTPS.</p>}
          </section>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void handleConnectBluetooth()} disabled={runtimeStatus.connecting} className="ui-button ui-button-primary min-h-11 justify-center text-xs">
              <Bluetooth className="h-4 w-4" />{runtimeStatus.connecting ? 'Mencari…' : 'Pilih Printer'}
            </button>
            <button type="button" onClick={() => void handleReconnect()} disabled={runtimeStatus.connecting} className="ui-button ui-button-secondary min-h-11 justify-center text-xs">
              <RefreshCw className="h-4 w-4" />Reconnect
            </button>
            <button type="button" onClick={() => void handleTestPrint()} disabled={isTesting} className="ui-button ui-button-secondary min-h-11 justify-center text-xs">
              <Printer className="h-4 w-4" />{isTesting ? 'Mengirim…' : 'Test Print'}
            </button>
            <button type="button" onClick={() => void handleDisconnect()} disabled={!actualConnected} className="ui-button min-h-11 justify-center border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 disabled:opacity-40">
              <Unplug className="h-4 w-4" />Putuskan
            </button>
          </div>

          {message && <p className={`rounded-xl border p-3 text-[11px] font-bold ${message.type === 'SUCCESS' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message.text}</p>}

          <section className="space-y-3 rounded-2xl border border-[var(--panel-border)] p-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Ukuran kertas</label>
              <div className="grid grid-cols-2 gap-2">
                {(['58mm', '80mm'] as const).map((size) => <button key={size} type="button" onClick={() => setFormConfig({ ...formConfig, paperSize: size })} className={`rounded-xl border py-2.5 text-xs font-bold ${formConfig.paperSize === size ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-text)]' : 'border-[var(--panel-border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'}`}>{size}</button>)}
              </div>
            </div>

            {formConfig.transport !== 'ANDROID_NATIVE' && <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Paket BLE</label>
              <select value={formConfig.chunkSize || 128} onChange={(event) => setFormConfig({ ...formConfig, chunkSize: Number(event.target.value) as PrinterConfig['chunkSize'] })} className="ui-input w-full text-xs">
                <option value={20}>20 byte · kompatibilitas maksimum</option>
                <option value={64}>64 byte · aman</option>
                <option value={128}>128 byte · seimbang</option>
                <option value={256}>256 byte · printer modern</option>
              </select>
            </div>}

            <div className="flex items-center justify-between rounded-xl bg-[var(--surface-secondary)] p-3">
              <div><p className="text-xs font-extrabold">Cetak otomatis setelah bayar</p><p className="mt-0.5 text-[10px] font-medium text-[var(--text-secondary)]">Pembayaran tetap sukses jika printer gagal.</p></div>
              <button type="button" onClick={() => setFormConfig({ ...formConfig, autoPrintOnPayment: !formConfig.autoPrintOnPayment })} className={`h-6 w-12 rounded-full p-1 transition ${formConfig.autoPrintOnPayment ? 'bg-[var(--primary)]' : 'bg-[var(--panel-border-strong)]'}`} aria-pressed={formConfig.autoPrintOnPayment}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${formConfig.autoPrintOnPayment ? 'translate-x-6' : ''}`} /></button>
            </div>
          </section>
        </div>

        <footer className="border-t border-[var(--panel-border)] bg-white p-4">
          <button type="button" onClick={() => { saveRuntimeConfig({ ...formConfig, isConnected: actualConnected }); onClose(); }} className="ui-button ui-button-primary w-full justify-center py-3 text-xs">Simpan Konfigurasi</button>
        </footer>
      </div>
    </div>
  );
};
