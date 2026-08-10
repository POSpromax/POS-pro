import { CondimentGroup, MenuItem } from '../types/pos';

export const isGroupApplicable = (group: CondimentGroup, menuItem: MenuItem): boolean => {
  if (!group.isActive) return false;

  const hasProductIds = Boolean(group.targetProductIds?.length);
  const hasProductNames = Boolean(group.targetProductNames?.length);
  const categories = group.targetCategories || (group.targetCategory ? [group.targetCategory] : []);
  const hasCategories = categories.length > 0;
  if (!hasProductIds && !hasProductNames && !hasCategories) return false;

  const matchesId = group.targetProductIds?.includes(menuItem.id) || false;
  let matchesName = false;
  if (hasProductNames) {
    const itemName = menuItem.name.toLowerCase();
    matchesName = group.targetProductNames!.some((name) =>
      itemName.includes(name.toLowerCase())
    );
  }
  const matchesCategory = categories.includes('ALL') || categories.includes(menuItem.category);
  return matchesId || matchesName || matchesCategory;
};
