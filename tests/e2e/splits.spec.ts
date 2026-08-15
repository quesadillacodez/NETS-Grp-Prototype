import { expect, test } from '@playwright/test';
import { USERS, signInAsCustomer, tapNav } from './helpers';

test.describe('Splitting a bill', () => {
  test('a scanned bill is split with a friend and creates a repayment request', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await tapNav(page, 'Scan');
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Payment Complete' })).toBeVisible();
    await page.getByRole('button', { name: 'Split Bill' }).click();

    // Two people by default: Alex plus one friend.
    await expect(page.getByText('Amount per person')).toBeVisible();
    await page.getByRole('button', { name: 'Select Contacts' }).click();

    await expect(page.getByText('From Your Contacts')).toBeVisible();
    await page.getByRole('button', { name: new RegExp(USERS.sarah.name) }).click();
    await page.getByRole('button', { name: /Equal Split \(2\/2\)/ }).click();

    await expect(page.getByText('Participants')).toBeVisible();
    await page.getByRole('button', { name: 'Pay Full Bill & Send Requests' }).click();

    await expect(page.getByRole('heading', { name: 'Bill Paid!' })).toBeVisible();
    await expect(page.getByText(/1 friend/).first()).toBeVisible();

    // The request is now tracked under Reminders as money to receive.
    await page.getByRole('button', { name: /View Pending/ }).click();
    await expect(page.getByRole('button', { name: /To Receive \(1\)/ })).toBeVisible();
    await expect(page.getByText(USERS.sarah.name).first()).toBeVisible();
  });

  test('the equal-split button stays disabled until enough friends are chosen', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await tapNav(page, 'Scan');
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await page.getByRole('button', { name: 'Split Bill' }).click();
    await page.getByRole('button', { name: 'Select Contacts' }).click();

    await expect(page.getByRole('button', { name: /Equal Split \(1\/2\)/ })).toBeDisabled();
    await page.getByRole('button', { name: new RegExp(USERS.sarah.name) }).click();
    await expect(page.getByRole('button', { name: /Equal Split \(2\/2\)/ })).toBeEnabled();
  });
});
