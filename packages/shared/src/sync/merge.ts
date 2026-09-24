import type { List, ListItem } from '../schemas/lists';

// Last-write-wins per field group, used by the client when applying server rows. The server
// runs the same rules in SQL (apps/api/src/routes/sync.ts). Both must stay identical or
// devices will disagree.
//
// Properties (tested): commutative, associative, idempotent, so replicas converge no matter
// the order in which they see updates.
//
// Tie-breaks when timestamps are equal must be deterministic:
// - list name: the larger string wins
// - item content: the larger text wins, then quantity, then product type id, then product id
//   (missing links compare as '')
// - checked: `true` wins
// - tombstones: the earliest deletion time wins (any deletion is final)

function earliestDeletedAt(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

export function mergeList(a: List, b: List): List {
  const nameFromB =
    b.nameUpdatedAt > a.nameUpdatedAt || (b.nameUpdatedAt === a.nameUpdatedAt && b.name > a.name);
  const name = nameFromB ? b : a;
  return {
    id: a.id,
    name: name.name,
    nameUpdatedAt: name.nameUpdatedAt,
    createdAt: Math.min(a.createdAt, b.createdAt),
    deletedAt: earliestDeletedAt(a.deletedAt, b.deletedAt),
  };
}

/** Tie-break order for equal content timestamps; mirrored by CONTENT_FROM_EXCLUDED in SQL. */
function contentGreater(b: ListItem, a: ListItem): boolean {
  if (b.text !== a.text) return b.text > a.text;
  if (b.quantity !== a.quantity) return b.quantity > a.quantity;
  const bType = b.productTypeId ?? '';
  const aType = a.productTypeId ?? '';
  if (bType !== aType) return bType > aType;
  return (b.productId ?? '') > (a.productId ?? '');
}

export function mergeItem(a: ListItem, b: ListItem): ListItem {
  const contentFromB =
    b.contentUpdatedAt > a.contentUpdatedAt ||
    (b.contentUpdatedAt === a.contentUpdatedAt && contentGreater(b, a));
  const content = contentFromB ? b : a;

  const checkedFromB =
    b.checkedUpdatedAt > a.checkedUpdatedAt ||
    (b.checkedUpdatedAt === a.checkedUpdatedAt && b.checked && !a.checked);
  const checked = checkedFromB ? b : a;

  return {
    id: a.id,
    listId: a.listId,
    text: content.text,
    quantity: content.quantity,
    productTypeId: content.productTypeId ?? null,
    productId: content.productId ?? null,
    contentUpdatedAt: content.contentUpdatedAt,
    checked: checked.checked,
    checkedUpdatedAt: checked.checkedUpdatedAt,
    createdAt: Math.min(a.createdAt, b.createdAt),
    deletedAt: earliestDeletedAt(a.deletedAt, b.deletedAt),
  };
}
