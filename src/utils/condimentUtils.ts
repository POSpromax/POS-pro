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

const normalizeName = (value: string) =>
  String(value || '').trim().toLocaleUpperCase('id-ID').replace(/\s+/g, ' ');

const sameNormalizedSelection = (chosen: string[], target: string[]) => {
  const left = chosen.map(normalizeName).filter(Boolean).sort();
  const right = target.map(normalizeName).filter(Boolean).sort();
  return left.length > 0
    && left.length === right.length
    && left.every((name, index) => name === right[index]);
};

const configuredAvailableNames = (group: CondimentGroup, names?: string[]) => {
  const available = new Map(
    group.options
      .filter((option) => option.isAvailable !== false)
      .map((option) => [normalizeName(option.name), option.name]),
  );

  return (names || [])
    .map((name) => available.get(normalizeName(name)))
    .filter((name): name is string => Boolean(name));
};

const orderConfiguredSelections = (group: CondimentGroup, selectedNames: string[]) => {
  const rank = new Map(group.options.map((option, index) => [normalizeName(option.name), index]));
  return [...selectedNames].sort((left, right) =>
    (rank.get(normalizeName(left)) ?? Number.MAX_SAFE_INTEGER)
      - (rank.get(normalizeName(right)) ?? Number.MAX_SAFE_INTEGER),
  );
};

const fallbackBaksoOnly = (group: CondimentGroup) =>
  group.options
    .filter((option) => {
      if (option.isAvailable === false) return false;
      const name = normalizeName(option.name).replace(/[^A-Z0-9]/g, '');
      return name === 'BAWANG' || name === 'SLEDRI' || name === 'SELEDRI';
    })
    .map((option) => option.name);

const fallbackCampur = (group: CondimentGroup) =>
  group.options
    .filter((option) => {
      if (option.isAvailable === false) return false;
      const name = normalizeName(option.name).replace(/[^A-Z0-9]/g, '');
      return name !== 'KWETIAW' && name !== 'BAKSOAJA' && name !== 'BAKSOSAJA';
    })
    .map((option) => option.name);

/**
 * Kitchen-only concise summary.
 *
 * Canonical ISIAN groups understand the same operational presets used by POS
 * and Self Order:
 * - exact Bakso Saja preset => "BAKSO SAJA"
 * - exact Campur preset     => allSelectedLabel or "CAMPUR"
 * - manual/modified recipe  => show the actual option list
 *
 * This prevents a manual change (e.g. Campur minus tauge) from being falsely
 * labelled CAMPUR while still making standard recipes fast to scan in KDS.
 */
export const summarizeCondimentOptions = (
  selected: SelectedCondimentGroup,
  groups: CondimentGroup[]
): string => {
  const group = groups.find((g) => normalizeName(g.name) === normalizeName(selected.groupName));
  if (!group) return selected.options.join(', ');

  const normalizedGroupName = normalizeName(group.name).replace(/[^A-Z0-9]/g, '');
  const isFilling = group.selfOrderRole === 'FILLING' || normalizedGroupName.includes('ISIAN');

  if (isFilling) {
    const baksoOnly = configuredAvailableNames(group, group.selfOrderBaksoOnlyOptions);
    const baksoOnlyTarget = baksoOnly.length ? baksoOnly : fallbackBaksoOnly(group);
    if (sameNormalizedSelection(selected.options, baksoOnlyTarget)) {
      return 'BAKSO SAJA';
    }

    const campur = configuredAvailableNames(group, group.selfOrderCampurOptions);
    const campurTarget = campur.length ? campur : fallbackCampur(group);
    if (sameNormalizedSelection(selected.options, campurTarget)) {
      return group.allSelectedLabel || 'CAMPUR';
    }

    return orderConfiguredSelections(group, selected.options).join(', ');
  }

  if (!group.allSelectedLabel) return orderConfiguredSelections(group, selected.options).join(', ');

  const availableNames = group.options
    .filter((option) => option.isAvailable !== false)
    .map((option) => option.name);

  return sameNormalizedSelection(selected.options, availableNames)
    ? group.allSelectedLabel
    : orderConfiguredSelections(group, selected.options).join(', ');
};
