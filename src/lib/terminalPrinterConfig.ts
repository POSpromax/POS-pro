import type { PrinterConfig } from '../types/pos';

const TERMINAL_PRINTER_CONFIG_KEY = 'omnipos_terminal_printer_config';

const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  deviceName: 'Thermal Printer BT-58',
  paperSize: '58mm',
  autoPrintOnPayment: true,
  isConnected: false,
  transport: 'AUTO',
  chunkSize: 128,
  autoPrintKitchenOnNewOrder: false,
};

const normalize = (value: Partial<PrinterConfig>): PrinterConfig => ({
  ...DEFAULT_PRINTER_CONFIG,
  ...value,
  paperSize: value.paperSize === '80mm' ? '80mm' : '58mm',
  // Koneksi GATT/SPP tidak valid setelah halaman atau aplikasi ditutup.
  isConnected: false,
  transport: value.transport || 'AUTO',
  chunkSize: value.chunkSize || 128,
  autoPrintKitchenOnNewOrder: value.autoPrintKitchenOnNewOrder ?? false,
});

/**
 * Printer adalah konfigurasi perangkat untuk tab terminal ini, bukan data
 * operasional restoran. Pada cloud mode ia disimpan di sessionStorage agar
 * reload tab dapat reconnect tanpa menjadikan localStorage sumber data.
 */
export function getTerminalPrinterConfig(): PrinterConfig {
  if (typeof window === 'undefined') return DEFAULT_PRINTER_CONFIG;
  try {
    const raw = window.sessionStorage.getItem(TERMINAL_PRINTER_CONFIG_KEY);
    if (!raw) return DEFAULT_PRINTER_CONFIG;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? normalize(parsed as Partial<PrinterConfig>)
      : DEFAULT_PRINTER_CONFIG;
  } catch {
    return DEFAULT_PRINTER_CONFIG;
  }
}

export function saveTerminalPrinterConfig(config: PrinterConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      TERMINAL_PRINTER_CONFIG_KEY,
      JSON.stringify({ ...normalize(config), isConnected: false }),
    );
  } catch {
    // Storage dapat dinonaktifkan oleh browser/kiosk; printer tetap berfungsi
    // untuk sesi aktif melalui state React.
  }
}
