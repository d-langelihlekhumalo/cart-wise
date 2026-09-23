import type { List, ListItem } from '@cart-wise/shared';
import { Dexie, type EntityTable } from 'dexie';

export interface OutboxEntry {
  /** `${kind}:${id}` — one entry per dirty row, however many times it was edited. */
  key: string;
  kind: 'list' | 'item';
  id: string;
}

export type LocalDb = Dexie & {
  lists: EntityTable<List, 'id'>;
  items: EntityTable<ListItem, 'id'>;
  outbox: EntityTable<OutboxEntry, 'key'>;
  meta: EntityTable<{ key: string; value: number }, 'key'>;
};

/** One database per user, so a shared phone never mixes accounts. */
export function openLocalDb(userId: string): LocalDb {
  const db = new Dexie(`cart-wise-${userId}`) as LocalDb;
  db.version(1).stores({
    lists: 'id',
    items: 'id, listId',
    outbox: 'key',
    meta: 'key',
  });
  return db;
}

export function outboxEntry(kind: OutboxEntry['kind'], id: string): OutboxEntry {
  return { key: `${kind}:${id}`, kind, id };
}
