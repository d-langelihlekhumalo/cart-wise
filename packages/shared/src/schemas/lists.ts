import * as z from 'zod/mini';

// Lists are offline-first: the client creates rows with its own ULIDs and per-field
// timestamps, and the server merges them (see sync/merge.ts, and the SQL in apps/api
// routes/sync.ts, which must agree with it).

export const LIST_NAME_MAX = 100;
export const ITEM_TEXT_MAX = 200;
export const ITEM_QUANTITY_MAX = 999;
/** Max rows per push request. Keeps D1 batches well within limits. */
export const SYNC_PUSH_MAX_ROWS = 200;

const ulid = z.string().check(z.regex(/^[0-9A-HJKMNP-TV-Z]{26}$/));
const timestamp = z.int().check(z.nonnegative());
const trimmed = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));

export const listSchema = z.object({
  id: ulid,
  name: trimmed(LIST_NAME_MAX),
  nameUpdatedAt: timestamp,
  createdAt: timestamp,
  /** Tombstone. Once set, a list stays deleted. */
  deletedAt: z.nullable(timestamp),
});

export type List = z.infer<typeof listSchema>;

export const listItemSchema = z.object({
  id: ulid,
  listId: ulid,
  /** "Content" fields are edited together and share one timestamp. */
  text: trimmed(ITEM_TEXT_MAX),
  quantity: z.int().check(z.minimum(1), z.maximum(ITEM_QUANTITY_MAX)),
  contentUpdatedAt: timestamp,
  checked: z.boolean(),
  checkedUpdatedAt: timestamp,
  createdAt: timestamp,
  deletedAt: z.nullable(timestamp),
});

export type ListItem = z.infer<typeof listItemSchema>;

export const pushRequestSchema = z
  .object({
    lists: z.array(listSchema),
    items: z.array(listItemSchema),
  })
  .check(
    z.refine((r) => r.lists.length + r.items.length <= SYNC_PUSH_MAX_ROWS, {
      message: `At most ${SYNC_PUSH_MAX_ROWS} rows per push`,
    }),
  );

export type PushRequest = z.infer<typeof pushRequestSchema>;

export const pushResponseSchema = z.object({
  /** Server state of every accepted row after merging. */
  lists: z.array(listSchema),
  items: z.array(listItemSchema),
  /** Rows the server refused (not yours, or an item whose list isn't yours). */
  rejected: z.array(z.object({ id: z.string(), reason: z.string() })),
});

export type PushResponse = z.infer<typeof pushResponseSchema>;

export const pullResponseSchema = z.object({
  lists: z.array(listSchema),
  items: z.array(listItemSchema),
  cursor: z.int().check(z.nonnegative()),
  hasMore: z.boolean(),
});

export type PullResponse = z.infer<typeof pullResponseSchema>;
