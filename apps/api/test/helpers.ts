import { env } from 'cloudflare:workers';
import app from '../src/index';

const ORIGIN = env.BETTER_AUTH_URL;

export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('origin', ORIGIN);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return app.request(`/api${path}`, { ...init, headers }, env);
}

let counter = 0;

/** Signs up a fresh user and returns the session cookie for authenticated requests. */
export async function signUp(): Promise<{ cookie: string; email: string; userId: string }> {
  counter += 1;
  const email = `user${counter}-${Date.now()}@example.com`;
  const res = await api('/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test User', email, password: 'correct-horse-battery' }),
  });
  if (!res.ok) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const body: { user: { id: string } } = await res.json();
  return { cookie, email, userId: body.user.id };
}

export function authed(cookie: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('cookie', cookie);
  return api(path, { ...init, headers });
}
