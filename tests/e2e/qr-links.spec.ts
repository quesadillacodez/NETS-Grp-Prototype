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

  test('a customer voucher QR opens a public verification page and works once', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.getByRole('button', { name: /\$3 Coffee Voucher/ }).click();
    await page.getByRole('button', { name: 'Confirm redemption' }).click();
    await page.getByRole('button', { name: 'View voucher' }).click();

    const voucherQr = page.getByRole('img', { name: /Scannable voucher code/ });
    await expect(voucherQr).toBeVisible();
    const refCode = await page.getByRole('paragraph').filter({ hasText: /^XP-[A-Z0-9]{6}$/ }).textContent();
    expect(refCode).toMatch(/^XP-[A-Z0-9]{6}$/);
    await expect.poll(async () => (await page.request.get(`/api/voucher/${refCode}`)).ok()).toBe(true);

    await page.getByRole('button', { name: 'Close' }).click();
    await signOut(page);
    await page.goto(`/v/${refCode}`);
    await expect(page.getByRole('heading', { name: 'Voucher redeemed' })).toBeVisible();
    await expect(page.getByText('This code cannot be used again.')).toBeVisible();

    await page.goto(`/v/${refCode}`);
    await expect(page.getByRole('heading', { name: 'Not accepted' })).toBeVisible();
    await expect(page.getByText(/already been used/)).toBeVisible();
  });
});
