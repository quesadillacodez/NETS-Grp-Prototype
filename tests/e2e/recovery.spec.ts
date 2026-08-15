import { expect, test } from '@playwright/test';
import { USERS, openApp } from './helpers';

const NEW_PIN = '246813';

test.describe('PIN recovery', () => {
  test('a customer verifies their identity, sets a new PIN and signs in with it', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Forgot PIN?' }).click();

    // Step 1 — identify the account with the registered mobile number.
    await expect(page.getByRole('heading', { name: 'Confirm your account' })).toBeVisible();
    await page.locator('#recovery-user-id').fill(USERS.mike.loginId);
    await page.locator('#recovery-phone').fill('+65 9345 6789');
    await page.getByRole('button', { name: 'Send verification code' }).click();

    // Step 2 — the prototype shows the code on screen instead of sending an SMS.
    await expect(page.getByRole('heading', { name: 'Check your messages' })).toBeVisible();
    const code = (await page.getByText(/^\d{6}$/).first().innerText()).trim();
    expect(code).toMatch(/^\d{6}$/);
    await page.locator('#recovery-code').fill(code);
    await page.getByRole('button', { name: 'Verify code' }).click();

    // Step 3 — choose a new PIN.
    await expect(page.getByRole('heading', { name: 'Create a new PIN' })).toBeVisible();
    await page.locator('#new-pin').fill(NEW_PIN);
    await page.locator('#confirm-pin').fill(NEW_PIN);
    await page.getByRole('button', { name: 'Save new PIN' }).click();

    await expect(page.getByRole('heading', { name: 'PIN reset complete' })).toBeVisible();
    await page.getByRole('button', { name: 'Return to sign in' }).click();

    // The new PIN works straight away, without a page reload.
    await page.locator('#login-user-id').fill(USERS.mike.loginId);
    await page.locator('#login-pin').fill(NEW_PIN);
    await page.getByRole('button', { name: 'Sign in securely' }).click();
    await expect(page.getByText(`Welcome back, ${USERS.mike.firstName}!`)).toBeVisible();
  });

  test('recovery is refused when the mobile number does not match the account', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Forgot PIN?' }).click();

    await page.locator('#recovery-user-id').fill(USERS.mike.loginId);
    await page.locator('#recovery-phone').fill('+65 0000 0000');
    await page.getByRole('button', { name: 'Send verification code' }).click();

    await expect(page.getByRole('heading', { name: 'Confirm your account' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check your messages' })).toHaveCount(0);
  });
});
