import { expect, test, type Page, type Browser } from '@playwright/test';
import { USERS, signInAsCustomer, stubNetsSandbox } from './helpers';

/**
 * Cloud sync is compiled out of the suite's own build (`VITE_DISABLE_CLOUD_SYNC`
 * in playwright.config.ts), because mirroring the whole database on every write
 * made the rest of the suite slow and flaky. These checks therefore run only
 * against a build that has it switched on:
 *
 *   npm run build && PORT=4175 NETS_SERVE_BUILD=true RESET_DEMO_DATA=true \
 *     NETS_DATA_FILE=tmp/sync.json EXPOSE_DEMO_OTP=true node server/index.mjs
 *   PLAYWRIGHT_CLOUD_SYNC=1 PLAYWRIGHT_PORT=4175 \
 *     PLAYWRIGHT_BASE_URL=http://localhost:4175 npx playwright test cloud-sync
 */
test.skip(!process.env.PLAYWRIGHT_CLOUD_SYNC, 'needs a build with cloud sync enabled');

async function freshDevice(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await stubNetsSandbox(page);
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in securely' })).toBeVisible({ timeout: 45_000 });
  return { context, page };
}

async function splitWithSarah(page: Page, stall: string) {
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await page.getByRole('button', { name: stall, exact: true }).click();
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payment Complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Split Bill' }).click();
  await page.getByRole('button', { name: 'Select Contacts' }).click();
  await page.getByRole('button', { name: new RegExp(USERS.sarah.name) }).click();
  await page.getByRole('button', { name: /Equal Split \(2\/2\)/ }).click();
  await page.getByRole('button', { name: 'Pay Full Bill & Send Requests' }).click();
  await expect(page.getByRole('heading', { name: 'Bill Paid!' })).toBeVisible();
  await page.getByRole('button', { name: /Back to Home/ }).click();
  await expect(page.getByText('Recent Activity')).toBeVisible();
}

/** How many transactions the wallet holds, read off Transaction History. */
async function transactionCount(page: Page): Promise<number> {
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Transaction History' })).toBeVisible();
  const text = await page.evaluate(() => document.body.innerText);
  await page.getByRole('button', { name: 'Back from Transaction History' }).click();
  return Number(text.match(/(\d+) of \d+ transactions/)?.[1] ?? -1);
}

async function markFirstReminderPaid(page: Page) {
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Reminders', exact: true }).last().click();
  await page.getByRole('button', { name: 'Mark Paid' }).first().click();
  await expect(page.getByText(/Payment received/)).toBeVisible();
}

// The bug this covers: publishing the database lost a race with a second
// device, and the losing side answered the conflict by replacing its whole
// local database with the server's copy — discarding the repayment it was in
// the middle of publishing. The repayment vanished a second or two after it was
// recorded, and stayed gone after a reload.
test('a repayment survives a second device publishing at the same time', async ({ browser }) => {
  const a = await freshDevice(browser);
  await signInAsCustomer(a.page, USERS.alex);
  await splitWithSarah(a.page, 'ZARA');
  await splitWithSarah(a.page, 'FairPrice');
  await a.page.waitForTimeout(2_500);
  const startingCount = await transactionCount(a.page);

  // A second device picks up everything already published.
  const b = await freshDevice(browser);
  await signInAsCustomer(b.page, USERS.alex);
  await b.page.waitForTimeout(2_500);
  expect(await transactionCount(b.page)).toBe(startingCount);

  // Both record a repayment at once, so one of them must lose the race.
  await markFirstReminderPaid(a.page);
  await markFirstReminderPaid(b.page);
  await a.page.waitForTimeout(5_000);
  await b.page.waitForTimeout(5_000);

  expect(await transactionCount(a.page)).toBe(startingCount + 1);
  expect(await transactionCount(b.page)).toBe(startingCount + 1);

  // And it is still there after a reload, rather than being hydrated away.
  await a.page.reload();
  await expect(a.page.getByText('Recent Activity')).toBeVisible({ timeout: 45_000 });
  expect(await transactionCount(a.page)).toBe(startingCount + 1);

  await a.context.close();
  await b.context.close();
});
