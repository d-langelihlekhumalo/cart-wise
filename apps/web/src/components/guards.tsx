import { Navigate, Outlet, useLocation } from 'react-router';
import { useAppSession } from '../lib/session';
import { usePrefs } from '../lib/prefs';
import { Alert, Spinner } from './ui';

/** Renders child routes only for signed-in users; otherwise redirects to /login. */
export function RequireAuth() {
  const { user, isPending } = useAppSession();
  const location = useLocation();
  if (isPending) return <Spinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/** Sends users who haven't picked a region yet to onboarding. */
export function RequireOnboarded() {
  const prefs = usePrefs();
  if (prefs.isPending) return <Spinner />;
  if (prefs.isError) return <Alert>{prefs.error.message}</Alert>;
  if (!prefs.data) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** For /login and /signup: signed-in users go straight to the app. */
export function RedirectIfSignedIn() {
  const { user, isPending } = useAppSession();
  if (isPending) return <Spinner />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
