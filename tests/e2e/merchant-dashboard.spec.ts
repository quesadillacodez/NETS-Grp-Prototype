import { expect, test } from '@playwright/test';
import { USERS, signInAsCustomer, signInAsMerchant } from './helpers';

// The per-dish view — best seller, what sells, what never does — is covered by
// merchant-portal.spec.ts. This file covers the stall-level read of the same
// item_sales rows: the week, the dayparts, what the stall gives back, and the
// two things a merchant can actually do about any of it.

test.describe('The stall-level view of trade', () => {
  test('shows the week, the dayparts, and what they suggest doing', async ({ page }) => {
    await signInAsMerchant(page, USERS.kopitiam);

    // A fortnight of seeded trade, read three ways from one set of rows.
    await expect(page.getByRole('heading', { name: 'Last seven days' })).toBeVisible();
    await expect(page.getByRole('img', { name: /: \$\d+\.\d\d from \d+ orders$/ }).first()).toBeVisible();

    await expect(page.getByRole('heading', { name: /Breakfast, lunch or dinner stall/ })).toBeVisible();
    await expect(page.getByText('Breakfast').first()).toBeVisible();
    await expect(page.getByText('Lunch').first()).toBeVisible();

    // Advice is only worth showing if the merchant can check it against a
    // figure on the same screen, which is what the note underneath promises.
    await expect(page.getByRole('heading', { name: 'What to try next' })).toBeVisible();
    await expect(page.getByText(/Nasi Lemak drives \d+% of your orders/)).toBeVisible();
    await expect(page.getByText(/check it against the evidence/)).toBeVisible();
  });

  test('reports what the stall gave back to its customers', async ({ page }) => {
    await signInAsMerchant(page, USERS.kopitiam);

    // XP is derived from the sales on this screen rather than counted twice, so
    // a stall with trade always shows some.
    const xpCard = page.locator('div').filter({ has: page.getByText('XP given out', { exact: true }) }).last();
    await expect(xpCard).toHaveText(/^[1-9][\d,]*/);
    await expect(page.getByText('Earned by your customers')).toBeVisible();

    await expect(page.getByText('Vouchers used')).toBeVisible();
    await expect(page.getByText('Redeemed at your stall')).toBeVisible();
  });
});

test.describe('Acting on what the dashboard says', () => {
  test('raising the XP multiplier says what a $5 order becomes', async ({ page }) => {
    await signInAsMerchant(page, USERS.kopitiam);
    await page.getByRole('button', { name: 'rewards', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Reward your regulars' })).toBeVisible();
    // Kopitiam runs a 2x campaign by default: $5 × 10 XP × 2.
    await expect(page.getByText('Future $5 orders award 100 XP.')).toBeVisible();

    await page.getByRole('button', { name: '1.5x', exact: true }).click();
    await expect(page.getByRole('button', { name: '1.5x', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Future $5 orders award 75 XP.')).toBeVisible();

    // The choice is the merchant's own record, so it survives leaving the tab.
    await page.getByRole('button', { name: 'today', exact: true }).click();
    await page.getByRole('button', { name: 'rewards', exact: true }).click();
    await expect(page.getByText('Future $5 orders award 75 XP.')).toBeVisible();
  });

  test('exporting the sales report hands over the trade, not the customers', async ({ page }) => {
    await signInAsMerchant(page, USERS.kopitiam);
    await page.getByRole('button', { name: 'rewards', exact: true }).click();

    await expect(page.getByText(/counts anonymous unique buyers/)).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export my sales report' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('kopitiam-sales.csv');

    const stream = await file.createReadStream();
    const csv = (await stream.toArray()).join('');

    // What sold, and how many people bought — never who they were.
    expect(csv).toContain('Item,Units,Revenue (SGD),Share of orders');
    expect(csv).toContain('Nasi Lemak');
    expect(csv).toContain('Anonymous unique buyers');
    expect(csv).not.toContain('Sarah');
    expect(csv).not.toContain('Mike');
  });
});

test('customer accounts cannot open the merchant portal', async ({ page }) => {
  await signInAsCustomer(page, USERS.alex);
  await page.goto('/merchant');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Welcome back, Alex!')).toBeVisible();
});
