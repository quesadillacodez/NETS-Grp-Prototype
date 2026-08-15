import { expect, test } from '@playwright/test';
import { USERS, openHistory, signInAsCustomer, tapNav } from './helpers';

test.describe('Paying a merchant', () => {
  test('a QR payment is recorded as a Purchase with a receipt', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await tapNav(page, 'Scan');
    await expect(page.getByRole('heading', { name: 'Ready to scan' })).toBeVisible();
    await page.getByRole('button', { name: 'Scan', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Payment Complete' })).toBeVisible();
    await page.getByRole('button', { name: 'Pay Full Amount' }).click();

    // Back on Home, the payment shows in Recent Activity described as a purchase.
    await expect(page.getByText('Available Balance')).toBeVisible();
    await expect(page.getByText(/You paid ·/).first()).toBeVisible();

    await openHistory(page);
    await expect(page.getByText('Purchase').first()).toBeVisible();

    // The receipt carries a reference number the customer can quote to support.
    await page.getByRole('button', { name: /Purchase/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible();
    await expect(page.getByText('Reference number', { exact: true })).toBeVisible();
    await expect(page.getByText(/^NETS\d{4}\d{6}$/)).toBeVisible();
    await expect(page.getByText('Completed')).toBeVisible();
  });

  test('history search and type filters narrow the list', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    // Two payments so there is something to filter between.
    for (let i = 0; i < 2; i++) {
      await tapNav(page, 'Scan');
      await page.getByRole('button', { name: 'Scan', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Payment Complete' })).toBeVisible();
      await page.getByRole('button', { name: 'Pay Full Amount' }).click();
      await expect(page.getByText('Available Balance')).toBeVisible();
    }

    await openHistory(page);
    await expect(page.getByText(/2 of 2 transactions/)).toBeVisible();

    // Filtering to a type with no rows empties the list rather than erroring.
    await page.getByRole('button', { name: 'Filter transactions' }).click();
    await page.getByRole('button', { name: 'Top-up', exact: true }).click();
    await expect(page.getByText('No transactions match your filters')).toBeVisible();

    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(page.getByText(/2 of 2 transactions/)).toBeVisible();

    // A search term that matches nothing behaves the same way.
    await page.getByLabel('Search transactions').fill('zzzzz');
    await expect(page.getByText('No transactions match your filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByText(/2 of 2 transactions/)).toBeVisible();
  });

  test('a wallet top-up is recorded as a Top-up, not a repayment', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await page.getByRole('button', { name: 'Top-up', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Top up wallet' })).toBeVisible();

    await page.getByRole('button', { name: '$50', exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Confirm top-up' }).click();

    await expect(page.getByRole('heading', { name: 'Top-up successful' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Home' }).click();

    await openHistory(page);
    await expect(page.getByText('Top-up').first()).toBeVisible();
    await expect(page.getByText('Added to wallet ·').first()).toBeVisible();
    await expect(page.getByText('Paid you back')).toHaveCount(0);
  });
});
