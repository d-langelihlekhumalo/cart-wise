import {
  type List,
  type ListItem,
  mergeItem,
  mergeList,
  newId,
  type PullResponse,
  type PushResponse,
} from '@cart-wise/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { api, authed, signUp } from '../../test/helpers';

function makeList(overrides: Partial<List> = {}): List {
  return {
    id: newId(),
    name: 'Groceries',
    nameUpdatedAt: 1000,
    createdAt: 1000,
    deletedAt: null,
    ...overrides,
  };
}

function makeItem(listId: string, overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: newId(),
    listId,
    text: 'Bread',
    quantity: 1,
    productTypeId: null,
    productId: null,
    contentUpdatedAt: 1000,
    checked: false,
    checkedUpdatedAt: 1000,
    createdAt: 1000,
    deletedAt: null,
    ...overrides,
  };
}

async function push(
  cookie: string,
  body: { lists?: List[]; items?: ListItem[] },
): Promise<PushResponse> {
  const res = await authed(cookie, '/sync/push', {
    method: 'POST',
    body: JSON.stringify({ lists: body.lists ?? [], items: body.items ?? [] }),
  });
  expect(res.status).toBe(200);
  return res.json();
}

async function pull(cookie: string, cursor = 0): Promise<PullResponse> {
  const res = await authed(cookie, `/sync/pull?cursor=${cursor}`);
  expect(res.status).toBe(200);
  return res.json();
}

