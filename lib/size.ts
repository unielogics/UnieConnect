// Shared physical-size helpers. Used by the shipment-plan modal and the SKU detail Item-details
// grid so "size tier" and cubic feet are computed identically everywhere.

export type Dims = { length?: number; width?: number; height?: number } | null | undefined;

/** Cubic feet for one unit from L×W×H inches (1728 in³ = 1 ft³). Mirrors the backend itemCubeFt.
 *  Returns null unless all three dimensions are positive. */
export function itemCubicFeet(dims?: Dims): number | null {
  if (!dims) return null;
  const l = dims.length ?? 0, w = dims.width ?? 0, h = dims.height ?? 0;
  if (l <= 0 || w <= 0 || h <= 0) return null;
  return Number(((l * w * h) / 1728).toFixed(3));
}

/** Coarse size tier from cubic feet — small/medium/large. Reference-only label for the operator;
 *  the real FBA size-tier classifier lives in Cortex. Thresholds: <0.5 ft³ small, <2 ft³ medium. */
export function sizeTier(dims?: Dims): 'small' | 'medium' | 'large' | null {
  const cf = itemCubicFeet(dims);
  if (cf == null) return null;
  if (cf < 0.5) return 'small';
  if (cf < 2) return 'medium';
  return 'large';
}

/** Human label combining tier + cube, e.g. "Medium · 0.09 ft³". Null when dims incomplete. */
export function sizeTierLabel(dims?: Dims): string | null {
  const tier = sizeTier(dims);
  if (!tier) return null;
  const cf = itemCubicFeet(dims);
  const tierText = tier.charAt(0).toUpperCase() + tier.slice(1);
  return cf != null ? `${tierText} · ${cf} ft³` : tierText;
}
