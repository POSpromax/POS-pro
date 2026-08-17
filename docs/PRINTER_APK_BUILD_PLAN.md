# Rancangan Debug APK — Bridge Printer Bluetooth Native (POS-PRO)

Dokumen ini melengkapi `docs/PRINTER_ANDROID_BRIDGE.md` (yang mendefinisikan
*kontrak* bridge) dengan **rancangan implementasi + langkah build** debug APK.
Tujuan APK: printer thermal **tetap tersambung** walau PWA di-reload atau saat
kasir berpindah ke aplikasi lain (ShopeeFood/Grab) — sesuatu yang tidak bisa
dijamin Web BLE karena siklus hidup halaman web.

---

## 1. Status lingkungan (mesin ini)

| Komponen | Status | Catatan |
|---|---|---|
| Android Studio | ✅ Terpasang (`AndroidStudio2026.1.2`) | Config ada di `%LOCALAPPDATA%\Google` |
| Android SDK | ✅ `%LOCALAPPDATA%\Android\Sdk` | platforms: android-36, 36.1 · build-tools: 35.0.0, 36.0.0 |
| platform-tools (adb) | ✅ Ada | Belum di PATH — panggil dari `...\Sdk\platform-tools\adb.exe` |
| JDK sistem | ⚠️ JDK **26** (JAVA_HOME) | **Terlalu baru untuk Gradle/AGP.** Build via Studio (pakai JBR) atau set JAVA_HOME ke JDK 17/21 |
| Node | ✅ v24 | Untuk `npm run build:web` |
| cmdline-tools | ❌ Kosong | Tidak wajib untuk build via `gradlew`/Studio |

> **Aksi wajib sebelum build:** gunakan **JBR bawaan Android Studio** (JDK 21).
> Di command line: `set JAVA_HOME=<dir Studio>\jbr` sebelum `gradlew`. Di Studio
> GUI: *Build > Build APK(s)* otomatis memakai JBR.

---

## 2. Keputusan arsitektur

**Capacitor + plugin native `PosPrinter`.** Alasan:

- Kode web sudah mengecek `window.Capacitor.Plugins.PosPrinter` **lebih dulu**
  (`src/services/androidPrinterBridge.ts`), lalu `window.PosPrinterAndroid`.
- Capacitor mendukung method **async (Promise)** yang persis cocok dengan
  kontrak (`selectAndConnect`, `printBase64`, dst. semuanya `await`-able).
- Bisa **memuat origin produksi** (`https://pos-pro-eight.vercel.app`) tanpa
  membundel ulang web tiap update, atau membundel `dist/` untuk offline.

Transport di dalam plugin:
1. **Bluetooth Classic / SPP (RFCOMM)** — utama untuk RPP02N-BL, VSC MP-58X,
   Panda PRJ-58B (printer thermal murah umumnya SPP).
2. **BLE/GATT** — fallback untuk varian BLE.

**Foreground service** memegang socket RFCOMM supaya koneksi bertahan saat app
di-background (inilah keunggulan utama vs PWA).

---

## 3. Kontrak yang harus dipenuhi plugin

Dari `src/services/androidPrinterBridge.ts` — plugin `PosPrinter` (nama plugin
Capacitor **harus** `PosPrinter`) mengekspos:

```ts
isSupported(): Promise<{ supported: boolean }>
selectAndConnect(): Promise<{ success: boolean; connected: boolean; name: string; address?: string; error?: string }>
reconnect(options?: { address?: string }): Promise<{ connected: boolean }>
isConnected(): Promise<{ connected: boolean }>
printBase64(options: { data: string }): Promise<{ success: boolean; error?: string }>  // data = base64 byte ESC/POS
disconnect(): Promise<void>
```

`printBase64.data` = **byte ESC/POS mentah dalam base64** (dihasilkan
`BluetoothPrinterService.generate*Bytes()` di web → `bytesToBase64`).

---

## 4. Langkah scaffold (sekali saja)

Dijalankan di root repo. Menambah `@capacitor/*` ke `package.json` + folder
`android/`.

```bash
npm install -D @capacitor/cli
npm install @capacitor/core @capacitor/android
npx cap init "POS-PRO" "app.pospro.terminal" --web-dir dist
npm run build:web        # hasilkan dist/
npx cap add android
```

`capacitor.config.ts` (dua mode — pilih salah satu):

```ts
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'app.pospro.terminal',
  appName: 'POS-PRO',
  webDir: 'dist',
  // MODE A — muat origin produksi (paling praktis untuk update OTA via Vercel):
  server: { url: 'https://pos-pro-eight.vercel.app', cleartext: false },
  // MODE B — offline, hapus `server` di atas dan pakai bundel dist lokal.
};
export default config;
```

> Untuk **debug/pengujian**, MODE A paling cepat: APK jadi shell tipis yang
> memuat web terbaru + menyediakan driver printer native.

---

## 5. Plugin Kotlin `PosPrinter` (kerangka)

`android/app/src/main/java/app/pospro/terminal/PosPrinterPlugin.kt`

