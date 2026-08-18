import { expect, test } from '@playwright/test';
import { USERS, loadDemoScenario, signInAsCustomer, tapNav } from './helpers';

async function openNotificationCentre(page: import('@playwright/test').Page) {
  await tapNav(page, 'Profile');
  await page.getByRole('button', { name: /Notifications/ }).click();
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
}

test.describe('Notification Centre', () => {
  test('keeps a full history with filters and a mark-all-as-read control', async ({ page }) => {
    await signInAsCustomer(page, USERS.sarah);
    await loadDemoScenario(page);
    await openNotificationCentre(page);

    // Sarah has one unread repayment request from the seeded scenario.
    await expect(page.getByText(/Remember to pay Alex Chen/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Reminders\d*$/ })).toBeVisible();

    // Filtering to a channel with nothing in it shows an empty state, not a crash.
    await page.getByRole('button', { name: /^Rewards\d*$/ }).click();
    await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible();

    await page.getByRole('button', { name: /^All( \(\d+\))?$/ }).click();
    await expect(page.getByText(/Remember to pay Alex Chen/)).toBeVisible();

    // Mark all as read clears the unread count and the per-row indicator.
    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(page.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mark as unread' }).first()).toBeVisible();

    // "Unread only" then legitimately has nothing to show.
    await page.getByLabel('Show unread only').check();
    await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible();
  });

  test('a notification deep-links to the bill it is about', async ({ page }) => {
    await signInAsCustomer(page, USERS.sarah);
    await loadDemoScenario(page);
    await openNotificationCentre(page);

    await page.getByRole('button', { name: /Remember to pay Alex Chen/ }).click();
    await expect(page.getByRole('button', { name: /To Pay \(1\)/ })).toBeVisible();
  });

  test('push preferences are saved per channel', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await openNotificationCentre(page);

    await page.getByRole('button', { name: 'Push preferences' }).click();
    await expect(page.getByRole('heading', { name: 'Notification Settings' })).toBeVisible();
    await expect(page.getByText('4 of 4 on')).toBeVisible();

    const rewards = page.getByRole('switch', { name: 'Rewards push notifications' });
    await expect(rewards).toHaveAttribute('aria-checked', 'true');
    await rewards.click();
    await expect(rewards).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('3 of 4 on')).toBeVisible();

    // The choice survives leaving and returning to the screen.
    await page.getByRole('button', { name: 'Back from Notification Settings' }).click();
    await page.getByRole('button', { name: /Notifications/ }).click();
    await page.getByRole('button', { name: 'Push preferences' }).click();
    await expect(page.getByText('3 of 4 on')).toBeVisible();
  });
});
