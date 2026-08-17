# Setup Debug APK POS-PRO (Capacitor + plugin PosPrinter native)

Runbook **paten** — ikuti berurutan. Semua kode native sudah disiapkan di
`capacitor/android/`; langkah di bawah hanya *generate* proyek Android + menyalin
file + build. **Tidak ada kode web yang diubah**, jadi seluruh fitur/UX/workflow
tetap identik dengan PWA (lihat `docs/APK_SHELL_PLAN.md`).

> Prasyarat: Android Studio + SDK sudah terpasang. **Gunakan JBR/JDK 17–21 untuk
> Gradle, bukan JDK 26.** Detail lingkungan: `docs/PRINTER_APK_BUILD_PLAN.md`.

---

## 1. Pasang Capacitor & generate proyek Android (sekali)

Dijalankan di ROOT repo:

```bash
npm install -D @capacitor/cli
npm install @capacitor/core @capacitor/android

# init (appId & appName ini WAJIB cocok dengan package Kotlin app.pospro.terminal)
npx cap init "POS-PRO" "app.pospro.terminal" --web-dir dist

npm run build:web        # hasilkan dist/
npx cap add android      # membuat folder android/
```

## 2. Ganti `capacitor.config.ts` (root) dengan MODE A (muat web produksi)

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.pospro.terminal',
  appName: 'POS-PRO',
  webDir: 'dist',
  // MODE A — shell tipis memuat web produksi; fitur auto-update dari Vercel.
  server: { url: 'https://pos-pro-eight.vercel.app', androidScheme: 'https' },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: true, // debug: bisa di-inspect via chrome://inspect. RELEASE: false
  },
};

export default config;
```

Lalu:

```bash
npx cap copy android
```

## 3. Salin file native ke proyek Android

Folder tujuan Kotlin: `android/app/src/main/java/app/pospro/terminal/`
(buat bila belum ada; harus sesuai `package app.pospro.terminal`).

| Dari | Ke |
|---|---|
| `capacitor/android/PosPrinterPlugin.kt` | `android/app/src/main/java/app/pospro/terminal/PosPrinterPlugin.kt` |
| `capacitor/android/PrinterForegroundService.kt` | `android/app/src/main/java/app/pospro/terminal/PrinterForegroundService.kt` |
| `capacitor/android/MainActivity.kt` | **timpa** `android/app/src/main/java/app/pospro/terminal/MainActivity.kt` |

> Jika Capacitor membuat `MainActivity` di package berbeda, samakan `package`
> pada file dengan yang dibuat Capacitor, atau pindahkan ke `app.pospro.terminal`
> dan sesuaikan `namespace`/`applicationId` di `android/app/build.gradle`.

## 4. Tambahkan izin & service ke Manifest

Buka `android/app/src/main/AndroidManifest.xml`, tambahkan isi
`capacitor/android/AndroidManifest.additions.xml` sesuai petunjuk di file itu
(blok `<uses-permission>` sebelum `<application>`, blok `<service>` di dalam
`<application>`).

## 5. Dependensi native (androidx.core untuk NotificationCompat)

Pastikan `android/app/build.gradle` punya (biasanya sudah ada bawaan Capacitor):

```gradle
dependencies {
    implementation "androidx.core:core-ktx:1.13.1"
}
```

compileSdk/targetSdk = 36, minSdk = 24.

## 6. Build & pasang debug APK

Via Android Studio (paling mudah, otomatis pakai JBR):
`File > Open > pilih folder android/` → **Run** ke perangkat/emulator.

Via command line (set JAVA_HOME ke JDK 17–21 dulu):

```bash
cd android
./gradlew assembleDebug          # Windows: .\gradlew.bat assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## 7. Pra-syarat printer

Pair printer thermal (mis. RPP02N-BL) lebih dulu di **Pengaturan Bluetooth
Android**. Di dalam APK: Setup Printer → `selectAndConnect` menampilkan daftar
perangkat paired → pilih printer.

## 8. Verifikasi

Jalankan **matriks verifikasi rilis** di `docs/APK_SHELL_PLAN.md` (8 poin).
Fokus bukti keunggulan APK: cetak → pindah ShopeeFood/Grab → kembali → **printer
masih tersambung** (tanpa reconnect).

---

## Alur update rutin

- **Perubahan fitur web** → cukup deploy ke Vercel; APK MODE A otomatis memuat
  versi terbaru. **Tidak perlu build APK ulang.**
- **Perubahan native** (plugin/izin) → salin ulang file + `npx cap copy android`
  + build APK.

## Menuju release

- `webContentsDebuggingEnabled: false`.
- Kunci navigasi ke origin produksi (`shouldOverrideUrlLoading` tolak origin lain).
- APK **di-sign** (keystore) — jangan pakai debug untuk operasional.
