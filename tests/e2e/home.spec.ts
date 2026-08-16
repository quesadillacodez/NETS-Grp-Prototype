import { expect, test, type Page } from '@playwright/test';
import { USERS, signInAsCustomer, signOut, tapNav } from './helpers';

/** The balance on the card currently in view — the only one that is a heading. */
async function shownBalance(page: Page): Promise<number> {
  const text = await page.locator('h1').filter({ hasText: /^\$/ }).first().innerText();
  return Number(text.replace(/[$,]/g, ''));
}

function dot(page: Page, cardName: string) {
  return page.getByRole('button', { name: `Show ${cardName}` });
}

/**
 * The Quick Actions editor, as a dialog. Scoping through it keeps its rows
 * apart from the shortcuts and navigation on the screen behind the sheet, which
 * carry the same names.
 */
function editor(page: Page) {
  return page.getByRole('dialog', { name: 'Edit Quick Actions' });
}

/** The shortcut row itself — "Reminders" here is not the bell in the header. */
function shortcuts(page: Page) {
  return page.getByRole('navigation', { name: 'Quick actions' });
}

/** Bring a card into view and open its detail sheet. */
async function openCard(page: Page, cardName: string): Promise<void> {
  await dot(page, cardName).click();
  await page.getByRole('button', { name: new RegExp(`^${cardName},`) }).click();
  await expect(page.getByRole('heading', { name: cardName })).toBeVisible();
}

test.describe('The card carousel', () => {
  test('starts on the vCashCard and moves between real NETS cards', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    // The wallet card is the one in view, and the only one announced.
    await expect(dot(page, 'NETS vCashCard')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('button', { name: /^NETS vCashCard, \$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^NETS Prepaid Card, \$/ })).toBeHidden();

    await dot(page, 'NETS Prepaid Card').click();
    await expect(dot(page, 'NETS Prepaid Card')).toHaveAttribute('aria-current', 'true');
    expect(await shownBalance(page)).toBe(120);

    await dot(page, 'NETS Motoring CashCard').click();
    expect(await shownBalance(page)).toBe(48.6);
  });

  test('swiping the carousel changes the card in view', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    // A swipe is a native horizontal scroll of the track, so this drives the
    // same code path a finger does rather than a synthetic click.
    const track = page.getByRole('group', { name: /Your NETS cards/ });
    await track.evaluate((element: HTMLElement) => {
      element.scrollTo({ left: element.clientWidth, behavior: 'auto' });
    });

    await expect(dot(page, 'NETS Prepaid Card')).toHaveAttribute('aria-current', 'true');
    expect(await shownBalance(page)).toBe(120);
  });

  test('the carousel can be driven from the keyboard', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await page.getByRole('group', { name: /Your NETS cards/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(dot(page, 'NETS Prepaid Card')).toHaveAttribute('aria-current', 'true');

    await page.keyboard.press('ArrowLeft');
    await expect(dot(page, 'NETS vCashCard')).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('Moving money between cards', () => {
  test('loading a prepaid card takes the money out of the wallet', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    const walletBefore = await shownBalance(page);

    await openCard(page, 'NETS Prepaid Card');
    await page.getByRole('button', { name: 'Add money' }).click();
    await page.getByRole('button', { name: '$50', exact: true }).click();
    await page.getByRole('button', { name: /^Load \$50/ }).click();

    await expect(page.getByText('$50.00 loaded onto your NETS Prepaid Card.')).toBeVisible();
    await page.getByRole('button', { name: 'Close card details' }).click();

    // The card holds it...
    expect(await shownBalance(page)).toBe(170);

    // ...and the wallet is down by exactly that much.
    await dot(page, 'NETS vCashCard').click();
    expect(await shownBalance(page)).toBeCloseTo(walletBefore - 50, 2);
  });

  test('money can be moved back off a card, and both moves are in the history', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    const walletBefore = await shownBalance(page);

    await openCard(page, 'NETS Motoring CashCard');
    await page.getByRole('button', { name: 'Add money' }).click();
    await page.getByRole('button', { name: '$20', exact: true }).click();
    await page.getByRole('button', { name: /^Load \$20/ }).click();
    await expect(page.getByText(/loaded onto your NETS Motoring CashCard/)).toBeVisible();

    await page.getByRole('button', { name: 'Move to wallet' }).click();
    await page.getByRole('button', { name: '$20', exact: true }).click();
    await page.getByRole('button', { name: /^Move \$20/ }).click();
    await expect(page.getByText('$20.00 returned to your wallet.')).toBeVisible();

    await page.getByRole('button', { name: 'Close card details' }).click();
    await dot(page, 'NETS vCashCard').click();
    expect(await shownBalance(page)).toBeCloseTo(walletBefore, 2);

    // Both movements are recorded, and neither is spending.
    await page.getByRole('button', { name: 'History', exact: true }).last().click();
    await expect(page.getByText('Card Load').first()).toBeVisible();
    await expect(page.getByText('Card Unload').first()).toBeVisible();
  });

  test('a frozen card refuses to move money until it is unfrozen', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await openCard(page, 'NETS Prepaid Card');
    await page.getByRole('button', { name: 'Freeze card' }).click();
    await expect(page.getByText(/Card frozen/)).toBeVisible();

    await page.getByRole('button', { name: 'Add money' }).click();
    await page.getByRole('button', { name: '$10', exact: true }).click();
    await page.getByRole('button', { name: /^Load \$10/ }).click();
    await expect(page.getByRole('alert')).toContainText('frozen');

    // The card face says so too.
    await page.getByRole('button', { name: 'Close card details' }).click();
    await expect(page.getByRole('button', { name: /^NETS Prepaid Card,.*frozen/ })).toBeVisible();

    await openCard(page, 'NETS Prepaid Card');
    await page.getByRole('button', { name: 'Unfreeze card' }).click();
    await expect(page.getByText(/Card unfrozen/)).toBeVisible();
  });

  test('the vCashCard sends you to Top-up instead, being the wallet itself', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await page.getByRole('button', { name: /^NETS vCashCard, \$/ }).click();
    await expect(page.getByText('Your main wallet balance')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Freeze card' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Top up your wallet' }).click();
    await expect(page.getByRole('heading', { name: /Top.?up/i }).first()).toBeVisible();
  });
});

