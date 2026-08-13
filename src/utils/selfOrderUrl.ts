// URL self-order permanen per cabang. Semua label meja di cabang yang sama
// boleh memakai QR identik; kasir mengendalikan daftar meja yang dapat dipilih.
export function buildBranchSelfOrderUrl(baseUrl: string, branchId: string): string {
  const url = new URL('/', baseUrl);
  url.searchParams.set('selforder', 'true');
  url.searchParams.set('branch', branchId);
  return url.toString();
}
