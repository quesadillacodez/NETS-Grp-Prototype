import { expect, test } from '@playwright/test';
import { signIn, USERS } from './helpers';

test('merchant account is isolated and turns NETS sales into actionable insights', async ({ page }) => {
  await signIn(page, USERS.merchant);

  await expect(page).toHaveURL(/\/merchant$/);
  await expect(page.getByText('NETS Merchant')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nasi Lemak' })).toBeVisible();
  await expect(page.getByText('Anonymous unique buyers')).toBeVisible();
  await expect(page.getByText('Demo history + live payments')).toBeVisible();

  await page.goto('/rewards');
  await expect(page).toHaveURL(/\/merchant$/);

  await page.getByRole('tab', { name: /Products/ }).click();
  await expect(page.getByRole('heading', { name: 'What customers choose' })).toBeVisible();
  await expect(page.getByText('Useful without exposing customers')).toBeVisible();

  await page.getByRole('tab', { name: /Growth/ }).click();
  await page.getByRole('button', { name: '1.5x' }).click();
  await expect(page.getByRole('button', { name: '1.5x' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Future $5 orders award 75 XP.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export my sales report' })).toBeVisible();
});

test('customer accounts cannot open the merchant portal', async ({ page }) => {
  await signIn(page, USERS.alex);
  await expect(page.getByText('Welcome back, Alex!')).toBeVisible();
  await page.goto('/merchant');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Welcome back, Alex!')).toBeVisible();
});
