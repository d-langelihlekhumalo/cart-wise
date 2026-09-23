// Session handling that keeps working offline.
//
// Better Auth's `useSession` needs the network. In the shop there often isn't any, so we keep
// the last known user in localStorage and fall back to it when the session request fails
// (as opposed to the server saying "signed out", which clears it).
import type { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { signOut, useSession } from './auth-client';
import { clearCachedPrefs } from './prefs';

export interface AppUser {
  id: string;
  name: string;
  email: string;
}

const KEY = 'cart-wise:user';

function readCachedUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AppUser | null): void {
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode): offline fallback just won't work.
  }
}

export function useAppSession(): { user: AppUser | null; isPending: boolean; offline: boolean } {
  const { data, isPending, error } = useSession();
  const serverUser = data
    ? { id: data.user.id, name: data.user.name, email: data.user.email }
    : null;

  useEffect(() => {
    // Only trust definitive answers from the server; a network error keeps the cache.
    if (isPending || error) return;
    writeCachedUser(serverUser);
  }, [isPending, error, serverUser?.id, serverUser?.name, serverUser?.email]); // eslint-disable-line react-hooks/exhaustive-deps -- serverUser is rebuilt every render; its fields are the real deps

  if (serverUser) return { user: serverUser, isPending: false, offline: false };
  if (isPending) return { user: null, isPending: true, offline: false };
  if (error) return { user: readCachedUser(), isPending: false, offline: true };
  return { user: null, isPending: false, offline: false };
}

/**
 * Signs out and removes everything this device holds for the user (POPIA; shared phones).
 * Returns false if the user chose to stay signed in to keep unsynced changes.
 */
export async function signOutAndForget(queryClient: QueryClient): Promise<boolean> {
  const { flushPendingChanges } = await import('../features/lists/sync');
  const unsynced = await flushPendingChanges();
  if (
    unsynced > 0 &&
    !window.confirm(
      `${unsynced} change${unsynced === 1 ? " hasn't" : "s haven't"} synced yet and will be lost if you sign out now. Sign out anyway?`,
    )
  ) {
    return false;
  }
  await signOut();
  await forgetLocalData(queryClient);
  return true;
}

/** Clears caches and the local database without calling the server (e.g. after deletion). */
export async function forgetLocalData(queryClient: QueryClient): Promise<void> {
  const { discardLocalData } = await import('../features/lists/sync');
  writeCachedUser(null);
  clearCachedPrefs();
  queryClient.clear();
  await discardLocalData();
}
