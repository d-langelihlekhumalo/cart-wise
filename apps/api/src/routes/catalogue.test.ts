import type {
  CatalogueResponse,
  Price,
  Product,
  ProductDetailResponse,
  Store,
} from '@cart-wise/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { authed, signUp } from '../../test/helpers';

async function onboardedUser(regionId = 'gauteng') {
  const u = await signUp();
  await authed(u.cookie, '/me/prefs', {
    method: 'PUT',
    body: JSON.stringify({ regionId, budgetCents: null, splitThresholdCents: 5000 }),
  });
  return u;
}

async function json<T>(res: Response | Promise<Response>, status = 200): Promise<T> {
  const r = await res;
  expect(r.status).toBe(status);
  return r.json();
}

/** Adds (or finds — stores are de-duplicated and D1 state is shared within a file) a store. */
async function addStore(cookie: string, chainId: string, name: string, suburb?: string) {
  const res = await authed(cookie, '/stores', {
    method: 'POST',
    body: JSON.stringify({ chainId, name, suburb }),
  });
  expect([200, 201]).toContain(res.status);
  return (await res.json<{ store: Store }>()).store;
}

async function search(cookie: string, q: string, type?: string) {
  const params = new URLSearchParams({ q, ...(type ? { type } : {}) });
  return (
    await json<{ products: Product[] }>(authed(cookie, `/products/search?${params.toString()}`))
  ).products;
}

describe('catalogue', () => {
  it('returns seeded chains and the taxonomy in aisle order', async () => {
    const { cookie } = await signUp();
    const body = await json<CatalogueResponse>(authed(cookie, '/catalogue'));
    expect(body.chains.find((c) => c.id === 'checkers')).toMatchObject({
      name: 'Checkers',
      loyaltyProgram: 'xtra_savings',
    });
    expect(body.categories[0]?.id).toBe('fruit-veg');
    const bakery = body.categories.find((c) => c.id === 'bakery');
    expect(bakery?.types.map((t) => t.id)).toContain('white-bread');
  });
});

describe('stores', () => {
  it('needs onboarding to know the region', async () => {
    const { cookie } = await signUp();
    const res = await authed(cookie, '/stores', {
      method: 'POST',
      body: JSON.stringify({ chainId: 'checkers', name: 'Checkers Sandton' }),
    });
    expect(res.status).toBe(409);
  });

  it('adds stores in the user region and de-duplicates them', async () => {
    const { cookie } = await onboardedUser();
    const a = await addStore(cookie, 'checkers', 'Checkers Hyper', 'Sandton');
    expect(a).toMatchObject({ chainId: 'checkers', regionId: 'gauteng', suburb: 'Sandton' });

    const again = await json<{ store: Store }>(
      authed(cookie, '/stores', {
        method: 'POST',
        body: JSON.stringify({ chainId: 'checkers', name: 'checkers hyper', suburb: 'SANDTON' }),
      }),
    );
    expect(again.store.id).toBe(a.id);

    const other = await onboardedUser('western-cape');
    const { stores } = await json<{ stores: Store[] }>(authed(other.cookie, '/stores'));
    expect(stores.map((s) => s.id)).not.toContain(a.id);
  });

  it('rejects unknown chains and regions', async () => {
    const { cookie } = await onboardedUser();
    const res = await authed(cookie, '/stores', {
      method: 'POST',
      body: JSON.stringify({ chainId: 'not-a-chain', name: 'X' }),
    });
    expect(res.status).toBe(400);
    expect((await authed(cookie, '/stores?region=atlantis')).status).toBe(400);
  });

  it('saves the stores a user shops at', async () => {
    const { cookie } = await onboardedUser();
    const a = await addStore(cookie, 'pick-n-pay', 'Pick n Pay', 'Rosebank');
    const b = await addStore(cookie, 'spaza', "Mama Thandi's spaza", 'Soweto');

    const saved = await json<{ stores: Store[] }>(
      authed(cookie, '/me/stores', {
        method: 'PUT',
        body: JSON.stringify({ storeIds: [a.id, b.id, a.id] }),
      }),
    );
    expect(saved.stores).toHaveLength(2);
    const mine = await json<{ stores: Store[] }>(authed(cookie, '/me/stores'));
    expect(mine.stores.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());

    const bad = await authed(cookie, '/me/stores', {
      method: 'PUT',
      body: JSON.stringify({ storeIds: ['nope'] }),
    });
    expect(bad.status).toBe(400);
  });

  it('saves loyalty cards', async () => {
    const { cookie } = await signUp();
    await json(
      authed(cookie, '/me/loyalty-cards', {
        method: 'PUT',
        body: JSON.stringify({ programs: ['xtra_savings', 'smart_shopper'] }),
      }),
    );
    const { programs } = await json<{ programs: string[] }>(authed(cookie, '/me/loyalty-cards'));
    expect(programs.sort()).toEqual(['smart_shopper', 'xtra_savings']);

    const bad = await authed(cookie, '/me/loyalty-cards', {
      method: 'PUT',
      body: JSON.stringify({ programs: ['clicks_clubcard'] }),
    });
    expect(bad.status).toBe(400);
  });
});

