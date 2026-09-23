import { REGIONS } from '@cart-wise/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { api } from '../test/helpers';

describe('api', () => {
  it('reports health', async () => {
    const res = await api('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await api('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it('seeds exactly the shared REGIONS', async () => {
    const { results } = await env.DB.prepare('SELECT id, name FROM regions ORDER BY id').all();
    const expected = [...REGIONS].sort((a, b) => a.id.localeCompare(b.id));
    expect(results).toEqual(expected);
  });
});
