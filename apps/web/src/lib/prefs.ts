import {
  type PrefsResponse,
  prefsResponseSchema,
  type UserPrefs,
  userPrefsSchema,
} from '@cart-wise/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod/mini';
import { ApiRequestError, apiJson } from './api';

export const prefsQueryKey = ['me', 'prefs'] as const;

// Last known prefs, so the app still opens offline.
const KEY = 'cart-wise:prefs';

function readCachedPrefs(): UserPrefs | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = z.safeParse(userPrefsSchema, JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCachedPrefs(prefs: UserPrefs | null): void {
  try {
    if (prefs) localStorage.setItem(KEY, JSON.stringify(prefs));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: offline fallback just won't work.
  }
}

export function clearCachedPrefs(): void {
  writeCachedPrefs(null);
}

async function fetchPrefs(): Promise<PrefsResponse> {
  try {
    const data = await apiJson('/me/prefs', prefsResponseSchema);
    writeCachedPrefs(data.prefs);
    return data;
  } catch (err) {
    const cached = readCachedPrefs();
    if (err instanceof ApiRequestError && err.code === 'network_error' && cached) {
      return { prefs: cached };
    }
    throw err;
  }
}

export function usePrefs() {
  return useQuery({
    queryKey: prefsQueryKey,
    queryFn: fetchPrefs,
    select: (data) => data.prefs,
  });
}

export function useSavePrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: UserPrefs) =>
      apiJson('/me/prefs', prefsResponseSchema, { method: 'PUT', body: JSON.stringify(prefs) }),
    onSuccess: (data) => {
      writeCachedPrefs(data.prefs);
      queryClient.setQueryData(prefsQueryKey, data);
    },
  });
}
