import { formatSize, type Product } from '@cart-wise/shared';

export function productLabel(p: Product): string {
  return [p.brand, p.name].filter(Boolean).join(' ');
}

/** One product in a list: brand + name, with size and a store-brand marker. */
export function ProductSummary({ product }: { product: Product }) {
  const size = formatSize(product);
  return (
    <span className="min-w-0">
      <span className="block truncate font-medium">{productLabel(product)}</span>
      <span className="flex items-center gap-2 text-xs text-stone-500">
        {size && <span>{size}</span>}
        {product.isStoreBrand && (
          <span className="rounded bg-stone-100 px-1.5 py-0.5 font-medium">Store brand</span>
        )}
      </span>
    </span>
  );
}
