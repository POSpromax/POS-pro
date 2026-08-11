import type { OrderItem, SelectedCondimentGroup } from '../types/pos';

export interface KitchenModifierSubgroup {
  key: string;
  quantity: number;
  selectedCondiments: SelectedCondimentGroup[];
  note?: string;
}

export interface KitchenProductGroup {
  key: string;
  menuName: string;
  totalQuantity: number;
  modifierGroups: KitchenModifierSubgroup[];
}

const normalizeModifiers = (groups: SelectedCondimentGroup[] = []) => groups
  .map((group) => ({
    groupName: String(group.groupName || '').trim(),
    options: [...(group.options || [])].map(String).map((value) => value.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'id-ID')),
  }))
  .filter((group) => group.groupName || group.options.length)
  .sort((a, b) => a.groupName.localeCompare(b.groupName, 'id-ID'));

const modifierSignature = (item: OrderItem) => JSON.stringify({
  modifiers: normalizeModifiers(item.selectedCondiments),
  note: String(item.notes || '').trim(),
});

/**
 * Groups only for Kitchen presentation. Source order items are never mutated,
 * so payment, refund, inventory and audit data keep their original granularity.
 */
export function groupKitchenItems(items: OrderItem[]): KitchenProductGroup[] {
  const products = new Map<string, KitchenProductGroup>();

  items.forEach((item) => {
    const productKey = item.menuId || item.menuName.trim().toLocaleLowerCase('id-ID');
    let product = products.get(productKey);
    if (!product) {
      product = { key: productKey, menuName: item.menuName, totalQuantity: 0, modifierGroups: [] };
      products.set(productKey, product);
    }

    const quantity = Math.max(1, Number(item.quantity) || 1);
    product.totalQuantity += quantity;
    const signature = modifierSignature(item);
    const existing = product.modifierGroups.find((group) => group.key === signature);
    if (existing) {
      existing.quantity += quantity;
    } else {
      product.modifierGroups.push({
        key: signature,
        quantity,
        selectedCondiments: normalizeModifiers(item.selectedCondiments),
        note: String(item.notes || '').trim() || undefined,
      });
    }
  });

  return [...products.values()];
}
