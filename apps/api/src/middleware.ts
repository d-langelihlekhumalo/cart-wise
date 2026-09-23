import { schema } from '@cart-wise/db';
import { drizzle } from 'drizzle-orm/d1';
import { createMiddleware } from 'hono/factory';
import { createAuth } from './lib/auth';
import { ApiHttpError } from './lib/errors';
import type { AppEnv } from './types';

/** Per-request auth + DB handles. */
export const services = createMiddleware<AppEnv>(async (c, next) => {
  c.set('auth', createAuth(c.env));
  c.set('db', drizzle(c.env.DB, { schema }));
  await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new ApiHttpError(401, 'unauthenticated', 'Sign in required');
  c.set('user', session.user);
  await next();
});
