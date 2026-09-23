import type { List, ListItem } from '@cart-wise/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppSession } from '../../lib/session';
import { getSession } from './sync';

export interface ListSummary extends List {
  total: number;
  remaining: number;
}

function useCurrentSession() {
  const { user } = useAppSession();
  // These hooks only render under RequireAuth, so a user is always present.
  if (!user) throw new Error('List hooks used without a signed-in user');
  return getSession(user.id);
}

export function useListStore() {
  return useCurrentSession().store;
}

/** Live list of lists with item counts, newest first. `undefined` while loading. */
export function useLists(): ListSummary[] | undefined {
  const { db } = useCurrentSession();
  return useLiveQuery(async () => {
    const [lists, items] = await Promise.all([db.lists.toArray(), db.items.toArray()]);
    const counts = new Map<string, { total: number; remaining: number }>();
    for (const item of items) {
      if (item.deletedAt !== null) continue;
      const c = counts.get(item.listId) ?? { total: 0, remaining: 0 };
      c.total += 1;
      if (!item.checked) c.remaining += 1;
      counts.set(item.listId, c);
    }
    return lists
      .filter((l) => l.deletedAt === null)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((l) => ({ ...l, ...(counts.get(l.id) ?? { total: 0, remaining: 0 }) }));
  }, [db]);
}

/** `null` if the list doesn't exist (or was deleted); `undefined` while loading. */
export function useList(id: string): List | null | undefined {
  const { db } = useCurrentSession();
  return useLiveQuery(async () => {
    const list = await db.lists.get(id);
    return list?.deletedAt === null ? list : null;
  }, [db, id]);
}

/** Visible items in creation order. */
export function useItems(listId: string): ListItem[] | undefined {
  const { db } = useCurrentSession();
  return useLiveQuery(
    async () =>
      (await db.items.where('listId').equals(listId).toArray())
        .filter((i) => i.deletedAt === null)
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    [db, listId],
  );
}
