import { Order, RestaurantProfile, PrinterConfig } from '../types/pos';

export class BluetoothPrinterService {
  private static device: any = null;
  private static gattServer: any = null;
  private static printCharacteristic: any = null;

  // Request Web Bluetooth Device
  static async connectBluetoothDevice(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!('bluetooth' in navigator)) {
      return {
        success: false,
        error: 'Web Bluetooth API tidak didukung di browser ini. Gunakan Chrome di Desktop/Android.'
      };
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
      });

      this.device = device;
      this.gattServer = await device.gatt?.connect();
      if (this.gattServer) {
        const services = await this.gattServer.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.printCharacteristic = char;
              break;
            }
          }
          if (this.printCharacteristic) break;
        }
      }
      return { success: true, deviceName: device.name || 'BT Printer 58mm' };
    } catch (err: any) {
      console.warn('Bluetooth connection cancelled or failed:', err);
      return { success: false, error: err.message || 'Koneksi bluetooth dibatalkan' };
    }
  }

  static get isConnected(): boolean {
    return !!this.printCharacteristic && !!this.gattServer?.connected;
  }

  static async printReceipt(order: Order, profile: RestaurantProfile, config: PrinterConfig): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected) {
      return { success: false, error: 'Printer belum terhubung. Hubungkan via Bluetooth terlebih dahulu.' };
    }

    try {
      const bytes = this.generateReceiptBytes(order, profile, config);
      const chunkSize = 512;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (this.printCharacteristic.properties.writeWithoutResponse) {
          await this.printCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.printCharacteristic.writeValue(chunk);
        }
      }
      return { success: true };
    } catch (err: any) {
      console.warn('Bluetooth print failed:', err);
      return { success: false, error: err.message || 'Gagal mencetak struk' };
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
      if (spaceNeeded <= 0) {
        return left.slice(0, lineWidth - right.length - 1) + ' ' + right + '\n';
      }
      return left + ' '.repeat(spaceNeeded) + right + '\n';
    };

    const separator = '-'.repeat(lineWidth) + '\n';

    let text = '';
    // ESC/POS init
    text += '\x1B\x40'; // Init
    text += '\x1B\x61\x01'; // Center align
    text += centerText(profile.name.toUpperCase());
    text += centerText(profile.address);
    text += centerText(`Telp: ${profile.phone}`);
    text += separator;

    text += '\x1B\x61\x00'; // Left align
    const dateStr = new Date(order.createdAt).toLocaleDateString('id-ID');
    const timeStr = new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    text += justifyText('TGL', dateStr);
    text += justifyText('JAM', timeStr);
    text += justifyText('NO ORDER', order.orderNumber);
    text += justifyText('TIPE / MEJA', `${order.type === 'DINE_IN' ? 'DINE IN' : 'TAKE AWAY'} (Meja ${order.tableNumber})`);
    text += justifyText('KASIR', order.cashierName);
    text += justifyText('PELANGGAN', order.customerName);
    text += separator;

    order.items.forEach((item) => {
      text += `${item.menuName}\n`;
      const itemDetail = `${item.quantity} x ${item.price.toLocaleString('id-ID')}`;
      const itemTotal = (item.quantity * item.price).toLocaleString('id-ID');
      text += justifyText(`  ${itemDetail}`, itemTotal);
      if (item.notes) {
        text += `  * ${item.notes}\n`;
      }
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
    text += '\x1B\x61\x01'; // Center align
    text += centerText('TERIMA KASIH ATAS KUNJUNGAN ANDA');
    text += centerText('Powered by Nusantara POS');
    text += '\n\n\n';
    text += '\x1D\x56\x41\x03'; // Cut paper command

    return encoder.encode(text);
  }
}
