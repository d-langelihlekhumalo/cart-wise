import { describe, expect, it } from 'vitest';
import { formatZAR } from '../money';
import type { Price } from '../schemas/catalogue';
import { describePromo, lineCost } from './cost';
import { REGULAR_PRICE_MAX_AGE_DAYS, resolveStorePrice, todayInSA } from './resolve';
import { formatSize, formatUnitPrice, normalizeSize, unitPrice } from './units';

const pack = (sizeValue: number, sizeUnit: 'g' | 'ml' | 'each', packCount = 1) => ({
  sizeValue,
  sizeUnit,
  packCount,
  soldByWeight: false,
});

describe('sizes', () => {
  it('normalises kg and litres', () => {
    expect(normalizeSize(12.5, 'kg')).toEqual({ sizeValue: 12500, sizeUnit: 'g' });
    expect(normalizeSize(0.75, 'l')).toEqual({ sizeValue: 750, sizeUnit: 'ml' });
    expect(normalizeSize(410, 'g')).toEqual({ sizeValue: 410, sizeUnit: 'g' });
    expect(normalizeSize(0, 'each')).toEqual({ sizeValue: 1, sizeUnit: 'each' });
  });

  it('formats sizes for people', () => {
    expect(formatSize(pack(700, 'g'))).toBe('700 g');
    expect(formatSize(pack(10000, 'g'))).toBe('10 kg');
    expect(formatSize(pack(2500, 'g'))).toBe('2.5 kg');
    expect(formatSize(pack(2000, 'ml'))).toBe('2 L');
    expect(formatSize(pack(1000, 'ml', 6))).toBe('6 × 1 L');
    expect(formatSize(pack(18, 'each'))).toBe('18 each');
    expect(formatSize(pack(1, 'each', 9))).toBe('9 pack');
    expect(formatSize({ ...pack(1000, 'g'), soldByWeight: true })).toBe('per kg');
  });
});

describe('unitPrice', () => {
  it('compares bulk and small packs per 100 g', () => {
    const big = unitPrice(pack(10000, 'g'), 12999); // R129.99 for 10 kg
    const small = unitPrice(pack(2500, 'g'), 3999); // R39.99 for 2.5 kg
    expect(big).toEqual({ cents: 129.99, per: '100 g' });
    expect(small.cents).toBeCloseTo(159.96);
    expect(big.cents).toBeLessThan(small.cents);
    expect(formatUnitPrice(big)).toBe('R1.30/100 g');
  });

  it('accounts for multipacks and per-kg items', () => {
    expect(unitPrice(pack(1000, 'ml', 6), 9000)).toEqual({ cents: 150, per: '100 ml' }); // R90 for 6 L
    expect(unitPrice({ ...pack(1000, 'g'), soldByWeight: true }, 8999)).toEqual({
      cents: 899.9,
      per: '100 g',
    });
    expect(unitPrice(pack(18, 'each'), 5400)).toEqual({ cents: 300, per: 'each' });
  });
});

const base: Price = {
  id: 'p1',
  productId: 'prod',
  chainId: 'checkers',
  regionId: null,
  storeId: null,
  priceCents: 2000,
  memberPriceCents: null,
  isPromo: false,
  promoType: 'none',
  promoQty: null,
  promoPriceCents: null,
  promoFreeQty: null,
  promoMemberOnly: false,
  validFrom: null,
  validTo: null,
  observedAt: 0,
  source: 'manual',
};

