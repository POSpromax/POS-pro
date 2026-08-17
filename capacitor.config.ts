import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.pospro.terminal',
  appName: 'POS-PRO',
  webDir: 'dist',
  // MODE A — shell tipis memuat web produksi; seluruh fitur/UX auto-update dari
  // Vercel tanpa build APK ulang. Untuk offline/bundel lokal, hapus blok server.
  server: {
    url: 'https://pos-pro-eight.vercel.app',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    // Debug: bisa di-inspect via chrome://inspect. RELEASE harus false.
    webContentsDebuggingEnabled: true,
  },
};

export default config;