describe('sync', () => {
  it('requires a session', async () => {
    expect((await api('/sync/pull')).status).toBe(401);
    expect((await api('/sync/push', { method: 'POST', body: '{}' })).status).toBe(401);
  });

  it('round-trips lists and items between devices', async () => {
    const { cookie } = await signUp();
    const list = makeList();
    const item = makeItem(list.id);

    const pushed = await push(cookie, { lists: [list], items: [item] });
    expect(pushed).toEqual({ lists: [list], items: [item], rejected: [] });

    const pulled = await pull(cookie);
    expect(pulled.lists).toEqual([list]);
    expect(pulled.items).toEqual([item]);
    expect(pulled.hasMore).toBe(false);

    // Nothing new since the cursor.
    const again = await pull(cookie, pulled.cursor);
    expect(again).toMatchObject({ lists: [], items: [], cursor: pulled.cursor });
  });

  it('only returns changes after the cursor', async () => {
    const { cookie } = await signUp();
    const list = makeList();
    await push(cookie, { lists: [list] });
    const { cursor } = await pull(cookie);

    const item = makeItem(list.id);
    await push(cookie, { items: [item] });
    const next = await pull(cookie, cursor);
    expect(next.lists).toEqual([]);
    expect(next.items).toEqual([item]);
  });

  it('merges concurrent edits the same way as the shared merge function', async () => {
    const { cookie } = await signUp();
    const list = makeList();
    const base = makeItem(list.id);
    await push(cookie, { lists: [list], items: [base] });

    // Phone checks the item; laptop renames it; a third device ties on timestamp.
    const phone = { ...base, checked: true, checkedUpdatedAt: 3000 };
    const laptop = { ...base, text: 'Brown bread', contentUpdatedAt: 2000 };
    const tie = { ...base, text: 'Zulu bread', contentUpdatedAt: 2000, quantity: 2 };
    await push(cookie, { items: [phone] });
    await push(cookie, { items: [laptop] });
    const res = await push(cookie, { items: [tie] });

    const expected = mergeItem(mergeItem(mergeItem(base, phone), laptop), tie);
    expect(res.items[0]).toEqual(expected);
    expect(expected).toMatchObject({ text: 'Zulu bread', quantity: 2, checked: true });

    const renamed = { ...list, name: 'Month-end shop', nameUpdatedAt: 5000 };
    const stale = { ...list, name: 'Old name', nameUpdatedAt: 4000 };
    await push(cookie, { lists: [renamed] });
    const listRes = await push(cookie, { lists: [stale] });
    expect(listRes.lists[0]).toEqual(mergeList(renamed, stale));
    expect(listRes.lists[0]?.name).toBe('Month-end shop');
  });

  it('syncs catalogue links and merges them like the client', async () => {
    const { cookie } = await signUp();
    const list = makeList();
    const base = makeItem(list.id, { text: 'bread' });
    await push(cookie, { lists: [list], items: [base] });

    const linked = { ...base, productTypeId: 'white-bread', contentUpdatedAt: 2000 };
    const tie = { ...linked, productId: 'seed-albany-superior-white-bread-1x700g' };
    await push(cookie, { items: [linked] });
    const res = await push(cookie, { items: [tie] });
    expect(res.items[0]).toEqual(mergeItem(mergeItem(base, linked), tie));
    expect(res.items[0]).toMatchObject({
      productTypeId: 'white-bread',
      productId: 'seed-albany-superior-white-bread-1x700g',
    });

    // Rows from clients that predate links are accepted and stored unlinked.
    const { productTypeId: _t, productId: _p, ...legacy } = makeItem(list.id);
    const legacyRes = await push(cookie, { items: [legacy] });
    expect(legacyRes.items[0]).toMatchObject({ productTypeId: null, productId: null });
  });

  it('keeps deletions and sends tombstones to other devices', async () => {
    const { cookie } = await signUp();
    const list = makeList();
    const item = makeItem(list.id);
    await push(cookie, { lists: [list], items: [item] });
    const { cursor } = await pull(cookie);

    await push(cookie, { items: [{ ...item, deletedAt: 2000 }] });
    // A later edit from an offline device doesn't resurrect it.
    await push(cookie, { items: [{ ...item, text: 'Rye', contentUpdatedAt: 9000 }] });

    const next = await pull(cookie, cursor);
    expect(next.items).toHaveLength(1);
    expect(next.items[0]).toMatchObject({ id: item.id, deletedAt: 2000, text: 'Rye' });
  });

  it("refuses to touch another user's lists and items", async () => {
    const alice = await signUp();
    const mallory = await signUp();
    const list = makeList({ name: 'Alice list' });
    const item = makeItem(list.id);
    await push(alice.cookie, { lists: [list], items: [item] });

    const injected = makeItem(list.id, { text: 'Injected' });
    const res = await push(mallory.cookie, {
      lists: [{ ...list, name: 'Pwned', nameUpdatedAt: 9999 }],
      items: [{ ...item, text: 'Pwned', contentUpdatedAt: 9999 }, injected],
    });
    expect(res.lists).toEqual([]);
    expect(res.items).toEqual([]);
    expect(res.rejected.map((r) => r.id).sort()).toEqual([list.id, item.id, injected.id].sort());

    // Mallory sees nothing; Alice's data is unchanged.
    expect(await pull(mallory.cookie)).toMatchObject({ lists: [], items: [] });
    const alicePull = await pull(alice.cookie);
    expect(alicePull.lists).toEqual([list]);
    expect(alicePull.items).toEqual([item]);
  });

  it("doesn't let an item move to a different list", async () => {
    const { cookie } = await signUp();
    const a = makeList();
    const b = makeList();
    const item = makeItem(a.id);
    await push(cookie, { lists: [a, b], items: [item] });

    const res = await push(cookie, { items: [{ ...item, listId: b.id, contentUpdatedAt: 5000 }] });
    expect(res.rejected).toEqual([{ id: item.id, reason: 'list_not_owned' }]);
  });

  it('pages through large pulls without skipping rows', async () => {
    const { cookie } = await signUp();
    const list = makeList();
    const items = Array.from({ length: 199 }, (_, i) => makeItem(list.id, { text: `Item ${i}` }));
    await push(cookie, { lists: [list], items });
    // 3 more pushes -> 797 rows total, more than one 500-row page.
    for (let n = 0; n < 3; n++) {
      await push(cookie, {
        items: Array.from({ length: 200 }, (_, i) => makeItem(list.id, { text: `More ${n}-${i}` })),
      });
    }

    const seen = new Set<string>();
    let cursor = 0;
    let pages = 0;
    for (;;) {
      const page = await pull(cookie, cursor);
      for (const row of [...page.lists, ...page.items]) seen.add(row.id);
      cursor = page.cursor;
      pages += 1;
      if (!page.hasMore) break;
    }
    expect(pages).toBe(2);
    expect(seen.size).toBe(1 + 199 + 600);
  });

  it('validates pushes', async () => {
    const { cookie } = await signUp();
    const tooMany = Array.from({ length: 201 }, () => makeList());
    const cases = [
      { lists: [makeList({ name: '   ' })], items: [] },
      { lists: [makeList({ id: 'not-a-ulid' })], items: [] },
      { lists: [], items: [makeItem(newId(), { quantity: 0 })] },
      { lists: tooMany, items: [] },
    ];
    for (const body of cases) {
      const res = await authed(cookie, '/sync/push', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(400);
    }
    expect((await authed(cookie, '/sync/pull?cursor=-1')).status).toBe(400);
  });

  it('deletes lists and items with the account', async () => {
    const { cookie, userId } = await signUp();
    const list = makeList();
    await push(cookie, { lists: [list], items: [makeItem(list.id)] });

    await authed(cookie, '/me', { method: 'DELETE' });
    const lists = await env.DB.prepare('SELECT count(*) AS n FROM lists WHERE owner_id = ?')
      .bind(userId)
      .first<{ n: number }>();
    const items = await env.DB.prepare('SELECT count(*) AS n FROM list_items WHERE list_id = ?')
      .bind(list.id)
      .first<{ n: number }>();
    expect(lists?.n).toBe(0);
    expect(items?.n).toBe(0);
  });
});
