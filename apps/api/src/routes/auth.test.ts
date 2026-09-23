import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { api, authed, signUp } from '../../test/helpers';

describe('auth', () => {
  it('signs up, reads the session, signs out', async () => {
    const { cookie, email } = await signUp();

    const session = await authed(cookie, '/auth/get-session');
    expect(session.status).toBe(200);
    const body: { user: { email: string; trust: string; id: string } } = await session.json();
    expect(body.user.email).toBe(email);
    expect(body.user.trust).toBe('new');
    expect(body.user.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID

    const out = await authed(cookie, '/auth/sign-out', { method: 'POST', body: '{}' });
    expect(out.status).toBe(200);
    const after = await authed(cookie, '/auth/get-session');
    expect(await after.json()).toBeNull();
  });

  it('signs in with the right password only', async () => {
    const { email } = await signUp();
    const bad = await api('/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'wrong-password' }),
    });
    expect(bad.status).toBe(401);

    const good = await api('/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'correct-horse-battery' }),
    });
    expect(good.status).toBe(200);
  });

  it('does not let users set their own trust level', async () => {
    const email = `sneaky-${Date.now()}@example.com`;
    const res = await api('/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sneaky',
        email,
        password: 'correct-horse-battery',
        trust: 'admin',
      }),
    });
    // Better Auth either rejects the field or ignores it; either way the user must stay `new`.
    if (res.ok) {
      const row = await env.DB.prepare('SELECT trust FROM user WHERE email = ?')
        .bind(email)
        .first<{ trust: string }>();
      expect(row?.trust).toBe('new');
    }
  });
});
