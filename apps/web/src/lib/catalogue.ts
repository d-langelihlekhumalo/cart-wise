import {
  type CatalogueResponse,
  catalogueResponseSchema,
  type Category,
  type Chain,
  type ProductType,
} from '@cart-wise/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import * as z from 'zod/mini';
import { ApiRequestError, apiJson } from './api';

// Chains + category/product-type taxonomy. Small and rarely changing, so it's cached in
// localStorage too: aisle grouping and item suggestions keep working offline.

const KEY = 'cart-wise:catalogue';

function readCached(): CatalogueResponse | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const parsed = z.safeParse(catalogueResponseSchema, JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function fetchCatalogue(): Promise<CatalogueResponse> {
  try {
    const data = await apiJson('/catalogue', catalogueResponseSchema);
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable; the in-memory copy still works.
    }
    return data;
  } catch (err) {
    const cached = readCached();
    if (err instanceof ApiRequestError && err.code === 'network_error' && cached) return cached;
    throw err;
  }
}

export interface CatalogueIndex {
  chains: Chain[];
  categories: Category[];
  chainById: Map<string, Chain>;
  typeById: Map<string, ProductType>;
  categoryById: Map<string, Category>;
}

export function useCatalogue(): { catalogue: CatalogueIndex | undefined; isError: boolean } {
  const query = useQuery({
    queryKey: ['catalogue'],
    queryFn: fetchCatalogue,
    staleTime: 60 * 60_000,
    initialData: readCached,
    initialDataUpdatedAt: 0,
  });
  const catalogue = useMemo(() => {
    const data = query.data;
    if (!data) return undefined;
    return {
      chains: data.chains,
      categories: data.categories,
      chainById: new Map(data.chains.map((c) => [c.id, c])),
      typeById: new Map(data.categories.flatMap((c) => c.types.map((t) => [t.id, t] as const))),
      categoryById: new Map(data.categories.map((c) => [c.id, c])),
    };
  }, [query.data]);
  return { catalogue, isError: query.isError };
}

/** Product types whose name matches the text, best matches first (for list suggestions). */
export function matchProductTypes(
  catalogue: CatalogueIndex,
  text: string,
  limit = 5,
): ProductType[] {
  const q = text.trim().toLowerCase();
  if (q.length < 2) return [];
  const scored: { type: ProductType; score: number }[] = [];
  for (const type of catalogue.typeById.values()) {
    const name = type.name.toLowerCase();
    const score =
      name === q ? 3 : name.startsWith(q) ? 2 : name.includes(q) || q.includes(name) ? 1 : 0;
    if (score) scored.push({ type, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.type.name.localeCompare(b.type.name))
    .slice(0, limit)
    .map((s) => s.type);
}
