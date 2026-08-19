import type { MenuItem, RawMaterial } from '../types/pos';

export interface HppLine {
  rawMaterialId: string;
  name: string;
  amount: number;      // jumlah dipakai per porsi
  unit: string;
  costPerUnit: number; // biaya per satuan bahan
  subtotal: number;    // amount * costPerUnit
  missing: boolean;    // bahan tidak ditemukan / harga belum diisi
}

export interface HppBreakdown {
  lines: HppLine[];
  total: number;          // HPP per porsi dari resep
  missingCount: number;   // bahan yang harganya belum diisi
}

/**
 * Menghitung HPP satu menu DARI RESEP: jumlah pemakaian x harga per satuan bahan.
 * Pemakaian kecil (mis. kecap 8 ml, mie 1 pack) tetap akurat selama satuan bahan
 * dan harga per satuannya konsisten — lihat kalkulator "harga beli / isi kemasan"
 * pada form bahan untuk mengubah harga kemasan menjadi harga per satuan.
 */
export function calculateMenuHpp(menu: MenuItem, rawMaterials: RawMaterial[]): HppBreakdown {
  const byId = new Map(rawMaterials.map((m) => [m.id, m]));
  const lines: HppLine[] = (menu.ingredients || []).map((ing) => {
    // Bahan CUSTOM memakai biaya yang diisi manual (tidak punya master harga).
    const material = byId.get(ing.rawMaterialId);
    const amount = Number(ing.amountNeeded) || 0;
    const costPerUnit = ing.isCustom
      ? (Number(ing.customCost) || 0)
      : (Number(material?.costPerUnit) || 0);
    const missing = ing.isCustom ? costPerUnit <= 0 : (!material || costPerUnit <= 0);
    return {
      rawMaterialId: ing.rawMaterialId || `custom:${ing.rawMaterialName}`,
      name: ing.isCustom ? ing.rawMaterialName : (material?.name || ing.rawMaterialName || 'Bahan tidak ditemukan'),
      amount,
      unit: ing.unit || material?.unit || '',
      costPerUnit,
      subtotal: Math.round(amount * costPerUnit),
      missing,
    };
  });
  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.subtotal, 0),
    missingCount: lines.filter((line) => line.missing).length,
  };
}

/** Margin & persentase terhadap harga jual. */
export function marginOf(price: number, hpp: number) {
  const safePrice = Number(price) || 0;
  const margin = safePrice - (Number(hpp) || 0);
  return {
    margin,
    percent: safePrice > 0 ? Math.round((margin / safePrice) * 1000) / 10 : 0,
  };
}
