import { expect, test, type Page } from '@playwright/test';
import { USERS, signIn, signInAsCustomer, signOut, signOutOfAdmin, tapNav } from './helpers';

/** Sign in as the admin and open the explorer the way the portal offers it. */
async function openExplorer(page: Page): Promise<void> {
  await signIn(page, USERS.admin);
  await expect(page.getByText('Management Portal')).toBeVisible();
  await page.getByRole('button', { name: 'Database' }).click();
  await expect(page).toHaveURL(/\/database$/);
  // The page is code-split, so wait for it to actually mount — the URL changes
  // before the admin portal is replaced.
  await expect(page.getByRole('heading', { name: 'Database' })).toBeVisible();
}

/** The row count the explorer reports for the transaction ledger. */
async function ledgerRowCount(page: Page): Promise<number> {
  const card = page.getByRole('button').filter({ hasText: /^transactions/ }).first();
  const text = await card.innerText();
  const match = text.match(/([\d,]+)\s+rows?/);
  expect(match, `no row count found in "${text}"`).not.toBeNull();
  return Number(match![1].replace(/,/g, ''));
}

test.describe('The database explorer', () => {
  test('lists every table the app keeps, with live row counts', async ({ page }) => {
    await openExplorer(page);

    // The table list is read from sqlite_master, so the tables behind the
    // features are all present rather than a hand-written list.
    await expect(page.getByText('transactions', { exact: true })).toBeVisible();
    await expect(page.getByText('item_sales', { exact: true })).toBeVisible();
    await expect(page.getByText('reward_promotions', { exact: true })).toBeVisible();

    await page.getByLabel('Filter tables by name').fill('item');
    await expect(page.getByText('item_sales', { exact: true })).toBeVisible();
    await expect(page.getByText('transactions', { exact: true })).toHaveCount(0);
  });

  test('opens a table and shows its real columns and rows', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('button', { name: /item_sales/ }).click();
    await expect(page.getByRole('heading', { name: 'Columns' })).toBeVisible();
    await expect(page.getByText('unit_price', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Rows/ })).toBeVisible();

    // Real rows, newest first: the seeded stall trade carries the payment id
    // that makes each sale idempotent.
    await expect(page.getByText(/^DEMO-ITEM-\d+$/).first()).toBeVisible();
  });

  test('shows the arithmetic behind each balance, and it matches the wallet', async ({ page }) => {
    // What Alex's Home screen says the wallet holds. The vCashCard is the
    // wallet itself, and carries its balance in its accessible name.
    await signInAsCustomer(page, USERS.alex);
    const label = await page.getByRole('button', { name: /^NETS vCashCard, / }).getAttribute('aria-label');
    const onHome = Number(label?.match(/\$([\d,]+\.\d\d)/)?.[1].replace(/,/g, ''));
    expect(onHome, `no balance in "${label}"`).toBeGreaterThan(0);
    await signOut(page);

    await openExplorer(page);
    await expect(page.getByRole('heading', { name: 'Derived, not stored' })).toBeVisible();

    // The same figure, shown as the sum that produced it. The two screens
    // format money differently, so compare the amounts rather than the strings.
    const row = page.locator('li').filter({ hasText: 'users.id = 1' }).first();
    await expect(row).toContainText('$2,500.00 opening');
    await expect(row).toContainText(/over \d+ rows/);
    await expect(row).toContainText(/\d+ earned − \d+ spent/);
    await expect(row).toContainText(/= [\d,]+ XP spendable now/);

    const derived = (await row.innerText()).match(/=\s*\$([\d,]+\.\d\d) wallet balance/);
    expect(derived, `no derived balance in "${await row.innerText()}"`).not.toBeNull();
    expect(Number(derived![1].replace(/,/g, ''))).toBe(onHome);

    // And the claim underneath is a live check, not a promise.
    await expect(page.getByText(/no wallet-balance or XP column exists/)).toBeVisible();
  });

  test('never shows a credential, and says why the column is empty', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('button', { name: /^users/ }).click();
    await expect(page.getByText('password', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/PINs are hashed and held by the server/)).toBeVisible();

    // Every PIN in the demo is six digits; none of them may appear here.
    await expect(page.getByText(/\b(111111|555555|888888)\b/)).toHaveCount(0);
  });

  test('a payment made in the app lands in the table on this screen', async ({ page }) => {
    await openExplorer(page);
    const before = await ledgerRowCount(page);
    await page.getByRole('button', { name: 'Go back' }).click();
    await signOutOfAdmin(page);

    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Scan');
    await page.getByRole('button', { name: 'Kopitiam', exact: true }).click();
    await page.getByRole('button', { name: 'Scan', exact: true }).last().click();
    await page.getByRole('button', { name: 'Pay Full Amount' }).click();
    await expect(page.getByText('Welcome back, Alex!')).toBeVisible();
    await signOut(page);

    // Nothing on this page is a snapshot — it reads the same database the
    // payment was just written to.
    await openExplorer(page);
    expect(await ledgerRowCount(page)).toBe(before + 1);
  });
});

test('customers cannot open the database explorer', async ({ page }) => {
  await signInAsCustomer(page, USERS.alex);
  await page.goto('/database');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Welcome back, Alex!')).toBeVisible();
});
