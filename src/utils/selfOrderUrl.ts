// URL self-order permanen per cabang. Semua label meja di cabang yang sama
// boleh memakai QR identik; kasir mengendalikan daftar meja yang dapat dipilih.
export function branchRouteCode(branchCode?: string): string {
  const match = String(branchCode || '').trim().match(/(?:^|-)(\d{1,4})$/);
  return match ? match[1].padStart(2, '0') : '';
}

export function buildBranchSelfOrderUrl(baseUrl: string, branchId: string, tenantId?: string, branchCode?: string): string {
  const routeCode = branchRouteCode(branchCode);
  const url = new URL(routeCode ? `/${routeCode}` : '/', baseUrl);
  if (routeCode) return url.toString();
  url.searchParams.set('selforder', 'true');
  if (tenantId) url.searchParams.set('tenant', tenantId);
  url.searchParams.set('branch', branchId);
  return url.toString();
}
