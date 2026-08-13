const LEGACY_BRANCH_ID_MAP: Record<string, string> = {
  'br-1': '00000000-0000-4000-a000-000000000010',
  'br-2': '00000000-0000-4000-a000-000000000020',
};

export function normalizeBranchId(branchId?: string | null): string {
  const value = String(branchId || '').trim();
  return LEGACY_BRANCH_ID_MAP[value] || value;
}
