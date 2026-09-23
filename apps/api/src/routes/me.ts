import { user, userPrefs } from '@cart-wise/db';
import { type PrefsResponse, type RegionId, userPrefsSchema } from '@cart-wise/shared';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { parseJson } from '../lib/json';
import { requireUser } from '../middleware';
import type { AppEnv } from '../types';

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

  /** POPIA: deletes the account and everything that cascades from it. */
  .delete('/', async (c) => {
    await c.var.db.delete(user).where(eq(user.id, c.var.user.id));
    return c.body(null, 204);
  });
