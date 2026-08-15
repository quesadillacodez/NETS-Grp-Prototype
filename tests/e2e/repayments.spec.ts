import { expect, test } from '@playwright/test';
import { USERS, loadDemoScenario, openHistory, signInAsCustomer, signOut, tapNav } from './helpers';

test.describe('Repaying a split bill', () => {
  test('a debtor repays, and both sides are labelled correctly', async ({ page }) => {
    // Seed the shared demo state: Sarah owes Alex $18.20 for Din Tai Fung.
    await signInAsCustomer(page, USERS.sarah);
    await loadDemoScenario(page);

    await tapNav(page, 'Home');
    await page.getByRole('button', { name: 'Reminders', exact: true }).last().click();
    await page.getByRole('button', { name: /To Pay \(1\)/ }).click();
    await page.getByRole('button', { name: /Pay \$18\.20/ }).click();

    await expect(page.getByRole('heading', { name: 'Confirm Payment' })).toBeVisible();
    await page.getByRole('button', { name: 'Approve Payment' }).click();

    await expect(page.getByRole('heading', { name: 'Payment Sent!' })).toBeVisible();
    await expect(page.getByText(/Authorization ref:/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Back to Home' }).click();

    // Sarah's side is money out — a repayment she sent, and it counts as spending.
    await openHistory(page);
    await expect(page.getByText('Repayment Sent').first()).toBeVisible();
    await expect(page.getByText('You repaid ·').first()).toBeVisible();

    // Alex's side is money in — a repayment received, never a top-up.
    await signOut(page);
    await signInAsCustomer(page, USERS.alex);
    await openHistory(page);
    await expect(page.getByText('Repayment Received').first()).toBeVisible();
    await expect(page.getByText('Paid you back ·').first()).toBeVisible();
    await expect(page.getByText('Bill split').first()).toBeVisible();
  });

  test('the payer is notified in the Notification Centre when they are repaid', async ({ page }) => {
    await signInAsCustomer(page, USERS.sarah);
    await loadDemoScenario(page);

    await tapNav(page, 'Home');
    await page.getByRole('button', { name: 'Reminders', exact: true }).last().click();
    await page.getByRole('button', { name: /To Pay \(1\)/ }).click();
    await page.getByRole('button', { name: /Pay \$18\.20/ }).click();
    await page.getByRole('button', { name: 'Approve Payment' }).click();
    await expect(page.getByRole('heading', { name: 'Payment Sent!' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Home' }).click();

    await signOut(page);
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Profile');
    await page.getByRole('button', { name: /Notifications/ }).click();

    await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
    await expect(page.getByText(`${USERS.sarah.name} paid you back`)).toBeVisible();
  });
});