test.describe('Editing Quick Actions', () => {
  test('a shortcut can be swapped, and the choice survives signing out', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await expect(shortcuts(page).getByRole('button', { name: 'Reminders' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit quick actions' }).click();
    // Drop Reminders, and put Wrapped in the slot it leaves behind.
    await editor(page).getByRole('button', { name: /^Reminders/ }).click();
    await editor(page).getByRole('button', { name: /^Wrapped/ }).click();
    await editor(page).getByRole('button', { name: 'Save Quick Actions' }).click();

    await expect(shortcuts(page).getByRole('button', { name: 'Wrapped' })).toBeVisible();
    await expect(shortcuts(page).getByRole('button', { name: 'Reminders' })).toHaveCount(0);

    // The shortcut works.
    await shortcuts(page).getByRole('button', { name: 'Wrapped' }).click();
    await expect(page).toHaveURL(/\/wrapped$/);
    await tapNav(page, 'Home');

    // It belongs to the account, not the page.
    await signOut(page);
    await signInAsCustomer(page, USERS.alex);
    await expect(shortcuts(page).getByRole('button', { name: 'Wrapped' })).toBeVisible();
  });

  test('exactly four actions can be chosen', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await page.getByRole('button', { name: 'Edit quick actions' }).click();

    // Four are already chosen, so the rest cannot be added.
    await expect(page.getByText('4 of 4 chosen')).toBeVisible();
    await expect(editor(page).getByRole('button', { name: /^Rewards/ })).toBeDisabled();

    // Free a slot and saving is blocked until it is filled again.
    await editor(page).getByRole('button', { name: /^History/ }).click();
    await expect(page.getByText('3 of 4 chosen')).toBeVisible();
    await expect(editor(page).getByRole('button', { name: 'Choose 1 more' })).toBeDisabled();

    await editor(page).getByRole('button', { name: /^Rewards/ }).click();
    await editor(page).getByRole('button', { name: 'Save Quick Actions' }).click();
    await expect(shortcuts(page).getByRole('button', { name: 'Rewards' })).toBeVisible();
  });

  test('the defaults can be restored', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);

    await page.getByRole('button', { name: 'Edit quick actions' }).click();
    await editor(page).getByRole('button', { name: /^Reminders/ }).click();
    await editor(page).getByRole('button', { name: /^Dashboard/ }).click();
    await editor(page).getByRole('button', { name: 'Save Quick Actions' }).click();
    await expect(shortcuts(page).getByRole('button', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit quick actions' }).click();
    await editor(page).getByRole('button', { name: /Reset to the defaults/ }).click();
    await editor(page).getByRole('button', { name: 'Save Quick Actions' }).click();

    await expect(shortcuts(page).getByRole('button', { name: 'Reminders' })).toBeVisible();
    await expect(shortcuts(page).getByRole('button', { name: 'Dashboard' })).toHaveCount(0);
  });
});
