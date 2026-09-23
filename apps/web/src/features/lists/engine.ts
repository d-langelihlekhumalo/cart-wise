// Push/pull sync between IndexedDB and the API (D11). Pure of React and globals so it can be
// tested with fake-indexeddb and a fake server.
import {
  type List,
  type ListItem,
  mergeItem,
  mergeList,
  pullResponseSchema,
  pushResponseSchema,
  SYNC_PUSH_MAX_ROWS,
} from '@cart-wise/shared';
import * as z from 'zod/mini';
import type { LocalDb, OutboxEntry } from './db';

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class SyncHttpError extends Error {
  constructor(readonly status: number) {
    super(`Sync request failed (${status})`);
  }
}

const CURSOR_KEY = 'pullCursor';

export class SyncEngine {
  constructor(
    private readonly db: LocalDb,
    private readonly fetchFn: Fetch,
  ) {}

  pendingCount(): Promise<number> {
    return this.db.outbox.count();
  }

  /** Pushes local changes, then pulls remote ones. Throws on network/HTTP failure. */
  async sync(): Promise<void> {
    await this.push();
    await this.pull();
  }

  private async request<T extends z.ZodMiniType>(schema: T, path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set('content-type', 'application/json');
    const res = await this.fetchFn(`/api/sync${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
    });
    if (!res.ok) throw new SyncHttpError(res.status);
    return z.parse(schema, await res.json());
  }

  private async push(): Promise<void> {
    // Keep going until the outbox is empty; edits made during a push are picked up next loop.
    for (let round = 0; round < 50; round++) {
      const entries = await this.db.outbox.limit(SYNC_PUSH_MAX_ROWS).toArray();
      if (entries.length === 0) return;

      const { lists, items, sent } = await this.collect(entries);
      if (lists.length + items.length > 0) {
        const res = await this.request(pushResponseSchema, '/push', {
          method: 'POST',
          body: JSON.stringify({ lists, items }),
        });
        await this.applyPushResult(res, sent);
      }
      // Entries whose row no longer exists locally are dropped.
      const missing = entries.filter((e) => !sent.has(e.key)).map((e) => e.key);
      if (missing.length) await this.db.outbox.bulkDelete(missing);
    }
  }

  private async collect(entries: OutboxEntry[]) {
    const listIds = entries.filter((e) => e.kind === 'list').map((e) => e.id);
    const itemIds = entries.filter((e) => e.kind === 'item').map((e) => e.id);
    const lists = (await this.db.lists.bulkGet(listIds)).filter((l): l is List => !!l);
    const items = (await this.db.items.bulkGet(itemIds)).filter((i): i is ListItem => !!i);
    // Snapshot of what we sent, to tell whether the row changed while the request was out.
    const sent = new Map<string, string>([
      ...lists.map((l) => [`list:${l.id}`, JSON.stringify(l)] as const),
      ...items.map((i) => [`item:${i.id}`, JSON.stringify(i)] as const),
    ]);
    return { lists, items, sent };
  }

  private async applyPushResult(
    res: z.infer<typeof pushResponseSchema>,
    sent: Map<string, string>,
  ): Promise<void> {
    const { db } = this;
    await db.transaction('rw', db.lists, db.items, db.outbox, async () => {
      const done: string[] = [];
      for (const server of res.lists) {
        const key = `list:${server.id}`;
        const local = await db.lists.get(server.id);
        if (local && JSON.stringify(local) === sent.get(key)) done.push(key);
        await db.lists.put(local ? mergeList(local, server) : server);
      }
      for (const server of res.items) {
        const key = `item:${server.id}`;
        const local = await db.items.get(server.id);
        if (local && JSON.stringify(local) === sent.get(key)) done.push(key);
        await db.items.put(local ? mergeItem(local, server) : server);
      }
      // The server refused these rows; keeping them would retry forever.
      for (const { id } of res.rejected) {
        done.push(`list:${id}`, `item:${id}`);
        await db.lists.delete(id);
        await db.items.delete(id);
        await db.items.where('listId').equals(id).delete();
      }
      await db.outbox.bulkDelete(done);
    });
  }

  private async pull(): Promise<void> {
    const { db } = this;
    for (let page = 0; page < 100; page++) {
      const cursor = (await db.meta.get(CURSOR_KEY))?.value ?? 0;
      const res = await this.request(pullResponseSchema, `/pull?cursor=${cursor}`);
      await db.transaction('rw', db.lists, db.items, db.meta, async () => {
        for (const remote of res.lists) {
          const local = await db.lists.get(remote.id);
          await db.lists.put(local ? mergeList(local, remote) : remote);
        }
        for (const remote of res.items) {
          const local = await db.items.get(remote.id);
          await db.items.put(local ? mergeItem(local, remote) : remote);
        }
        await db.meta.put({ key: CURSOR_KEY, value: res.cursor });
      });
      if (!res.hasMore) return;
    }
  }
}
