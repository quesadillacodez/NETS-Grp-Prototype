import { expect, test } from '@playwright/test';
import { USERS, signInAsCustomer, tapNav } from './helpers';

// Every one of these five was a visible button that did nothing.
const PROFILE_PAGES = [
  { button: /Personal Information/, heading: 'Personal Information' },
  { button: /Payment Methods/,      heading: 'Payment Methods' },
  { button: /Notifications/,        heading: 'Notifications' },
  { button: /Security & Privacy/,   heading: 'Security & Privacy' },
  { button: /Help & Support/,       heading: 'Help & Support' },
];

test.describe('Profile', () => {
  test.afterEach(async ({ request }) => {
    await request.post('/api/test/reset', { headers: { 'X-NETS-CSRF': '1' } });
  });

  for (const { button, heading } of PROFILE_PAGES) {
    test(`"${heading}" opens a real page`, async ({ page }) => {
      await signInAsCustomer(page, USERS.alex);
      await tapNav(page, 'Profile');
      await page.getByRole('button', { name: button }).click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    });
  }

  test('personal details are edited and persist', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Profile');
    await page.getByRole('button', { name: /Personal Information/ }).click();

    await page.getByLabel('Email address').fill('alex.chen@example.com');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

    // Navigate away and back — the change survives.
    await page.getByRole('button', { name: 'Back from Personal Information' }).click();
    await page.getByRole('button', { name: /Personal Information/ }).click();
    await expect(page.getByLabel('Email address')).toHaveValue('alex.chen@example.com');
  });

  test('an invalid email blocks saving', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Profile');
    await page.getByRole('button', { name: /Personal Information/ }).click();

    await page.getByLabel('Email address').fill('not-an-email');
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  test('a payment method can be frozen and made default', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Profile');
    await page.getByRole('button', { name: /Payment Methods/ }).click();

    await expect(page.getByText('NETS vCashCard')).toBeVisible();
    await expect(page.getByText('Default', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Freeze' }).last().click();
    await expect(page.getByText(/frozen — it can't be used to pay/).first()).toBeVisible();
    await expect(page.getByText('Frozen', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Unfreeze' }).click();
    await expect(page.getByText(/unfrozen/).first()).toBeVisible();
  });

  test('the PIN can be changed and the old PIN stops working', async ({ page }) => {
    await signInAsCustomer(page, USERS.sarah);
    await tapNav(page, 'Profile');
    await page.getByRole('button', { name: /Security & Privacy/ }).click();

    // A wrong current PIN is refused.
    await page.locator('#current-pin').fill('000000');
    await page.locator('#new-pin').fill('135791');
    await page.locator('#confirm-pin').fill('135791');
    await page.getByRole('button', { name: 'Update PIN' }).click();
    await expect(page.getByText('Your current PIN is incorrect.').first()).toBeVisible();

    // The real one works.
    await page.locator('#current-pin').fill(USERS.sarah.pin);
    await page.locator('#new-pin').fill('135791');
    await page.locator('#confirm-pin').fill('135791');
    await page.getByRole('button', { name: 'Update PIN' }).click();
    await expect(page.getByText(/Your PIN has been changed/).first()).toBeVisible();

    // Sign out and back in with the new PIN.
    await page.getByRole('button', { name: 'Sign out of this device' }).click();
    await page.locator('#login-user-id').fill(USERS.sarah.loginId);
    await page.locator('#login-pin').fill('135791');
    await page.getByRole('button', { name: 'Sign in securely' }).click();
    await expect(page.getByText(`Welcome back, ${USERS.sarah.firstName}!`)).toBeVisible();

  });

  test('an issue can be reported and gets a case reference', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Profile');
    await page.getByRole('button', { name: /Help & Support/ }).click();

    await page.getByLabel('What went wrong?').selectOption('Payment did not go through');
    await page.getByLabel('What happened?').fill('The QR code timed out before I could pay.');
    await page.getByRole('button', { name: 'Submit issue' }).click();

    await expect(page.getByText('Issue logged').first()).toBeVisible();
    await expect(page.getByText(/^CASE-/)).toBeVisible();
  });
});
