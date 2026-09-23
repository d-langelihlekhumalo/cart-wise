import 'fake-indexeddb/auto';
import {
  type List,
  type ListItem,
  mergeItem,
  mergeList,
  type PullResponse,
  type PushRequest,
  type PushResponse,
} from '@cart-wise/shared';
import { Dexie } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { type LocalDb, openLocalDb } from './db';
import { type Fetch, SyncEngine } from './engine';
import { ListStore } from './store';

/** In-memory stand-in for /api/sync, using the shared merge rules like the real server. */
class FakeServer {
  lists = new Map<string, { row: List; seq: number }>();
  items = new Map<string, { row: ListItem; seq: number }>();
  seq = 0;
  online = true;
  /** Called after reading the request body, before responding — to simulate races. */
  onPush: (() => Promise<void>) | null = null;
  rejectIds = new Set<string>();

  fetch: Fetch = async (input, init) => {
    if (!this.online) throw new TypeError('Failed to fetch');
    const url = new URL(input, 'http://test');
    if (url.pathname === '/api/sync/push') {
      const body = JSON.parse(init?.body as string) as PushRequest;
      if (this.onPush) await this.onPush();
      const res: PushResponse = { lists: [], items: [], rejected: [] };
      for (const l of body.lists) {
        if (this.rejectIds.has(l.id)) {
          res.rejected.push({ id: l.id, reason: 'not_owner' });
          continue;
        }
        const existing = this.lists.get(l.id);
        const row = existing ? mergeList(existing.row, l) : l;
        this.lists.set(l.id, { row, seq: ++this.seq });
        res.lists.push(row);
      }
      for (const i of body.items) {
        const existing = this.items.get(i.id);
        const row = existing ? mergeItem(existing.row, i) : i;
        this.items.set(i.id, { row, seq: ++this.seq });
        res.items.push(row);
      }
      return Response.json(res);
    }
    if (url.pathname === '/api/sync/pull') {
      const cursor = Number(url.searchParams.get('cursor'));
      const lists = [...this.lists.values()].filter((e) => e.seq > cursor);
      const items = [...this.items.values()].filter((e) => e.seq > cursor);
      const res: PullResponse = {
        lists: lists.map((e) => e.row),
        items: items.map((e) => e.row),
        cursor: this.seq,
        hasMore: false,
      };
      return Response.json(res);
    }
    return new Response(null, { status: 404 });
  };
}

const openDbs: LocalDb[] = [];

function device(server: FakeServer, name: string) {
  const db = openLocalDb(`${name}-${Math.random()}`);
  openDbs.push(db);
  return { db, store: new ListStore(db), engine: new SyncEngine(db, server.fetch) };
}

afterEach(async () => {
  for (const db of openDbs.splice(0)) {
    db.close();
    await Dexie.delete(db.name);
  }
});

