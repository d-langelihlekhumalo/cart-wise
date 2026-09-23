import { LIST_NAME_MAX } from '@cart-wise/shared';
import { type SubmitEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ListIcon, PlusIcon } from '../../components/icons';
import { PageHeader } from '../../components/Layout';
import { Button, Card, Spinner } from '../../components/ui';
import { type ListSummary, useListStore, useLists } from './hooks';

const SUGGESTED_NAMES = ['Month-end shop', 'Weekly top-up', 'Braai', 'School lunches'];

export function Component() {
  const lists = useLists();
  const store = useListStore();
  const navigate = useNavigate();

  async function create(name: string) {
    const id = await store.createList(name);
    void navigate(`/lists/${id}`);
  }

  return (
    <>
      <PageHeader
        title="Lists"
        description="Your shopping lists. They work offline and sync across your devices."
      />
      <NewListForm onCreate={create} />

      {lists === undefined ? (
        <Spinner />
      ) : lists.length === 0 ? (
        <EmptyState onCreate={create} />
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => (
            <li key={list.id}>
              <ListCard list={list} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NewListForm({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    void onCreate(name);
    setName('');
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <label htmlFor="new-list" className="sr-only">
        New list name
      </label>
      <input
        id="new-list"
        value={name}
        maxLength={LIST_NAME_MAX}
        placeholder="New list, e.g. Month-end shop"
        onChange={(e) => {
          setName(e.target.value);
        }}
        className="min-h-11 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 shadow-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 focus:outline-none"
      />
      <Button type="submit" disabled={!name.trim()} className="shrink-0 gap-1">
        <PlusIcon className="size-4" />
        Create
      </Button>
    </form>
  );
}

export function ListCard({ list }: { list: ListSummary }) {
  const done = list.total - list.remaining;
  const pct = list.total === 0 ? 0 : Math.round((done / list.total) * 100);
  return (
    <Link
      to={`/lists/${list.id}`}
      className="block h-full rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:shadow-md hover:ring-brand-600/40"
    >
      <p className="truncate font-semibold">{list.name}</p>
      <p className="mt-1 text-sm text-stone-600">
        {list.total === 0
          ? 'No items yet'
          : list.remaining === 0
            ? `All ${list.total} items ticked`
            : `${list.remaining} of ${list.total} to get`}
      </p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${list.name} progress`}
      >
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}

function EmptyState({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  return (
    <Card className="mt-6 flex flex-col items-center gap-4 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <ListIcon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">No lists yet</p>
        <p className="text-sm text-stone-600">Start with one of these, or name your own above.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTED_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => void onCreate(name)}
            className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-brand-50 hover:text-brand-800"
          >
            {name}
          </button>
        ))}
      </div>
    </Card>
  );
}
