import { prefsResponseSchema, type UserPrefs } from '@cart-wise/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiJson } from './api';

export const prefsQueryKey = ['me', 'prefs'] as const;

export function usePrefs() {
  return useQuery({
    queryKey: prefsQueryKey,
    queryFn: () => apiJson('/me/prefs', prefsResponseSchema),
    select: (data) => data.prefs,
  });
}

export function useSavePrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: UserPrefs) =>
      apiJson('/me/prefs', prefsResponseSchema, { method: 'PUT', body: JSON.stringify(prefs) }),
    onSuccess: (data) => {
      queryClient.setQueryData(prefsQueryKey, data);
    },
  });
}
