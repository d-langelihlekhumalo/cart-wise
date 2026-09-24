import { stores, user, userLoyaltyCards, userPrefs, userStores } from '@cart-wise/db';
import {
  loyaltyCardsSchema,
  myStoresSchema,
  type PrefsResponse,
  type RegionId,
  userPrefsSchema,
} from '@cart-wise/shared';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { ApiHttpError } from '../lib/errors';
import { parseJson } from '../lib/json';
import { requireUser } from '../middleware';
import type { AppEnv } from '../types';
import { toStore } from './catalogue';

export const me = new Hono<AppEnv>()
  .use(requireUser)

  .get('/prefs', async (c) => {
    const row = await c.var.db.query.userPrefs.findFirst({
      where: eq(userPrefs.userId, c.var.user.id),
    });
    const body: PrefsResponse = {
      prefs: row
        ? {
            // The FK to `regions` guarantees this is a known region id.
            regionId: row.regionId as RegionId,
            budgetCents: row.budgetCents,
            splitThresholdCents: row.splitThresholdCents,
          }
        : null,
    };
    return c.json(body);
  })

  .put('/prefs', async (c) => {
    const prefs = await parseJson(c, userPrefsSchema);
    await c.var.db
      .insert(userPrefs)
      .values({ userId: c.var.user.id, ...prefs })
      .onConflictDoUpdate({
        target: userPrefs.userId,
        set: { ...prefs, updatedAt: sql`(unixepoch('subsec') * 1000)` },
      });
    const body: PrefsResponse = { prefs };
    return c.json(body);
  })

  .get('/loyalty-cards', async (c) => {
    const rows = await c.var.db
      .select()
      .from(userLoyaltyCards)
      .where(eq(userLoyaltyCards.userId, c.var.user.id));
    return c.json({ programs: rows.map((r) => r.program) });
  })

  .put('/loyalty-cards', async (c) => {
    const { programs } = await parseJson(c, loyaltyCardsSchema);
    const userId = c.var.user.id;
    const unique = [...new Set(programs)];
    await c.var.db.batch([
      c.var.db.delete(userLoyaltyCards).where(eq(userLoyaltyCards.userId, userId)),
      ...unique.map((program) => c.var.db.insert(userLoyaltyCards).values({ userId, program })),
    ]);
    return c.json({ programs: unique });
  })

  /** The stores this user shops at (D13): recommendations only consider these. */
  .get('/stores', async (c) => {
    const rows = await c.var.db
      .select({ store: stores })
      .from(userStores)
      .innerJoin(stores, eq(stores.id, userStores.storeId))
      .where(eq(userStores.userId, c.var.user.id))
      .orderBy(asc(stores.name));
    return c.json({ stores: rows.map((r) => toStore(r.store)) });
  })

  .put('/stores', async (c) => {
    const { storeIds } = await parseJson(c, myStoresSchema);
    const db = c.var.db;
    const userId = c.var.user.id;
    const unique = [...new Set(storeIds)];
    const found = unique.length
      ? await db.select().from(stores).where(inArray(stores.id, unique))
      : [];
    if (found.length !== unique.length) {
      throw new ApiHttpError(400, 'unknown_store', 'One or more stores do not exist');
    }
    await db.batch([
      db.delete(userStores).where(eq(userStores.userId, userId)),
      ...unique.map((storeId) => db.insert(userStores).values({ userId, storeId })),
    ]);
    return c.json({ stores: found.map(toStore).sort((a, b) => a.name.localeCompare(b.name)) });
  })

  /** POPIA: deletes the account and everything that cascades from it. */
  .delete('/', async (c) => {
    await c.var.db.delete(user).where(eq(user.id, c.var.user.id));
    return c.body(null, 204);
  });
