import { expect, test, type Page } from '@playwright/test';
import { USERS, openHistory, signInAsCustomer, tapNav } from './helpers';

/** The dashboard has no bottom navigation, so step back to Profile first. */
async function leaveDashboard(page: Page): Promise<void> {
  const back = page.getByRole('button', { name: 'Back to profile' });
  if (await back.isVisible().catch(() => false)) await back.click();
}

async function readBalance(page: Page): Promise<number> {
  await leaveDashboard(page);
  await tapNav(page, 'Home');
  const text = await page.locator('h1').filter({ hasText: /^\$/ }).first().innerText();
  return Number(text.replace(/[$,]/g, ''));
}

async function openGoals(page: Page): Promise<void> {
  await tapNav(page, 'Profile');
  await page.getByRole('button', { name: /Spending Dashboard/ }).click();
  await page.getByRole('button', { name: 'goals', exact: true }).click();
}

async function createGoal(page: Page, name: string, target: string): Promise<void> {
  await page.getByRole('button', { name: 'New Savings Goal' }).click();
  await page.getByPlaceholder('Goal name (e.g. New Laptop)').fill(name);
  await page.getByPlaceholder('Target amount (SGD)').fill(target);
  await page.getByRole('button', { name: 'Create Goal' }).click();
  await expect(page.getByText(name)).toBeVisible();
}

test.describe('Savings goals', () => {
  test('contributing to a goal moves the money out of the wallet balance', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    const before = await readBalance(page);

    await openGoals(page);
    await createGoal(page, 'New Laptop', '1000');

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: '$200', exact: true }).click();
    await page.getByRole('button', { name: /Contribute/ }).click();

    // The goal reflects it...
    await expect(page.getByText('$200.00 of $1,000.00')).toBeVisible();

    // ...and so does the wallet: the money has left it.
    const after = await readBalance(page);
    expect(after).toBeCloseTo(before - 200, 2);
  });

  test('a goal contribution is recorded in transaction history', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await openGoals(page);
    await createGoal(page, 'Holiday', '500');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: '$50', exact: true }).click();
    await page.getByRole('button', { name: /Contribute/ }).click();
    await expect(page.getByText('$50.00 of $500.00')).toBeVisible();

    await leaveDashboard(page);
    await openHistory(page);
    await expect(page.getByText('Goal Contribution').first()).toBeVisible();
    await expect(page.getByText('Holiday').first()).toBeVisible();
  });

  test('money can be taken back out of a goal', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    const before = await readBalance(page);

    await openGoals(page);
    await createGoal(page, 'Emergency Fund', '2000');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: '$100', exact: true }).click();
    await page.getByRole('button', { name: /Contribute/ }).click();
    await expect(page.getByText('$100.00 of $2,000.00')).toBeVisible();

    await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
    await page.getByPlaceholder('Custom amount').fill('100');
    await page.getByRole('button', { name: /Withdraw \$/ }).click();

    await expect(page.getByText('$0.00 of $2,000.00')).toBeVisible();
    expect(await readBalance(page)).toBeCloseTo(before, 2);
  });

  test('a goal cannot be funded beyond the available balance', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    const before = await readBalance(page);

    await openGoals(page);
    await createGoal(page, 'Impossible Goal', '999999');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByPlaceholder('Custom amount').fill(String(before + 500));

    await expect(page.getByText(/only have .* available/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Contribute/ })).toBeDisabled();
  });
});
