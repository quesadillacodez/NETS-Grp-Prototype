import { expect, test } from '@playwright/test';
import { USERS, signInAsCustomer, tapNav } from './helpers';

test.describe('Hangouts', () => {
  test('no friends are preselected, and the count updates as they are chosen', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Hangouts');

    await page.getByRole('button', { name: 'Plan together' }).click();
    await expect(page.getByRole('heading', { name: 'Create a Hangout' })).toBeVisible();

    // The old behaviour preselected two friends, so tapping one silently removed
    // them. Selection now starts empty and says so.
    await expect(page.getByText('No friends selected')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create voting plan' })).toBeDisabled();
    await expect(page.getByText('Invite at least one friend to vote.')).toBeVisible();

    await page.getByRole('button', { name: `Invite ${USERS.sarah.name}` }).click();
    await expect(page.getByText('1 friend selected')).toBeVisible();

    await page.getByRole('button', { name: `Invite ${USERS.mike.name}` }).click();
    await expect(page.getByText('2 friends selected')).toBeVisible();

    // Tapping a selected friend removes them, and the count says what happened.
    await page.getByRole('button', { name: `Remove ${USERS.mike.name}` }).click();
    await expect(page.getByText('1 friend selected')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Create voting plan' })).toBeEnabled();
  });

  test('a plan is created, voted on and confirmed by the host', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Hangouts');

    await page.getByRole('button', { name: 'Plan together' }).click();
    await page.getByRole('button', { name: `Invite ${USERS.sarah.name}` }).click();
    await page.getByRole('button', { name: 'Create voting plan' }).click();

    // The new plan opens straight into its voting sheet.
    await expect(page.getByText('Voting is open')).toBeVisible();
    await expect(page.getByText('Vote for one activity')).toBeVisible();

    // Cast the host's vote, then confirm the group choice. Each option button
    // carries its price and area, e.g. "$18/person - Bugis".
    const voteOptions = page.getByRole('button').filter({ hasText: /\/person -/ });
    await expect(voteOptions.first()).toBeVisible();
    await voteOptions.first().click();

    const confirm = page.getByRole('button', { name: /Confirm group choice/ });
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByText('Plan confirmed')).toBeVisible();
    await expect(page.getByText('Top group choice')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay' })).toBeVisible();
  });
});
