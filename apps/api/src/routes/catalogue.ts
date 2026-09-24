import {
  categories,
  chains,
  prices,
  products,
  productTypes,
  stores,
  userPrefs,
  userStores,
} from '@cart-wise/db';
import {
  type CatalogueResponse,
  type Chain,
  createPriceSchema,
  createProductSchema,
  createStoreSchema,
  isRegionId,
  newId,
  normalizeSize,
  type Price,
  type Product,
  type ProductDetailResponse,
  type RegionId,
  resolveStorePrice,
  type Store,
  todayInSA,
} from '@cart-wise/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { ApiHttpError } from '../lib/errors';
import { parseJson } from '../lib/json';
import { requireUser } from '../middleware';
import type { AppEnv } from '../types';

type Db = AppEnv['Variables']['db'];

// ---- Row mappers --------------------------------------------------------------------------

type ChainRow = typeof chains.$inferSelect;
type StoreRow = typeof stores.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type PriceRow = typeof prices.$inferSelect;

export const toChain = (r: ChainRow): Chain => ({
  id: r.id,
  name: r.name,
  tier: r.tier,
  loyaltyProgram: r.loyaltyProgram,
});

export const toStore = (r: StoreRow): Store => ({
  id: r.id,
  chainId: r.chainId,
  name: r.name,
  // The FK to `regions` guarantees a known region id.
  regionId: r.regionId as RegionId,
  suburb: r.suburb,
});

const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  productTypeId: r.productTypeId,
  name: r.name,
  brand: r.brand,
  sizeValue: r.sizeValue,
  sizeUnit: r.sizeUnit,
  packCount: r.packCount,
  soldByWeight: r.soldByWeight,
  isStoreBrand: r.isStoreBrand,
});

const toPrice = (r: PriceRow): Price => ({
  id: r.id,
  productId: r.productId,
  chainId: r.chainId,
  regionId: r.regionId as RegionId | null,
  storeId: r.storeId,
  priceCents: r.priceCents,
  memberPriceCents: r.memberPriceCents,
  isPromo: r.isPromo,
  promoType: r.promoType,
  promoQty: r.promoQty,
  promoPriceCents: r.promoPriceCents,
  promoFreeQty: r.promoFreeQty,
  promoMemberOnly: r.promoMemberOnly,
  validFrom: r.validFrom,
  validTo: r.validTo,
  observedAt: r.observedAt,
  source: r.source,
});

async function userRegion(db: Db, userId: string): Promise<RegionId> {
  const prefs = await db.query.userPrefs.findFirst({ where: eq(userPrefs.userId, userId) });
  if (!prefs) throw new ApiHttpError(409, 'onboarding_required', 'Choose your province first');
  return prefs.regionId as RegionId;
}

/** Turns free text into an FTS5 prefix query: `albany whi` -> `"albany"* "whi"*`. */
export function toFtsQuery(q: string): string | null {
  const tokens = q
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  return tokens.length ? tokens.map((t) => `"${t}"*`).join(' ') : null;
}

// ---- Routes -------------------------------------------------------------------------------

