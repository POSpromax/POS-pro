# Printer Thermal: PWA BLE dan Android Classic/SPP

## Status implementasi

Frontend memakai satu service ESC/POS dengan dua transport:

1. `WEB_BLE` untuk PWA Chrome dan printer BLE/GATT;
2. `ANDROID_NATIVE` untuk shell APK yang menyediakan driver Bluetooth
   Classic/SPP atau BLE native.

Mode `AUTO` memilih driver Android jika tersedia, kemudian jatuh ke Web
Bluetooth. Kegagalan printer tidak pernah membatalkan pembayaran yang sudah
diakui server.

## Kompatibilitas

| Perangkat | Transport utama |
|---|---|
| RPP02N varian BLE/GATT | PWA `WEB_BLE` atau native |
| RPP02N lama/RPP02N-BL SPP | APK `ANDROID_NATIVE` |
| VSC MP-58X / Panda PRJ-58B | APK `ANDROID_NATIVE` |
| Printer BLE dengan service vendor lain | Tambahkan UUID service ke `BLE_SERVICE_UUIDS` |

Varian perangkat harus diverifikasi dari unit fisik. Nama model yang sama dapat
memakai modul Bluetooth berbeda antar batch.

## Kontrak bridge APK

Shell Android harus mengekspos plugin Capacitor `PosPrinter` atau JavaScript
interface `window.PosPrinterAndroid` dengan metode berikut:

```ts
interface PosPrinterBridge {
  isSupported(): Promise<{ supported: boolean }> | boolean;
  selectAndConnect(): Promise<{
    success: boolean;
    connected: boolean;
    name: string;
    address?: string;
    error?: string;
  }>;
  reconnect(options?: { address?: string }): Promise<{ connected: boolean }>;
  isConnected(): Promise<{ connected: boolean }>;
  printBase64(options: { data: string }): Promise<{ success: boolean; error?: string }>;
  disconnect(): Promise<void>;
}
```

`printBase64` menerima byte ESC/POS mentah. Driver native bertanggung jawab untuk:

- meminta `BLUETOOTH_SCAN` dan `BLUETOOTH_CONNECT` pada Android 12+;
- menampilkan hanya perangkat paired/nearby yang relevan;
- membuka socket RFCOMM/SPP untuk printer Classic;
- memakai koneksi GATT untuk printer BLE;
- menulis byte secara berurutan dan mengembalikan error yang dapat dibaca;
- menutup socket ketika perangkat berganti;
- tidak menyimpan PIN, token Supabase, atau data transaksi di native layer.

## Checklist pengujian perangkat

1. Hubungkan printer dari Setup Printer, bukan dari proses pembayaran pertama.
2. Jalankan Test Print tiga kali berturut-turut.
3. Matikan printer, hidupkan kembali, lalu uji Reconnect.
4. Cetak nota 30 item untuk menguji fragmentasi paket.
5. Cetak dua nota berurutan dan pastikan byte tidak bercampur.
6. Tutup dan buka kembali PWA/APK; status harus kembali nonaktif sampai reconnect
   benar-benar berhasil.
7. Uji baterai rendah, kertas habis, dan jarak lebih dari 5 meter.
8. Pastikan pembayaran tetap tercatat walaupun cetak gagal.

## Build APK

Membungkus web dengan WebView tanpa plugin di atas tidak menambahkan dukungan
SPP. Debug APK dipakai untuk pengujian perangkat. Terminal operasional harus
memakai APK release yang ditandatangani dan dikunci pada origin produksi.

