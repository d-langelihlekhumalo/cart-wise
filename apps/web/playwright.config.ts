import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build (`vite preview`), because offline support
// depends on the service worker, which only exists in builds. Run `pnpm build` and
// `pnpm db:migrate:local` first.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
  webServer: {
    // Run Vite directly: pnpm's launcher doesn't forward the stop signal, which left the
    // server (and the CI job) running after the tests finished.
    command: 'node ./node_modules/vite/bin/vite.js preview --port 5180 --strictPort',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    url: 'http://localhost:5180/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
