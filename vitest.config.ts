import path from 'path';
import { defineConfig } from 'vitest/config';

// Unit tests only. The Playwright end-to-end suite lives in tests/e2e and is run
// by `npm run test:e2e`; without this include, Vitest would also try to execute
// those .spec.ts files and fail on the Playwright imports.
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
