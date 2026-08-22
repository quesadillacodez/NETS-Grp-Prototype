import { expect, test, type Page } from '@playwright/test';
import { openHistory, USERS, signInAsCustomer, tapNav } from './helpers';

/** Scan a named stall and split the bill evenly with Sarah. */
async function splitWithSarah(page: Page, stall: string) {
  await page.getByRole('button', { name: stall, exact: true }).click();
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payment Complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Split Bill' }).click();
  await page.getByRole('button', { name: 'Select Contacts' }).click();
  await page.getByRole('button', { name: new RegExp(USERS.sarah.name) }).click();
  await page.getByRole('button', { name: /Equal Split \(2\/2\)/ }).click();
  await page.getByRole('button', { name: 'Pay Full Bill & Send Requests' }).click();
}

/** Open Reminders from the Home screen and show the Shared Bills tab. */
async function openSharedBills(page: Page) {
  await tapNav(page, 'Home');
  await page.getByRole('button', { name: 'Reminders', exact: true }).last().click();
  await page.getByRole('button', { name: /^Shared \(/ }).click();
}

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


  test('a second and third split are recorded, not just the first', async ({ page }) => {
    // Reported from the field: after the first split, later ones "don't come
    // out" in Recent Activity or under Shared bills. Each split has to write its
    // own payment and its own bill, including two at the same merchant.
    await signInAsCustomer(page, USERS.mike);

    const split = async () => {
      await tapNav(page, 'Scan');
      await page.getByRole('button', { name: 'Scan', exact: true }).last().click();
      await page.getByRole('button', { name: 'Split Bill' }).click();
      await page.getByRole('button', { name: 'Select Contacts' }).click();
      await page.getByRole('button', { name: new RegExp(USERS.sarah.name) }).click();
      await page.getByRole('button', { name: /Equal Split \(2\/2\)/ }).click();
      await page.getByRole('button', { name: 'Pay Full Bill & Send Requests' }).click();
      await expect(page.getByRole('heading', { name: 'Bill Paid!' })).toBeVisible();
      // Navigate on, in-app, exactly as the buttons do.
      await page.getByRole('button', { name: /Back to Home/ }).click();
      await expect(page.getByText('Recent Activity')).toBeVisible();
    };

    await split();
    await split();
    await split();

    // Three separate requests, not one merged or two dropped.
    await tapNav(page, 'Home');
    await page.getByRole('button', { name: 'Reminders' }).first().click().catch(async () => {
      await page.goto('/reminders');
    });
    await expect(page.getByRole('button', { name: /To Receive \(3\)/ })).toBeVisible();

    // And each one stands as its own shared bill.
    await page.getByRole('button', { name: /Shared \(3\)/ }).click();
    await expect(page.getByText(/You paid · 2 people/).first()).toBeVisible();
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

test.describe('Splitting a second bill', () => {
  // The scan screen used to mint one payment id per mount and hand it back out
  // to whatever navigated in. Backing out of the split flow returned to /scan
  // carrying the id of the payment just recorded, so the NEXT payment was
  // dropped as a duplicate: no transaction, no shared bill, and a receipt that
  // still said the friend had been added.
  test('a payment made after backing out of a split still lands', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await tapNav(page, 'Scan');
    await splitWithSarah(page, 'Kopitiam');
    await expect(page.getByRole('heading', { name: 'Bill Paid!' })).toBeVisible();
    await page.getByRole('button', { name: /Back to Home/ }).click();

    // Back into the split flow, then out to the scan screen via its own header.
    await page.goBack();
    await page.goBack();
    await page.goBack();
    await page.goBack();
    await expect(page.getByText('Amount per person')).toBeVisible();
    await page.getByRole('button', { name: /^Back from Split Bill/ }).click();
    await expect(page.getByRole('heading', { name: 'Ready to scan' })).toBeVisible();

    // A different stall, and therefore a different payment.
    await splitWithSarah(page, 'Uniqlo');
    await expect(page.getByRole('heading', { name: 'Bill Paid!' })).toBeVisible();
    await page.getByRole('button', { name: /Back to Home/ }).click();

    await openHistory(page);
    await expect(page.getByText('2 of 2 transactions')).toBeVisible();
    await expect(page.getByText('Uniqlo').first()).toBeVisible();

    await page.getByRole('button', { name: 'Back from Transaction History' }).click();
    await openSharedBills(page);
    await expect(page.getByRole('button', { name: /Uniqlo/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Kopitiam/ })).toBeVisible();
  });

  // Confirming the same payment again is one payment, not two. It must say so
  // rather than announcing a split it did not write.
  test('confirming the same payment again neither charges twice nor claims a new split', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await tapNav(page, 'Scan');
    await splitWithSarah(page, 'Kopitiam');
    await expect(page.getByRole('heading', { name: 'Bill Paid!' })).toBeVisible();
    await page.getByRole('button', { name: /Back to Home/ }).click();

    // Back to the breakdown screen and pay again, as a swipe-back invites.
    await page.goBack();
    await page.goBack();
    await expect(page.getByText('Participants')).toBeVisible();
    await page.getByRole('button', { name: 'Pay Full Bill & Send Requests' }).click();

    await expect(page.getByRole('heading', { name: 'Already Paid' })).toBeVisible();
    await expect(page.getByText(/^Already paid — this bill/)).toBeVisible();
    await page.getByRole('button', { name: /Back to Home/ }).click();

    // One payment, one debit, one shared bill.
    await openHistory(page);
    await expect(page.getByText('1 of 1 transaction')).toBeVisible();

    await page.getByRole('button', { name: 'Back from Transaction History' }).click();
    await openSharedBills(page);
    await expect(page.getByRole('button', { name: /Kopitiam/ })).toHaveCount(1);
  });
});