describe('lineCost', () => {
  it('uses the member price only with the card', () => {
    const p = { ...base, memberPriceCents: 1500 };
    expect(lineCost(p, 2, false)).toBe(4000);
    expect(lineCost(p, 2, true)).toBe(3000);
  });

  it('applies multibuys to complete bundles only', () => {
    const p = { ...base, promoType: 'multibuy' as const, promoQty: 3, promoPriceCents: 5000 };
    expect(lineCost(p, 2, false)).toBe(4000);
    expect(lineCost(p, 3, false)).toBe(5000);
    expect(lineCost(p, 7, false)).toBe(5000 * 2 + 2000);
  });

  it('never uses a promo that is worse than buying singly', () => {
    const p = { ...base, promoType: 'multibuy' as const, promoQty: 2, promoPriceCents: 4500 };
    expect(lineCost(p, 2, false)).toBe(4000);
  });

  it('gives free items for buy X get Y', () => {
    const p = { ...base, promoType: 'buy_x_get_y' as const, promoQty: 2, promoFreeQty: 1 };
    expect(lineCost(p, 2, false)).toBe(4000);
    expect(lineCost(p, 3, false)).toBe(4000);
    expect(lineCost(p, 6, false)).toBe(8000);
  });

  it('respects member-only promos', () => {
    const p = {
      ...base,
      promoType: 'multibuy' as const,
      promoQty: 2,
      promoPriceCents: 3000,
      promoMemberOnly: true,
    };
    expect(lineCost(p, 2, false)).toBe(4000);
    expect(lineCost(p, 2, true)).toBe(3000);
  });

  it('describes promos', () => {
    expect(
      describePromo(
        { ...base, promoType: 'multibuy', promoQty: 3, promoPriceCents: 5000 },
        formatZAR,
      ),
    ).toBe('3 for R50.00');
    expect(
      describePromo({ ...base, promoType: 'buy_x_get_y', promoQty: 2, promoFreeQty: 1 }, formatZAR),
    ).toBe('Buy 2 get 1 free');
    expect(describePromo(base, formatZAR)).toBeNull();
  });
});

describe('todayInSA', () => {
  it('uses the South African calendar day, not UTC', () => {
    // 23:30 UTC on 30 Sept is 01:30 on 1 Oct in Johannesburg (UTC+2).
    expect(todayInSA(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01');
    expect(todayInSA(new Date('2026-09-30T21:59:00Z'))).toBe('2026-09-30');
  });
});

describe('resolveStorePrice', () => {
  const store = { id: 'store-sandton', chainId: 'checkers', regionId: 'gauteng' };
  const now = Date.parse('2026-09-24T10:00:00Z');
  const today = '2026-09-24';
  const daysAgo = (d: number) => now - d * 86_400_000;

  it('prefers the most specific scope, then the newest', () => {
    const national = { ...base, id: 'national', observedAt: daysAgo(1) };
    const region = { ...base, id: 'region', regionId: 'gauteng' as const, observedAt: daysAgo(5) };
    const thisStore = { ...base, id: 'store', storeId: 'store-sandton', observedAt: daysAgo(10) };
    const newerStore = { ...thisStore, id: 'store-newer', observedAt: daysAgo(2) };
    expect(resolveStorePrice([national, region], store, now, today).regular?.id).toBe('region');
    expect(
      resolveStorePrice([national, region, thisStore, newerStore], store, now, today).regular?.id,
    ).toBe('store-newer');
  });

  it('ignores other chains, regions and stores', () => {
    const rows = [
      { ...base, id: 'pnp', chainId: 'pick-n-pay' },
      { ...base, id: 'wc', regionId: 'western-cape' as const },
      { ...base, id: 'other-store', storeId: 'store-rosebank' },
    ];
    expect(resolveStorePrice(rows, store, now, today)).toEqual({
      regular: null,
      promo: null,
      lastSeen: null,
    });
  });

  it('drops stale regular prices but remembers them as last seen', () => {
    const stale = { ...base, id: 'stale', observedAt: daysAgo(REGULAR_PRICE_MAX_AGE_DAYS + 1) };
    const result = resolveStorePrice([stale], store, now, today);
    expect(result.regular).toBeNull();
    expect(result.lastSeen?.id).toBe('stale');
  });

  it('only uses specials within their dates', () => {
    const special = {
      ...base,
      isPromo: true,
      priceCents: 1500,
      observedAt: daysAgo(3),
      validFrom: '2026-09-20',
      validTo: '2026-09-24',
    };
    expect(resolveStorePrice([special], store, now, today).promo).not.toBeNull();
    expect(resolveStorePrice([special], store, now, '2026-09-25').promo).toBeNull();
    expect(resolveStorePrice([special], store, now, '2026-09-19').promo).toBeNull();
  });
});
