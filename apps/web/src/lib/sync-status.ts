// Tiny observable for sync status. Lives in the main bundle (no Dexie) so the header and
// sidebar can show it; the lazily-loaded sync engine writes to it.
import { useSyncExternalStore } from 'react';

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  /** Local changes not yet accepted by the server. */
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
}

let state: SyncStatus = {
  phase: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle',
  pending: 0,
  lastSyncedAt: null,
  error: null,
};
const listeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return state;
}

export function setSyncStatus(patch: Partial<SyncStatus>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSyncStatus, getSyncStatus);
}
