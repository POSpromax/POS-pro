# Rancangan APK Shell — Seluruh Sistem Stabil (bukan hanya printer)

Tujuan: menjalankan **seluruh POS-PRO** (UX, workflow, tombol, semua fungsi)
di dalam APK Android dengan kestabilan native, **tanpa mengubah/menulis ulang
fitur web**. Melengkapi `PRINTER_APK_BUILD_PLAN.md` (khusus printer) dan
`PRINTER_ANDROID_BRIDGE.md` (kontrak bridge).

---

## Prinsip inti: paritas fitur 100% (MODE A)

APK memakai **Capacitor WebView yang memuat origin produksi**
(`https://pos-pro-eight.vercel.app`, `server.url` di `capacitor.config.ts`).
Konsekuensinya:

- **Semua UX/workflow/tombol/fungsi = identik dengan PWA.** Tidak ada yang
  di-porting atau ditulis ulang → tidak ada risiko fitur "beda perilaku".
- **Update otomatis**: perbaikan/fitur web yang di-deploy ke Vercel langsung
  terpakai di APK **tanpa build ulang APK**. APK hanya perlu di-build ulang bila
  ada perubahan *native* (plugin printer/izin).
- APK = **terminal Kasir/Dapur**. Self-order pelanggan tetap lewat **browser HP**
  (scan QR) — tidak terpengaruh APK.

Yang ditambahkan APK di atas web yang sama:
1. Driver printer Bluetooth native yang tetap tersambung (SPP + foreground service).
2. Izin & akses perangkat yang stabil (kamera selfie, GPS presensi).
3. Proses yang tidak mati di background (realtime & printer bertahan).
4. Mode kiosk terminal (layar tidak tidur, orientasi terkunci, back button aman).

---

## Peta subsistem → kebutuhan native → verifikasi

| Subsistem web | Berjalan di WebView? | Yang harus disiapkan di APK | Cara uji |
|---|---|---|---|
| **Login PIN + Supabase Auth** | Ya (localStorage) | `domStorageEnabled`, `databaseEnabled` aktif; jangan clear storage | Login → tutup APK → buka lagi → sesi masih ada |
| **Realtime (WebSocket order/shift/meja)** | Ya | Foreground service jaga proses saat background; app sudah reconnect saat resume | Buat order dari HP lain → muncul di APK; background 1 menit → kembali → sinkron |
| **Presensi selfie (kamera)** | `getUserMedia` — perlu izin | Manifest `CAMERA` + WebView `onPermissionRequest` grant `RESOURCE_VIDEO_CAPTURE` | Clock-in → kamera muncul & foto tersimpan |
| **Presensi GPS** | `navigator.geolocation` — perlu izin | Manifest `ACCESS_FINE_LOCATION` + WebView `onGeolocationPermissionsShowPrompt` allow | Clock-in di dalam radius → lolos; di luar → ditolak |
| **Cetak nota/tiket** | Bridge native | Plugin `PosPrinter` (lihat PRINTER_APK_BUILD_PLAN.md) | Bayar → nota tercetak; pindah app → kembali → masih connected |
| **Upload gambar (Cloudinary)** | `<input type=file>` | WebView `setAllowFileAccess`; Android 13+ `READ_MEDIA_IMAGES` bila pilih dari galeri | Ganti logo/menu → gambar terunggah |
| **QR self-order (cetak label)** | Web canvas | — (murni web) | Cetak label → QR valid |
| **Navigasi + tombol back HW** | — | Intercept back: navigasi dalam web / konfirmasi keluar, jangan tutup app di tengah transaksi | Tekan back saat di POS → tidak keluar app mendadak |
| **Suara notifikasi order** | `<audio>` | Autoplay policy: mainkan setelah interaksi (app sudah begitu) | Order baru → bunyi |
| **Offline sesaat** | Cache app | `server.url` + jaringan; hindari SW yang menyajikan shell basi | Matikan wifi sebentar → nyala lagi → app pulih |

---

