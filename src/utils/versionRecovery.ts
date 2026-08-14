const RECOVERY_STORAGE_KEY = 'omnipos_asset_recovery_at';
const RECOVERY_WINDOW_MS = 30_000;

export function isAssetVersionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /dynamically imported module|failed to fetch|module script|importing a module script|preload|404|bad-precaching-response/i.test(message);
}

async function clearApplicationCodeCaches(): Promise<void> {
  if (!('caches' in window)) return;
  const keys = await window.caches.keys();
  await Promise.all(keys
    .filter((key) => key.includes('workbox-precache') || key.startsWith('pos-navigation-'))
    .map((key) => window.caches.delete(key)));
}

async function unregisterApplicationWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

function reloadFromNetwork(): void {
  const url = new URL(window.location.href);
  url.searchParams.set('__appv', Date.now().toString(36));
  window.location.replace(url.toString());
}

/**
 * Repairs a Vercel/PWA deployment mismatch without touching auth session,
 * terminal state, printer settings, or operational data.
 */
export async function recoverFromAssetVersionError(error: unknown, force = false): Promise<boolean> {
  if (!force && !isAssetVersionError(error)) return false;
  const lastRecoveryAt = Number(sessionStorage.getItem(RECOVERY_STORAGE_KEY) || 0);
  if (!force && Date.now() - lastRecoveryAt < RECOVERY_WINDOW_MS) return false;

  sessionStorage.setItem(RECOVERY_STORAGE_KEY, String(Date.now()));
  await Promise.allSettled([
    clearApplicationCodeCaches(),
    unregisterApplicationWorkers(),
  ]);
  reloadFromNetwork();
  return true;
}

export function installAssetVersionRecovery(): () => void {
  const handlePreloadError = (event: Event) => {
    const preloadEvent = event as Event & { payload?: unknown };
    event.preventDefault();
    void recoverFromAssetVersionError(preloadEvent.payload || new Error('Vite preload error'), true);
  };
  window.addEventListener('vite:preloadError', handlePreloadError);
  return () => window.removeEventListener('vite:preloadError', handlePreloadError);
}
