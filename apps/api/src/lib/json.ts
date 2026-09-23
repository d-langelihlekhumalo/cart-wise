import type { Context } from 'hono';
import * as z from 'zod/mini';
import type { $ZodType } from 'zod/v4/core';
import { ApiHttpError } from './errors';

/** Parses the JSON body with `schema`; validation failures become 400s via the error handler. */
export async function parseJson<T extends $ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(400, 'invalid_json', 'Body must be valid JSON');
  }
  return z.parse(schema, body);
}
