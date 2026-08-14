export interface NativePrinterDevice {
  name: string;
  address?: string;
  connected: boolean;
}

interface NativePrinterBridgeLike {
  isSupported?: () => boolean | Promise<boolean> | string | Promise<string>;
  selectAndConnect: () => unknown | Promise<unknown>;
  reconnect?: (options?: { address?: string }) => unknown | Promise<unknown>;
  disconnect?: () => unknown | Promise<unknown>;
  isConnected?: () => boolean | Promise<boolean> | string | Promise<string>;
  printBase64: (options: { data: string }) => unknown | Promise<unknown>;
}

declare global {
  interface Window {
    /** Disediakan oleh shell APK Android untuk Bluetooth Classic/SPP. */
    PosPrinterAndroid?: NativePrinterBridgeLike;
    Capacitor?: {
      Plugins?: {
        PosPrinter?: NativePrinterBridgeLike;
      };
    };
  }
}

const parseBridgeValue = <T>(value: unknown): T => {
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
};

const readBoolean = (value: unknown): boolean => {
  const parsed = parseBridgeValue<unknown>(value);
  if (typeof parsed === 'boolean') return parsed;
  if (typeof parsed === 'string') return parsed === 'true';
  if (parsed && typeof parsed === 'object' && 'connected' in parsed) {
    return Boolean((parsed as { connected?: boolean }).connected);
  }
  if (parsed && typeof parsed === 'object' && 'supported' in parsed) {
    return Boolean((parsed as { supported?: boolean }).supported);
  }
  if (parsed && typeof parsed === 'object' && 'success' in parsed) {
    return Boolean((parsed as { success?: boolean }).success);
  }
  return false;
};

export const getAndroidPrinterBridge = (): NativePrinterBridgeLike | null => {
  if (typeof window === 'undefined') return null;
  return window.Capacitor?.Plugins?.PosPrinter || window.PosPrinterAndroid || null;
};

export const isAndroidPrinterAvailable = async (): Promise<boolean> => {
  const bridge = getAndroidPrinterBridge();
  if (!bridge) return false;
  if (!bridge.isSupported) return true;
  try {
    return readBoolean(await bridge.isSupported());
  } catch {
    return false;
  }
};

export const connectAndroidPrinter = async (): Promise<NativePrinterDevice> => {
  const bridge = getAndroidPrinterBridge();
  if (!bridge) throw new Error('Driver printer Android belum tersedia pada aplikasi ini.');
  const result = parseBridgeValue<Record<string, unknown>>(await bridge.selectAndConnect());
  const connected = readBoolean(result);
  if (!connected) throw new Error(String(result?.error || 'Printer Bluetooth tidak berhasil dihubungkan.'));
  return {
    name: String(result?.name || result?.deviceName || 'Printer Bluetooth Android'),
    address: result?.address ? String(result.address) : undefined,
    connected: true,
  };
};

export const reconnectAndroidPrinter = async (address?: string): Promise<boolean> => {
  const bridge = getAndroidPrinterBridge();
  if (!bridge) return false;
  try {
    if (bridge.reconnect) return readBoolean(await bridge.reconnect({ address }));
    return bridge.isConnected ? readBoolean(await bridge.isConnected()) : false;
  } catch {
    return false;
  }
};

export const isAndroidPrinterConnected = async (): Promise<boolean> => {
  const bridge = getAndroidPrinterBridge();
  if (!bridge?.isConnected) return false;
  try {
    return readBoolean(await bridge.isConnected());
  } catch {
    return false;
  }
};

export const disconnectAndroidPrinter = async (): Promise<void> => {
  const bridge = getAndroidPrinterBridge();
  if (bridge?.disconnect) await bridge.disconnect();
};

export const printAndroidBase64 = async (data: string): Promise<void> => {
  const bridge = getAndroidPrinterBridge();
  if (!bridge) throw new Error('Driver printer Android belum tersedia.');
  const result = parseBridgeValue<Record<string, unknown> | boolean>(await bridge.printBase64({ data }));
  if (result === false || (result && typeof result === 'object' && result.success === false)) {
    const message = result && typeof result === 'object' ? result.error : undefined;
    throw new Error(String(message || 'Driver Android gagal mengirim data ke printer.'));
  }
};
