import * as z from 'zod/mini';
import { REGION_IDS } from '../regions';

// Chains, stores, the product taxonomy and prices. Money is integer cents; sizes are stored
// normalised to g / ml / each (see pricing/units.ts).

export const LOYALTY_PROGRAMS = [
  { id: 'xtra_savings', name: 'Xtra Savings', chains: 'Checkers, Shoprite' },
  { id: 'smart_shopper', name: 'Smart Shopper', chains: 'Pick n Pay' },
  { id: 'wrewards', name: 'WRewards', chains: 'Woolworths' },
  { id: 'spar_rewards', name: 'Spar Rewards', chains: 'Spar' },
] as const;

export type LoyaltyProgramId = (typeof LOYALTY_PROGRAMS)[number]['id'];
export const LOYALTY_PROGRAM_IDS = LOYALTY_PROGRAMS.map((p) => p.id) as [
  LoyaltyProgramId,
  ...LoyaltyProgramId[],
];

export const CHAIN_TIERS = ['major', 'regional', 'informal'] as const;
export const SIZE_UNITS = ['g', 'ml', 'each'] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];
/** Units accepted on input; kg and l are converted to g and ml. */
export const INPUT_SIZE_UNITS = ['g', 'kg', 'ml', 'l', 'each'] as const;
export type InputSizeUnit = (typeof INPUT_SIZE_UNITS)[number];

export const PROMO_TYPES = ['none', 'multibuy', 'buy_x_get_y'] as const;
export type PromoType = (typeof PROMO_TYPES)[number];

const cents = z.int().check(z.positive(), z.maximum(10_000_000));
const text = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));
const id = z.string().check(z.minLength(1), z.maxLength(64));
/** `YYYY-MM-DD`, a calendar day in Africa/Johannesburg. */
export const isoDateSchema = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));

export const chainSchema = z.object({
  id,
  name: z.string(),
  tier: z.enum(CHAIN_TIERS),
  loyaltyProgram: z.nullable(z.enum(LOYALTY_PROGRAM_IDS)),
});
export type Chain = z.infer<typeof chainSchema>;

export const storeSchema = z.object({
  id,
  chainId: id,
  name: z.string(),
  regionId: z.enum(REGION_IDS),
  suburb: z.nullable(z.string()),
});
export type Store = z.infer<typeof storeSchema>;

export const createStoreSchema = z.object({
  chainId: id,
  name: text(80),
  suburb: z.optional(z.nullable(text(80))),
});
export type CreateStore = z.infer<typeof createStoreSchema>;

export const productTypeSchema = z.object({
  id,
  categoryId: id,
  name: z.string(),
  defaultSizeUnit: z.enum(SIZE_UNITS),
});
export type ProductType = z.infer<typeof productTypeSchema>;

export const categorySchema = z.object({
  id,
  name: z.string(),
  sort: z.int(),
  types: z.array(productTypeSchema),
});
export type Category = z.infer<typeof categorySchema>;

export const catalogueResponseSchema = z.object({
  chains: z.array(chainSchema),
  categories: z.array(categorySchema),
});
export type CatalogueResponse = z.infer<typeof catalogueResponseSchema>;

export const productSchema = z.object({
  id,
  productTypeId: id,
  name: z.string(),
  brand: z.nullable(z.string()),
  sizeValue: z.number(),
  sizeUnit: z.enum(SIZE_UNITS),
  packCount: z.int(),
  soldByWeight: z.boolean(),
  isStoreBrand: z.boolean(),
});
export type Product = z.infer<typeof productSchema>;

export const createProductSchema = z.object({
  productTypeId: id,
  name: text(120),
  brand: z.optional(z.nullable(text(60))),
  sizeValue: z.number().check(z.positive(), z.maximum(1_000_000)),
  sizeUnit: z.enum(INPUT_SIZE_UNITS),
  packCount: z.optional(z.int().check(z.minimum(1), z.maximum(100))),
  soldByWeight: z.optional(z.boolean()),
  isStoreBrand: z.optional(z.boolean()),
});
export type CreateProduct = z.infer<typeof createProductSchema>;

