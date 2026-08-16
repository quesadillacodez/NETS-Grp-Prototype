import { expect, test } from '@playwright/test';
import { USERS, signIn, signInAsCustomer, tapNav } from './helpers';

/**
 * Runs in the `compact-phone` project at 320px — the narrowest width the app
 * supports, and the width at which the admin header used to wrap and the tab
 * row exposed a horizontal scrollbar.
 */

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe('Compact phone (320px)', () => {
  test('the management portal header and tabs fit without horizontal scrolling', async ({ page }) => {
    await signIn(page, USERS.admin);
    await expect(page.getByText('Management Portal')).toBeVisible();

    // All four tabs are reachable without a scrollbar.
    for (const tab of ['overview', 'transactions', 'hangouts', 'merchants']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }

    await expectNoHorizontalOverflow(page);

    // The sign-out control collapses to an icon but keeps its accessible name.
    await expect(page.getByRole('button', { name: 'Sign out of the management portal' })).toBeVisible();

    await page.getByRole('button', { name: 'transactions', exact: true }).click();
    await expectNoHorizontalOverflow(page);
  });

  test('the customer wallet fits at 320px', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await expectNoHorizontalOverflow(page);

    await tapNav(page, 'Rewards');
    await expect(page.getByText(/earn and spend XP/)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await tapNav(page, 'Hangouts');
    await expect(page.getByRole('button', { name: 'Discover' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await tapNav(page, 'Profile');
    await expectNoHorizontalOverflow(page);
  });

  test('the card carousel and Quick Actions editor fit at 320px', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    // The carousel scrolls inside itself; the page behind it must not.
    await page.getByRole('button', { name: 'Show NETS Motoring CashCard' }).click();
    await expect(page.getByText('···· 5563')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Edit quick actions' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit Quick Actions' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('key controls meet the 44px minimum touch target', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    // Home: the control that opens the Quick Actions editor.
    const edit = await page.getByRole('button', { name: 'Edit quick actions' }).boundingBox();
    expect(edit?.height ?? 0).toBeGreaterThanOrEqual(44);

    await tapNav(page, 'Profile');

    for (const name of [/Personal Information/, /Payment Methods/, /Demo Controls/]) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole('button', { name: /Notifications/ }).click();
    const markAll = await page.getByRole('button', { name: 'Mark all as read' }).boundingBox();
    expect(markAll?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
