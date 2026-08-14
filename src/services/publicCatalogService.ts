import type { Branch, BranchOperationalConfig, CondimentGroup, MenuItem, RestaurantProfile, RestaurantTable } from '../types/pos';

export interface PublicCatalogContext {
  branch: Branch;
  profile: Partial<RestaurantProfile> | null;
  operationalConfig: BranchOperationalConfig;
  menuItems: MenuItem[];
  tables: RestaurantTable[];
  condimentGroups: CondimentGroup[];
  isShiftActive: boolean;
}

export async function getPublicCatalogContext(branchId?: string, tenantId?: string, branchCode?: string): Promise<PublicCatalogContext> {
  const query = new URLSearchParams();
  if (branchId) query.set('branchId', branchId);
  if (tenantId) query.set('tenantId', tenantId);
  if (branchCode) query.set('branchCode', branchCode);
  const response = await fetch(`/api/public-catalog?${query.toString()}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Katalog self-order tidak tersedia');
  return data as PublicCatalogContext;
}