## Konfigurasi WebView / Activity (kritis untuk stabilitas)

`MainActivity` / `capacitor.config.ts` + kode native:

```kotlin
// Izinkan konten web memakai kamera & mikrofon (presensi selfie)
webView.webChromeClient = object : BridgeWebChromeClient(bridge) {
  override fun onPermissionRequest(request: PermissionRequest) {
    runOnUiThread { request.grant(request.resources) } // origin sudah tepercaya (produksi)
  }
  override fun onGeolocationPermissionsShowPrompt(origin: String, cb: GeolocationPermissions.Callback) {
    cb.invoke(origin, true, false) // izinkan GPS untuk origin produksi
  }
}
webView.settings.apply {
  domStorageEnabled = true
  databaseEnabled = true
  mediaPlaybackRequiresUserGesture = false
  setGeolocationEnabled(true)
}
// Terminal: layar tidak tidur
window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
```

`capacitor.config.ts` (tambahan penting):

```ts
const config: CapacitorConfig = {
  appId: 'app.pospro.terminal',
  appName: 'POS-PRO',
  webDir: 'dist',
  server: { url: 'https://pos-pro-eight.vercel.app', androidScheme: 'https' },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: true }, // debug: bisa di-inspect via chrome://inspect
  plugins: { CapacitorHttp: { enabled: false } },
};
```

Tombol back Android (jangan keluar app di tengah kerja):

```kotlin
// via @capacitor/app: App.addListener('backButton', ...) di web,
// atau override onBackPressed → webView.goBack() bila canGoBack, else konfirmasi.
```

Orientasi & status bar: kunci orientasi terminal (mis. `sensorLandscape` untuk
tablet kasir) di manifest; sembunyikan status bar untuk kiosk bila perlu.

---

## Izin lengkap (`AndroidManifest.xml`)

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.bluetooth" android:required="false" />
```

Runtime request (Capacitor): minta CAMERA, LOCATION, BLUETOOTH_*, POST_NOTIFICATIONS
saat fitur pertama dipakai.

---

## Keamanan

- **Kunci ke origin produksi** (release): hanya muat `pos-pro-eight.vercel.app`;
  tolak navigasi ke origin lain (`shouldOverrideUrlLoading`).
- HTTPS only (`allowMixedContent = false`). Debug boleh `webContentsDebuggingEnabled`;
  **release harus `false`**.
- Native layer **tidak** menyimpan PIN, token Supabase, atau data transaksi.
- Release APK **di-sign**; debug hanya untuk pengujian.

---

## Matriks verifikasi rilis (wajib lulus sebelum dipakai operasional)

1. Login 2 cabang, sesi bertahan setelah app ditutup-buka.
2. POS → KDS → bayar → tiket tercetak; item tambahan pada order tersimpan ikut terbayar.
3. Presensi: selfie + GPS lolos di dalam radius, ditolak di luar.
4. Realtime: order dari perangkat lain muncul < 3 dtk; setelah background lalu kembali, tetap sinkron.
5. Printer tetap tersambung setelah pindah ShopeeFood/Grab & reload.
6. Back button tidak menutup app di tengah transaksi.
7. Layar tidak tidur selama shift.
8. Cabut internet sesaat → pulih tanpa data rusak; pembayaran tetap tercatat server.

---

## Ringkasan alur kerja

1. Scaffold Capacitor (lihat PRINTER_APK_BUILD_PLAN.md §4) + `server.url` produksi.
2. Tambah plugin `PosPrinter` + foreground service (§5) untuk printer.
3. Terapkan konfigurasi WebView/izin di dokumen ini (kamera, GPS, kiosk, back).
4. Build **debug APK**, jalankan matriks verifikasi.
5. Bila lolos → build **release APK ter-sign**, kunci ke origin produksi.

> Karena web dimuat apa adanya, **semua fitur yang sudah stabil di PWA otomatis
> stabil di APK**; APK menambah kestabilan koneksi/perangkat, bukan mengubah
> perilaku aplikasi.
