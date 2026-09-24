import { LOYALTY_PROGRAMS, type LoyaltyProgramId, type Store } from '@cart-wise/shared';
import { type SubmitEvent, useState } from 'react';
import { useCatalogue } from '../lib/catalogue';
import {
  useAddMyStore,
  useLoyaltyCards,
  useMyStores,
  useRegionStores,
  useSaveLoyaltyCards,
  useSaveMyStores,
} from '../lib/stores';
import { PlusIcon, TrashIcon } from './icons';
import { Alert, Button, Card, SelectField, Spinner, TextField } from './ui';

/** The chain name, unless the store is already called that ("Pick n Pay" / "Pick n Pay"). */
function storeChainLabel(store: Store, chainName: string | undefined): string | undefined {
  return chainName && chainName.toLowerCase() !== store.name.toLowerCase() ? chainName : undefined;
}

export function LoyaltyCardsCard() {
  const { data: held, isPending } = useLoyaltyCards();
  const save = useSaveLoyaltyCards();

  function toggle(id: LoyaltyProgramId, on: boolean) {
    const next = new Set(held ?? []);
    if (on) next.add(id);
    else next.delete(id);
    save.mutate([...next]);
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Loyalty cards</h2>
        <p className="text-sm text-stone-600">We only use member prices for cards you have.</p>
      </div>
      {save.isError && <Alert>{save.error.message}</Alert>}
      {isPending ? (
        <Spinner />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {LOYALTY_PROGRAMS.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-stone-200 has-checked:bg-brand-50 has-checked:ring-brand-600/40">
                <input
                  type="checkbox"
                  checked={held?.includes(p.id) ?? false}
                  onChange={(e) => {
                    toggle(p.id, e.target.checked);
                  }}
                  className="size-5 accent-brand-700"
                />
                <span>
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-xs text-stone-500">{p.chains}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function MyStoresCard() {
  const { data: mine, isPending } = useMyStores();
  const { catalogue } = useCatalogue();
  const save = useSaveMyStores();
  const [adding, setAdding] = useState(false);

  function remove(store: Store) {
    save.mutate((mine ?? []).filter((s) => s.id !== store.id).map((s) => s.id));
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">My stores</h2>
          <p className="text-sm text-stone-600">
            Where you actually shop. We compare prices across these.
          </p>
        </div>
        {!adding && (
          <Button
            variant="secondary"
            className="shrink-0 gap-1"
            onClick={() => {
              setAdding(true);
            }}
          >
            <PlusIcon className="size-4" />
            Add
          </Button>
        )}
      </div>
      {save.isError && <Alert>{save.error.message}</Alert>}
      {isPending ? (
        <Spinner />
      ) : mine?.length ? (
        <ul className="divide-y divide-stone-100 rounded-lg ring-1 ring-stone-200">
          {mine.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-xs text-stone-500">
                  {[storeChainLabel(s, catalogue?.chainById.get(s.chainId)?.name), s.suburb]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  remove(s);
                }}
                className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-red-700"
                title={`Remove ${s.name}`}
              >
                <TrashIcon className="size-4" />
                <span className="sr-only">Remove {s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !adding && (
          <p className="rounded-lg bg-stone-50 px-3 py-4 text-center text-sm text-stone-600">
            No stores yet. Add the shops you go to, including your local spaza or butchery.
          </p>
        )
      )}
      {adding && (
        <AddStoreForm
          excludeIds={new Set((mine ?? []).map((s) => s.id))}
          onDone={() => {
            setAdding(false);
          }}
        />
      )}
    </Card>
  );
}

function AddStoreForm({ excludeIds, onDone }: { excludeIds: Set<string>; onDone: () => void }) {
  const { catalogue } = useCatalogue();
  const { data: regionStores } = useRegionStores();
  const addMyStore = useAddMyStore();
  const [chainId, setChainId] = useState('');
  const [existingId, setExistingId] = useState('');
  const [name, setName] = useState('');
  const [suburb, setSuburb] = useState('');

  const candidates = (regionStores ?? []).filter(
    (s) => s.chainId === chainId && !excludeIds.has(s.id),
  );
  const chain = catalogue?.chainById.get(chainId);
  const creating = existingId === '' || existingId === 'new';

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!chainId) return;
    const existing = candidates.find((s) => s.id === existingId);
    if (existing) {
      await addMyStore.add({ existing });
    } else {
      await addMyStore.add({
        create: {
          chainId,
          name: name.trim() || (chain?.name ?? ''),
          suburb: suburb.trim() || null,
        },
      });
    }
    onDone();
  }

  const tiers = [
    ['major', 'Supermarkets'],
    ['regional', 'Regional chains'],
    ['informal', 'Local & informal'],
  ] as const;

  return (
    <form
      onSubmit={(e) => void onSubmit(e).catch(() => undefined)}
      className="space-y-3 rounded-lg bg-stone-50 p-3"
    >
      {addMyStore.error && <Alert>{addMyStore.error.message}</Alert>}
      <SelectField
        label="Shop"
        value={chainId}
        onChange={(e) => {
          setChainId(e.target.value);
          setExistingId('');
        }}
        required
      >
        <option value="" disabled>
          Choose…
        </option>
        {tiers.map(([tier, label]) => (
          <optgroup key={tier} label={label}>
            {catalogue?.chains
              .filter((c) => c.tier === tier)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
        ))}
      </SelectField>

      {chainId && candidates.length > 0 && (
        <SelectField
          label="Which one?"
          value={existingId || 'new'}
          onChange={(e) => {
            setExistingId(e.target.value);
          }}
        >
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.suburb ? ` — ${s.suburb}` : ''}
            </option>
          ))}
          <option value="new">Another branch…</option>
        </SelectField>
      )}

      {chainId && creating && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Store name"
            placeholder={chain?.tier === 'informal' ? "e.g. Mama Thandi's" : chain?.name}
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
            }}
            required={chain?.tier === 'informal'}
          />
          <TextField
            label="Suburb or area"
            placeholder="e.g. Soweto"
            value={suburb}
            maxLength={80}
            onChange={(e) => {
              setSuburb(e.target.value);
            }}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={!chainId || addMyStore.isPending}>
          {addMyStore.isPending ? 'Adding…' : 'Add store'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
