import {
  type List,
  type ListItem,
  type PullResponse,
  type PushResponse,
  pushRequestSchema,
} from '@cart-wise/shared';
import { Hono } from 'hono';
import { ApiHttpError } from '../lib/errors';
import { parseJson } from '../lib/json';
import { requireUser } from '../middleware';
import type { AppEnv } from '../types';

// Offline-first sync for lists (D11 in docs/IMPLEMENTATION.md).
//
// Merging happens in SQL inside one D1 batch (a transaction), so concurrent pushes can't
// overwrite each other. The CASE expressions mirror mergeList/mergeItem in
// packages/shared/src/sync/merge.ts. Change both together; the API tests compare them.
//
// Each pushed row gets a unique, increasing server_seq, taken from sync_counter in the same
// batch. Pull uses it as the cursor.

const PULL_PAGE_SIZE = 500;
/** D1 allows 100 bound parameters per statement. */
const IN_CHUNK = 90;

const SEQ = '(SELECT value FROM sync_counter WHERE id = 1)';

const DELETED_AT_MERGE = (t: string) => `CASE
  WHEN ${t}.deleted_at IS NULL THEN excluded.deleted_at
  WHEN excluded.deleted_at IS NULL THEN ${t}.deleted_at
  ELSE min(${t}.deleted_at, excluded.deleted_at) END`;

const UPSERT_LIST = `
INSERT INTO lists (id, owner_id, name, name_updated_at, created_at, deleted_at, server_seq)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ${SEQ} - ?7
WHERE true
ON CONFLICT (id) DO UPDATE SET
  name = CASE
    WHEN excluded.name_updated_at > lists.name_updated_at
      OR (excluded.name_updated_at = lists.name_updated_at AND excluded.name > lists.name)
    THEN excluded.name ELSE lists.name END,
  name_updated_at = max(lists.name_updated_at, excluded.name_updated_at),
  created_at = min(lists.created_at, excluded.created_at),
  deleted_at = ${DELETED_AT_MERGE('lists')},
  server_seq = excluded.server_seq
WHERE lists.owner_id = excluded.owner_id`;

const CONTENT_FROM_EXCLUDED = `(
  excluded.content_updated_at > list_items.content_updated_at
  OR (excluded.content_updated_at = list_items.content_updated_at AND (
    excluded.text > list_items.text
    OR (excluded.text = list_items.text AND excluded.quantity > list_items.quantity))))`;

const UPSERT_ITEM = `
INSERT INTO list_items (id, list_id, text, quantity, content_updated_at, checked,
  checked_updated_at, created_at, deleted_at, server_seq)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ${SEQ} - ?10
WHERE EXISTS (SELECT 1 FROM lists WHERE id = ?2 AND owner_id = ?11)
ON CONFLICT (id) DO UPDATE SET
  text = CASE WHEN ${CONTENT_FROM_EXCLUDED} THEN excluded.text ELSE list_items.text END,
  quantity = CASE WHEN ${CONTENT_FROM_EXCLUDED} THEN excluded.quantity ELSE list_items.quantity END,
  content_updated_at = max(list_items.content_updated_at, excluded.content_updated_at),
  checked = CASE
    WHEN excluded.checked_updated_at > list_items.checked_updated_at
      OR (excluded.checked_updated_at = list_items.checked_updated_at
        AND excluded.checked > list_items.checked)
    THEN excluded.checked ELSE list_items.checked END,
  checked_updated_at = max(list_items.checked_updated_at, excluded.checked_updated_at),
  created_at = min(list_items.created_at, excluded.created_at),
  deleted_at = ${DELETED_AT_MERGE('list_items')},
  server_seq = excluded.server_seq
WHERE list_items.list_id = excluded.list_id`;

interface ListRow {
  id: string;
  owner_id: string;
  name: string;
  name_updated_at: number;
  created_at: number;
  deleted_at: number | null;
  server_seq: number;
}

interface ItemRow {
  id: string;
  list_id: string;
  text: string;
  quantity: number;
  content_updated_at: number;
  checked: number;
  checked_updated_at: number;
  created_at: number;
  deleted_at: number | null;
  server_seq: number;
}

/** A pulled row of either kind, tagged with its seq for merging the two streams. */
interface Tagged {
  seq: number;
  list?: ListRow;
  item?: ItemRow;
}

const toList = (r: ListRow): List => ({
  id: r.id,
  name: r.name,
  nameUpdatedAt: r.name_updated_at,
  createdAt: r.created_at,
  deletedAt: r.deleted_at,
});

const toItem = (r: ItemRow): ListItem => ({
  id: r.id,
  listId: r.list_id,
  text: r.text,
  quantity: r.quantity,
  contentUpdatedAt: r.content_updated_at,
  checked: r.checked === 1,
  checkedUpdatedAt: r.checked_updated_at,
  createdAt: r.created_at,
  deletedAt: r.deleted_at,
});