describe('products', () => {
  it('finds products by brand, name prefix and product type', async () => {
    const { cookie } = await signUp();
    expect((await search(cookie, 'albany whi')).map((p) => p.name)).toContain(
      'Superior White Bread',
    );
    // "bread" matches the product type name, not just product names.
    const bread = await search(cookie, 'bread');
    expect(bread.length).toBeGreaterThan(2);
    // Diacritics and punctuation don't matter.
    expect((await search(cookie, 'valpre')).map((p) => p.brand)).toContain('Valpré');
    expect((await search(cookie, "fatti's")).length).toBeGreaterThan(0);
    // Filter by type.
    const maize = await search(cookie, 'super', 'maize-meal');
    expect(maize.every((p) => p.productTypeId === 'maize-meal')).toBe(true);
    expect(await search(cookie, '   ')).toEqual([]);
    // Pack sizes are searchable however people type them.
    const label = (ps: Product[]) => ps.map((p) => `${p.brand ?? ''} ${p.name} ${p.sizeValue}`);
    expect(label(await search(cookie, 'white star 10kg'))[0]).toBe(
      'White Star Super Maize Meal 10000',
    );
    expect(label(await search(cookie, 'white star 10'))[0]).toBe(
      'White Star Super Maize Meal 10000',
    );
    expect(label(await search(cookie, 'iwisa 5 kg'))).toEqual(['Iwisa Super Maize Meal 5000']);
    expect(label(await search(cookie, 'sunfoil 2l'))).toEqual(['Sunfoil Sunflower Oil 2000']);
    expect(label(await search(cookie, 'sunfoil 750ml'))).toEqual(['Sunfoil Sunflower Oil 750']);
  });

  it('creates products with normalised sizes', async () => {
    const { cookie } = await signUp();
    const { product } = await json<{ product: Product }>(
      authed(cookie, '/products', {
        method: 'POST',
        body: JSON.stringify({
          productTypeId: 'maize-meal',
          brand: 'Ritebrand',
          name: 'Super Maize Meal',
          sizeValue: 12.5,
          sizeUnit: 'kg',
          isStoreBrand: true,
        }),
      }),
      201,
    );
    expect(product).toMatchObject({ sizeValue: 12500, sizeUnit: 'g', isStoreBrand: true });
    expect((await search(cookie, 'ritebrand')).map((p) => p.id)).toContain(product.id);
  });
});

