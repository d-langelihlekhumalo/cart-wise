import {
  type CreatePrice,
  createPriceSchema,
  INPUT_SIZE_UNITS,
  type InputSizeUnit,
  parseRandsToCents,
  type Product,
  type PromoType,
  todayInSA,
} from '@cart-wise/shared';
import { type ReactNode, type SubmitEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import * as z from 'zod/mini';
import { ArrowLeftIcon } from '../../components/icons';
import { PageHeader } from '../../components/Layout';
import { Alert, Button, Card, SelectField, Spinner, TextField } from '../../components/ui';
import { useCatalogue } from '../../lib/catalogue';
import { useMyStores } from '../../lib/stores';
import { useCreateProduct, useDebounced, useLogPrice, useProduct, useProductSearch } from './api';
import { ProductSummary, productLabel } from './ProductRow';

type Errors = Record<string, string>;

export function Component() {
  const [params, setParams] = useSearchParams();
  const preselected = params.get('product');
  const [product, setProduct] = useState<Product | null>(null);
  const { data: preloaded } = useProduct(preselected);
  const chosen = product ?? (preselected ? (preloaded?.product ?? null) : null);

  return (
    <>
      <Link
        to={chosen ? `/products/${chosen.id}` : '/prices'}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <ArrowLeftIcon className="size-4" />
        Back
      </Link>
      <PageHeader
        title="Log a price"
        description="What did you see on the shelf or in the pamphlet?"
      />
      <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2">
          <Step n={1} title="Product">
            {chosen ? (
              <div className="flex items-center justify-between gap-3">
                <ProductSummary product={chosen} />
                <Button
                  variant="secondary"
                  onClick={() => {
                    setProduct(null);
                    setParams({}, { replace: true });
                  }}
                >
                  Change
                </Button>
              </div>
            ) : preselected && !preloaded ? (
              <Spinner />
            ) : (
              <ProductPicker onPick={setProduct} />
            )}
          </Step>
          {chosen && <PriceForm product={chosen} />}
        </div>
        <Card className="space-y-2 text-sm text-stone-600">
          <h2 className="font-semibold text-stone-900">Tips</h2>
          <p>Log the shelf price for one item or pack, including VAT.</p>
          <p>If there&apos;s a lower price with a loyalty card, add it as the member price.</p>
          <p>For specials, add the end date from the shelf ticket or pamphlet.</p>
        </Card>
      </div>
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Card className="space-y-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-brand-700 text-xs text-white">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function ProductPicker({ onPick }: { onPick: (p: Product) => void }) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(q);
  const { data: results, isFetching } = useProductSearch(debounced);

  if (creating) {
    return (
      <NewProductForm
        initialName={q}
        onCreated={onPick}
        onCancel={() => {
          setCreating(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <TextField
        label="Search products"
        type="search"
        placeholder="e.g. Iwisa 10kg"
        value={q}
        autoFocus
        onChange={(e) => {
          setQ(e.target.value);
        }}
      />
      {debounced.trim().length >= 2 && (
        <ul
          className={`divide-y divide-stone-100 rounded-lg ring-1 ring-stone-200 ${isFetching ? 'opacity-60' : ''}`}
        >
          {(results ?? []).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(p);
                }}
                className="flex w-full items-center px-3 py-2.5 text-left hover:bg-stone-50"
              >
                <ProductSummary product={p} />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setCreating(true);
              }}
              className="w-full px-3 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-stone-50"
            >
              {results?.length
                ? 'Not listed? Add a new product'
                : `Add "${q.trim()}" as a new product`}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function NewProductForm({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string;
  onCreated: (p: Product) => void;
  onCancel: () => void;
}) {
  const { catalogue } = useCatalogue();
  const create = useCreateProduct();
  const [typeId, setTypeId] = useState('');
  const [brand, setBrand] = useState('');
  const [name, setName] = useState(initialName);
  const [size, setSize] = useState('');
  const [unit, setUnit] = useState<InputSizeUnit>('g');
  const [pack, setPack] = useState('1');
  const [byWeight, setByWeight] = useState(false);
  const [storeBrand, setStoreBrand] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const sizeValue = Number(size.replace(',', '.'));
    if (!typeId) {
      setError('Choose what kind of product it is.');
      return;
    }
    if (!byWeight && !(sizeValue > 0)) {
      setError('Enter the pack size, e.g. 700 g or 2 L.');
      return;
    }
    setError(null);
    create.mutate(
      {
        productTypeId: typeId,
        brand: brand.trim() || null,
        name: name.trim(),
        sizeValue: byWeight ? 1 : sizeValue,
        sizeUnit: byWeight ? 'kg' : unit,
        packCount: Math.max(1, Math.round(Number(pack) || 1)),
        soldByWeight: byWeight,
        isStoreBrand: storeBrand,
      },
      {
        onSuccess: ({ product }) => {
          onCreated(product);
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {(error ?? create.error) && <Alert>{error ?? create.error?.message}</Alert>}
      <SelectField
        label="Kind of product"
        value={typeId}
        onChange={(e) => {
          setTypeId(e.target.value);
        }}
        required
      >
        <option value="" disabled>
          Choose…
        </option>
        {catalogue?.categories.map((c) => (
          <optgroup key={c.id} label={c.name}>
            {c.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectField>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Brand"
          hint="Leave empty for loose/unbranded items"
          value={brand}
          maxLength={60}
          onChange={(e) => {
            setBrand(e.target.value);
          }}
        />
        <TextField
          label="Name"
          value={name}
          maxLength={120}
          required
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={byWeight}
          className="size-5 accent-brand-700"
          onChange={(e) => {
            setByWeight(e.target.checked);
          }}
        />
        Priced per kg (e.g. mince, loose tomatoes)
      </label>
      {!byWeight && (
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label="Size"
            inputMode="decimal"
            placeholder="700"
            value={size}
            onChange={(e) => {
              setSize(e.target.value);
            }}
          />
          <SelectField
            label="Unit"
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value as InputSizeUnit);
            }}
          >
            {INPUT_SIZE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u === 'l' ? 'L' : u}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Pack of"
            inputMode="numeric"
            value={pack}
            onChange={(e) => {
              setPack(e.target.value);
            }}
          />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={storeBrand}
          className="size-5 accent-brand-700"
          onChange={(e) => {
            setStoreBrand(e.target.checked);
          }}
        />
        Store brand (e.g. Ritebrand, No Name, Woolworths)
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add product'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const PROMO_OPTIONS: { value: PromoType; label: string }[] = [
  { value: 'none', label: 'Reduced price' },
  { value: 'multibuy', label: 'Multibuy (e.g. 3 for R50)' },
  { value: 'buy_x_get_y', label: 'Buy X get Y free' },
];

function PriceForm({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { data: stores, isPending: storesPending } = useMyStores();
  const { catalogue } = useCatalogue();
  const log = useLogPrice();
  const [storeId, setStoreId] = useState('');
  const [price, setPrice] = useState('');
  const [member, setMember] = useState('');
  const [special, setSpecial] = useState(false);
  const [promoType, setPromoType] = useState<PromoType>('none');
  const [promoQty, setPromoQty] = useState('3');
  const [promoPrice, setPromoPrice] = useState('');
  const [freeQty, setFreeQty] = useState('1');
  const [memberOnly, setMemberOnly] = useState(false);
  const [validTo, setValidTo] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const store = stores?.find((s) => s.id === storeId);
  const program = store ? catalogue?.chainById.get(store.chainId)?.loyaltyProgram : null;

  if (storesPending) return <Spinner />;
  if (!stores?.length) {
    return (
      <Step n={2} title="Store">
        <p className="text-sm text-stone-600">
          Add the stores you shop at first.{' '}
          <Link to="/settings" className="font-medium text-brand-700 underline">
            Go to settings
          </Link>
        </p>
      </Step>
    );
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const next: Errors = {};
    const priceCents = parseRandsToCents(price);
    if (priceCents === null || priceCents === 0) next.priceCents = 'Enter the price, e.g. 24.99';
    const memberCents = member.trim() ? parseRandsToCents(member) : null;
    if (member.trim() && memberCents === null)
      next.memberPriceCents = 'Enter an amount, e.g. 21.99';
    const bundleCents = promoPrice.trim() ? parseRandsToCents(promoPrice) : null;
    if (!storeId) next.storeId = 'Choose the store';

    const input: CreatePrice = {
      productId: product.id,
      storeId,
      priceCents: priceCents ?? 0,
      memberPriceCents: program ? memberCents : null,
      promoType: special ? promoType : 'none',
      promoQty: special && promoType !== 'none' ? Number(promoQty) : null,
      promoPriceCents: special && promoType === 'multibuy' ? bundleCents : null,
      promoFreeQty: special && promoType === 'buy_x_get_y' ? Number(freeQty) : null,
      promoMemberOnly: special && promoType !== 'none' && memberOnly,
      validFrom: special ? todayInSA() : null,
      validTo: special && validTo ? validTo : null,
    };
    if (Object.keys(next).length === 0) {
      const parsed = z.safeParse(createPriceSchema, input);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? 'form');
          next[key] ??= issue.message;
        }
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    log.mutate(input, {
      onSuccess: () => {
        void navigate(`/products/${product.id}`, { state: { logged: true } });
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Step n={2} title="Store">
        <SelectField
          label="Where did you see it?"
          value={storeId}
          error={errors.storeId}
          onChange={(e) => {
            setStoreId(e.target.value);
          }}
        >
          <option value="" disabled>
            Choose…
          </option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.suburb ? ` — ${s.suburb}` : ''}
            </option>
          ))}
        </SelectField>
      </Step>

      <Step n={3} title="Price">
        {log.isError && <Alert>{log.error.message}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={`Price for ${productLabel(product)} (R)`}
            inputMode="decimal"
            placeholder="e.g. 24.99"
            value={price}
            error={errors.priceCents}
            onChange={(e) => {
              setPrice(e.target.value);
            }}
          />
          {program && (
            <TextField
              label="Member price (R)"
              hint="Optional: price with the store's loyalty card"
              inputMode="decimal"
              value={member}
              error={errors.memberPriceCents}
              onChange={(e) => {
                setMember(e.target.value);
              }}
            />
          )}
        </div>

        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={special}
            className="size-5 accent-brand-700"
            onChange={(e) => {
              setSpecial(e.target.checked);
            }}
          />
          It&apos;s on special
        </label>

        {special && (
          <div className="space-y-3 rounded-lg bg-amber-50/60 p-3 ring-1 ring-amber-200">
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-sm font-medium text-stone-700">Type of special</legend>
              {PROMO_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="promo-type"
                    value={o.value}
                    checked={promoType === o.value}
                    className="size-4 accent-brand-700"
                    onChange={() => {
                      setPromoType(o.value);
                    }}
                  />
                  {o.label}
                </label>
              ))}
            </fieldset>
            {promoType === 'multibuy' && (
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="How many"
                  inputMode="numeric"
                  value={promoQty}
                  error={errors.promoQty}
                  onChange={(e) => {
                    setPromoQty(e.target.value);
                  }}
                />
                <TextField
                  label="For (R)"
                  inputMode="decimal"
                  placeholder="50"
                  value={promoPrice}
                  error={errors.promoPriceCents}
                  onChange={(e) => {
                    setPromoPrice(e.target.value);
                  }}
                />
              </div>
            )}
            {promoType === 'buy_x_get_y' && (
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Buy"
                  inputMode="numeric"
                  value={promoQty}
                  error={errors.promoQty}
                  onChange={(e) => {
                    setPromoQty(e.target.value);
                  }}
                />
                <TextField
                  label="Get free"
                  inputMode="numeric"
                  value={freeQty}
                  error={errors.promoFreeQty}
                  onChange={(e) => {
                    setFreeQty(e.target.value);
                  }}
                />
              </div>
            )}
            {promoType !== 'none' && program && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={memberOnly}
                  className="size-5 accent-brand-700"
                  onChange={(e) => {
                    setMemberOnly(e.target.checked);
                  }}
                />
                Only with the loyalty card
              </label>
            )}
            <TextField
              label="Special ends"
              hint="Optional, from the ticket or pamphlet"
              type="date"
              min={todayInSA()}
              value={validTo}
              error={errors.validTo}
              onChange={(e) => {
                setValidTo(e.target.value);
              }}
            />
          </div>
        )}

        <Button type="submit" disabled={log.isPending} className="w-full sm:w-auto">
          {log.isPending ? 'Saving…' : 'Save price'}
        </Button>
      </Step>
    </form>
  );
}
