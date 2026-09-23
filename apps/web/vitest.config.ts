import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts: the Cloudflare plugin can't run inside Vitest, and unit tests
// here only cover browser-side logic.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
