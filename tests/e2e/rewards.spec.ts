import { expect, test } from '@playwright/test';
import { USERS, openHistory, signInAsCustomer, tapNav } from './helpers';

test.describe('Redeeming a reward', () => {
  test('cashback redemption shows a receipt, a Done button and lands in the wallet', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');

    // Every account starts with the 500 XP welcome bonus, enough for $5 cashback.
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.getByRole('button', { name: /\$5 Wallet Cashback/ }).click();

    await expect(page.getByText('Cashback is applied to your wallet instantly')).toBeVisible();
    await page.getByRole('button', { name: 'Terms & conditions' }).click();
    await expect(page.getByText(/cannot be reversed once redeemed/)).toBeVisible();

    await page.getByRole('button', { name: 'Confirm redemption' }).click();

    // The confirmation receipt is its own step, closed by an explicit Done.
    await expect(page.getByRole('heading', { name: 'Redemption confirmed' })).toBeVisible();
    await expect(page.getByText('Reference code')).toBeVisible();
    await expect(page.getByText('XP spent')).toBeVisible();
    await expect(page.getByText('-500 XP')).toBeVisible();
    await expect(page.getByText('Valid until')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Redemption confirmed' })).toHaveCount(0);

    // It appears in the rewards wallet as applied, and credits the NETS wallet.
    await expect(page.getByRole('heading', { name: 'My Rewards Wallet' })).toBeVisible();
    await expect(page.getByText('Applied').first()).toBeVisible();

    await openHistory(page);
    await expect(page.getByText('Cashback').first()).toBeVisible();
    await expect(page.getByText('Cashback earned ·').first()).toBeVisible();
  });

  test('a voucher carries an expiry date and generates a live merchant QR', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');

    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.getByRole('button', { name: /\$1\.50 Student Meal Credit/ }).click();
    await expect(page.getByText(/Valid for 21 days/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm redemption' }).click();

    await expect(page.getByRole('heading', { name: 'Redemption confirmed' })).toBeVisible();
    await page.getByRole('button', { name: 'View voucher' }).click();

    await expect(page.getByText('Active', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Expires', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Find NYP Campus Food Court/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /Scannable voucher code/ })).toBeVisible();
    await expect(page.getByText(/Present this scannable, single-use QR/)).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    // The redemption history keeps a permanent record of it.
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'XP & Redemption History' })).toBeVisible();
    await expect(page.getByText(/Redemption history \(1\)/)).toBeVisible();
    await expect(page.getByText('Active').first()).toBeVisible();
  });

  test('a reward the customer cannot afford is locked rather than redeemable', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');

    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.getByRole('button', { name: /\$10 Ride Credit/ }).click();

    await expect(page.getByText(/You need .* more XP/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Not enough XP' })).toBeDisabled();
  });
});
