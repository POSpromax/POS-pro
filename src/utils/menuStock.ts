import type { MenuItem, RawMaterial } from '../types/pos';

/**
 * Returns the number of complete portions that can be produced from a menu's
 * recipe. raw_materials is the operational source of truth; menu_items'
 * stock_count only remains relevant for a menu without a stock-linked recipe.
 */
export function getRecipeAvailablePortions(
  menu: MenuItem,
  rawMaterials: readonly RawMaterial[],
): number | undefined {
  if (menu.isManualPrice) return undefined;

  const stockIngredients = (menu.ingredients || []).filter((ingredient) => (
    !ingredient.isCustom
    && Boolean(ingredient.rawMaterialId)
    && Number.isFinite(ingredient.amountNeeded)
    && ingredient.amountNeeded > 0
  ));
  if (stockIngredients.length === 0) return undefined;

  const materialById = new Map(rawMaterials.map((material) => [material.id, material]));
  let availablePortions = Infinity;
  for (const ingredient of stockIngredients) {
    const material = materialById.get(ingredient.rawMaterialId);
    // Do not invent a balance when a damaged/legacy recipe points at a deleted
    // material. The editor will flag the recipe instead of showing false zero.
    if (!material) return undefined;
    availablePortions = Math.min(
      availablePortions,
      Math.floor(Math.max(0, material.stockQuantity) / ingredient.amountNeeded),
    );
  }
  return Number.isFinite(availablePortions) ? availablePortions : undefined;
}

export function getEffectiveMenuStock(menu: MenuItem, rawMaterials: readonly RawMaterial[]): number | undefined {
  return getRecipeAvailablePortions(menu, rawMaterials) ?? menu.stockCount;
}

/** Maps catalog items for screens that show stock. It never writes the derived
 * value back to menu_items, so inventory changes remain ledger-driven. */
export function withEffectiveMenuStock(menuItems: readonly MenuItem[], rawMaterials: readonly RawMaterial[]): MenuItem[] {
  return menuItems.map((menu) => {
    const recipeStock = getRecipeAvailablePortions(menu, rawMaterials);
    return recipeStock === undefined ? menu : { ...menu, stockCount: recipeStock, isAutoStock: true };
  });
}
