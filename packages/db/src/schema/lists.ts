import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth';

// Offline-first rows: IDs and per-field timestamps come from the client. `server_seq` is a
// server-assigned, globally increasing number used as the pull cursor.

export const lists = sqliteTable(
  'lists',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameUpdatedAt: integer('name_updated_at').notNull(),
    createdAt: integer('created_at').notNull(),
    deletedAt: integer('deleted_at'),
    serverSeq: integer('server_seq').notNull(),
  },
  (t) => [index('lists_owner_seq_idx').on(t.ownerId, t.serverSeq)],
);

export const listItems = sqliteTable(
  'list_items',
  {
    id: text('id').primaryKey(),
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    quantity: integer('quantity').notNull(),
    contentUpdatedAt: integer('content_updated_at').notNull(),
    checked: integer('checked', { mode: 'boolean' }).notNull(),
    checkedUpdatedAt: integer('checked_updated_at').notNull(),
    createdAt: integer('created_at').notNull(),
    deletedAt: integer('deleted_at'),
    serverSeq: integer('server_seq').notNull(),
  },
  (t) => [index('list_items_list_idx').on(t.listId), index('list_items_seq_idx').on(t.serverSeq)],
);

/** Single-row counter that hands out `server_seq` values inside each push batch. */
export const syncCounter = sqliteTable('sync_counter', {
  id: integer('id').primaryKey(),
  value: integer('value').notNull(),
});
