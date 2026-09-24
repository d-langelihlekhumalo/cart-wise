import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth';
import { regions } from './core';

const now = sql`(unixepoch('subsec') * 1000)`;

// Reference data (chains, categories, product types) uses readable slug IDs and is seeded by
// migration. User-created rows (stores, products, prices) use ULIDs.

export const chains = sqliteTable('chains', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tier: text('tier', { enum: ['major', 'regional', 'informal'] }).notNull(),
  loyaltyProgram: text('loyalty_program', {
    enum: ['xtra_savings', 'smart_shopper', 'wrewards', 'spar_rewards'],
  }),
});

export const stores = sqliteTable(
  'stores',
  {
    id: text('id').primaryKey(),
    chainId: text('chain_id')
      .notNull()
      .references(() => chains.id),
    name: text('name').notNull(),
    regionId: text('region_id')
      .notNull()
      .references(() => regions.id),
    suburb: text('suburb'),
    lat: integer('lat'),
    lng: integer('lng'),
    /** Stores are shared; deleting the account keeps the store but forgets who added it. */
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('stores_region_chain_idx').on(t.regionId, t.chainId)],
);

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sort: integer('sort').notNull(),
});

export const productTypes = sqliteTable(
  'product_types',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
    name: text('name').notNull(),
    defaultSizeUnit: text('default_size_unit', { enum: ['g', 'ml', 'each'] }).notNull(),
  },
  (t) => [index('product_types_category_idx').on(t.categoryId)],
);

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    productTypeId: text('product_type_id')
      .notNull()
      .references(() => productTypes.id),
    name: text('name').notNull(),
    brand: text('brand'),
    /** In g, ml or items (see size_unit), per pack item. */
    sizeValue: integer('size_value').notNull(),
    sizeUnit: text('size_unit', { enum: ['g', 'ml', 'each'] }).notNull(),
    packCount: integer('pack_count').notNull().default(1),
    /** Priced per kg (mince, loose produce); size_value is then ignored. */
    soldByWeight: integer('sold_by_weight', { mode: 'boolean' }).notNull().default(false),
    isStoreBrand: integer('is_store_brand', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('products_type_idx').on(t.productTypeId)],
);

/**
 * Append-only (D4): a new observation is a new row; history is the older rows. The current
 * price for a store is chosen by resolveStorePrice() in @cart-wise/shared.
 */
export const prices = sqliteTable(
  'prices',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    chainId: text('chain_id')
      .notNull()
      .references(() => chains.id),
    regionId: text('region_id').references(() => regions.id),
    storeId: text('store_id').references(() => stores.id),
    priceCents: integer('price_cents').notNull(),
    memberPriceCents: integer('member_price_cents'),
    isPromo: integer('is_promo', { mode: 'boolean' }).notNull(),
    promoType: text('promo_type', { enum: ['none', 'multibuy', 'buy_x_get_y'] }).notNull(),
    promoQty: integer('promo_qty'),
    promoPriceCents: integer('promo_price_cents'),
    promoFreeQty: integer('promo_free_qty'),
    promoMemberOnly: integer('promo_member_only', { mode: 'boolean' }).notNull().default(false),
    validFrom: text('valid_from'),
    validTo: text('valid_to'),
    observedAt: integer('observed_at').notNull(),
    source: text('source', { enum: ['manual', 'pamphlet', 'receipt'] }).notNull(),
    pamphletId: text('pamphlet_id'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['live', 'hidden'] })
      .notNull()
      .default('live'),
  },
  (t) => [
    index('prices_product_chain_idx').on(t.productId, t.chainId, t.observedAt),
    index('prices_valid_to_idx').on(t.validTo),
  ],
);

export const userLoyaltyCards = sqliteTable(
  'user_loyalty_cards',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    program: text('program', {
      enum: ['xtra_savings', 'smart_shopper', 'wrewards', 'spar_rewards'],
    }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.program] })],
);

export const userStores = sqliteTable(
  'user_stores',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.storeId] })],
);