export const productSearchResponseSchema = z.object({ products: z.array(productSchema) });

export const priceSchema = z.object({
  id,
  productId: id,
  chainId: id,
  regionId: z.nullable(z.enum(REGION_IDS)),
  storeId: z.nullable(id),
  priceCents: z.int(),
  memberPriceCents: z.nullable(z.int()),
  isPromo: z.boolean(),
  promoType: z.enum(PROMO_TYPES),
  promoQty: z.nullable(z.int()),
  promoPriceCents: z.nullable(z.int()),
  promoFreeQty: z.nullable(z.int()),
  promoMemberOnly: z.boolean(),
  validFrom: z.nullable(isoDateSchema),
  validTo: z.nullable(isoDateSchema),
  observedAt: z.int(),
  source: z.enum(['manual', 'pamphlet', 'receipt']),
});
export type Price = z.infer<typeof priceSchema>;

/** Manual price entry for one store. */
export const createPriceSchema = z
  .object({
    productId: id,
    storeId: id,
    priceCents: cents,
    memberPriceCents: z.optional(z.nullable(cents)),
    promoType: z.optional(z.enum(PROMO_TYPES)),
    promoQty: z.optional(z.nullable(z.int().check(z.minimum(2), z.maximum(24)))),
    promoPriceCents: z.optional(z.nullable(cents)),
    promoFreeQty: z.optional(z.nullable(z.int().check(z.minimum(1), z.maximum(24)))),
    promoMemberOnly: z.optional(z.boolean()),
    validFrom: z.optional(z.nullable(isoDateSchema)),
    validTo: z.optional(z.nullable(isoDateSchema)),
  })
  .check(
    z.refine((p) => p.memberPriceCents == null || p.memberPriceCents < p.priceCents, {
      message: 'Member price must be lower than the normal price',
      path: ['memberPriceCents'],
    }),
    z.refine(
      (p) =>
        (p.promoType ?? 'none') !== 'multibuy' || (p.promoQty != null && p.promoPriceCents != null),
      { message: 'A multibuy needs a quantity and a bundle price', path: ['promoPriceCents'] },
    ),
    z.refine(
      (p) =>
        (p.promoType ?? 'none') !== 'buy_x_get_y' || (p.promoQty != null && p.promoFreeQty != null),
      { message: 'Buy X get Y needs both quantities', path: ['promoFreeQty'] },
    ),
    z.refine((p) => !p.validFrom || !p.validTo || p.validFrom <= p.validTo, {
      message: 'The special must end on or after it starts',
      path: ['validTo'],
    }),
  );
export type CreatePrice = z.infer<typeof createPriceSchema>;

export const storePriceSchema = z.object({
  store: storeSchema,
  chain: chainSchema,
  /** Latest regular price still considered current (≤ 60 days old). */
  regular: z.nullable(priceSchema),
  /** Best special valid today, if any. */
  promo: z.nullable(priceSchema),
  /** Most recent price of any kind, even if stale — for "last seen R X". */
  lastSeen: z.nullable(priceSchema),
});
export type StorePrice = z.infer<typeof storePriceSchema>;

export const productDetailResponseSchema = z.object({
  product: productSchema,
  productType: productTypeSchema,
  category: z.object({ id, name: z.string() }),
  stores: z.array(storePriceSchema),
});
export type ProductDetailResponse = z.infer<typeof productDetailResponseSchema>;

export const storesResponseSchema = z.object({ stores: z.array(storeSchema) });

export const myStoresSchema = z.object({ storeIds: z.array(id).check(z.maxLength(30)) });
export const loyaltyCardsSchema = z.object({
  programs: z.array(z.enum(LOYALTY_PROGRAM_IDS)).check(z.maxLength(LOYALTY_PROGRAMS.length)),
});
export type LoyaltyCards = z.infer<typeof loyaltyCardsSchema>;
