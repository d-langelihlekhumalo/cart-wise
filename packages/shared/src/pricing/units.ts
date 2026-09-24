import { formatZAR } from '../money';
import type { InputSizeUnit, Product, SizeUnit } from '../schemas/catalogue';

/** Converts an entered size to the stored base unit (g, ml or each). */
export function normalizeSize(
  value: number,
  unit: InputSizeUnit,
): { sizeValue: number; sizeUnit: SizeUnit } {
  switch (unit) {
    case 'kg':
      return { sizeValue: Math.round(value * 1000), sizeUnit: 'g' };
    case 'l':
      return { sizeValue: Math.round(value * 1000), sizeUnit: 'ml' };
    case 'g':
    case 'ml':
      return { sizeValue: Math.round(value), sizeUnit: unit };
    case 'each':
      return { sizeValue: Math.max(1, Math.round(value)), sizeUnit: 'each' };
  }
}

type Sized = Pick<Product, 'sizeValue' | 'sizeUnit' | 'packCount' | 'soldByWeight'>;

/** Human size: `700 g`, `2 L`, `6 × 1 L`, `12 each`, `per kg`. */
export function formatSize(p: Sized): string {
  if (p.soldByWeight) return 'per kg';
  const one = (() => {
    if (p.sizeUnit === 'each') return p.sizeValue === 1 ? '' : `${p.sizeValue} each`;
    const big = p.sizeValue >= 1000 && p.sizeValue % 100 === 0;
    if (p.sizeUnit === 'g') return big ? `${p.sizeValue / 1000} kg` : `${p.sizeValue} g`;
    return big ? `${p.sizeValue / 1000} L` : `${p.sizeValue} ml`;
  })();
  if (p.packCount > 1) return one ? `${p.packCount} × ${one}` : `${p.packCount} pack`;
  return one;
}

export interface UnitPrice {
  /** Cents per `per`. Fractional; for comparison and display only, never stored. */
  cents: number;
  per: '100 g' | '100 ml' | 'each';
}

/**
 * Price per 100 g / 100 ml / item, so a 10 kg bag can be compared with a 2.5 kg one.
 * `priceCents` is for the whole pack, or per kg when the product is sold by weight.
 */
export function unitPrice(p: Sized, priceCents: number): UnitPrice {
  if (p.soldByWeight) return { cents: priceCents / 10, per: '100 g' };
  const total = p.sizeValue * p.packCount;
  if (p.sizeUnit === 'each') return { cents: priceCents / total, per: 'each' };
  return { cents: (priceCents / total) * 100, per: p.sizeUnit === 'g' ? '100 g' : '100 ml' };
}

export function formatUnitPrice(u: UnitPrice): string {
  return `${formatZAR(Math.round(u.cents))}/${u.per}`;
}
