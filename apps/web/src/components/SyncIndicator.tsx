import { type SyncStatus, useSyncStatus } from '../lib/sync-status';
import { CloudCheckIcon, OfflineIcon, RefreshIcon } from './icons';

function describe(status: SyncStatus): {
  label: string;
  tone: string;
  detail?: string | undefined;
} {
  const waiting = status.pending === 1 ? '1 change' : `${status.pending} changes`;
  switch (status.phase) {
    case 'offline':
      return {
        label: 'Offline',
        tone: 'text-amber-800 bg-amber-50 ring-amber-200',
        detail: status.pending
          ? `${waiting} saved on this device. They'll sync when you're back online.`
          : "You can keep using your lists. We'll sync when you're back online.",
      };
    case 'syncing':
      return { label: 'Syncing…', tone: 'text-stone-600 bg-stone-50 ring-stone-200' };
    case 'error':
      return {
        label: "Couldn't sync",
        tone: 'text-red-800 bg-red-50 ring-red-200',
        detail: status.error ?? undefined,
      };
    case 'idle':
      return status.pending
        ? { label: `${waiting} waiting`, tone: 'text-stone-600 bg-stone-50 ring-stone-200' }
        : { label: 'All changes saved', tone: 'text-brand-800 bg-brand-50 ring-brand-100' };
  }
}

function PhaseIcon({ phase }: { phase: SyncStatus['phase'] }) {
  if (phase === 'offline') return <OfflineIcon className="size-4" />;
  if (phase === 'syncing') return <RefreshIcon className="size-4 animate-spin" />;
  return <CloudCheckIcon className="size-4" />;
}

/** Full status card for the sidebar / list side panel. */
export function SyncIndicator({ className = '' }: { className?: string }) {
  const status = useSyncStatus();
  const { label, tone, detail } = describe(status);
  return (
    <div role="status" className={`rounded-lg px-3 py-2 text-sm ring-1 ${tone} ${className}`}>
      <p className="flex items-center gap-2 font-medium">
        <PhaseIcon phase={status.phase} />
        {label}
      </p>
      {detail && <p className="mt-1 text-xs opacity-90">{detail}</p>}
    </div>
  );
}

/** Compact pill for the mobile top bar. Hidden when everything is saved. */
export function SyncPill() {
  const status = useSyncStatus();
  if (status.phase === 'idle' && status.pending === 0) return null;
  const { label, tone } = describe(status);
  return (
    <span
      role="status"
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${tone}`}
    >
      <PhaseIcon phase={status.phase} />
      {label}
    </span>
  );
}
