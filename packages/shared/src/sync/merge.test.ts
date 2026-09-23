import { describe, expect, it } from 'vitest';
import type { List, ListItem } from '../schemas/lists';
import { mergeItem, mergeList } from './merge';

const ID = '01J8Z6X0000000000000000000';
const LIST_ID = '01J8Z6X0000000000000000001';

function item(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: ID,
    listId: LIST_ID,
    text: 'Bread',
    quantity: 1,
    contentUpdatedAt: 100,
    checked: false,
    checkedUpdatedAt: 100,
    createdAt: 100,
    deletedAt: null,
    ...overrides,
  };
}

function list(overrides: Partial<List> = {}): List {
  return {
    id: LIST_ID,
    name: 'Groceries',
    nameUpdatedAt: 100,
    createdAt: 100,
    deletedAt: null,
    ...overrides,
  };
}

describe('mergeItem', () => {
  it('keeps a text edit and a concurrent check from different devices', () => {
    const phone = item({ checked: true, checkedUpdatedAt: 200 });
    const laptop = item({ text: 'Brown bread', contentUpdatedAt: 150 });
    const merged = mergeItem(phone, laptop);
    expect(merged).toMatchObject({ text: 'Brown bread', checked: true });
  });

  it('takes the newer value per field group', () => {
    const a = item({
      text: 'Milk',
      quantity: 2,
      contentUpdatedAt: 300,
      checked: false,
      checkedUpdatedAt: 500,
    });
    const b = item({
      text: 'Milk 2L',
      quantity: 1,
      contentUpdatedAt: 400,
      checked: true,
      checkedUpdatedAt: 450,
    });
    expect(mergeItem(a, b)).toMatchObject({
      text: 'Milk 2L',
      quantity: 1,
      contentUpdatedAt: 400,
      checked: false,
      checkedUpdatedAt: 500,
    });
  });

  it('lets a deletion win over any later edit', () => {
    const deleted = item({ deletedAt: 200 });
    const edited = item({ text: 'Rye bread', contentUpdatedAt: 900 });
    expect(mergeItem(deleted, edited).deletedAt).toBe(200);
    expect(mergeItem(edited, deleted).deletedAt).toBe(200);
  });

  it('keeps the earliest deletion time', () => {
    expect(mergeItem(item({ deletedAt: 300 }), item({ deletedAt: 200 })).deletedAt).toBe(200);
  });

  it('breaks timestamp ties deterministically', () => {
    const a = item({ text: 'Apples', checked: false });
    const b = item({ text: 'Bananas', checked: true });
    expect(mergeItem(a, b)).toEqual(mergeItem(b, a));
    expect(mergeItem(a, b)).toMatchObject({ text: 'Bananas', checked: true });

    const q1 = item({ quantity: 1 });
    const q3 = item({ quantity: 3 });
    expect(mergeItem(q1, q3).quantity).toBe(3);
    expect(mergeItem(q3, q1).quantity).toBe(3);
  });
});

describe('mergeList', () => {
  it('takes the newer name, ties to the larger string', () => {
    expect(
      mergeList(list({ name: 'A', nameUpdatedAt: 1 }), list({ name: 'B', nameUpdatedAt: 2 })).name,
    ).toBe('B');
    expect(
      mergeList(list({ name: 'Z', nameUpdatedAt: 5 }), list({ name: 'B', nameUpdatedAt: 2 })).name,
    ).toBe('Z');
    expect(mergeList(list({ name: 'A' }), list({ name: 'B' })).name).toBe('B');
    expect(mergeList(list({ name: 'B' }), list({ name: 'A' })).name).toBe('B');
  });

  it('keeps tombstones', () => {
    expect(
      mergeList(list({ deletedAt: 10 }), list({ name: 'New', nameUpdatedAt: 999 })).deletedAt,
    ).toBe(10);
  });
});

// Deterministic pseudo-random versions of the same row, to check the algebraic properties
// that make replicas converge regardless of delivery order.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

function randomItem(next: () => number): ListItem {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T;
  return item({
    text: pick(['Bread', 'Milk', 'Eggs']),
    quantity: pick([1, 2, 3]),
    contentUpdatedAt: pick([100, 200, 300]),
    checked: pick([true, false]),
    checkedUpdatedAt: pick([100, 200, 300]),
    createdAt: pick([50, 100]),
    deletedAt: pick([null, null, 150, 250]),
  });
}

describe('merge properties', () => {
  const next = rng(42);
  const samples = Array.from(
    { length: 300 },
    () => [randomItem(next), randomItem(next), randomItem(next)] as const,
  );

  it('is commutative', () => {
    for (const [a, b] of samples) expect(mergeItem(a, b)).toEqual(mergeItem(b, a));
  });

  it('is associative', () => {
    for (const [a, b, c] of samples) {
      expect(mergeItem(mergeItem(a, b), c)).toEqual(mergeItem(a, mergeItem(b, c)));
    }
  });

  it('is idempotent', () => {
    for (const [a, b] of samples) {
      expect(mergeItem(a, a)).toEqual(a);
      const ab = mergeItem(a, b);
      expect(mergeItem(ab, b)).toEqual(ab);
    }
  });
});
