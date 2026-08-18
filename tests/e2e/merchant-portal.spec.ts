import { expect, test } from '@playwright/test';
import {
  USERS, loadDemoScenario, signIn, signInAsCustomer, signInAsMerchant, signOut,
  signOutOfMerchant, tapNav,
} from './helpers';

/** The stalls only have trade once the presentation scenario has been loaded. */
async function seedTrade(page: import('@playwright/test').Page): Promise<void> {
  await signInAsCustomer(page, USERS.alex);
  await loadDemoScenario(page);
  await signOut(page);
}

test.describe('Signing in as a merchant', () => {
  test('a merchant lands in their own portal, not the customer wallet', async ({ page }) => {
    await signInAsMerchant(page, USERS.kopitiam);

    await expect(page).toHaveURL(/\/merchant$/);
    await expect(page.getByRole('heading', { name: 'Kopitiam' })).toBeVisible();
    // None of the customer app is reachable from here.
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toHaveCount(0);
  });

  test('a merchant is not a contact customers can split a bill with', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Hangouts');

    // The stalls have accounts, but they are not people to invite.
    await expect(page.getByText('Kopitiam', { exact: true })).toHaveCount(0);
  });
});

test.describe('The merchant dashboard', () => {
  test('names the best seller and what it earns', async ({ page }) => {
    await seedTrade(page);
    await signInAsMerchant(page, USERS.kopitiam);

    // The whole point of the feature: the stall sees the dish, not just a total.
    await expect(page.getByText('Your best seller')).toBeVisible();
    await expect(page.getByText('Nasi Lemak').first()).toBeVisible();
    await expect(page.getByText(/sold · \$/).first()).toBeVisible();
    await expect(page.getByText(/Sells most around/)).toBeVisible();

    // And the ranked list behind it.
    await expect(page.getByRole('heading', { name: 'What sells' })).toBeVisible();
    await expect(page.getByText(/peaks \d/).first()).toBeVisible();
  });

  test('takings agree with the items sold', async ({ page }) => {
    await seedTrade(page);
    await signInAsMerchant(page, USERS.kopitiam);

    // Every seeded item sale is also a payment, so the stall's takings and its
    // menu report describe the same trade rather than two different stories.
    await expect(page.getByText('Takings')).toBeVisible();
    const takings = await page.locator('p').filter({ hasText: /^\$\d/ }).first().innerText();
    expect(Number(takings.replace(/[$,]/g, ''))).toBeGreaterThan(100);
  });

  test('flags what is on the menu but never sells', async ({ page }) => {
    await seedTrade(page);
    await signInAsMerchant(page, USERS.kopitiam);

    await expect(page.getByRole('heading', { name: 'Not selling' })).toBeVisible();
    await expect(page.getByText(/Milo Dinosaur/)).toBeVisible();
  });

  test('one stall cannot see another stall\'s trade', async ({ page }) => {
    await seedTrade(page);

    await signInAsMerchant(page, USERS.kopitiam);
    await expect(page.getByText('Nasi Lemak').first()).toBeVisible();
    await signOutOfMerchant(page);

    // The bubble tea stall sees its own menu and none of the kopitiam's.
    await signInAsMerchant(page, USERS.bubbletea);
    await expect(page.getByText('Brown Sugar Milk Tea').first()).toBeVisible();
    await expect(page.getByText('Nasi Lemak')).toHaveCount(0);
  });
});

