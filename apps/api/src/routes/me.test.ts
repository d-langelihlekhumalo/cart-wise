import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { api, authed, signUp } from '../../test/helpers';

const validPrefs = { regionId: 'gauteng', budgetCents: 80_000, splitThresholdCents: 5_000 };

describe('/api/me/prefs', () => {
  it('requires a session', async () => {
    const res = await api('/me/prefs');
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('is null before onboarding, then upserts', async () => {
    const { cookie } = await signUp();
    expect(await (await authed(cookie, '/me/prefs')).json()).toEqual({ prefs: null });

    const put = await authed(cookie, '/me/prefs', {
      method: 'PUT',
      body: JSON.stringify(validPrefs),
    });
    expect(put.status).toBe(200);

    const updated = { ...validPrefs, regionId: 'western-cape', budgetCents: null };
    await authed(cookie, '/me/prefs', { method: 'PUT', body: JSON.stringify(updated) });
    expect(await (await authed(cookie, '/me/prefs')).json()).toEqual({ prefs: updated });
  });

  it.each([
    ['unknown region', { ...validPrefs, regionId: 'atlantis' }],
    ['fractional cents', { ...validPrefs, budgetCents: 12.5 }],
    ['negative threshold', { ...validPrefs, splitThresholdCents: -1 }],
    ['absurd budget', { ...validPrefs, budgetCents: 10_000_001 }],
    ['missing field', { regionId: 'gauteng' }],
  ])('rejects %s', async (_label, prefs) => {
    const { cookie } = await signUp();
    const res = await authed(cookie, '/me/prefs', { method: 'PUT', body: JSON.stringify(prefs) });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_request' } });
  });

  it('explains validation failures per field', async () => {
    const { cookie } = await signUp();
    const res = await authed(cookie, '/me/prefs', {
      method: 'PUT',
      body: JSON.stringify({ ...validPrefs, regionId: 'atlantis' }),
    });
    const body: { error: { issues: { path: string; message: string }[] } } = await res.json();
    expect(body.error.issues).toEqual([
      { path: 'regionId', message: expect.stringContaining('expected one of') as string },
    ]);
  });

  it('rejects malformed JSON', async () => {
    const { cookie } = await signUp();
    const res = await authed(cookie, '/me/prefs', { method: 'PUT', body: '{nope' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_json' } });
  });
});

describe('DELETE /api/me', () => {
  it('removes the user and all their data', async () => {
    const { cookie, userId } = await signUp();
    await authed(cookie, '/me/prefs', { method: 'PUT', body: JSON.stringify(validPrefs) });

    const res = await authed(cookie, '/me', { method: 'DELETE' });
    expect(res.status).toBe(204);

    for (const table of ['user_prefs', 'session', 'account']) {
      const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id = ?`)
        .bind(userId)
        .first<{ n: number }>();
      expect(row?.n, table).toBe(0);
    }
    const user = await env.DB.prepare('SELECT id FROM user WHERE id = ?').bind(userId).first();
    expect(user).toBeNull();

    expect((await authed(cookie, '/me/prefs')).status).toBe(401);
  });
});
