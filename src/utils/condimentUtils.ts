import { CondimentGroup, MenuItem } from '../types/pos';

export const isGroupApplicable = (group: CondimentGroup, menuItem: MenuItem): boolean => {
  if (!group.isActive) return false;

  if (group.targetProductIds && group.targetProductIds.length > 0) {
    return group.targetProductIds.includes(menuItem.id);
  }

  if (group.targetProductNames && group.targetProductNames.length > 0) {
    const itemName = menuItem.name.toLowerCase();
    const matchesName = group.targetProductNames.some((name) =>
      itemName.includes(name.toLowerCase())
    );
    return matchesName;
  }

  if (group.targetCategories && group.targetCategories.length > 0) {
    if (group.targetCategories.includes('ALL')) return true;
    return group.targetCategories.includes(menuItem.category);
  }

  if (group.targetCategory) return group.targetCategory === 'ALL' || group.targetCategory === menuItem.category;

  return false;
};
