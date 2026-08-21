import { expect, test, type Browser, type Page } from '@playwright/test';
import { USERS, loadDemoScenario, signInAsCustomer, stubNetsSandbox, tapNav } from './helpers';

/**
 * Redeeming a voucher from a device that never issued it.
 *
 * The customer holds the voucher on their own phone. The merchant scans its QR
 * with a different phone — one that is not signed in as the customer and has no
 * copy of their database, because the synchronized SQLite blob is only served
 * to an authenticated session. Everything the counter needs therefore has to
 * come from the server voucher index.
 *
 * A separate browser context is the honest way to model that second device: it
 * shares no cookies, no localStorage and no IndexedDB with the first, so a test
 * that passes here cannot be passing off the issuing device's local record.
 */

/** Opens the scan URL on a device with no session and no local database. */
async function scanFromNewDevice(browser: Browser, refCode: string): Promise<Page> {
  const counter = await browser.newContext();
  const page = await counter.newPage();
  await stubNetsSandbox(page);
  await page.goto(`/v/${refCode}`);
  // Closed by the test through page.context(), once its assertions have run.
  return page;
}

/** Redeems a voucher from the store and returns the code on its receipt. */
async function redeemVoucher(page: Page, name: RegExp): Promise<string> {
  await tapNav(page, 'Rewards');
  await page.getByRole('button', { name: 'Store', exact: true }).click();
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: 'Confirm redemption' }).click();
  await expect(page.getByRole('heading', { name: 'Redemption confirmed' })).toBeVisible();
  return (await page.getByText(/^XP-[A-Z0-9]+$/).first().innerText()).trim();
}

test.describe('Scanning a voucher from another device', () => {
  test('a seeded voucher redeems from a device that has never signed in', async ({ page, browser }) => {
    // The seeded vouchers are written straight into SQLite by the demo reset,
    // so they never pass through the redemption path. They are precisely the
    // case that used to scan as "no voucher matches this code".
    await signInAsCustomer(page, USERS.alex);
    await loadDemoScenario(page);

    const scan = await scanFromNewDevice(browser, 'XP-DEMO04');
    try {
      await expect(scan.getByRole('heading', { name: 'Voucher redeemed' })).toBeVisible();
      await expect(scan.getByText('XP-DEMO04')).toBeVisible();
      await expect(scan.getByText('$5 Heartland Voucher')).toBeVisible();
    } finally {
      await scan.context().close();
    }

    // A photograph of the QR is worth nothing after the first scan.
    const rescan = await scanFromNewDevice(browser, 'XP-DEMO04');
    try {
      await expect(rescan.getByRole('heading', { name: 'Not accepted' })).toBeVisible();
      await expect(rescan.getByText('This voucher has already been used.')).toBeVisible();
    } finally {
      await rescan.context().close();
    }
  });

  test('the code is matched whatever case the scanner reports it in', async ({ page, browser }) => {
    await signInAsCustomer(page, USERS.alex);
    await loadDemoScenario(page);

    const scan = await scanFromNewDevice(browser, 'xp-demo05');
    try {
      await expect(scan.getByRole('heading', { name: 'Voucher redeemed' })).toBeVisible();
    } finally {
      await scan.context().close();
    }
  });

  test('a voucher redeemed live in this session scans from another device', async ({ page, browser }) => {
    await signInAsCustomer(page, USERS.alex);
    const refCode = await redeemVoucher(page, /\$1\.50 Student Meal Credit/);

    const scan = await scanFromNewDevice(browser, refCode);
    try {
      await expect(scan.getByRole('heading', { name: 'Voucher redeemed' })).toBeVisible();
      await expect(scan.getByText(refCode)).toBeVisible();
    } finally {
      await scan.context().close();
    }
  });

  test('a voucher the customer marked used no longer scans at the counter', async ({ page, browser }) => {
    await signInAsCustomer(page, USERS.alex);
    const refCode = await redeemVoucher(page, /\$1\.50 Student Meal Credit/);

    await page.getByRole('button', { name: 'View voucher' }).click();
    await page.getByRole('button', { name: /Use now/ }).click();
    await expect(page.getByText('Voucher already used').first()).toBeVisible();

    // The spend has to reach the index, or the counter would honour it again.
    const scan = await scanFromNewDevice(browser, refCode);
    try {
      await expect(scan.getByRole('heading', { name: 'Not accepted' })).toBeVisible();
      await expect(scan.getByText('This voucher has already been used.')).toBeVisible();
    } finally {
      await scan.context().close();
    }
  });

  test('an unknown code is refused rather than shown as valid', async ({ browser }) => {
    const scan = await scanFromNewDevice(browser, 'XP-NOTREAL');
    try {
      await expect(scan.getByRole('heading', { name: 'Not accepted' })).toBeVisible();
      await expect(scan.getByText('No voucher matches this code.')).toBeVisible();
    } finally {
      await scan.context().close();
    }
  });
});
