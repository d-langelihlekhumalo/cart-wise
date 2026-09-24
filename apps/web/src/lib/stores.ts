import {
  type CreateStore,
  type LoyaltyProgramId,
  loyaltyCardsSchema,
  type Store,
  storeSchema,
  storesResponseSchema,
} from '@cart-wise/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod/mini';
import { apiJson } from './api';

const myStoresKey = ['me', 'stores'] as const;
const regionStoresKey = ['stores'] as const;
const cardsKey = ['me', 'loyalty-cards'] as const;

export function useMyStores() {
  return useQuery({
    queryKey: myStoresKey,
    queryFn: () => apiJson('/me/stores', storesResponseSchema),
    select: (d) => d.stores,
  });
}

export function useSaveMyStores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storeIds: string[]) =>
      apiJson('/me/stores', storesResponseSchema, {
        method: 'PUT',
        body: JSON.stringify({ storeIds }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(myStoresKey, data);
    },
  });
}

/** All known stores in the user's region, to pick from before adding a new one. */
export function useRegionStores(enabled = true) {
  return useQuery({
    queryKey: regionStoresKey,
    queryFn: () => apiJson('/stores', storesResponseSchema),
    select: (d) => d.stores,
    enabled,
  });
}

export function useCreateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStore) =>
      apiJson('/stores', z.object({ store: storeSchema }), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: regionStoresKey });
    },
  });
}

/** Adds a store to "my stores" (creating it first if needed). */
export function useAddMyStore() {
  const create = useCreateStore();
  const save = useSaveMyStores();
  const { data: mine } = useMyStores();
  return {
    isPending: create.isPending || save.isPending,
    error: create.error ?? save.error,
    async add(input: { existing: Store } | { create: CreateStore }): Promise<void> {
      const store =
        'existing' in input ? input.existing : (await create.mutateAsync(input.create)).store;
      const ids = new Set((mine ?? []).map((s) => s.id));
      ids.add(store.id);
      await save.mutateAsync([...ids]);
    },
  };
}

export function useLoyaltyCards() {
  return useQuery({
    queryKey: cardsKey,
    queryFn: () => apiJson('/me/loyalty-cards', loyaltyCardsSchema),
    select: (d) => d.programs,
  });
}

/** Optimistic: the checkbox updates immediately and rolls back if the save fails. */
export function useSaveLoyaltyCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (programs: LoyaltyProgramId[]) =>
      apiJson('/me/loyalty-cards', loyaltyCardsSchema, {
        method: 'PUT',
        body: JSON.stringify({ programs }),
      }),
    onMutate: async (programs) => {
      await qc.cancelQueries({ queryKey: cardsKey });
      const previous = qc.getQueryData<{ programs: LoyaltyProgramId[] }>(cardsKey);
      qc.setQueryData(cardsKey, { programs });
      return { previous };
    },
    onError: (_err, _programs, context) => {
      if (context?.previous) qc.setQueryData(cardsKey, context.previous);
    },
    onSuccess: (data) => {
      qc.setQueryData(cardsKey, data);
    },
  });
}
