import { useState } from 'react';
import { Link } from 'react-router';
import { PlusIcon, TagIcon } from '../../components/icons';
import { PageHeader } from '../../components/Layout';
import { Card, Spinner } from '../../components/ui';
import { useCatalogue } from '../../lib/catalogue';
import { useDebounced, useProductSearch } from './api';
import { ProductSummary } from './ProductRow';

export function Component() {
  const [q, setQ] = useState('');
  const [typeId, setTypeId] = useState<string | undefined>();
  const debounced = useDebounced(q);
  const { data: products, isFetching } = useProductSearch(debounced, typeId);
  const { catalogue } = useCatalogue();
  const activeType = typeId ? catalogue?.typeById.get(typeId) : undefined;

  return (
    <>
      <PageHeader
        title="Prices"
        description="Look up what things cost at your stores, or add a price you've seen."
        actions={
          <Link
            to="/prices/new"
            className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-brand-700 px-4 font-medium text-white hover:bg-brand-800"
          >
            <PlusIcon className="size-4" />
            Log a price
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2">
          <div>
            <label htmlFor="product-search" className="sr-only">
              Search products
            </label>
            <input
              id="product-search"
              type="search"
              value={q}
              placeholder="Search, e.g. maize meal, Albany, Sunfoil 2L"
              onChange={(e) => {
                setQ(e.target.value);
              }}
              className="min-h-12 w-full rounded-lg border border-stone-300 bg-white px-4 text-base shadow-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 focus:outline-none"
            />
            {activeType && (
              <p className="mt-2 text-sm text-stone-600">
                Showing <strong>{activeType.name}</strong>{' '}
                <button
                  type="button"
                  className="font-medium text-brand-700 underline"
                  onClick={() => {
                    setTypeId(undefined);
                  }}
                >
                  clear
                </button>
              </p>
            )}
          </div>

          <Card className="p-0">
            {debounced.trim().length < 2 && !typeId ? (
              <p className="px-4 py-10 text-center text-sm text-stone-500">
                Search for a product, or pick a category.
              </p>
            ) : products === undefined ? (
              <Spinner />
            ) : products.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-stone-600">
                No products found.{' '}
                <Link to="/prices/new" className="font-medium text-brand-700 underline">
                  Add it with a price
                </Link>
              </p>
            ) : (
              <ul
                className={`divide-y divide-stone-100 ${isFetching ? 'opacity-60' : ''}`}
                aria-busy={isFetching}
              >
                {products.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/products/${p.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50"
                    >
                      <TagIcon className="size-5 shrink-0 text-stone-400" />
                      <ProductSummary product={p} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="space-y-3 self-start">
          <h2 className="font-semibold">Browse</h2>
          {catalogue ? (
            <div className="space-y-3">
              {catalogue.categories.map((cat) => (
                <details key={cat.id} className="group">
                  <summary className="cursor-pointer list-none rounded-lg px-2 py-1.5 font-medium hover:bg-stone-50">
                    {cat.name}
                  </summary>
                  <div className="mt-1 flex flex-wrap gap-1.5 px-2">
                    {cat.types.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTypeId(t.id);
                          setQ('');
                        }}
                        className={`rounded-full px-2.5 py-1 text-sm ${
                          typeId === t.id
                            ? 'bg-brand-700 text-white'
                            : 'bg-stone-100 text-stone-700 hover:bg-brand-50'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <Spinner />
          )}
        </Card>
      </div>
    </>
  );
}