// Mounted at the API root, so auth is attached per route (a router-level `use` would also
// cover /api/health and /api/auth).
export const catalogue = new Hono<AppEnv>()
  /** Chains and the category → product type taxonomy. Changes rarely; cache on the client. */
  .get('/catalogue', requireUser, async (c) => {
    const db = c.var.db;
    const [chainRows, categoryRows, typeRows] = await Promise.all([
      db.select().from(chains).orderBy(asc(chains.name)),
      db.select().from(categories).orderBy(asc(categories.sort)),
      db.select().from(productTypes).orderBy(asc(productTypes.name)),
    ]);
    const body: CatalogueResponse = {
      chains: chainRows.map(toChain),
      categories: categoryRows.map((cat) => ({
        id: cat.id,
        name: cat.name,
        sort: cat.sort,
        types: typeRows
          .filter((t) => t.categoryId === cat.id)
          .map((t) => ({
            id: t.id,
            categoryId: t.categoryId,
            name: t.name,
            defaultSizeUnit: t.defaultSizeUnit,
          })),
      })),
    };
    c.header('Cache-Control', 'private, max-age=3600');
    return c.json(body);
  })

  /** Stores in a region (default: the user's). */
  .get('/stores', requireUser, async (c) => {
    const db = c.var.db;
    const requested = c.req.query('region');
    if (requested !== undefined && !isRegionId(requested)) {
      throw new ApiHttpError(400, 'unknown_region', 'Unknown region');
    }
    const region = requested ?? (await userRegion(db, c.var.user.id));
    const rows = await db
      .select()
      .from(stores)
      .where(eq(stores.regionId, region))
      .orderBy(asc(stores.name))
      .limit(500);
    return c.json({ stores: rows.map(toStore) });
  })

  /** Adds a store in the user's region. Returns the existing one if it's a duplicate. */
  .post('/stores', requireUser, async (c) => {
    const input = await parseJson(c, createStoreSchema);
    const db = c.var.db;
    const regionId = await userRegion(db, c.var.user.id);
    const chain = await db.query.chains.findFirst({ where: eq(chains.id, input.chainId) });
    if (!chain) throw new ApiHttpError(400, 'unknown_chain', 'Unknown chain');

    const suburb = input.suburb ?? null;
    const existing = await db.query.stores.findFirst({
      where: and(
        eq(stores.chainId, chain.id),
        eq(stores.regionId, regionId),
        sql`lower(${stores.name}) = lower(${input.name})`,
        suburb === null
          ? sql`${stores.suburb} IS NULL`
          : sql`lower(${stores.suburb}) = lower(${suburb})`,
      ),
    });
    if (existing) return c.json({ store: toStore(existing) });

    const [row] = await db
      .insert(stores)
      .values({
        id: newId(),
        chainId: chain.id,
        name: input.name,
        regionId,
        suburb,
        createdBy: c.var.user.id,
      })
      .returning();
    if (!row) throw new ApiHttpError(500, 'insert_failed', 'Could not add the store');
    return c.json({ store: toStore(row) }, 201);
  })

  .get('/products/search', requireUser, async (c) => {
    const q = toFtsQuery(c.req.query('q') ?? '');
    const typeId = c.req.query('type');
    const limit = Math.min(Number(c.req.query('limit') ?? 20) || 20, 50);
    const db = c.var.db;

    if (!q) {
      if (!typeId) return c.json({ products: [] });
      const rows = await db
        .select()
        .from(products)
        .where(eq(products.productTypeId, typeId))
        .orderBy(asc(products.brand), asc(products.name))
        .limit(limit);
      return c.json({ products: rows.map(toProduct) });
    }

    const { results } = await c.env.DB.prepare(
      `SELECT p.* FROM products_fts f JOIN products p ON p.id = f.product_id
       WHERE products_fts MATCH ?1 ${typeId ? 'AND p.product_type_id = ?3' : ''}
       ORDER BY bm25(products_fts, 0, 10, 5, 2, 3) LIMIT ?2`,
    )
      .bind(q, limit, ...(typeId ? [typeId] : []))
      .all();
    const ids = results.map((r) => r.id as string);
    if (ids.length === 0) return c.json({ products: [] });
    // Re-read through Drizzle for typed mapping, keeping the FTS ranking order.
    const rows = await db.select().from(products).where(inArray(products.id, ids));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return c.json({
      products: ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [toProduct(row)] : [];
      }),
    });
  })

  .post('/products', requireUser, async (c) => {
    const input = await parseJson(c, createProductSchema);
    const db = c.var.db;
    const type = await db.query.productTypes.findFirst({
      where: eq(productTypes.id, input.productTypeId),
    });
    if (!type) throw new ApiHttpError(400, 'unknown_product_type', 'Unknown product type');
    const soldByWeight = input.soldByWeight ?? false;
    const size = soldByWeight
      ? { sizeValue: 1000, sizeUnit: 'g' as const }
      : normalizeSize(input.sizeValue, input.sizeUnit);

    const [row] = await db
      .insert(products)
      .values({
        id: newId(),
        productTypeId: type.id,
        name: input.name,
        brand: input.brand ?? null,
        ...size,
        packCount: input.packCount ?? 1,
        soldByWeight,
        isStoreBrand: input.isStoreBrand ?? false,
        createdBy: c.var.user.id,
      })
      .returning();
    if (!row) throw new ApiHttpError(500, 'insert_failed', 'Could not add the product');
    return c.json({ product: toProduct(row) }, 201);
  })

  /** A product with its current price at the user's stores (and others in their region). */
  .get('/products/:id', requireUser, async (c) => {
    const db = c.var.db;
    const userId = c.var.user.id;
    const product = await db.query.products.findFirst({
      where: eq(products.id, c.req.param('id')),
    });
    if (!product) throw new ApiHttpError(404, 'not_found', 'Product not found');
    const type = await db.query.productTypes.findFirst({
      where: eq(productTypes.id, product.productTypeId),
    });
    const category = type
      ? await db.query.categories.findFirst({ where: eq(categories.id, type.categoryId) })
      : undefined;
    if (!type || !category) throw new ApiHttpError(500, 'broken_catalogue', 'Missing product type');

    const region = await userRegion(db, userId);
    const priceRows = await db
      .select()
      .from(prices)
      .where(and(eq(prices.productId, product.id), eq(prices.status, 'live')));

    // Stores to show: the user's own, plus any in their region with a price for this product.
    const mine = await db
      .select({ store: stores })
      .from(userStores)
      .innerJoin(stores, eq(stores.id, userStores.storeId))
      .where(eq(userStores.userId, userId));
    const pricedStoreIds = [
      ...new Set(priceRows.flatMap((p) => (p.storeId === null ? [] : [p.storeId]))),
    ];
    const priced = pricedStoreIds.length
      ? await db
          .select()
          .from(stores)
          .where(and(inArray(stores.id, pricedStoreIds.slice(0, 90)), eq(stores.regionId, region)))
      : [];
    const storeMap = new Map([...mine.map((m) => m.store), ...priced].map((s) => [s.id, s]));
    const chainIds = [...new Set([...storeMap.values()].map((s) => s.chainId))];
    const chainRows = chainIds.length
      ? await db.select().from(chains).where(inArray(chains.id, chainIds))
      : [];
    const chainMap = new Map(chainRows.map((ch) => [ch.id, toChain(ch)]));

    const now = Date.now();
    const today = todayInSA(new Date(now));
    const allPrices = priceRows.map(toPrice);
    const body: ProductDetailResponse = {
      product: toProduct(product),
      productType: {
        id: type.id,
        categoryId: type.categoryId,
        name: type.name,
        defaultSizeUnit: type.defaultSizeUnit,
      },
      category: { id: category.id, name: category.name },
      stores: [...storeMap.values()].flatMap((s) => {
        const chain = chainMap.get(s.chainId);
        if (!chain) return [];
        const store = toStore(s);
        return [{ store, chain, ...resolveStorePrice(allPrices, store, now, today) }];
      }),
    };
    return c.json(body);
  })

  /** Manual price entry for one store. Prices are append-only (D4). */
  .post('/prices', requireUser, async (c) => {
    const input = await parseJson(c, createPriceSchema);
    const db = c.var.db;
    const [product, store] = await Promise.all([
      db.query.products.findFirst({ where: eq(products.id, input.productId) }),
      db.query.stores.findFirst({ where: eq(stores.id, input.storeId) }),
    ]);
    if (!product) throw new ApiHttpError(400, 'unknown_product', 'Unknown product');
    if (!store) throw new ApiHttpError(400, 'unknown_store', 'Unknown store');

    const promoType = input.promoType ?? 'none';
    const isPromo = promoType !== 'none' || input.validTo != null;
    const today = todayInSA();
    const [row] = await db
      .insert(prices)
      .values({
        id: newId(),
        productId: product.id,
        chainId: store.chainId,
        regionId: store.regionId,
        storeId: store.id,
        priceCents: input.priceCents,
        memberPriceCents: input.memberPriceCents ?? null,
        isPromo,
        promoType,
        promoQty: promoType === 'none' ? null : (input.promoQty ?? null),
        promoPriceCents: promoType === 'multibuy' ? (input.promoPriceCents ?? null) : null,
        promoFreeQty: promoType === 'buy_x_get_y' ? (input.promoFreeQty ?? null) : null,
        promoMemberOnly: promoType !== 'none' && (input.promoMemberOnly ?? false),
        validFrom: isPromo ? (input.validFrom ?? today) : null,
        validTo: isPromo ? (input.validTo ?? null) : null,
        observedAt: Date.now(),
        source: 'manual',
        createdBy: c.var.user.id,
      })
      .returning();
    if (!row) throw new ApiHttpError(500, 'insert_failed', 'Could not save the price');
    return c.json({ price: toPrice(row) }, 201);
  });