describe('prices', () => {
  const productId = 'seed-white-star-super-maize-meal-1x10000g';

  it('records prices and resolves them per store', async () => {
    const { cookie } = await onboardedUser();
    const sandton = await addStore(cookie, 'checkers', 'Checkers', 'Sandton');
    const rosebank = await addStore(cookie, 'pick-n-pay', 'Pick n Pay', 'Rosebank');
    await authed(cookie, '/me/stores', {
      method: 'PUT',
      body: JSON.stringify({ storeIds: [sandton.id, rosebank.id] }),
    });

    const regular = await json<{ price: Price }>(
      authed(cookie, '/prices', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          storeId: sandton.id,
          priceCents: 12999,
          memberPriceCents: 11999,
        }),
      }),
      201,
    );
    expect(regular.price).toMatchObject({
      chainId: 'checkers',
      regionId: 'gauteng',
      storeId: sandton.id,
      isPromo: false,
      validFrom: null,
    });

    const special = await json<{ price: Price }>(
      authed(cookie, '/prices', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          storeId: rosebank.id,
          priceCents: 13999,
          promoType: 'multibuy',
          promoQty: 2,
          promoPriceCents: 25000,
          validTo: '2099-12-31',
        }),
      }),
      201,
    );
    expect(special.price).toMatchObject({ isPromo: true, promoType: 'multibuy', promoQty: 2 });
    expect(special.price.validFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const detail = await json<ProductDetailResponse>(authed(cookie, `/products/${productId}`));
    expect(detail.product.brand).toBe('White Star');
    expect(detail.category.id).toBe('staples');
    const byStore = new Map(detail.stores.map((s) => [s.store.id, s]));
    expect(byStore.get(sandton.id)?.regular?.priceCents).toBe(12999);
    expect(byStore.get(sandton.id)?.promo).toBeNull();
    expect(byStore.get(rosebank.id)?.promo?.promoPriceCents).toBe(25000);
    expect(byStore.get(rosebank.id)?.chain.name).toBe('Pick n Pay');
  });

  it('validates price entries', async () => {
    const { cookie } = await onboardedUser();
    const store = await addStore(cookie, 'spar', 'Spar', 'Melville');
    const cases = [
      { productId, storeId: store.id, priceCents: 0 },
      { productId, storeId: store.id, priceCents: 12.5 },
      { productId, storeId: store.id, priceCents: 1000, memberPriceCents: 1200 },
      { productId, storeId: store.id, priceCents: 1000, promoType: 'multibuy' },
      {
        productId,
        storeId: store.id,
        priceCents: 1000,
        validFrom: '2026-10-10',
        validTo: '2026-10-01',
      },
    ];
    for (const body of cases) {
      const res = await authed(cookie, '/prices', { method: 'POST', body: JSON.stringify(body) });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const unknown = await authed(cookie, '/prices', {
      method: 'POST',
      body: JSON.stringify({ productId: 'nope', storeId: store.id, priceCents: 1000 }),
    });
    expect(unknown.status).toBe(400);
  });

  it('keeps community prices but forgets who added them when the account is deleted', async () => {
    const { cookie, userId } = await onboardedUser();
    const store = await addStore(cookie, 'shoprite', 'Shoprite', 'Hillbrow');
    const { price } = await json<{ price: Price }>(
      authed(cookie, '/prices', {
        method: 'POST',
        body: JSON.stringify({ productId, storeId: store.id, priceCents: 11999 }),
      }),
      201,
    );
    await authed(cookie, '/me', { method: 'DELETE' });

    const row = await env.DB.prepare('SELECT created_by FROM prices WHERE id = ?')
      .bind(price.id)
      .first<{ created_by: string | null }>();
    expect(row).toEqual({ created_by: null });
    const storeRow = await env.DB.prepare('SELECT created_by FROM stores WHERE id = ?')
      .bind(store.id)
      .first<{ created_by: string | null }>();
    expect(storeRow).toEqual({ created_by: null });
    const mine = await env.DB.prepare('SELECT count(*) AS n FROM user_stores WHERE user_id = ?')
      .bind(userId)
      .first<{ n: number }>();
    expect(mine?.n).toBe(0);
  });
});