test.describe('Managing the menu', () => {
  test('an item can be added, marked sold out and removed', async ({ page }) => {
    await signInAsMerchant(page, USERS.kopitiam);
    await page.getByRole('button', { name: 'menu', exact: true }).click();

    await page.getByRole('button', { name: /Add item/ }).click();
    await page.getByLabel('Item name').fill('Laksa');
    await page.getByLabel('Price (SGD)').fill('5.50');
    await page.getByRole('button', { name: 'Add to menu' }).click();

    const row = page.locator('li').filter({ hasText: 'Laksa' }).first();
    await expect(row).toContainText('$5.50');
    await expect(row).toContainText('not sold yet');

    // Sold out for today, then back on.
    await row.getByRole('button', { name: 'Available' }).click();
    await expect(row.getByRole('button', { name: 'Sold out' })).toBeVisible();

    await row.getByRole('button', { name: /Remove Laksa/ }).click();
    await expect(page.getByText('Laksa')).toHaveCount(0);
  });

  test('the same dish cannot be added twice', async ({ page }) => {
    await signInAsMerchant(page, USERS.kopitiam);
    await page.getByRole('button', { name: 'menu', exact: true }).click();

    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole('button', { name: /Add item/ }).click();
      await page.getByLabel('Item name').fill('Mee Rebus');
      await page.getByLabel('Price (SGD)').fill('4.00');
      await page.getByRole('button', { name: 'Add to menu' }).click();
    }

    // Two rows of the same name would split that dish's sales in the report.
    await expect(page.getByRole('alert')).toContainText(/already on your menu/i);
  });

  test('a price has to be a real price', async ({ page }) => {
    await signInAsMerchant(page, USERS.kopitiam);
    await page.getByRole('button', { name: 'menu', exact: true }).click();

    await page.getByRole('button', { name: /Add item/ }).click();
    await page.getByLabel('Item name').fill('Free Sample');
    await page.getByLabel('Price (SGD)').fill('0');
    await page.getByRole('button', { name: 'Add to menu' }).click();

    await expect(page.getByRole('alert')).toContainText(/greater than zero/i);
  });
});

test.describe('Paying for a dish', () => {
  test('choosing an item at payment tells the stall what sold', async ({ page }) => {
    // Give the kopitiam a menu, then buy from it as a customer.
    await signInAsMerchant(page, USERS.kopitiam);
    await page.getByRole('button', { name: 'menu', exact: true }).click();
    await page.getByRole('button', { name: /Add item/ }).click();
    await page.getByLabel('Item name').fill('Nasi Lemak');
    await page.getByLabel('Price (SGD)').fill('3.50');
    await page.getByRole('button', { name: 'Add to menu' }).click();
    await expect(page.getByText('Nasi Lemak').first()).toBeVisible();
    await signOutOfMerchant(page);

    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Scan');
    await page.getByRole('button', { name: 'Kopitiam', exact: true }).click();

    // The stall keeps a menu, so the customer says what they bought.
    await page.getByRole('button', { name: /^Nasi Lemak/ }).click();
    await expect(page.getByRole('button', { name: /^Nasi Lemak/ })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Scan', exact: true }).last().click();
    await page.getByRole('button', { name: 'Pay Full Amount' }).click();
    await expect(page.getByText('Welcome back, Alex!')).toBeVisible();
    await signOut(page);

    // Back at the stall, that plate is now in the report.
    await signInAsMerchant(page, USERS.kopitiam);
    await expect(page.getByText('Your best seller')).toBeVisible();
    await expect(page.getByText('Nasi Lemak').first()).toBeVisible();
    await expect(page.getByText(/1 sold/).first()).toBeVisible();
  });
});

test.describe('A merchant buying placement', () => {
  test('a stall can promote only its own reward, and sees what it paid', async ({ page }) => {
    await signInAsMerchant(page, USERS.kopitiam);
    await page.getByRole('button', { name: 'rewards', exact: true }).click();

    // The picker offers this stall's rewards and nobody else's.
    const picker = page.getByLabel('Reward');
    await expect(picker).toBeVisible();
    const options = await picker.locator('option').allInnerTexts();
    expect(options.join(' ')).not.toContain('Milk Tea');

    await picker.selectOption({ index: 1 });
    await page.getByRole('button', { name: /^Featured ·/ }).click();
    await page.getByRole('button', { name: '7 days' }).click();
    await page.getByRole('button', { name: 'Book placement' }).click();

    await expect(page.getByText(/is now featured for 7 days/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your placements' })).toBeVisible();
    await expect(page.getByText('You paid')).toBeVisible();
  });

  test('the return-rate panel says plainly whether rewards worked', async ({ page }) => {
    await seedTrade(page);
    await signInAsMerchant(page, USERS.kopitiam);
    await page.getByRole('button', { name: 'rewards', exact: true }).click();

    await expect(page.getByRole('heading', { name: /Did your rewards bring people back/ })).toBeVisible();
    await expect(page.getByText(/came back and paid you/)).toBeVisible();
  });
});

test.describe('Role separation', () => {
  test('the management portal still belongs to the admin alone', async ({ page }) => {
    await signIn(page, USERS.admin);
    await expect(page.getByText('Management Portal')).toBeVisible();
    // The admin sees every stall; a merchant sees one.
    await page.getByRole('button', { name: 'rewards', exact: true }).click();
    await expect(page.getByText('Merchants tracked')).toBeVisible();
  });
});
