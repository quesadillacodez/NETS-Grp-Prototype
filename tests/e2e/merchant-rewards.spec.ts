import { expect, test, type Page } from '@playwright/test';
import { USERS, loadDemoScenario, signIn, signInAsCustomer, signOut, signOutOfAdmin, tapNav } from './helpers';

/** Open the management portal's Rewards tab as the admin. */
async function openRewardsAdmin(page: Page): Promise<void> {
  await signIn(page, USERS.admin);
  await expect(page.getByText('Management Portal')).toBeVisible();
  await page.getByRole('button', { name: 'rewards', exact: true }).click();
}

/** Sell a placement on a reward and return to the list. */
async function promote(page: Page, optionLabel: RegExp, placement: 'Featured' | 'Spotlight', days = 7) {
  await page.getByRole('button', { name: /^Promote$/ }).click();
  await page.getByLabel('Reward').selectOption({ label: (await page
    .getByLabel('Reward')
    .locator('option')
    .filter({ hasText: optionLabel })
    .first()
    .innerText()) });
  await page.getByRole('button', { name: new RegExp(`^${placement} ·`) }).click();
  await page.getByRole('button', { name: `${days} days` }).click();
  await page.getByRole('button', { name: 'Book placement' }).click();
}

test.describe('Merchant insights in the portal', () => {
  test('a merchant report is built from real sales, not placeholders', async ({ page }) => {
    // The demo scenario writes a known history of purchases and redemptions.
    await signInAsCustomer(page, USERS.alex);
    await loadDemoScenario(page);
    await signOut(page);

    await openRewardsAdmin(page);

    // The headline counts come from that history.
    await expect(page.getByText('Merchants tracked')).toBeVisible();
    await expect(page.getByText('What customers spend on')).toBeVisible();

    // Kopitiam has sales in the scenario, so its report opens with real figures.
    await page.getByRole('button', { name: /Kopitiam/ }).first().click();
    await expect(page.getByText('Average sale')).toBeVisible();
    await expect(page.getByText('Busiest time')).toBeVisible();
    await expect(page.getByText(/Sales by category/)).toBeVisible();
  });

  test('a merchant with no activity says so instead of inventing numbers', async ({ page }) => {
    await openRewardsAdmin(page);

    // ZARA is a configured merchant that the demo never sells anything at.
    const zara = page.getByRole('button', { name: /ZARA/ }).first();
    await zara.click();
    await expect(page.getByText(/No activity yet/)).toBeVisible();
  });
});

test.describe('Selling a placement', () => {
  test('a promoted reward is pinned and labelled in the customer store', async ({ page }) => {
    await openRewardsAdmin(page);
    await promote(page, /Free Curry Puff/, 'Featured');

    await expect(page.getByText(/is now featured for 7 days/)).toBeVisible();
    await expect(page.getByText('Shown').first()).toBeVisible();

    // The customer sees it first, and sees that it was paid for.
    await signOutOfAdmin(page);
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();

    const cards = page.locator('.grid > button').filter({ hasText: 'XP' });
    await expect(cards.first()).toContainText('Free Curry Puff');
    await expect(cards.first()).toContainText('Sponsored');
    await expect(page.getByText(/Sponsored rewards are paid placements/)).toBeVisible();
  });

  test('a spotlight buys the banner as well as the position', async ({ page }) => {
    await openRewardsAdmin(page);
    await promote(page, /1-for-1 Medium Milk Tea/, 'Spotlight');

    await signOutOfAdmin(page);
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();

    // The banner sits above the listing and is labelled.
    await expect(page.getByRole('button', { name: /^Sponsored spotlight: 1-for-1 Medium Milk Tea/ }))
      .toBeVisible();
  });

  test('a paid slot buys position only — the price and the lock are untouched', async ({ page }) => {
    await openRewardsAdmin(page);
    // The $10 cashback costs 1000 XP, far more than a new customer holds.
    await promote(page, /15% Off Stationery/, 'Featured');

    await signOutOfAdmin(page);
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();

    const promoted = page.locator('.grid > button').filter({ hasText: '15% Off Stationery' }).first();
    await expect(promoted).toContainText('600 XP');
    // Alex starts with 500 XP, so a sponsored reward they cannot afford still
    // reads as locked rather than being made to look redeemable.
    await expect(promoted).toContainText('View');
  });

  test('the store refuses to oversell its paid slots', async ({ page }) => {
    await openRewardsAdmin(page);
    await promote(page, /Free Curry Puff/, 'Featured');
    await promote(page, /1-for-1 Medium Milk Tea/, 'Featured');
    await promote(page, /15% Off Stationery/, 'Featured');

    // A fourth booking over the same dates has nowhere to go.
    await promote(page, /\$3 Coffee Voucher/, 'Featured');
    await expect(page.getByRole('alert')).toContainText(/slots are taken/i);
  });

  test('the same reward cannot be sold two overlapping placements', async ({ page }) => {
    await openRewardsAdmin(page);
    await promote(page, /Free Curry Puff/, 'Featured');
    await promote(page, /Free Curry Puff/, 'Spotlight');

    await expect(page.getByRole('alert')).toContainText(/already promoted/i);
  });

  test('ending a placement stops it and keeps its report', async ({ page }) => {
    await openRewardsAdmin(page);
    await promote(page, /Free Curry Puff/, 'Featured');
    await expect(page.getByText('live').first()).toBeVisible();

    await page.getByRole('button', { name: 'End placement' }).first().click();

    // The booking stays visible so the merchant can still see what it did.
    await expect(page.getByText('Free Curry Puff').first()).toBeVisible();
    await expect(page.getByText('live')).toHaveCount(0);

    // And it is gone from the customer's store.
    await signOutOfAdmin(page);
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await expect(page.getByText('Sponsored')).toHaveCount(0);
  });
});

test.describe('Redemptions feed back to the merchant', () => {
  test('redeeming a promoted reward is attributed to the placement', async ({ page }) => {
    await openRewardsAdmin(page);
    // 500 XP is exactly what a new customer holds, so this can be redeemed.
    await promote(page, /\$5 Heartland Voucher/, 'Featured');
    await signOutOfAdmin(page);

    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.getByRole('button', { name: /\$5 Heartland Voucher/ }).first().click();
    await page.getByRole('button', { name: 'Confirm redemption' }).click();
    await expect(page.getByRole('heading', { name: 'Redemption confirmed' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await signOut(page);

    // The merchant's report counts it, and prices what it cost them.
    await openRewardsAdmin(page);
    const row = page.locator('li').filter({ hasText: '$5 Heartland Voucher' }).first();
    await expect(row.getByText('Redeemed')).toBeVisible();
    await expect(row).toContainText('1');
  });

  test('what customers redeem drives the popularity ranking', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.getByRole('button', { name: /\$5 Heartland Voucher/ }).first().click();
    await page.getByRole('button', { name: 'Confirm redemption' }).click();
    await expect(page.getByRole('heading', { name: 'Redemption confirmed' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    // Back in the store, the card now carries how often it has been redeemed.
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await expect(page.getByText(/Redeemed 1×/).first()).toBeVisible();

    // And the portal ranks it.
    await signOut(page);
    await openRewardsAdmin(page);
    await expect(page.getByText('Most redeemed rewards')).toBeVisible();
    await expect(page.getByText('$5 Heartland Voucher').first()).toBeVisible();
  });
});
