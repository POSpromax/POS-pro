import React, {useEffect} from 'react';
import {RefreshCw, WifiOff} from 'lucide-react';
import {useRegisterSW} from 'virtual:pwa-register/react';

export const PWAUpdatePrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady) return;
    const timeout = window.setTimeout(() => setOfflineReady(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [offlineReady, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[80] w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-black/10 bg-[var(--primary)] p-3.5 text-white shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-solid)]">
          {needRefresh ? <RefreshCw className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">{needRefresh ? 'Pembaruan sistem tersedia' : 'Aplikasi siap offline'}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">
            {needRefresh
              ? 'Selesaikan transaksi aktif, lalu muat versi terbaru.'
              : 'Aset utama telah tersimpan untuk koneksi yang tidak stabil.'}
          </p>
        </div>
      </div>
      {needRefresh && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-white/65"
          >
            Nanti
          </button>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="flex-1 rounded-xl bg-[var(--primary-solid)] px-3 py-2 text-[11px] font-bold text-white hover:bg-[var(--primary-pressed)]"
          >
            Muat terbaru
          </button>
        </div>
      )}
    </div>
  );
};
