import type { Branch, CondimentGroup, MenuItem, RestaurantProfile, RestaurantTable } from '../types/pos';

export interface PublicCatalogContext {
  branch: Branch;
  profile: Partial<RestaurantProfile> | null;
  menuItems: MenuItem[];
  tables: RestaurantTable[];
  condimentGroups: CondimentGroup[];
}

export async function getPublicCatalogContext(branchId: string): Promise<PublicCatalogContext> {
  const response = await fetch(`/api/public-catalog?branchId=${encodeURIComponent(branchId)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Katalog self-order tidak tersedia');
  return data as PublicCatalogContext;
}
