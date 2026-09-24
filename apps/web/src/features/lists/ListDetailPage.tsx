import {
  ITEM_QUANTITY_MAX,
  ITEM_TEXT_MAX,
  LIST_NAME_MAX,
  type List,
  type ListItem,
} from '@cart-wise/shared';
import { type ReactNode, type SubmitEvent, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowLeftIcon,
  CheckIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
} from '../../components/icons';
import { Button, Card, Spinner } from '../../components/ui';
import { type CatalogueIndex, matchProductTypes, useCatalogue } from '../../lib/catalogue';
import { useItems, useList, useListStore } from './hooks';
import { ItemSuggestions } from './ItemSuggestions';
import type { ItemLink, ListStore } from './store';

const inputClass =
  'min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 shadow-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 focus:outline-none';

export function Component() {
  const { listId = '' } = useParams();
  const list = useList(listId);
  const items = useItems(listId);
  const store = useListStore();
  const { catalogue } = useCatalogue();

  if (list === undefined || items === undefined) return <Spinner />;
  if (list === null) {
    return (
      <Card className="mx-auto mt-10 max-w-md space-y-2 text-center">
        <p className="font-medium">This list doesn&apos;t exist anymore.</p>
        <Link to="/lists" className="font-medium text-brand-700 underline">
          Back to your lists
        </Link>
      </Card>
    );
  }

  const toGet = items.filter((i) => !i.checked);
  const inTrolley = items.filter((i) => i.checked);

  return (
    <>
      <Link
        to="/lists"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <ArrowLeftIcon className="size-4" />
        All lists
      </Link>
      <ListTitle list={list} store={store} />

      <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2">
          <AddItemForm listId={list.id} store={store} />

          <Card className="p-0">
            <SectionHeading>
              To get <Count n={toGet.length} />
            </SectionHeading>
            {toGet.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-stone-500">
                {items.length === 0
                  ? 'Add your first item above.'
                  : 'Everything is in the trolley.'}
              </p>
            ) : (
              <GroupedItems items={toGet} store={store} catalogue={catalogue} />
            )}
          </Card>

          {inTrolley.length > 0 && (
            <Card className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pr-3">
                <SectionHeading>
                  In the trolley <Count n={inTrolley.length} />
                </SectionHeading>
                <div className="flex gap-1">
                  <SmallButton onClick={() => void store.uncheckAll(list.id)}>
                    Untick all
                  </SmallButton>
                  <SmallButton onClick={() => void store.clearChecked(list.id)}>
                    Remove ticked
                  </SmallButton>
                </div>
              </div>
              <ul className="divide-y divide-stone-100">
                {inTrolley.map((item) => (
                  <ItemRow key={item.id} item={item} store={store} />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-10">
          <ProgressCard total={items.length} done={inTrolley.length} />
          <Card className="space-y-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <TagIcon className="size-4 text-stone-500" />
              Where is this cheapest?
            </h2>
            <p className="text-sm text-stone-600">
              Store price comparisons for your list are coming once prices are in.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="flex items-center gap-2 px-4 pt-4 pb-2 font-semibold">{children}</h2>;
}

function Count({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
      {n}
    </span>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
    >
      {children}
    </button>
  );
}

function ListTitle({ list, store }: { list: List; store: ListStore }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);

  function save(e: SubmitEvent) {
    e.preventDefault();
    if (name.trim() && name.trim() !== list.name) void store.renameList(list.id, name);
    setEditing(false);
  }

  function remove() {
    if (!window.confirm(`Delete "${list.name}"? This removes it from all your devices.`)) return;
    void store.deleteList(list.id).then(() => navigate('/lists', { replace: true }));
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 lg:mb-8">
      {editing ? (
        <form onSubmit={save} className="flex w-full max-w-lg gap-2">
          <label htmlFor="list-name" className="sr-only">
            List name
          </label>
          <input
            id="list-name"
            autoFocus
            value={name}
            maxLength={LIST_NAME_MAX}
            onChange={(e) => {
              setName(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false);
            }}
            className={`${inputClass} text-lg font-semibold`}
          />
          <Button type="submit">Save</Button>
        </form>
      ) : (
        <h1 className="text-2xl font-semibold break-words lg:text-3xl">{list.name}</h1>
      )}
      {!editing && (
        <div className="flex gap-1">
          <IconButton
            label="Rename list"
            onClick={() => {
              setName(list.name);
              setEditing(true);
            }}
          >
            <PencilIcon />
          </IconButton>
          <IconButton label="Delete list" onClick={remove} danger>
            <TrashIcon />
          </IconButton>
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex size-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 ${
        danger ? 'hover:text-red-700' : 'hover:text-stone-900'
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function AddItemForm({ listId, store }: { listId: string; store: ListStore }) {
  const [text, setText] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [suggesting, setSuggesting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { catalogue } = useCatalogue();

  function add(itemText: string, link: ItemLink) {
    void store.addItem(listId, itemText, quantity, link);
    setText('');
    setQuantity(1);
    setSuggesting(false);
    inputRef.current?.focus();
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    // Typed an exact product type name ("Eggs")? Link it so it's grouped and priced.
    const exact = catalogue
      ? matchProductTypes(catalogue, text, 1).find(
          (t) => t.name.toLowerCase() === text.trim().toLowerCase(),
        )
      : undefined;
    add(text, exact ? { productTypeId: exact.id } : {});
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-2 sm:flex-nowrap">
      <div className="relative flex-1 basis-full sm:basis-auto">
        <label htmlFor="new-item" className="sr-only">
          Item
        </label>
        <input
          id="new-item"
          ref={inputRef}
          value={text}
          maxLength={ITEM_TEXT_MAX}
          placeholder="Add an item, e.g. White bread or Clover milk 2L"
          autoComplete="off"
          aria-autocomplete="list"
          onChange={(e) => {
            setText(e.target.value);
            setSuggesting(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSuggesting(false);
          }}
          className={inputClass}
        />
        {suggesting && (
          <ItemSuggestions
            text={text}
            catalogue={catalogue}
            onPick={(s) => {
              add(s.text, s.link);
            }}
          />
        )}
      </div>
      <QuantityStepper value={quantity} onChange={setQuantity} />
      <Button type="submit" disabled={!text.trim()} className="flex-1 gap-1 sm:flex-none">
        <PlusIcon className="size-4" />
        Add
      </Button>
    </form>
  );
}

function QuantityStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex min-h-11 items-center rounded-lg border border-stone-300 bg-white shadow-sm">
      <button
        type="button"
        className="flex h-full w-10 items-center justify-center text-stone-600 disabled:text-stone-300"
        onClick={() => {
          onChange(Math.max(1, value - 1));
        }}
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        <MinusIcon className="size-4" />
      </button>
      <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="flex h-full w-10 items-center justify-center text-stone-600 disabled:text-stone-300"
        onClick={() => {
          onChange(Math.min(ITEM_QUANTITY_MAX, value + 1));
        }}
        disabled={value >= ITEM_QUANTITY_MAX}
        aria-label="Increase quantity"
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}

/** Items grouped by aisle (category order); unlinked items go last under "Other". */
function GroupedItems({
  items,
  store,
  catalogue,
}: {
  items: ListItem[];
  store: ListStore;
  catalogue: CatalogueIndex | undefined;
}) {
  const categoryOf = (item: ListItem) => {
    const type = item.productTypeId ? catalogue?.typeById.get(item.productTypeId) : undefined;
    return type ? catalogue?.categoryById.get(type.categoryId) : undefined;
  };
  const groups = new Map<string, { name: string; sort: number; items: ListItem[] }>();
  for (const item of items) {
    const cat = categoryOf(item);
    const key = cat?.id ?? 'other';
    const group = groups.get(key) ?? {
      name: cat?.name ?? 'Other',
      sort: cat?.sort ?? Number.MAX_SAFE_INTEGER,
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }
  const ordered = [...groups.values()].sort((a, b) => a.sort - b.sort);
  // One unlabelled group reads better than a lone "Other" heading.
  const showHeadings = ordered.length > 1 || ordered[0]?.name !== 'Other';

  return (
    <div>
      {ordered.map((group) => (
        <section key={group.name} aria-label={showHeadings ? group.name : undefined}>
          {showHeadings && (
            <h3 className="bg-stone-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">
              {group.name}
            </h3>
          )}
          <ul className="divide-y divide-stone-100">
            {group.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                store={store}
                typeName={
                  item.productTypeId ? catalogue?.typeById.get(item.productTypeId)?.name : undefined
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ItemRow({
  item,
  store,
  typeName,
}: {
  item: ListItem;
  store: ListStore;
  typeName?: string | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const [quantity, setQuantity] = useState(item.quantity);
  const [suggesting, setSuggesting] = useState(false);
  const { catalogue } = useCatalogue();

  function save(e: SubmitEvent) {
    e.preventDefault();
    if (text.trim()) void store.updateItem(item.id, { text, quantity });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form onSubmit={save} className="flex flex-wrap gap-2 sm:flex-nowrap">
          <div className="relative flex-1 basis-full sm:basis-auto">
            <label htmlFor={`edit-${item.id}`} className="sr-only">
              Item
            </label>
            <input
              id={`edit-${item.id}`}
              autoFocus
              value={text}
              maxLength={ITEM_TEXT_MAX}
              autoComplete="off"
              onChange={(e) => {
                setText(e.target.value);
                setSuggesting(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(false);
              }}
              className={inputClass}
            />
            {suggesting && (
              <ItemSuggestions
                text={text}
                catalogue={catalogue}
                onPick={(s) => {
                  void store.updateItem(item.id, { text: s.text, quantity, ...s.link });
                  setEditing(false);
                  setSuggesting(false);
                }}
              />
            )}
          </div>
          <QuantityStepper value={quantity} onChange={setQuantity} />
          <Button type="submit">Save</Button>
        </form>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 px-4 py-2">
      <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={(e) => void store.setChecked(item.id, e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`flex size-7 shrink-0 items-center justify-center rounded-full ring-2 transition peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2 ${
            item.checked ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-stone-300'
          }`}
        >
          {item.checked && <CheckIcon className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block ${item.checked ? 'text-stone-400 line-through' : ''}`}>
            {item.text}
          </span>
          {!item.checked && item.productId && (
            <Link
              to={`/products/${item.productId}`}
              className="text-xs font-medium text-brand-700 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              See prices
            </Link>
          )}
          {!item.checked &&
            !item.productId &&
            typeName &&
            typeName.toLowerCase() !== item.text.toLowerCase() && (
              <span className="text-xs text-stone-500">Any {typeName.toLowerCase()}</span>
            )}
        </span>
        {item.quantity > 1 && (
          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-sm font-medium text-stone-700 tabular-nums">
            ×{item.quantity}
          </span>
        )}
      </label>
      <div className="flex opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <IconButton
          label={`Edit ${item.text}`}
          onClick={() => {
            setText(item.text);
            setQuantity(item.quantity);
            setEditing(true);
          }}
        >
          <PencilIcon className="size-4" />
        </IconButton>
        <IconButton
          label={`Remove ${item.text}`}
          onClick={() => void store.deleteItem(item.id)}
          danger
        >
          <TrashIcon className="size-4" />
        </IconButton>
      </div>
    </li>
  );
}

function ProgressCard({ total, done }: { total: number; done: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Progress</h2>
        <span className="text-sm text-stone-600 tabular-nums">
          {done} of {total}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-stone-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Items ticked"
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-stone-600">
        Tick items off as you shop. This works without data, and syncs when you&apos;re back online.
      </p>
    </Card>
  );
}
