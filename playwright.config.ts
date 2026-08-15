import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

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
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
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
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
