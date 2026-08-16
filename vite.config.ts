import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        // Service worker hanya diperlukan pada build produksi. Mengaktifkannya
        // pada Vite dev membuat /dev-sw.js jatuh ke SPA fallback (text/html)
        // dan menghasilkan error MIME yang menyesatkan saat audit lokal.
        devOptions: {enabled: false},
        manifest: {
          name: 'Bakso Ujo POS',
          short_name: 'Bakso Ujo',
          description: 'POS restoran multi cabang, KDS, absensi, dan self-order.',
          theme_color: '#181816',
          background_color: '#f5f5f4',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          orientation: 'any',
          categories: ['business', 'productivity'],
          icons: [
            {
              src: '/omnipos-icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          // Jangan cache app-shell HTML. Pada POS multi-perangkat, HTML lama
          // dapat menunjuk ke chunk yang sudah tidak ada dan membuat perubahan
          // cabang/QR tampak tidak pernah terdeploy. Refresh online wajib
          // mengambil index terbaru dari deployment.
          // Jangan precache bundle JS/CSS ber-hash. Vercel hanya menyimpan aset
          // deployment aktif; instalasi SW lama yang terjadi setelah deploy
          // dapat menerima 404 dan gagal total bila chunk ikut diprecache.
          globPatterns: ['**/*.{svg,png,webmanifest}'],
          globIgnores: ['**/index.html'],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/res\.cloudinary\.com\//i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'cloudinary-media-v1',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
