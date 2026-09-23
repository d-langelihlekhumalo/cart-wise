// Runtime wiring for offline lists: one local DB + sync engine per signed-in user, and the
// triggers that decide when to sync. Loaded lazily so Dexie stays out of the initial bundle.
import { Dexie } from 'dexie';
import { setSyncStatus } from '../../lib/sync-status';
import { type LocalDb, openLocalDb } from './db';
import { SyncEngine, SyncHttpError } from './engine';
import { ListStore } from './store';

const PERIODIC_SYNC_MS = 30_000;
const EDIT_DEBOUNCE_MS = 800;

interface Session {
  userId: string;
  db: LocalDb;
  engine: SyncEngine;
  store: ListStore;
  stop: () => void;
}

let session: Session | null = null;
let running: Promise<void> | null = null;
let rerun = false;
let debounce: ReturnType<typeof setTimeout> | undefined;

/** Whether `s` is still the active session (the user may sign out mid-sync). */
function isActive(s: Session): boolean {
  return session === s;
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

async function refreshPending(): Promise<void> {
  if (session) setSyncStatus({ pending: await session.engine.pendingCount() });
}

async function runSync(): Promise<void> {
  const current = session;
  if (!current) return;
  if (!isOnline()) {
    setSyncStatus({ phase: 'offline' });
    await refreshPending();
    return;
  }
  setSyncStatus({ phase: 'syncing', error: null });
  try {
    await current.engine.sync();
    if (isActive(current)) setSyncStatus({ phase: 'idle', lastSyncedAt: Date.now() });
  } catch (err) {
    if (!isActive(current)) return;
    if (err instanceof SyncHttpError) {
      const message =
        err.status === 401 ? 'Your session expired. Sign in again to sync.' : err.message;
      setSyncStatus({ phase: 'error', error: message });
    } else {
      // fetch() rejects on network failure, which is just "offline" as far as users care.
      setSyncStatus({ phase: 'offline' });
    }
  } finally {
    await refreshPending();
  }
}

/** Read through a function: `rerun` is set by other calls while we await. */
function rerunRequested(): boolean {
  return rerun;
}

/** Runs a sync now; concurrent calls coalesce into one follow-up run. */
export function syncNow(): Promise<void> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    do {
      rerun = false;
      await runSync();
    } while (rerunRequested());
  })().finally(() => {
    running = null;
  });
  return running;
}

function requestSync(): void {
  void refreshPending();
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    void syncNow();
  }, EDIT_DEBOUNCE_MS);
}

/** Opens the user's local DB and starts background sync. Safe to call repeatedly. */
export function startSync(userId: string): Session {
  if (session?.userId === userId) return session;
  session?.stop();

  const db = openLocalDb(userId);
  const engine = new SyncEngine(db, (input, init) => fetch(input, init));
  const store = new ListStore(db, requestSync);

  const onOnline = () => void syncNow();
  const onOffline = () => {
    setSyncStatus({ phase: 'offline' });
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, PERIODIC_SYNC_MS);

  session = {
    userId,
    db,
    engine,
    store,
    stop: () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
      clearTimeout(debounce);
      db.close();
    },
  };
  void syncNow();
  return session;
}

export function getSession(userId: string): Session {
  return startSync(userId);
}

/** Tries to push outstanding changes; returns how many are still unsynced. */
export async function flushPendingChanges(): Promise<number> {
  if (!session) return 0;
  await syncNow();
  return session.engine.pendingCount();
}

/** Stops syncing and deletes this user's local database (sign-out, account deletion). */
export async function discardLocalData(): Promise<void> {
  const current = session;
  session = null;
  setSyncStatus({ phase: 'idle', pending: 0, lastSyncedAt: null, error: null });
  if (!current) return;
  current.stop();
  await Dexie.delete(current.db.name);
}
