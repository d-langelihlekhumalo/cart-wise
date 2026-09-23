import { apiErrorSchema } from '@cart-wise/shared';
import * as z from 'zod/mini';
import type { $ZodType } from 'zod/v4/core';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Fetches `/api{path}`, throwing `ApiRequestError` for non-2xx responses. */
export async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('content-type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiRequestError(0, 'network_error', "Can't reach the server. Check your connection.");
  }
  if (res.ok) return res;

  const parsed = apiErrorSchema.safeParse(await res.json().catch(() => null));
  if (parsed.success) {
    const { code, message, issues } = parsed.data.error;
    throw new ApiRequestError(res.status, code, message, issues);
  }
  throw new ApiRequestError(res.status, 'http_error', `Request failed (${res.status})`);
}

/** Like `apiRequest`, but parses the JSON body with `schema`. */
export async function apiJson<T extends $ZodType>(
  path: string,
  schema: T,
  init: RequestInit = {},
): Promise<z.output<T>> {
  const res = await apiRequest(path, init);
  return z.parse(schema, await res.json());
}
