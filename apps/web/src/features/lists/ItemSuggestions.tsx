import { formatSize, type Product, type ProductType } from '@cart-wise/shared';
import { TagIcon } from '../../components/icons';
import { type CatalogueIndex, matchProductTypes } from '../../lib/catalogue';
import { useDebounced, useProductSearch } from '../prices/api';
import { productLabel } from '../prices/ProductRow';
import type { ItemLink } from './store';

export interface Suggestion {
  text: string;
  link: ItemLink;
}

/**
 * Suggestions while typing a list item: product types ("any white bread", works offline from
 * the cached catalogue) and exact products (from search, when online).
 */
export function ItemSuggestions({
  text,
  catalogue,
  onPick,
}: {
  text: string;
  catalogue: CatalogueIndex | undefined;
  onPick: (s: Suggestion) => void;
}) {
  const debounced = useDebounced(text, 300);
  const { data: products } = useProductSearch(debounced);
  const types = catalogue ? matchProductTypes(catalogue, text, 4) : [];
  const exact = (products ?? []).slice(0, 5);
  if (text.trim().length < 2 || (types.length === 0 && exact.length === 0)) return null;

  return (
    <div
      role="listbox"
      aria-label="Suggestions"
      className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-stone-200"
    >
      {types.length > 0 && <GroupLabel>Any brand</GroupLabel>}
      {types.map((t) => (
        <Option
          key={t.id}
          onPick={() => {
            onPick(typeSuggestion(t));
          }}
          primary={t.name}
          secondary={catalogue?.categoryById.get(t.categoryId)?.name}
        />
      ))}
      {exact.length > 0 && <GroupLabel>Exact product</GroupLabel>}
      {exact.map((p) => (
        <Option
          key={p.id}
          onPick={() => {
            onPick(productSuggestion(p));
          }}
          primary={productLabel(p)}
          secondary={formatSize(p)}
          icon
        />
      ))}
    </div>
  );
}

export function typeSuggestion(t: ProductType): Suggestion {
  return { text: t.name, link: { productTypeId: t.id, productId: null } };
}

export function productSuggestion(p: Product): Suggestion {
  const size = formatSize(p);
  return {
    text: [productLabel(p), size].filter(Boolean).join(' '),
    link: { productTypeId: p.productTypeId, productId: p.id },
  };
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
      {children}
    </p>
  );
}

function Option({
  primary,
  secondary,
  icon = false,
  onPick,
}: {
  primary: string;
  secondary?: string | undefined;
  icon?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected="false"
      onClick={onPick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-brand-50"
    >
      {icon && <TagIcon className="size-4 shrink-0 text-stone-400" />}
      <span className="min-w-0 flex-1 truncate">{primary}</span>
      {secondary && <span className="shrink-0 text-xs text-stone-500">{secondary}</span>}
    </button>
  );
}
