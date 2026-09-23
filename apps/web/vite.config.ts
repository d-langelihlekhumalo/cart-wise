import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The Worker (API) lives in apps/api; this Vite project builds the React app as its static
// assets and runs both together in dev.
export default defineConfig({
  // Fixed port so it matches BETTER_AUTH_URL in apps/api/wrangler.jsonc.
  server: { port: 5180, strictPort: true },
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({
      configPath: '../api/wrangler.jsonc',
      // Shared with `pnpm db:migrate:local` so dev sees the migrated local D1.
      persistState: { path: '../../.wrangler/state' },
    }),
  ],
});
