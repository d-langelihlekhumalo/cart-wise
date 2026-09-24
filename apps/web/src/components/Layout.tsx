import { type ComponentType, type ReactNode, type SVGProps, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { signOutAndForget, useAppSession } from '../lib/session';
import {
  HomeIcon,
  ListIcon,
  LogOutIcon,
  OfflineIcon,
  PamphletIcon,
  SettingsIcon,
  SplitIcon,
  TagIcon,
} from './icons';
import { SyncIndicator, SyncPill } from './SyncIndicator';

function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 text-lg font-semibold ${className}`}>
      <img src="/icon.svg" alt="" className="size-8" />
      Cart Wise
    </Link>
  );
}

function Footer({ className = '' }: { className?: string }) {
  return (
    <footer className={`text-xs text-stone-500 ${className}`}>
      <Link to="/privacy" className="underline hover:text-stone-700">
        Privacy
      </Link>
    </footer>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Signed-out + onboarding: brand panel beside the form on large screens.                      */
/* ------------------------------------------------------------------------------------------ */

const valueProps = [
  {
    icon: PamphletIcon,
    title: 'Pamphlet specials, sorted',
    body: 'Snap a Checkers, Pick n Pay or Spar pamphlet and we pull out the deals.',
  },
  {
    icon: SplitIcon,
    title: 'One shop or two?',
    body: 'See your cheapest store, and when a two-store split is worth the trip.',
  },
  {
    icon: OfflineIcon,
    title: 'Works without data',
    body: 'Your checklist keeps working in the aisle, even with no signal.',
  },
];

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col">
        <Logo className="text-white" />
        <div className="my-auto max-w-md space-y-10">
          <div className="space-y-4">
            <h2 className="text-4xl leading-tight font-semibold">
              Know where your groceries are cheapest.
            </h2>
            <p className="text-lg text-brand-100">
              Build your list once. We compare store specials and loyalty prices across South
              Africa&apos;s supermarkets for you.
            </p>
          </div>
          <ul className="space-y-6">
            {valueProps.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-brand-100">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-brand-100/80">Prices in rand, VAT inclusive.</p>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-brand-600/30"
        />
      </aside>

      <div className="flex flex-col px-4 py-6 sm:px-8">
        <Logo className="text-brand-800 lg:hidden" />
        <main className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
        <Footer className="text-center" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Signed-in app: sidebar on large screens, top bar + bottom tabs on phones.                   */
/* ------------------------------------------------------------------------------------------ */

interface NavEntry {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Not built yet; shown so the roadmap is visible, but not clickable. */
  soon?: boolean;
}

const navEntries: NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/lists', label: 'Lists', icon: ListIcon },
  { to: '/prices', label: 'Prices', icon: TagIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function AppLayout() {
  const { user } = useAppSession();
  const userId = user?.id;

  // Open the local database and start background sync. Loaded lazily to keep Dexie out of
  // the initial bundle.
  useEffect(() => {
    if (!userId) return;
    void import('../features/lists/sync').then((m) => m.startSync(userId));
  }, [userId]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Sidebar />

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo className="text-brand-800" />
        <SyncPill />
      </header>

      <div className="flex min-h-dvh flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-10">
          <Outlet />
        </main>
        <Footer className="hidden px-10 pb-6 lg:block" />
      </div>

      <BottomNav />
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-stone-200 bg-white px-4 py-6 lg:flex">
      <Logo className="px-2 text-brand-800" />
      <nav className="mt-8 flex-1 space-y-1" aria-label="Main">
        {navEntries.map((entry) => (
          <SidebarItem key={entry.to} entry={entry} />
        ))}
      </nav>
      <SyncIndicator className="mb-4" />
      <AccountBlock />
    </aside>
  );
}

function SidebarItem({ entry }: { entry: NavEntry }) {
  const { icon: Icon, label, soon } = entry;
  if (soon) {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-stone-400"
      >
        <Icon />
        {label}
        <SoonBadge />
      </span>
    );
  }
  return (
    <NavLink
      to={entry.to}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-colors ${
          isActive ? 'bg-brand-50 text-brand-800' : 'text-stone-600 hover:bg-stone-100'
        }`
      }
    >
      <Icon />
      {label}
    </NavLink>
  );
}

function SoonBadge() {
  return (
    <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
      Soon
    </span>
  );
}

function AccountBlock() {
  const { user } = useAppSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  if (!user) return null;

  async function onSignOut() {
    if (await signOutAndForget(queryClient)) void navigate('/login', { replace: true });
  }

  const initial = user.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="flex items-center gap-3 border-t border-stone-200 px-2 pt-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-stone-500">{user.email}</p>
      </div>
      <button
        type="button"
        onClick={() => void onSignOut()}
        className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        title="Sign out"
      >
        <LogOutIcon />
        <span className="sr-only">Sign out</span>
      </button>
    </div>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {navEntries.map(({ to, label, icon: Icon, soon }) =>
        soon ? (
          <span
            key={to}
            aria-disabled="true"
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-stone-300"
          >
            <Icon />
            {label}
          </span>
        ) : (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive ? 'text-brand-700' : 'text-stone-500'
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ),
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Public pages (privacy, 404): full-width header, readable content column.                   */
/* ------------------------------------------------------------------------------------------ */

export function PublicLayout() {
  const { user } = useAppSession();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
          <Logo className="text-brand-800" />
          <Link
            to={user ? '/' : '/login'}
            className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            {user ? 'Open app' : 'Sign in'}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-10">
        <Outlet />
      </main>
      <Footer className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-10" />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold lg:text-3xl">{title}</h1>
        {description && <p className="text-stone-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
