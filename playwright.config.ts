import { defineConfig, devices } from '@playwright/test';

// The suite runs against a production preview build, not the dev server.
//
// `npm run dev` enables a dev-only feature that mirrors the entire database to
// disk after every write: it exports the whole SQLite file, base64-encodes it,
// snapshots every table and POSTs the lot to the Vite middleware. That work
// grows with the data a test creates and runs on the browser's main thread, so
// on a slow CI runner it delayed sign-in past the assertion timeout and made
// the suite flaky. A preview build has none of that, and it exercises the same
// bundle that actually ships.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

// The app is a phone-sized experience, so the default viewport matches the
// 390px frame the UI is designed around. The `compact-phone` project re-runs
// the responsive checks at 320px, the narrowest width we support.
const PHONE = { width: 390, height: 844 };
const COMPACT_PHONE = { width: 320, height: 640 };

// CI downloads the browser Playwright expects (`npx playwright install chromium`).
// Some sandboxes ship a pre-installed Chromium at a different build number;
// point PLAYWRIGHT_CHROMIUM_PATH at it there instead of downloading a second copy.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  // Shared CI runners need more headroom, while server-backed PIN mutation
  // requires serial execution to keep credentials deterministic.
  expect: { timeout: process.env.CI ? 25_000 : 15_000 },
  // Authentication and PIN recovery are intentionally server-backed. Keep the
  // suite serial so a credential mutation cannot race another sign-in.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'phone',
      testIgnore: /responsive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: PHONE, launchOptions },
    },
    {
      name: 'compact-phone',
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: COMPACT_PHONE, launchOptions },
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // Includes a production build, so allow more than a bare server start.
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      ...process.env,
      PORT: String(PORT),
      RESET_DEMO_DATA: 'true',
      NETS_DATA_FILE: 'tmp/playwright-auth.json',
      EXPOSE_DEMO_OTP: 'true',
      VITE_DISABLE_CLOUD_SYNC: 'true',
      NETS_SERVE_BUILD: 'true',
    },
  },
});