```kotlin
package app.pospro.terminal

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.util.Base64
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.io.OutputStream
import java.util.UUID

@CapacitorPlugin(
  name = "PosPrinter",
  permissions = [
    Permission(alias = "bt", strings = [
      Manifest.permission.BLUETOOTH_CONNECT,
      Manifest.permission.BLUETOOTH_SCAN
    ])
  ]
)
class PosPrinterPlugin : Plugin() {
  private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
  private var socket: BluetoothSocket? = null
  private var out: OutputStream? = null
  private var deviceAddress: String? = null

  @PluginMethod
  fun isSupported(call: PluginCall) {
    val ok = BluetoothAdapter.getDefaultAdapter() != null
    call.resolve(JSObject().put("supported", ok))
  }

  @PluginMethod
  fun isConnected(call: PluginCall) {
    call.resolve(JSObject().put("connected", socket?.isConnected == true))
  }

  @PluginMethod
  fun selectAndConnect(call: PluginCall) {
    // 1) Pastikan izin BLUETOOTH_CONNECT/SCAN (requestPermissionForAlias "bt").
    // 2) Tampilkan daftar perangkat paired (adapter.bondedDevices) via dialog
    //    native ATAU terima address dari web. Untuk debug: pilih perangkat paired
    //    pertama yang namanya cocok pola printer, atau tampilkan picker.
    // 3) connectTo(device) di thread background, mulai ForegroundPrinterService.
    // Kembalikan { success, connected, name, address, error }.
  }

  @PluginMethod
  fun reconnect(call: PluginCall) {
    val addr = call.getString("address") ?: deviceAddress
    // buka ulang socket ke addr; resolve { connected }.
  }

  @PluginMethod
  fun printBase64(call: PluginCall) {
    val data = call.getString("data") ?: return call.resolve(errObj("data kosong"))
    try {
      val bytes = Base64.decode(data, Base64.DEFAULT)
      val o = out ?: return call.resolve(errObj("printer belum terhubung"))
      // Tulis bertahap (mis. 256 byte) + jeda kecil agar buffer printer tidak overflow.
      var i = 0
      while (i < bytes.size) {
        val end = minOf(i + 256, bytes.size)
        o.write(bytes, i, end - i); o.flush(); i = end
        Thread.sleep(8)
      }
      call.resolve(JSObject().put("success", true))
    } catch (e: Exception) {
      call.resolve(errObj(e.message ?: "gagal cetak"))
    }
  }

  @PluginMethod
  fun disconnect(call: PluginCall) {
    try { out?.close(); socket?.close() } catch (_: Exception) {}
    out = null; socket = null
    // hentikan ForegroundPrinterService
    call.resolve()
  }

  private fun errObj(msg: String) = JSObject().put("success", false).put("error", msg)
}
```

Detail yang harus dilengkapi implementornya:
- **Koneksi**: `device.createRfcommSocketToServiceRecord(SPP_UUID)` → `socket.connect()`
  di thread background (jangan di main thread). Fallback reflection
  `createRfcommSocket` bila printer rewel.
- **Foreground service** (`ForegroundPrinterService`) dengan notifikasi persisten
  agar OS tidak membunuh proses saat app di-background.
- **BLE fallback**: bila SPP gagal, pakai GATT (service UUID vendor, tulis
  `writeType = WRITE_TYPE_NO_RESPONSE`, chunk 20 byte).

Registrasi plugin (Capacitor 5+ auto-register bila di-annotate `@CapacitorPlugin`
dan modul di-scan; jika manual, tambah di `MainActivity`):

```kotlin
// MainActivity.kt
class MainActivity : BridgeActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    registerPlugin(PosPrinterPlugin::class.java)
    super.onCreate(savedInstanceState)
  }
}
```

---

## 6. Izin `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<!-- Android <= 11 -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
<!-- Foreground service printer -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
<uses-permission android:name="android.permission.INTERNET" />
```

`targetSdk`/`compileSdk = 36` (SDK yang terpasang). `minSdk = 24` (Android 7).

---

## 7. Build & pasang debug APK

```bash
npm run build:web
npx cap copy android
# Command line (WAJIB set JAVA_HOME ke JBR/JDK 21 — bukan JDK 26):
cd android
.\gradlew.bat assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r app\build\outputs\apk\debug\app-debug.apk
```

Atau lebih mudah: **buka folder `android/` di Android Studio → Run** (otomatis
pakai JBR, compile, install ke perangkat/emulator yang tersambung).

---

## 8. Verifikasi (pakai checklist `PRINTER_ANDROID_BRIDGE.md`)

Fokus tambahan untuk APK:
1. Hubungkan printer via Setup Printer di dalam APK → cetak test 3×.
2. **Pindah ke ShopeeFood/Grab lalu kembali → printer tetap tersambung** (tidak
   perlu reconnect). Ini bukti keunggulan APK vs PWA.
3. Reload/putar layar → koneksi tetap.
4. Nota 30 item + dua nota beruntun → byte tidak bercampur.

---

## 9. Catatan penting

- **Web app tidak perlu diubah** — `androidPrinterBridge.ts` otomatis mendeteksi
  `window.Capacitor.Plugins.PosPrinter` dan memilih transport `ANDROID_NATIVE`.
- Debug APK untuk pengujian. **Terminal produksi** harus pakai **APK release
  yang di-sign** dan (bila MODE A) dikunci ke origin produksi.
- Jangan simpan PIN/token Supabase/data transaksi di layer native.
- Ini pekerjaan **native terpisah** (Kotlin/Gradle), di luar kode web repo ini.
