import { Hono } from 'hono';
import { errorHandler } from './lib/errors';
import { services } from './middleware';
import { catalogue } from './routes/catalogue';
import { me } from './routes/me';
import { sync } from './routes/sync';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>()
  .basePath('/api')
  .use(services)
  .get('/health', (c) => c.json({ ok: true }))
  .on(['GET', 'POST'], '/auth/*', (c) => c.var.auth.handler(c.req.raw))
  .route('/me', me)
  .route('/', catalogue)
  .route('/sync', sync);

app.onError(errorHandler);
app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404));

export default app;
