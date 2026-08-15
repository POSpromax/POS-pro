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

const normalizeName = (value: string) => value.trim().toLocaleUpperCase('id-ID');

// Ringkas daftar panjang dengan label seperti "CAMPUR".
// Jika preset Campur dikonfigurasi khusus di Pengaturan, label hanya aktif
// ketika pilihan customer sama persis dengan isi preset Campur tersebut.
export const summarizeCondimentOptions = (
  selected: SelectedCondimentGroup,
  groups: CondimentGroup[]
): string => {
  const group = groups.find((g) => normalizeName(g.name) === normalizeName(selected.groupName));
  if (!group?.allSelectedLabel) return selected.options.join(', ');

  const availableNames = new Set(
    group.options.filter((o) => o.isAvailable).map((o) => normalizeName(o.name)),
  );
  const configuredCampur = (group.selfOrderCampurOptions || [])
    .map(normalizeName)
    .filter((name) => Boolean(name) && availableNames.has(name));

  const summaryTarget = configuredCampur.length > 0
    ? configuredCampur
    : [...availableNames];

  if (summaryTarget.length < 2) return selected.options.join(', ');

  const chosen = selected.options.map(normalizeName).sort();
  const target = [...summaryTarget].sort();
  const isExactPreset = chosen.length === target.length
    && target.every((name, index) => chosen[index] === name);

  return isExactPreset ? group.allSelectedLabel : selected.options.join(', ');
};