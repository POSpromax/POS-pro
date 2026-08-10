import { CondimentGroup, MenuItem, SelectedCondimentGroup } from '../types/pos';

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

// Ganti daftar panjang dengan satu label ringkas (mis. "CAMPUR") saat seluruh opsi
// yang tersedia dipilih, supaya tiket dapur tetap terbaca sekilas.
export const summarizeCondimentOptions = (
  selected: SelectedCondimentGroup,
  groups: CondimentGroup[]
): string => {
  const group = groups.find((g) => g.name === selected.groupName);
  if (!group?.allSelectedLabel) return selected.options.join(', ');

  const availableNames = group.options.filter((o) => o.isAvailable).map((o) => o.name);
  if (availableNames.length < 2) return selected.options.join(', ');

  const allChosen = availableNames.every((name) => selected.options.includes(name));
  return allChosen ? group.allSelectedLabel : selected.options.join(', ');
};
