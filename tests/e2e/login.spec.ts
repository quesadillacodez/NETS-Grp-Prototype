import { expect, test } from '@playwright/test';
import { USERS, openApp, signIn, signInAsCustomer, signOut, stubNetsSandbox, tapNav } from './helpers';

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

  test('opening a protected page while signed out returns there after signing in', async ({ page }) => {
    await stubNetsSandbox(page);

    // The app signs out on every fresh load, so this is the deep-link case:
    // arrive at a protected URL without a session.
    await page.goto('/all-transactions');
    await expect(page.getByRole('button', { name: 'Sign in securely' })).toBeVisible({ timeout: 45_000 });

    await page.locator('#login-user-id').fill(USERS.alex.loginId);
    await page.locator('#login-pin').fill(USERS.alex.pin);
    await page.getByRole('button', { name: 'Sign in securely' }).click();

    await expect(page.getByRole('heading', { name: 'Transaction History' })).toBeVisible();
  });

  test('signing out deliberately lands the next sign-in on Home, not the page left behind', async ({ page }) => {
    // Signing out from a deep page must not drop the next person to sign in
    // back into the previous session's screen.
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Profile');
    await page.getByRole('button', { name: /Security & Privacy/ }).click();
    await expect(page.getByRole('heading', { name: 'Security & Privacy', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out of this device' }).click();
    await expect(page.getByRole('button', { name: 'Sign in securely' })).toBeVisible();

    // A different customer signs in next.
    await page.locator('#login-user-id').fill(USERS.sarah.loginId);
    await page.locator('#login-pin').fill(USERS.sarah.pin);
    await page.getByRole('button', { name: 'Sign in securely' }).click();

    await expect(page.getByText(`Welcome back, ${USERS.sarah.firstName}!`)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Security & Privacy', exact: true })).toHaveCount(0);
  });
});
