// URL self-order permanen per cabang. Semua label meja di cabang yang sama
// boleh memakai QR identik; kasir mengendalikan daftar meja yang dapat dipilih.
export function buildBranchSelfOrderUrl(baseUrl: string, branchId: string, tenantId?: string): string {
  const url = new URL('/', baseUrl);
  url.searchParams.set('selforder', 'true');
  if (tenantId) url.searchParams.set('tenant', tenantId);
  url.searchParams.set('branch', branchId);
  return url.toString();
}
