import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth';

const now = sql`(unixepoch('subsec') * 1000)`;

/** Seeded from `REGIONS` in @cart-wise/shared. */
export const regions = sqliteTable('regions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const userPrefs = sqliteTable('user_prefs', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  regionId: text('region_id')
    .notNull()
    .references(() => regions.id),
  budgetCents: integer('budget_cents'),
  splitThresholdCents: integer('split_threshold_cents').notNull().default(5000),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(now),
});
