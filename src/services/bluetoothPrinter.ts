import { Order, RestaurantProfile, PrinterConfig, Shift } from '../types/pos';
import {
  connectAndroidPrinter,
  disconnectAndroidPrinter,
  getAndroidPrinterBridge,
  isAndroidPrinterAvailable,
  isAndroidPrinterConnected,
  printAndroidBase64,
  reconnectAndroidPrinter,
} from './androidPrinterBridge';

type PrinterTransport = 'WEB_BLE' | 'ANDROID_NATIVE';

export interface PrinterRuntimeStatus {
  connected: boolean;
  connecting: boolean;
  transport: PrinterTransport | null;
  deviceName?: string;
  error?: string;
}

export interface PrinterConnectionResult {
  success: boolean;
  deviceName?: string;
  transport?: PrinterTransport;
  configPatch?: Partial<PrinterConfig>;
  error?: string;
}

export interface ZReportData {
  shift: Shift;
  qrisSales: number;
  debitSales: number;
  totalDiscount: number;
  totalTax: number;
  expectedCash: number;
  actualCash: number;
  varianceAmount: number;
}

const BLE_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const blockSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += blockSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + blockSize));
  }
  return btoa(binary);
};

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export class BluetoothPrinterService {
  private static device: any = null;
  private static gattServer: any = null;
  private static printCharacteristic: any = null;
  private static activeTransport: PrinterTransport | null = null;
  private static printQueue: Promise<unknown> = Promise.resolve();
  private static listeners = new Set<(status: PrinterRuntimeStatus) => void>();
  private static runtimeStatus: PrinterRuntimeStatus = {
    connected: false,
    connecting: false,
    transport: null,
  };

  private static updateStatus(patch: Partial<PrinterRuntimeStatus>) {
    this.runtimeStatus = { ...this.runtimeStatus, ...patch };
    this.listeners.forEach((listener) => listener(this.runtimeStatus));
  }

  static subscribe(listener: (status: PrinterRuntimeStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.runtimeStatus);
    return () => this.listeners.delete(listener);
  }

  static async getStatus(): Promise<PrinterRuntimeStatus> {
    if (this.activeTransport === 'ANDROID_NATIVE') {
      const connected = await isAndroidPrinterConnected();
      this.updateStatus({ connected });
    } else if (this.activeTransport === 'WEB_BLE') {
      this.updateStatus({ connected: Boolean(this.printCharacteristic && this.gattServer?.connected) });
    }
    return this.runtimeStatus;
  }

  static async getCapabilities(): Promise<{ webBle: boolean; androidNative: boolean; secureContext: boolean }> {
    return {
      webBle: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
      androidNative: await isAndroidPrinterAvailable(),
      secureContext: typeof window !== 'undefined' && window.isSecureContext,
    };
  }

  static get isConnected(): boolean {
    return this.runtimeStatus.connected;
  }

  static async connectBluetoothDevice(config?: PrinterConfig): Promise<PrinterConnectionResult> {
    if (this.runtimeStatus.connecting) {
      return { success: false, error: 'Proses koneksi printer masih berjalan.' };
    }
    this.updateStatus({ connecting: true, error: undefined });
    try {
      const requestedTransport = config?.transport || 'AUTO';
      // Pada PWA jangan melakukan await sebelum requestDevice(): Chrome
      // mensyaratkan chooser Bluetooth tetap berada dalam user activation.
      const nativeAvailable = getAndroidPrinterBridge() ? await isAndroidPrinterAvailable() : false;
      if (requestedTransport === 'ANDROID_NATIVE' && !nativeAvailable) {
        throw new Error('Driver Android Classic/SPP hanya tersedia di APK POS-PRO. Gunakan mode Otomatis/PWA BLE atau buka aplikasi Android.');
      }
      if (nativeAvailable && requestedTransport !== 'WEB_BLE') {
        const nativeDevice = await connectAndroidPrinter();
        this.activeTransport = 'ANDROID_NATIVE';
        this.updateStatus({
          connected: true,
          connecting: false,
          transport: 'ANDROID_NATIVE',
          deviceName: nativeDevice.name,
        });
        return {
          success: true,
          deviceName: nativeDevice.name,
          transport: 'ANDROID_NATIVE',
          configPatch: {
            transport: 'ANDROID_NATIVE',
            bluetoothAddress: nativeDevice.address,
            lastConnectedAt: new Date().toISOString(),
          },
        };
      }

      return await this.connectWebBle(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Koneksi Bluetooth dibatalkan.';
      this.updateStatus({ connected: false, connecting: false, error: message });
      return { success: false, error: message };
    }
  }

  private static async connectWebBle(config?: PrinterConfig): Promise<PrinterConnectionResult> {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth tidak didukung. Printer Classic/SPP memerlukan aplikasi Android.');
    }
    if (!window.isSecureContext) {
      throw new Error('Bluetooth PWA hanya tersedia melalui HTTPS atau localhost.');
    }

    const bluetooth = (navigator as any).bluetooth;
    const device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_SERVICE_UUIDS,
    });
    const discovered = await this.attachWebBleDevice(device);
    return {
      success: true,
      deviceName: device.name || 'Printer Thermal BLE',
      transport: 'WEB_BLE',
      configPatch: {
        transport: 'WEB_BLE',
        deviceId: device.id,
        deviceName: device.name || 'Printer Thermal BLE',
        serviceUuid: discovered.serviceUuid,
        characteristicUuid: discovered.characteristicUuid,
        chunkSize: config?.chunkSize || 128,
        lastConnectedAt: new Date().toISOString(),
      },
    };
  }

  private static async attachWebBleDevice(device: any): Promise<{ serviceUuid: string; characteristicUuid: string }> {
    const server = await device.gatt?.connect();
    if (!server) throw new Error('Printer tidak menyediakan koneksi BLE/GATT. Kemungkinan perangkat memakai Bluetooth Classic/SPP.');

    let writableCharacteristic: any = null;
    let matchedServiceUuid = '';
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      writableCharacteristic = characteristics.find((characteristic: any) => (
        characteristic.properties.write || characteristic.properties.writeWithoutResponse
      ));
      if (writableCharacteristic) {
        matchedServiceUuid = String(service.uuid);
        break;
      }
    }
    if (!writableCharacteristic) {
      server.disconnect();
      throw new Error('Karakteristik tulis ESC/POS tidak ditemukan. Gunakan driver Android atau daftarkan UUID printer ini.');
    }

    if (this.device && this.device !== device) {
      this.device.removeEventListener?.('gattserverdisconnected', this.handleWebBleDisconnected);
    }
    this.device = device;
    this.gattServer = server;
    this.printCharacteristic = writableCharacteristic;
    this.activeTransport = 'WEB_BLE';
    device.addEventListener?.('gattserverdisconnected', this.handleWebBleDisconnected);
    this.updateStatus({
      connected: true,
      connecting: false,
      transport: 'WEB_BLE',
      deviceName: device.name || 'Printer Thermal BLE',
      error: undefined,
    });
    return { serviceUuid: matchedServiceUuid, characteristicUuid: String(writableCharacteristic.uuid) };
  }

  private static handleWebBleDisconnected = () => {
    BluetoothPrinterService.gattServer = null;
    BluetoothPrinterService.printCharacteristic = null;
    BluetoothPrinterService.updateStatus({ connected: false, connecting: false, error: 'Printer terputus.' });
  };

  static async reconnect(config: PrinterConfig): Promise<boolean> {
    const preferred = config.transport || 'AUTO';
    if (preferred !== 'WEB_BLE' && await isAndroidPrinterAvailable()) {
      const connected = await reconnectAndroidPrinter(config.bluetoothAddress);
      if (connected) {
        this.activeTransport = 'ANDROID_NATIVE';
        this.updateStatus({ connected: true, transport: 'ANDROID_NATIVE', deviceName: config.deviceName, error: undefined });
        return true;
      }
    }

    if (preferred === 'ANDROID_NATIVE' || !config.deviceId || typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      return false;
    }
    try {
      const bluetooth = (navigator as any).bluetooth;
      if (typeof bluetooth.getDevices !== 'function') return false;
      const permittedDevices = await bluetooth.getDevices();
      const remembered = permittedDevices.find((device: any) => device.id === config.deviceId);
      if (!remembered) return false;
      await this.attachWebBleDevice(remembered);
      return true;
    } catch (error) {
      this.updateStatus({ connected: false, error: error instanceof Error ? error.message : 'Reconnect printer gagal.' });
      return false;
    }
  }

  static async disconnect(): Promise<void> {
    try {
      if (this.activeTransport === 'ANDROID_NATIVE') await disconnectAndroidPrinter();
      if (this.device) this.device.removeEventListener?.('gattserverdisconnected', this.handleWebBleDisconnected);
      if (this.gattServer?.connected) this.gattServer.disconnect();
    } finally {
      this.device = null;
      this.gattServer = null;
      this.printCharacteristic = null;
      this.activeTransport = null;
      this.updateStatus({ connected: false, connecting: false, transport: null, error: undefined });
    }
  }

  static async printReceipt(order: Order, profile: RestaurantProfile, config: PrinterConfig): Promise<{ success: boolean; error?: string }> {
    return this.enqueuePrint(() => this.performPrint(this.generateReceiptBytes(order, profile, config), config));
  }

  static async printKitchenTicket(order: Order, profile: RestaurantProfile, config: PrinterConfig): Promise<{ success: boolean; error?: string }> {
    return this.enqueuePrint(() => this.performPrint(this.generateKitchenTicketBytes(order, profile, config), config));
  }

  static async printZReport(report: ZReportData, profile: RestaurantProfile, config: PrinterConfig): Promise<{ success: boolean; error?: string }> {
    return this.enqueuePrint(() => this.performPrint(this.generateZReportBytes(report, profile, config), config));
  }

  static async testPrint(config: PrinterConfig): Promise<{ success: boolean; error?: string }> {
    const width = config.paperSize === '80mm' ? 48 : 32;
    const now = new Date().toLocaleString('id-ID');
    const text = `\x1B\x40\x1B\x61\x01TEST PRINTER POS-PRO\n${config.deviceName}\n${now}\n${'-'.repeat(width)}\nKoneksi dan ESC/POS siap.\n\n\n`;
    return this.enqueuePrint(() => this.performPrint(new TextEncoder().encode(text), config));
  }

  private static async enqueuePrint(task: () => Promise<{ success: boolean; error?: string }>) {
    const queued = this.printQueue.then(task, task);
    this.printQueue = queued.then(() => undefined, () => undefined);
    return queued;
  }

  private static async performPrint(bytes: Uint8Array, config: PrinterConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.runtimeStatus.connected && !(await this.reconnect(config))) {
        return { success: false, error: 'Printer belum terhubung. Buka Setup Printer lalu pilih perangkat.' };
      }
      if (this.activeTransport === 'ANDROID_NATIVE') {
        await printAndroidBase64(bytesToBase64(bytes));
      } else {
        await this.writeWebBle(bytes, config.chunkSize || 128);
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mencetak struk.';
      this.updateStatus({ connected: false, error: message });
      return { success: false, error: message };
    }
  }

  private static async writeWebBle(bytes: Uint8Array, preferredChunkSize: number): Promise<void> {
    if (!this.printCharacteristic || !this.gattServer?.connected) throw new Error('Koneksi BLE printer terputus.');
    const sizes = [...new Set([preferredChunkSize, 128, 64, 20])].filter((size) => size > 0).sort((a, b) => b - a);
    let sizeIndex = Math.max(0, sizes.findIndex((size) => size <= preferredChunkSize));
    let offset = 0;
    while (offset < bytes.length) {
      const chunkSize = sizes[sizeIndex] || 20;
      const chunk = bytes.slice(offset, offset + chunkSize);
      try {
        if (this.printCharacteristic.properties.writeWithoutResponse) {
          await this.printCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.printCharacteristic.writeValue(chunk);
        }
        offset += chunk.length;
        await wait(12);
      } catch (error) {
        if (sizeIndex < sizes.length - 1) {
          sizeIndex += 1;
          continue;
        }
        throw error;
      }
    }
  }

  // Format Receipt Text to ESC/POS bytes array
  static generateReceiptBytes(order: Order, profile: RestaurantProfile, config: PrinterConfig): Uint8Array {
    const encoder = new TextEncoder();
    const lineWidth = config.paperSize === '80mm' ? 48 : 32;

    const centerText = (str: string) => {
      if (str.length >= lineWidth) return str.slice(0, lineWidth) + '\n';
      const spaces = Math.floor((lineWidth - str.length) / 2);
      return ' '.repeat(spaces) + str + '\n';
    };

    const justifyText = (left: string, right: string) => {
      const spaceNeeded = lineWidth - left.length - right.length;
      if (spaceNeeded <= 0) return left.slice(0, Math.max(0, lineWidth - right.length - 1)) + ' ' + right + '\n';
      return left + ' '.repeat(spaceNeeded) + right + '\n';
    };

    const separator = '-'.repeat(lineWidth) + '\n';
    let text = '\x1B\x40';
    text += '\x1B\x61\x01';
    text += centerText(profile.name.toUpperCase());
    text += centerText(`NOTA ${order.orderNumber}`);
    text += centerText(profile.address);
    if (profile.phone) text += centerText(`Telp: ${profile.phone}`);
    text += separator;

    text += '\x1B\x61\x00';
    const createdAt = new Date(order.createdAt);
    const dateStr = createdAt.toLocaleDateString('id-ID');
    const timeStr = createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    text += justifyText('TGL / JAM', `${dateStr} ${timeStr}`);
    text += justifyText('TIPE', order.type === 'DINE_IN' ? `DINE IN / MEJA ${order.tableNumber}` : 'TAKE AWAY');
    text += justifyText('KASIR', order.cashierName || '-');
    text += justifyText('PELANGGAN', order.customerName || 'Guest');
    text += separator;

    order.items.forEach((item) => {
      text += `${item.menuName}\n`;
      text += justifyText(`  ${item.quantity} x ${item.price.toLocaleString('id-ID')}`, (item.quantity * item.price).toLocaleString('id-ID'));
      if (item.selectedCondiments?.length) {
        item.selectedCondiments.forEach((group) => { text += `  + ${group.groupName}: ${group.options.join(', ')}\n`; });
      }
      if (item.notes) text += `  * ${item.notes}\n`;
    });

    text += separator;
    text += justifyText('SUBTOTAL', `Rp ${order.subtotal.toLocaleString('id-ID')}`);
    if (order.tax > 0) text += justifyText('PAJAK', `Rp ${order.tax.toLocaleString('id-ID')}`);
    if (order.discount > 0) text += justifyText('DISKON', `-Rp ${order.discount.toLocaleString('id-ID')}`);
    text += separator;
    text += justifyText('TOTAL', `Rp ${order.total.toLocaleString('id-ID')}`);
    text += justifyText('METODE', order.paymentMethod || 'CASH');
    if (order.paymentMethod === 'CASH' && order.cashPaid) {
      text += justifyText('BAYAR (CASH)', `Rp ${order.cashPaid.toLocaleString('id-ID')}`);
      text += justifyText('KEMBALI', `Rp ${(order.change || 0).toLocaleString('id-ID')}`);
    }
    text += separator;
    text += '\x1B\x61\x01';
    text += centerText(profile.receiptFooter || 'TERIMA KASIH ATAS KUNJUNGAN ANDA');
    text += '\n\n\n';
    if (config.paperSize === '80mm') text += '\x1D\x56\x41\x03';
    return encoder.encode(text);
  }

  static generateZReportBytes(report: ZReportData, profile: RestaurantProfile, config: PrinterConfig): Uint8Array {
    const encoder = new TextEncoder();
    const lineWidth = config.paperSize === '80mm' ? 48 : 32;
    const separator = '-'.repeat(lineWidth) + '\n';
    const center = (value: string) => {
      const text = value.slice(0, lineWidth);
      return `${' '.repeat(Math.max(0, Math.floor((lineWidth - text.length) / 2)))}${text}\n`;
    };
    const justify = (left: string, right: string) => {
      const gap = lineWidth - left.length - right.length;
      return gap > 0 ? `${left}${' '.repeat(gap)}${right}\n` : `${left.slice(0, Math.max(0, lineWidth - right.length - 1))} ${right}\n`;
    };
    const money = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;
    const { shift } = report;
    const endTime = shift.endTime ? new Date(shift.endTime) : new Date();
    let text = '\x1B\x40\x1B\x61\x01';
    text += center(profile.name.toUpperCase());
    text += '\x1D\x21\x11' + center('Z-REPORT') + '\x1D\x21\x00';
    text += separator + '\x1B\x61\x00';
    text += justify('SHIFT', shift.id);
    text += justify('BUKA', new Date(shift.startTime).toLocaleString('id-ID'));
    text += justify('TUTUP', endTime.toLocaleString('id-ID'));
    text += justify('KASIR', shift.staffName || '-');
    text += separator;
    text += justify('MODAL AWAL', money(shift.initialCash));
    text += justify('CASH', money(shift.cashSales));
    text += justify('QRIS', money(report.qrisSales));
    text += justify('DEBIT', money(report.debitSales));
    text += justify('DISKON', `-${money(report.totalDiscount)}`);
    text += justify('PAJAK', money(report.totalTax));
    text += justify('TOTAL OMZET', money(shift.grossOmset));
    text += separator;
    text += justify('PEMASUKAN', money(shift.totalIncome));
    text += justify('PENGELUARAN', `-${money(shift.totalExpense)}`);
    text += justify('EXPECTED CASH', money(report.expectedCash));
    text += justify('ACTUAL CASH', money(report.actualCash));
    text += justify('SELISIH', money(report.varianceAmount));
    text += separator + '\x1B\x61\x01' + center('SHIFT CLOSED') + '\n\n\n';
    if (config.paperSize === '80mm') text += '\x1D\x56\x41\x03';
    return encoder.encode(text);
  }

  /**
   * Tiket produksi sengaja tidak membawa harga, total, ataupun metode bayar.
   * Kertas dapur hanya memuat informasi yang diperlukan untuk memasak dan
   * mengantar, dengan kuantitas/item dibuat lebih besar agar cepat dipindai.
   */
  static generateKitchenTicketBytes(order: Order, profile: RestaurantProfile, config: PrinterConfig): Uint8Array {
    const encoder = new TextEncoder();
    const lineWidth = config.paperSize === '80mm' ? 48 : 32;
    const separator = '-'.repeat(lineWidth) + '\n';
    const wrap = (value: string, prefix = '') => {
      const width = Math.max(8, lineWidth - prefix.length);
      const words = value.trim().split(/\s+/);
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        if (`${current} ${word}`.trim().length > width && current) {
          lines.push(prefix + current);
          current = word;
        } else {
          current = `${current} ${word}`.trim();
        }
      }
      if (current) lines.push(prefix + current);
      return lines.join('\n') + (lines.length ? '\n' : '');
    };

    const createdAt = new Date(order.createdAt);
    const dateTime = createdAt.toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
    const orderLabel = order.dailyNumber ? `#${String(order.dailyNumber).padStart(3, '0')}` : order.orderNumber;
    const orderContext = [
      orderLabel,
      order.type === 'DINE_IN' ? `MEJA ${order.tableNumber || '-'}` : 'TAKE AWAY',
      dateTime,
    ].join('   ');
    let text = '\x1B\x40\x1B\x61\x00';
    text += wrap(orderContext);
    text += wrap(`${order.source === 'SELF_ORDER' ? 'SELF ORDER' : 'POS KASIR'} · ${order.customerName || 'Guest'}`);
    text += separator;

    order.items.forEach((item, index) => {
      text += '\x1D\x21\x10';
      text += wrap(`${item.quantity}x ${item.menuName}`);
      text += '\x1D\x21\x00';
      item.selectedCondiments?.forEach((group) => {
        text += wrap(`${group.groupName.toUpperCase()}: ${group.options.join(', ')}`, '    ');
      });
      if (item.notes) text += wrap(item.notes, '    ! ');
      if (index < order.items.length - 1) text += '\n';
    });

    if (order.notes) {
      text += separator;
      text += wrap(order.notes, '! ');
    }
    text += `${separator}\n\n`;
    if (config.paperSize === '80mm') text += '\x1D\x56\x41\x03';
    return encoder.encode(text);
  }
}