describe('SyncEngine', () => {
  it('queues offline edits and pushes them when back online', async () => {
    const server = new FakeServer();
    const phone = device(server, 'phone');
    server.online = false;

    const listId = await phone.store.createList('Month-end');
    await phone.store.addItem(listId, 'Maize meal 10kg');
    await phone.store.addItem(listId, 'Cooking oil', 2);
    expect(await phone.engine.pendingCount()).toBe(3);
    await expect(phone.engine.sync()).rejects.toThrow('Failed to fetch');
    expect(await phone.engine.pendingCount()).toBe(3);

    server.online = true;
    await phone.engine.sync();
    expect(await phone.engine.pendingCount()).toBe(0);
    expect(server.lists.size).toBe(1);
    expect([...server.items.values()].map((e) => e.row.text).sort()).toEqual([
      'Cooking oil',
      'Maize meal 10kg',
    ]);
  });

  it('syncs lists between two devices', async () => {
    const server = new FakeServer();
    const phone = device(server, 'phone');
    const laptop = device(server, 'laptop');

    const listId = await laptop.store.createList('Braai');
    const itemId = await laptop.store.addItem(listId, 'Boerewors');
    await laptop.engine.sync();
    await phone.engine.sync();

    expect(await phone.db.lists.get(listId)).toMatchObject({ name: 'Braai' });
    expect(await phone.db.items.get(itemId)).toMatchObject({ text: 'Boerewors', checked: false });
  });

  it('merges concurrent offline edits to the same item', async () => {
    const server = new FakeServer();
    const phone = device(server, 'phone');
    const laptop = device(server, 'laptop');
    const listId = await laptop.store.createList('Weekly');
    const itemId = await laptop.store.addItem(listId, 'Milk');
    await laptop.engine.sync();
    await phone.engine.sync();

    // Both offline: phone ticks it in the shop, laptop changes the quantity.
    await phone.store.setChecked(itemId, true);
    await laptop.store.updateItem(itemId, { quantity: 2 });
    await phone.engine.sync();
    await laptop.engine.sync();
    await phone.engine.sync();

    const expected = { text: 'Milk', quantity: 2, checked: true };
    expect(await phone.db.items.get(itemId)).toMatchObject(expected);
    expect(await laptop.db.items.get(itemId)).toMatchObject(expected);
  });

  it('keeps edits made while a push is in flight', async () => {
    const server = new FakeServer();
    const phone = device(server, 'phone');
    const listId = await phone.store.createList('Weekly');
    const itemId = await phone.store.addItem(listId, 'Eggs');

    // While the push request is "on the network", the user ticks the item.
    server.onPush = async () => {
      server.onPush = null;
      await phone.store.setChecked(itemId, true);
    };
    await phone.engine.sync();

    // The engine loops until the outbox is empty, so the tick reached the server too.
    expect(await phone.engine.pendingCount()).toBe(0);
    expect(server.items.get(itemId)?.row.checked).toBe(true);
    expect(await phone.db.items.get(itemId)).toMatchObject({ checked: true });
  });

  it('does not let a pull overwrite unsynced local edits', async () => {
    const server = new FakeServer();
    const phone = device(server, 'phone');
    const laptop = device(server, 'laptop');
    const listId = await laptop.store.createList('Weekly');
    const itemId = await laptop.store.addItem(listId, 'Bread');
    await laptop.engine.sync();
    await phone.engine.sync();

    await laptop.store.updateItem(itemId, { text: 'Brown bread' });
    await laptop.engine.sync();
    server.online = false;
    await phone.store.setChecked(itemId, true); // local, unsynced
    server.online = true;

    await phone.engine.sync();
    expect(await phone.db.items.get(itemId)).toMatchObject({ text: 'Brown bread', checked: true });
    expect(server.items.get(itemId)?.row).toMatchObject({ text: 'Brown bread', checked: true });
  });

  it('propagates deletions', async () => {
    const server = new FakeServer();
    const phone = device(server, 'phone');
    const laptop = device(server, 'laptop');
    const listId = await laptop.store.createList('Party');
    const a = await laptop.store.addItem(listId, 'Chips');
    await laptop.store.addItem(listId, 'Coke');
    await laptop.engine.sync();
    await phone.engine.sync();

    await phone.store.setChecked(a, true);
    await phone.store.clearChecked(listId);
    await phone.store.deleteList(listId);
    await phone.engine.sync();
    await laptop.engine.sync();

    expect((await laptop.db.items.get(a))?.deletedAt).not.toBeNull();
    expect((await laptop.db.lists.get(listId))?.deletedAt).not.toBeNull();
  });

  it('drops rows the server rejects instead of retrying forever', async () => {
    const server = new FakeServer();
    const phone = device(server, 'phone');
    const listId = await phone.store.createList('Not mine');
    server.rejectIds.add(listId);

    await phone.engine.sync();
    expect(await phone.engine.pendingCount()).toBe(0);
    expect(await phone.db.lists.get(listId)).toBeUndefined();
  });

  it('makes a local edit win even if this device clock is behind', async () => {
    const server = new FakeServer();
    const phone = device(server, 'phone');
    const listId = await phone.store.createList('Weekly');
    const itemId = await phone.store.addItem(listId, 'Rice');
    // Pretend another device with a clock an hour ahead already ticked it.
    const future = Date.now() + 3_600_000;
    await phone.db.items.update(itemId, { checked: true, checkedUpdatedAt: future });

    await phone.store.setChecked(itemId, false);
    const item = await phone.db.items.get(itemId);
    expect(item?.checked).toBe(false);
    expect(item?.checkedUpdatedAt).toBe(future + 1);
  });
});
