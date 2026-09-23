// Local writes. Every change lands in IndexedDB first (so it works offline), marks the row
// dirty in the outbox, and nudges the sync engine.
import {
  ITEM_QUANTITY_MAX,
  ITEM_TEXT_MAX,
  LIST_NAME_MAX,
  type List,
  type ListItem,
  newId,
} from '@cart-wise/shared';
import { type LocalDb, outboxEntry } from './db';

type Nudge = () => void;

/**
 * Timestamp for a local edit that always beats the version the user is looking at, even if
 * this device's clock is behind the one that wrote it.
 */
function nextTs(previous = 0): number {
  return Math.max(Date.now(), previous + 1);
}

const clampText = (text: string, max: number) => text.trim().slice(0, max);
const clampQuantity = (q: number) => Math.min(Math.max(Math.round(q), 1), ITEM_QUANTITY_MAX);

export class ListStore {
  constructor(
    private readonly db: LocalDb,
    private readonly nudge: Nudge = () => undefined,
  ) {}

  private async writeList(list: List): Promise<void> {
    await this.db.transaction('rw', this.db.lists, this.db.outbox, async () => {
      await this.db.lists.put(list);
      await this.db.outbox.put(outboxEntry('list', list.id));
    });
    this.nudge();
  }

  private async writeItems(items: ListItem[]): Promise<void> {
    if (items.length === 0) return;
    await this.db.transaction('rw', this.db.items, this.db.outbox, async () => {
      await this.db.items.bulkPut(items);
      await this.db.outbox.bulkPut(items.map((i) => outboxEntry('item', i.id)));
    });
    this.nudge();
  }

  async createList(name: string): Promise<string> {
    const now = nextTs();
    const list: List = {
      id: newId(),
      name: clampText(name, LIST_NAME_MAX),
      nameUpdatedAt: now,
      createdAt: now,
      deletedAt: null,
    };
    await this.writeList(list);
    return list.id;
  }

  async renameList(id: string, name: string): Promise<void> {
    const list = await this.db.lists.get(id);
    if (!list) return;
    await this.writeList({
      ...list,
      name: clampText(name, LIST_NAME_MAX),
      nameUpdatedAt: nextTs(list.nameUpdatedAt),
    });
  }

  async deleteList(id: string): Promise<void> {
    const list = await this.db.lists.get(id);
    if (list?.deletedAt !== null) return;
    await this.writeList({ ...list, deletedAt: nextTs() });
  }

  async addItem(listId: string, text: string, quantity = 1): Promise<string> {
    const now = nextTs();
    const item: ListItem = {
      id: newId(),
      listId,
      text: clampText(text, ITEM_TEXT_MAX),
      quantity: clampQuantity(quantity),
      contentUpdatedAt: now,
      checked: false,
      checkedUpdatedAt: now,
      createdAt: now,
      deletedAt: null,
    };
    await this.writeItems([item]);
    return item.id;
  }

  async updateItem(id: string, changes: { text?: string; quantity?: number }): Promise<void> {
    const item = await this.db.items.get(id);
    if (!item) return;
    await this.writeItems([
      {
        ...item,
        text: changes.text === undefined ? item.text : clampText(changes.text, ITEM_TEXT_MAX),
        quantity: changes.quantity === undefined ? item.quantity : clampQuantity(changes.quantity),
        contentUpdatedAt: nextTs(item.contentUpdatedAt),
      },
    ]);
  }

  async setChecked(id: string, checked: boolean): Promise<void> {
    const item = await this.db.items.get(id);
    if (!item || item.checked === checked) return;
    await this.writeItems([{ ...item, checked, checkedUpdatedAt: nextTs(item.checkedUpdatedAt) }]);
  }

  async deleteItem(id: string): Promise<void> {
    const item = await this.db.items.get(id);
    if (item?.deletedAt !== null) return;
    await this.writeItems([{ ...item, deletedAt: nextTs() }]);
  }

  /** Removes every ticked item from the list (after a shop). */
  async clearChecked(listId: string): Promise<void> {
    const items = await this.db.items.where('listId').equals(listId).toArray();
    const now = nextTs();
    await this.writeItems(
      items.filter((i) => i.checked && i.deletedAt === null).map((i) => ({ ...i, deletedAt: now })),
    );
  }

  /** Unticks everything, to reuse a list for the next shop. */
  async uncheckAll(listId: string): Promise<void> {
    const items = await this.db.items.where('listId').equals(listId).toArray();
    await this.writeItems(
      items
        .filter((i) => i.checked && i.deletedAt === null)
        .map((i) => ({ ...i, checked: false, checkedUpdatedAt: nextTs(i.checkedUpdatedAt) })),
    );
  }
}
