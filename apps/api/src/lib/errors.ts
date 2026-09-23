import type { ApiError } from '@cart-wise/shared';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import * as z from 'zod/mini';
import { $ZodError } from 'zod/v4/core';

// zod/mini ships without messages; load English ones for validation errors.
z.config(z.locales.en());

export class ApiHttpError extends HTTPException {
  constructor(
    status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(status, { message });
  }
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof $ZodError) {
    const body: ApiError = {
      error: {
        code: 'invalid_request',
        message: 'Request validation failed',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
    return c.json(body, 400);
  }
  if (err instanceof HTTPException) {
    const code = err instanceof ApiHttpError ? err.code : 'http_error';
    const body: ApiError = { error: { code, message: err.message } };
    return c.json(body, err.status);
  }
  console.error({ event: 'unhandled_error', message: err.message, stack: err.stack });
  const body: ApiError = { error: { code: 'internal_error', message: 'Something went wrong' } };
  return c.json(body, 500);
};
