// URL self-order permanen per cabang. Semua label meja di cabang yang sama
// boleh memakai QR identik; kasir mengendalikan daftar meja yang dapat dipilih.
export function branchRouteCode(branchCode?: string): string {
  const match = String(branchCode || '').trim().match(/(?:^|-)(\d{1,4})$/);
  return match ? match[1].padStart(2, '0') : '';
}

export function buildBranchSelfOrderUrl(
  baseUrl: string,
  branchId: string,
  tenantId?: string,
  branchCode?: string,
  publicOrderSlug?: string,
): string {
  const configuredSlug = String(publicOrderSlug || '').trim();
  const routeCode = /^\d{2,4}$/.test(configuredSlug) ? configuredSlug : branchRouteCode(branchCode);
  const browserOrigin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost';
  let safeBaseUrl = browserOrigin;
  try {
    safeBaseUrl = new URL(String(baseUrl || '').trim()).origin;
  } catch {
    // Konfigurasi domain dapat kosong/tidak lengkap ketika sedang diedit.
    // QR tetap memakai origin aplikasi supaya render halaman tidak terputus.
  }
  // Changed from /{code} to /pesan/{code} to avoid Chrome phishing warning
  const url = new URL(routeCode ? `/pesan/${routeCode}` : '/', safeBaseUrl);
  if (routeCode) return url.toString();
  url.searchParams.set('selforder', 'true');
  if (tenantId) url.searchParams.set('tenant', tenantId);
  url.searchParams.set('branch', branchId);
  return url.toString();
}
