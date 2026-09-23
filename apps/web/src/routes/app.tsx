import { formatZAR, regionName } from '@cart-wise/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CheckIcon, ListIcon } from '../components/icons';
import { PageHeader } from '../components/Layout';
import { PrefsForm } from '../components/PrefsForm';
import { Alert, Button, Card, Spinner, TextField } from '../components/ui';
import { apiRequest } from '../lib/api';
import { signOut, useSession } from '../lib/auth-client';
import { usePrefs } from '../lib/prefs';

export function HomePage() {
  const { data: session } = useSession();
  const { data: prefs } = usePrefs();
  if (!session || !prefs) return <Spinner />;

  const setupSteps = [
    { label: 'Create your account', done: true },
    { label: 'Choose your province', done: true },
    { label: 'Set a monthly budget', done: prefs.budgetCents !== null, to: '/settings' },
    { label: 'Make your first shopping list', done: false, soon: true },
    { label: 'Add your loyalty cards', done: false, soon: true },
  ];

  return (
    <>
      <PageHeader
        title={`Hi ${session.user.name}`}
        description="Here's where your shopping stands."
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="flex min-h-72 flex-col lg:col-span-2 lg:row-span-2">
          <h2 className="font-semibold">Your shopping lists</h2>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <ListIcon className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">No lists yet</p>
              <p className="max-w-sm text-sm text-stone-600">
                Soon you&apos;ll build lists here, see which store is cheapest, and tick items off
                in the shop, even offline.
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your setup</h2>
            <Link to="/settings" className="text-sm font-medium text-brand-700 hover:underline">
              Edit
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Province" value={regionName(prefs.regionId)} />
            <Stat
              label="Monthly budget"
              value={prefs.budgetCents === null ? 'Not set' : formatZAR(prefs.budgetCents)}
              muted={prefs.budgetCents === null}
            />
            <Stat label="Split shops when saving" value={formatZAR(prefs.splitThresholdCents)} />
            <Stat label="Loyalty cards" value="Coming soon" muted />
          </dl>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">Getting started</h2>
          <ol className="space-y-2 text-sm">
            {setupSteps.map((step) => (
              <li key={step.label} className="flex items-center gap-3">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                    step.done ? 'bg-brand-600 text-white' : 'ring-1 ring-stone-300'
                  }`}
                >
                  {step.done && <CheckIcon className="size-4" />}
                </span>
                {step.to && !step.done ? (
                  <Link to={step.to} className="font-medium text-brand-700 hover:underline">
                    {step.label}
                  </Link>
                ) : (
                  <span className={step.done ? 'text-stone-500 line-through' : ''}>
                    {step.label}
                  </span>
                )}
                {step.soon && (
                  <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                    Soon
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className={`mt-0.5 font-medium ${muted ? 'text-stone-400' : ''}`}>{value}</dd>
    </div>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { data: prefs, isPending } = usePrefs();
  if (isPending) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-brand-700">Step 2 of 2</p>
        <h1 className="text-2xl font-semibold lg:text-3xl">Where do you shop?</h1>
        <p className="text-stone-600">
          Store pamphlets and prices are regional. You can change this later in settings.
        </p>
      </div>
      <PrefsForm
        initial={prefs ?? null}
        mode="onboarding"
        submitLabel="Continue"
        onSaved={() => void navigate('/', { replace: true })}
      />
    </div>
  );
}

export function SettingsPage() {
  const { data: session } = useSession();
  const { data: prefs, isPending } = usePrefs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  if (isPending || !session) return <Spinner />;

  async function onSignOut() {
    await signOut();
    queryClient.clear();
    void navigate('/login', { replace: true });
  }

  return (
    <>
      <PageHeader title="Settings" description="Your region, budget and account." />

      <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="space-y-4 lg:col-span-2 lg:p-6">
          <div>
            <h2 className="font-semibold">Shopping preferences</h2>
            <p className="text-sm text-stone-600">Used to pick prices and plan your shop.</p>
          </div>
          <PrefsForm initial={prefs ?? null} mode="settings" submitLabel="Save changes" />
        </Card>

        <div className="space-y-4 lg:space-y-6">
          <Card className="space-y-3">
            <h2 className="font-semibold">Account</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-stone-500">Name</dt>
                <dd className="font-medium">{session.user.name}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Email</dt>
                <dd className="font-medium break-all">{session.user.email}</dd>
              </div>
            </dl>
            <Button variant="secondary" className="w-full" onClick={() => void onSignOut()}>
              Sign out
            </Button>
            <Link to="/privacy" className="block text-center text-sm text-stone-500 underline">
              Privacy policy
            </Link>
          </Card>

          <DeleteAccount />
        </div>
      </div>
    </>
  );
}

const CONFIRM_WORD = 'DELETE';

function DeleteAccount() {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiRequest('/me', { method: 'DELETE' });
      // Full reload so every cached query and the session atom start from scratch.
      window.location.assign('/login?deleted=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account');
      setPending(false);
    }
  }

  return (
    <Card className="space-y-3 ring-red-200">
      <h2 className="font-semibold text-red-800">Delete account</h2>
      <p className="text-sm text-stone-600">
        Permanently deletes your account, preferences and lists. This can&apos;t be undone.
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <TextField
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={confirm}
          autoComplete="off"
          onChange={(e) => {
            setConfirm(e.target.value);
          }}
        />
        <Button
          type="submit"
          variant="danger"
          className="w-full"
          disabled={confirm !== CONFIRM_WORD || pending}
        >
          {pending ? 'Deleting…' : 'Delete my account'}
        </Button>
      </form>
    </Card>
  );
}
