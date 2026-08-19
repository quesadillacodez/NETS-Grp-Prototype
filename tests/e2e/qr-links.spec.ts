import { expect, test } from '@playwright/test';
import {
  USERS, openHistory, signInAsCustomer, signInAsMerchant, signOut, signOutOfMerchant, tapNav,
} from './helpers';

function tokenFrom(url: string): string {
  return new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
}

test.describe('Live QR links', () => {
  test('a merchant payment QR opens the webapp and records the purchase', async ({ page }) => {
    await signInAsMerchant(page, USERS.kopitiam);
    await page.getByRole('button', { name: 'qr', exact: true }).click();

    const menu = page.getByLabel('Menu item');
    const nasiLemak = await menu.locator('option').filter({ hasText: 'Nasi Lemak' }).getAttribute('value');
    await menu.selectOption(nasiLemak ?? '');
    await page.getByRole('button', { name: 'Generate live QR' }).click();

    await expect(page.getByRole('img', { name: /Payment QR/ })).toBeVisible();
    const openLink = page.getByRole('link', { name: 'Open link' });
    const paymentUrl = await openLink.getAttribute('href');
    expect(paymentUrl).toMatch(/\/pay\/[A-Za-z0-9_-]+$/);

    await signOutOfMerchant(page);
    await signInAsCustomer(page, USERS.alex);
    await page.goto(paymentUrl!);

    await expect(page.getByRole('heading', { name: 'Kopitiam' })).toBeVisible();
    await expect(page.getByText('Nasi Lemak')).toBeVisible();
    await expect(page.getByText(/Earn .* XP/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm NETS payment' }).click();
    await expect(page.getByText('Payment complete', { exact: true })).toBeVisible();

    const status = await page.request.get(`/api/payment-intents/${tokenFrom(paymentUrl!)}`);
    expect(status.ok()).toBeTruthy();
    expect((await status.json()).status).toBe('paid');

    await page.getByRole('button', { name: 'Done' }).click();
    await openHistory(page);
    await expect(page.getByText('Kopitiam').first()).toBeVisible();
    await expect(page.getByText('Purchase').first()).toBeVisible();
  });

  test('a customer voucher QR is redeemed by the matching merchant once', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.getByRole('button', { name: /\$3 Coffee Voucher/ }).click();
    await page.getByRole('button', { name: 'Confirm redemption' }).click();
    await page.getByRole('button', { name: 'View voucher' }).click();

    const voucherQr = page.getByRole('img', { name: /Live voucher QR/ });
    await expect(voucherQr).toBeVisible();
    const voucherUrl = await page.getByRole('link', { name: 'Open QR link' }).getAttribute('href');
    expect(voucherUrl).toMatch(/\/voucher\/[A-Za-z0-9_-]+$/);

    await page.getByRole('button', { name: 'Close' }).click();
    await signOut(page);
    await signInAsMerchant(page, USERS.kopitiam);
    await page.goto(voucherUrl!);

    await expect(page.getByRole('heading', { name: '$3 Coffee Voucher' })).toBeVisible();
    await expect(page.getByText('Merchant verification')).toBeVisible();
    await page.getByRole('button', { name: 'Redeem voucher' }).click();
    await expect(page.getByText('Voucher redeemed successfully')).toBeVisible();

    const status = await page.request.get(`/api/voucher-claims/${tokenFrom(voucherUrl!)}`);
    expect(status.ok()).toBeTruthy();
    expect((await status.json()).status).toBe('used');

    await page.getByRole('button', { name: 'Done' }).click();
    await signOutOfMerchant(page);
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Wallet', exact: true }).click();
    await page.getByRole('button', { name: /\$3 Coffee Voucher/ }).click();
    await expect(page.getByText('Voucher already used')).toBeVisible();
  });
});