function chunks<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** Runs `sql` once per chunk of `ids`; `sql` receives the `?, ?, …` placeholder list. */
async function selectByIds<T>(
  db: D1Database,
  sql: (placeholders: string) => string,
  ids: string[],
  leadingParams: unknown[] = [],
): Promise<T[]> {
  const rows: T[] = [];
  for (const chunk of chunks(ids, IN_CHUNK)) {
    const { results } = await db
      .prepare(sql(chunk.map(() => '?').join(', ')))
      .bind(...leadingParams, ...chunk)
      .all<T>();
    rows.push(...results);
  }
  return rows;
}

export const sync = new Hono<AppEnv>()
  .use(requireUser)

  .post('/push', async (c) => {
    const { lists, items } = await parseJson(c, pushRequestSchema);
    const userId = c.var.user.id;
    const db = c.env.DB;
    const total = lists.length + items.length;
    const body: PushResponse = { lists: [], items: [], rejected: [] };
    if (total === 0) return c.json(body);

    // Row i gets seq (counter after increment) - (total - 1 - i): unique and increasing.
    const offset = (i: number) => total - 1 - i;
    await db.batch([
      db.prepare('UPDATE sync_counter SET value = value + ? WHERE id = 1').bind(total),
      ...lists.map((l, i) =>
        db
          .prepare(UPSERT_LIST)
          .bind(l.id, userId, l.name, l.nameUpdatedAt, l.createdAt, l.deletedAt, offset(i)),
      ),
      ...items.map((it, i) =>
        db
          .prepare(UPSERT_ITEM)
          .bind(
            it.id,
            it.listId,
            it.text,
            it.quantity,
            it.contentUpdatedAt,
            it.checked ? 1 : 0,
            it.checkedUpdatedAt,
            it.createdAt,
            it.deletedAt,
            offset(lists.length + i),
            userId,
          ),
      ),
    ]);

    // Read back the merged state. Only rows the user owns are returned; anything else was
    // refused by the WHERE clauses above.
    const listRows = await selectByIds<ListRow>(
      db,
      (p) => `SELECT * FROM lists WHERE id IN (${p})`,
      lists.map((l) => l.id),
    );
    const ownedLists = new Map(listRows.filter((r) => r.owner_id === userId).map((r) => [r.id, r]));
    for (const l of lists) {
      const row = ownedLists.get(l.id);
      if (row) body.lists.push(toList(row));
      else body.rejected.push({ id: l.id, reason: 'not_owner' });
    }

    const ownedItemRows = await selectByIds<ItemRow>(
      db,
      (p) =>
        `SELECT i.* FROM list_items i JOIN lists l ON l.id = i.list_id
         WHERE l.owner_id = ? AND i.id IN (${p})`,
      items.map((it) => it.id),
      [userId],
    );
    const ownedItems = new Map(ownedItemRows.map((r) => [r.id, r]));
    for (const it of items) {
      const row = ownedItems.get(it.id);
      if (row?.list_id === it.listId) body.items.push(toItem(row));
      else body.rejected.push({ id: it.id, reason: 'list_not_owned' });
    }

    return c.json(body);
  })

  .get('/pull', async (c) => {
    const cursor = Number(c.req.query('cursor') ?? '0');
    if (!Number.isSafeInteger(cursor) || cursor < 0) {
      throw new ApiHttpError(400, 'invalid_cursor', 'cursor must be a non-negative integer');
    }
    const userId = c.var.user.id;
    const db = c.env.DB;
    const limit = PULL_PAGE_SIZE + 1;

    const [listRes, itemRes] = await db.batch<ListRow | ItemRow>([
      db
        .prepare(
          'SELECT * FROM lists WHERE owner_id = ? AND server_seq > ? ORDER BY server_seq LIMIT ?',
        )
        .bind(userId, cursor, limit),
      db
        .prepare(
          `SELECT i.* FROM list_items i JOIN lists l ON l.id = i.list_id
           WHERE l.owner_id = ? AND i.server_seq > ? ORDER BY i.server_seq LIMIT ?`,
        )
        .bind(userId, cursor, limit),
    ]);

    // Merge both seq-ordered streams and take one page. Every row with seq <= the new cursor
    // is guaranteed to be in this page, so the next pull can't skip anything.
    const merged: Tagged[] = [
      ...((listRes?.results ?? []) as ListRow[]).map((r) => ({ seq: r.server_seq, list: r })),
      ...((itemRes?.results ?? []) as ItemRow[]).map((r) => ({ seq: r.server_seq, item: r })),
    ].sort((a, b) => a.seq - b.seq);
    const page = merged.slice(0, PULL_PAGE_SIZE);

    const body: PullResponse = {
      lists: page.flatMap((t) => (t.list ? [toList(t.list)] : [])),
      items: page.flatMap((t) => (t.item ? [toItem(t.item)] : [])),
      cursor: page.at(-1)?.seq ?? cursor,
      hasMore: merged.length > PULL_PAGE_SIZE,
    };
    return c.json(body);
  });
