import {
  type CreatePrice,
  type CreateProduct,
  priceSchema,
  productDetailResponseSchema,
  productSchema,
  productSearchResponseSchema,
} from '@cart-wise/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import * as z from 'zod/mini';
import { apiJson } from '../../lib/api';

export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(value);
    }, ms);
    return () => {
      clearTimeout(t);
    };
  }, [value, ms]);
  return debounced;
}

export function useProductSearch(q: string, typeId?: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ['products', 'search', query, typeId ?? null],
    queryFn: () => {
      const params = new URLSearchParams({ q: query, limit: '20' });
      if (typeId) params.set('type', typeId);
      return apiJson(`/products/search?${params}`, productSearchResponseSchema);
    },
    select: (d) => d.products,
    enabled: query.length >= 2 || Boolean(typeId),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () =>
      apiJson(`/products/${encodeURIComponent(id ?? '')}`, productDetailResponseSchema),
    enabled: Boolean(id),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProduct) =>
      apiJson('/products', z.object({ product: productSchema }), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products', 'search'] });
    },
  });
}

export function useLogPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePrice) =>
      apiJson('/prices', z.object({ price: priceSchema }), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['products', input.productId] });
    },
  });
}
