import { defineConfig } from 'drizzle-kit';

// Only used to generate SQL migrations; Wrangler applies them to D1.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema',
  out: './migrations',
});
