import { expect, test } from '@playwright/test';
import { USERS, openApp, signIn, signInAsCustomer, signOut } from './helpers';

test.describe('Sign in', () => {
  test('a customer signs in and lands on their wallet', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await expect(page.getByText('Available Balance')).toBeVisible();
    await expect(page.getByText('NETS vCashCard')).toBeVisible();
  });

  test('an incorrect PIN is rejected and reports the attempts left', async ({ page }) => {
    await openApp(page);
    await page.locator('#login-user-id').fill(USERS.alex.loginId);
    await page.locator('#login-pin').fill('000000');
    await page.getByRole('button', { name: 'Sign in securely' }).click();

    await expect(page.getByRole('alert')).toContainText('We could not match those details');
    await expect(page.getByRole('button', { name: 'Sign in securely' })).toBeVisible();
  });

  test('the submit button stays disabled until both fields are complete', async ({ page }) => {
    await openApp(page);
    const submit = page.getByRole('button', { name: 'Sign in securely' });
    await expect(submit).toBeDisabled();

    await page.locator('#login-user-id').fill(USERS.alex.loginId);
    await expect(submit).toBeDisabled();

    await page.locator('#login-pin').fill('1111');
    await expect(submit).toBeDisabled();

    await page.locator('#login-pin').fill(USERS.alex.pin);
    await expect(submit).toBeEnabled();
  });

  test('the management account is routed to the portal, not the wallet', async ({ page }) => {
    await signIn(page, USERS.admin);

    await expect(page.getByText('Management Portal')).toBeVisible();
    await expect(page.getByText('NETS Pulse Dashboard')).toBeVisible();
  });

  test('signing out returns to the sign-in screen', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await signOut(page);
  });
});
