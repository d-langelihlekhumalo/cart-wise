import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
    VitePWA({
      // Ask before swapping in a new version, so an update never interrupts a shop.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Cart Wise',
        short_name: 'Cart Wise',
        description: 'Find where your grocery list is cheapest in South Africa.',
        lang: 'en-ZA',
        start_url: '/',
        display: 'standalone',
        theme_color: '#047857',
        background_color: '#fafaf9',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell and every route chunk so the app opens with no signal.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
