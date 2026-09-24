import { useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../components/Layout';
import { PrefsForm } from '../components/PrefsForm';
import { LoyaltyCardsCard, MyStoresCard } from '../components/ShoppingSetup';
import { Alert, Button, Card, Spinner, TextField } from '../components/ui';
import { apiRequest } from '../lib/api';
import { usePrefs } from '../lib/prefs';
import { forgetLocalData, signOutAndForget, useAppSession } from '../lib/session';

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
  const { user } = useAppSession();
  const { data: prefs, isPending } = usePrefs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  if (isPending || !user) return <Spinner />;

  async function onSignOut() {
    if (await signOutAndForget(queryClient)) void navigate('/login', { replace: true });
  }

  return (
    <>
      <PageHeader title="Settings" description="Your region, stores, loyalty cards and account." />

      <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <Card className="space-y-4 lg:p-6">
            <div>
              <h2 className="font-semibold">Shopping preferences</h2>
              <p className="text-sm text-stone-600">Used to pick prices and plan your shop.</p>
            </div>
            <PrefsForm initial={prefs ?? null} mode="settings" submitLabel="Save changes" />
          </Card>
          <MyStoresCard />
          <LoyaltyCardsCard />
        </div>

        <div className="space-y-4 lg:space-y-6">
          <Card className="space-y-3">
            <h2 className="font-semibold">Account</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-stone-500">Name</dt>
                <dd className="font-medium">{user.name}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Email</dt>
                <dd className="font-medium break-all">{user.email}</dd>
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
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiRequest('/me', { method: 'DELETE' });
      await forgetLocalData(queryClient);
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
