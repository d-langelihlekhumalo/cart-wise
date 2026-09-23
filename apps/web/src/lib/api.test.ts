import { afterEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod/mini';
import { ApiRequestError, apiJson, apiRequest } from './api';

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('maps API error bodies to ApiRequestError', async () => {
    mockFetch(() =>
      Promise.resolve(
        Response.json(
          {
            error: {
              code: 'invalid_request',
              message: 'Request validation failed',
              issues: [{ path: 'regionId', message: 'Invalid option' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const err = await apiRequest('/me/prefs').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({
      status: 400,
      code: 'invalid_request',
      issues: [{ path: 'regionId', message: 'Invalid option' }],
    });
  });

  it('handles non-JSON error bodies', async () => {
    mockFetch(() => Promise.resolve(new Response('Bad gateway', { status: 502 })));
    await expect(apiRequest('/health')).rejects.toMatchObject({ status: 502, code: 'http_error' });
  });

  it('turns network failures into a friendly error', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(apiRequest('/health')).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    });
  });

  it('sends JSON bodies with a content type', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/me', { method: 'PUT', body: '{}' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/me');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });
});

describe('apiJson', () => {
  it('parses successful responses with the schema', async () => {
    mockFetch(() => Promise.resolve(Response.json({ ok: true })));
    await expect(apiJson('/health', z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
  });

  it('rejects responses that do not match the schema', async () => {
    mockFetch(() => Promise.resolve(Response.json({ ok: 'yes' })));
    await expect(apiJson('/health', z.object({ ok: z.boolean() }))).rejects.toThrow();
  });
});
