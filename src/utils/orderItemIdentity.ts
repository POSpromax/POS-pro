import type {OrderItem, SelectedCondimentGroup} from '../types/pos';

const normalizeIdentityText = (value?: string) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('id-ID');

/**
 * Stable condiment normalization used only for identity/grouping.
 * The original OrderItem is never mutated, so receipt/audit text keeps the
 * exact labels saved by POS/Self Order.
 */
export const normalizeCondimentsForIdentity = (
  groups: SelectedCondimentGroup[] = [],
) =>
  groups
    .map((group) => ({
      groupName: normalizeIdentityText(group.groupName),
      options: [...(group.options || [])]
        .map(normalizeIdentityText)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'id-ID')),
    }))
    .filter((group) => group.groupName || group.options.length > 0)
    .sort((a, b) => a.groupName.localeCompare(b.groupName, 'id-ID'));

/**
 * Modifier-level identity. Two portions are equivalent only when condiment
 * selections AND the per-item note are equivalent.
 */
export const buildOrderItemModifierSignature = (item: OrderItem): string =>
  JSON.stringify({
    condiments: normalizeCondimentsForIdentity(item.selectedCondiments),
    note: normalizeIdentityText(item.notes),
  });

/**
 * Full line identity used by POS cart consolidation.
 * Price is intentionally included because condiment options can add price.
 * Status is also included so loading an existing bill never merges DONE and
 * PENDING/PREPARING portions into one mutable line.
 */
export const buildOrderItemVariantKey = (item: OrderItem): string =>
  JSON.stringify({
    product: item.menuId
      ? `ID:${String(item.menuId)}`
      : `NAME:${normalizeIdentityText(item.menuName)}`,
    category: item.category,
    price: Number(item.price || 0),
    status: item.status || '',
    modifiers: buildOrderItemModifierSignature(item),
  });

/**
 * Safe cart consolidation:
 * - identical product + price + condiment + note => quantity can be merged
 * - any modifier/note difference => remains a separate source line
 *
 * This keeps the source order granular enough for Kitchen to show different
 * recipes per portion while still giving Cashier compact x2/x3 rows when the
 * portions are truly identical.
 */
export const consolidateEquivalentOrderItems = (
  items: OrderItem[] = [],
): OrderItem[] => {
  const grouped = new Map<string, OrderItem>();

  for (const item of items) {
    const key = buildOrderItemVariantKey(item);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const existing = grouped.get(key);

    if (existing) {
      grouped.set(key, {
        ...existing,
        quantity: Math.max(1, Number(existing.quantity) || 1) + quantity,
      });
      continue;
    }

    grouped.set(key, {...item, quantity});
  }

  return [...grouped.values()];
};