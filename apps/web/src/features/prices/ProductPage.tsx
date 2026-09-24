import {
  describePromo,
  formatSize,
  formatUnitPrice,
  formatZAR,
  type Price,
  type Product,
  type StorePrice,
  unitPrice,
} from '@cart-wise/shared';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowLeftIcon, PlusIcon } from '../../components/icons';
import { Alert, Card, Spinner } from '../../components/ui';
import { useLoyaltyCards } from '../../lib/stores';
import { useProduct } from './api';
import { productLabel } from './ProductRow';

const dateFormat = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short' });

function formatDay(iso: string): string {
  return dateFormat.format(new Date(`${iso}T12:00:00`));
}

function ago(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function Component() {
  const { productId = '' } = useParams();
  const location = useLocation();
  const justLogged = (location.state as { logged?: boolean } | null)?.logged === true;
  const { data, isPending, error } = useProduct(productId);
  const { data: cards } = useLoyaltyCards();

  if (isPending) return <Spinner />;
  if (error) return <Alert>{error.message}</Alert>;

  const { product, productType, category } = data;
  const stores = [...data.stores].sort((a, b) => bestCents(a) - bestCents(b));

  return (
    <>
      <Link
        to="/prices"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <ArrowLeftIcon className="size-4" />
        Prices
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
        <div className="space-y-1">
          <p className="text-sm text-stone-500">
            {category.name} · {productType.name}
          </p>
          <h1 className="text-2xl font-semibold lg:text-3xl">{productLabel(product)}</h1>
          <p className="text-stone-600">{formatSize(product)}</p>
        </div>
        <Link
          to={`/prices/new?product=${encodeURIComponent(product.id)}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-brand-700 px-4 font-medium text-white hover:bg-brand-800"
        >
          <PlusIcon className="size-4" />
          Log a price
        </Link>
      </div>

      {justLogged && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-brand-100"
        >
          Thanks! Your price is saved and helps everyone nearby.
        </p>
      )}

      {stores.length === 0 ? (
        <Card className="space-y-2 py-10 text-center">
          <p className="font-medium">No prices at your stores yet</p>
          <p className="text-sm text-stone-600">
            Seen it on the shelf? Log the price.{' '}
            <Link to="/settings" className="font-medium text-brand-700 underline">
              Add your stores
            </Link>{' '}
            if they&apos;re missing.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stores.map((sp) => (
            <li key={sp.store.id}>
              <StorePriceCard
                sp={sp}
                product={product}
                hasCard={
                  sp.chain.loyaltyProgram !== null &&
                  (cards?.includes(sp.chain.loyaltyProgram) ?? false)
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Lowest known current single-item price, for sorting (unknown last). */
function bestCents(sp: StorePrice): number {
  const candidates = [sp.promo, sp.regular]
    .filter((p): p is Price => p !== null)
    .map((p) => p.memberPriceCents ?? p.priceCents);
  return candidates.length ? Math.min(...candidates) : Number.POSITIVE_INFINITY;
}

function StorePriceCard({
  sp,
  product,
  hasCard,
}: {
  sp: StorePrice;
  product: Product;
  hasCard: boolean;
}) {
  const current = sp.promo ?? sp.regular;
  return (
    <Card className="flex h-full flex-col gap-3">
      <div>
        <p className="font-semibold">{sp.store.name}</p>
        <p className="text-xs text-stone-500">
          {[sp.chain.name !== sp.store.name ? sp.chain.name : null, sp.store.suburb]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {current ? (
        <PriceBlock price={current} product={product} hasCard={hasCard} />
      ) : sp.lastSeen ? (
        <p className="text-sm text-stone-500">
          Last seen at {formatZAR(sp.lastSeen.priceCents)} {ago(sp.lastSeen.observedAt)}, which may
          be out of date.
        </p>
      ) : (
        <p className="text-sm text-stone-500">No recent price</p>
      )}
      {sp.promo && sp.regular && (
        <p className="text-xs text-stone-500">Usually {formatZAR(sp.regular.priceCents)}</p>
      )}
    </Card>
  );
}

function PriceBlock({
  price,
  product,
  hasCard,
}: {
  price: Price;
  product: Product;
  hasCard: boolean;
}) {
  const promo = describePromo(price, formatZAR);
  const member = price.memberPriceCents;
  return (
    <div className="space-y-1.5">
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{formatZAR(price.priceCents)}</span>
        <span className="text-sm text-stone-500">
          {formatUnitPrice(unitPrice(product, price.priceCents))}
        </span>
      </p>
      {member !== null && (
        <p
          className={`text-sm font-medium ${hasCard ? 'text-brand-700' : 'text-stone-500'}`}
          title={hasCard ? 'You have this loyalty card' : 'Needs the loyalty card'}
        >
          {formatZAR(member)} with card{hasCard ? ' ✓' : ''}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {price.isPromo && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
            Special{price.validTo ? ` until ${formatDay(price.validTo)}` : ''}
          </span>
        )}
        {promo && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
            {promo}
            {price.promoMemberOnly ? ' (card)' : ''}
          </span>
        )}
      </div>
      <p className="text-xs text-stone-400">Seen {ago(price.observedAt)}</p>
    </div>
  );
}
