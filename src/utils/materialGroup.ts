import { MaterialGroup, RawMaterial } from '../types/pos';

export const MATERIAL_GROUP_LABELS: Record<MaterialGroup, string> = {
  MENU: 'Bahan Menu',
  DAPUR: 'Stok Dapur',
  KEMASAN: 'Kemasan Bawa Pulang'
};

const PACKAGING_HINTS = ['cup', 'gelas plastik', 'rice bowl', 'kemasan', 'kantong', 'kresek', 'sendok', 'garpu', 'sedotan', 'mika', 'box makan', 'paper bag'];

// Legacy materials were saved before `group` existed; infer it from id prefix and name.
export const resolveMaterialGroup = (material: RawMaterial): MaterialGroup => {
  if (material.group) return material.group;

  const name = material.name.toLowerCase();
  if (PACKAGING_HINTS.some((hint) => name.includes(hint))) return 'KEMASAN';
  if (material.id.startsWith('raw-b') || name.startsWith('bakso') || name.startsWith('mie ayam')) return 'MENU';
  return 'DAPUR';
};

export const filterMaterialsByGroup = (materials: RawMaterial[], group: MaterialGroup): RawMaterial[] =>
  materials.filter((m) => resolveMaterialGroup(m) === group);
