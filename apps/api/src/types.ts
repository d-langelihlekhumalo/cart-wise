import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { schema } from '@cart-wise/db';
import type { Auth, SessionUser } from './lib/auth';

export interface AppEnv {
  Bindings: Env;
  Variables: {
    auth: Auth;
    db: DrizzleD1Database<typeof schema>;
    user: SessionUser;
  };
}
