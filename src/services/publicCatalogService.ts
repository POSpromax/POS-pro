import type { Branch, BranchOperationalConfig, CondimentGroup, MenuItem, RestaurantProfile, RestaurantTable } from '../types/pos';

export interface PublicCatalogContext {
  branch: Branch;
  profile: Partial<RestaurantProfile> | null;
  operationalConfig: BranchOperationalConfig;
  menuItems: MenuItem[];
  tables: RestaurantTable[];
  condimentGroups: CondimentGroup[];
}

export async function getPublicCatalogContext(branchId: string, tenantId?: string): Promise<PublicCatalogContext> {
  const query = new URLSearchParams({ branchId });
  if (tenantId) query.set('tenantId', tenantId);
  const response = await fetch(`/api/public-catalog?${query.toString()}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Katalog self-order tidak tersedia');
  return data as PublicCatalogContext;
}
