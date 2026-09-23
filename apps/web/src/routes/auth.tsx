import { type ReactNode, type SubmitEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert, Button, TextField } from '../components/ui';
import { signIn, signUp } from '../lib/auth-client';

function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/** Only allow same-app relative redirects (no `//evil.example`). */
function safeNext(next: string | null): string {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await signIn.email({
      email: formText(form, 'email'),
      password: formText(form, 'password'),
    });
    setPending(false);
    if (error) {
      setError(error.message ?? 'Could not sign in');
      return;
    }
    void navigate(safeNext(params.get('next')), { replace: true });
  }

  return (
    <AuthCard title="Sign in">
      {params.has('deleted') && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Your account and data have been deleted.
        </p>
      )}
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="text-center text-sm text-stone-600">
        New here?{' '}
        <Link to="/signup" className="font-medium text-brand-700 underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await signUp.email({
      name: formText(form, 'name'),
      email: formText(form, 'email'),
      password: formText(form, 'password'),
    });
    setPending(false);
    if (error) {
      setError(error.message ?? 'Could not create your account');
      return;
    }
    void navigate('/onboarding', { replace: true });
  }

  return (
    <AuthCard title="Create your account" eyebrow="Step 1 of 2">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <TextField label="Name" name="name" autoComplete="given-name" required maxLength={100} />
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          hint="At least 8 characters."
          required
        />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="text-center text-sm text-stone-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-700 underline">
          Sign in
        </Link>
      </p>
      <p className="text-center text-xs text-stone-500">
        By signing up you agree to our{' '}
        <Link to="/privacy" className="underline">
          privacy policy
        </Link>
        .
      </p>
    </AuthCard>
  );
}

function AuthCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {eyebrow && <p className="text-sm font-medium text-brand-700">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold lg:text-3xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
