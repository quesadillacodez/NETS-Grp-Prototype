import { expect, test, type Page } from '@playwright/test';
import { USERS, signInAsCustomer, tapNav } from './helpers';

/**
 * Every distance badge currently on screen, in kilometres, in display order.
 * The regex is deliberately unanchored: Playwright matches a regex against the
 * element's raw text, which keeps the whitespace around the icon.
 */
async function distancesOnScreen(page: Page): Promise<number[]> {
  const labels = await page.getByText(/\d+(\.\d+)? (m|km) away/).allInnerTexts();
  return labels.map((label) => {
    const match = /(\d+(?:\.\d+)?) (m|km) away/.exec(label);
    if (!match) throw new Error(`Unparsable distance label: ${label}`);
    return match[2] === 'm' ? Number(match[1]) / 1000 : Number(match[1]);
  });
}

test.describe('Nearby Hangouts', () => {
  test('the Near you tab shows distances from Alex, closest first', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Hangouts');
    await page.getByRole('button', { name: 'Near you' }).click();

    // The demo location is stated plainly so the filtering is explainable.
    await expect(page.getByText('Hangouts near you')).toBeVisible();
    await expect(page.getByText('Orchard', { exact: true })).toBeVisible();

    const distances = await distancesOnScreen(page);
    expect(distances.length).toBeGreaterThan(0);

    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);
  });

  test('the radius filter narrows and widens the list', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Hangouts');
    await page.getByRole('button', { name: 'Near you' }).click();

    await page.getByRole('button', { name: '10 km' }).click();
    const wide = await distancesOnScreen(page);

    await page.getByRole('button', { name: '2 km' }).click();
    const narrow = await distancesOnScreen(page);

    expect(narrow.length).toBeLessThanOrEqual(wide.length);
    // Nothing beyond the chosen radius survives the filter.
    for (const distance of narrow) expect(distance).toBeLessThanOrEqual(2);
    await expect(page.getByText(/of \d+ ideas within 2 km/)).toBeVisible();
  });

  test('a radius with nothing in it explains itself rather than showing an empty grid', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Hangouts');
    await page.getByRole('button', { name: 'Near you' }).click();
    await page.getByRole('button', { name: '2 km' }).click();

    // Either there are results within 2 km, or the empty state offers a way out.
    const results = await distancesOnScreen(page);
    if (results.length === 0) {
      await expect(page.getByRole('heading', { name: 'Nothing within 2 km' })).toBeVisible();
      await page.getByRole('button', { name: /Search within 10 km/ }).click();
      expect((await distancesOnScreen(page)).length).toBeGreaterThan(0);
    }
  });
});

test.describe('Changing your location', () => {
  test('moving to another area re-ranks the Hangout suggestions', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Hangouts');
    await page.getByRole('button', { name: 'Near you' }).click();
    await page.getByRole('button', { name: '10 km' }).click();

    const firstFromOrchard = await page.getByRole('heading', { level: 3 }).first().innerText();

    // Move across the island.
    await page.getByRole('button', { name: /Change your location/ }).click();
    await expect(page.getByRole('heading', { name: 'Set your location' })).toBeVisible();
    await page.getByRole('button', { name: /^Mandai/ }).click();

    // The banner follows, and so does the ranking.
    await expect(page.getByText('Mandai', { exact: true }).first()).toBeVisible();
    const firstFromMandai = await page.getByRole('heading', { level: 3 }).first().innerText();
    expect(firstFromMandai).not.toBe(firstFromOrchard);
    // The Night Safari is the one thing actually in Mandai.
    expect(firstFromMandai).toContain('Night Safari');
  });

  test('the location can be searched and reset', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Hangouts');
    await page.getByRole('button', { name: 'Near you' }).click();

    await page.getByRole('button', { name: /Change your location/ }).click();
    await page.getByLabel('Search an area').fill('tamp');
    await page.getByRole('button', { name: /^Tampines/ }).click();
    await expect(page.getByText('Tampines', { exact: true }).first()).toBeVisible();

    // Reset puts Alex back in Orchard.
    await page.getByRole('button', { name: /Change your location/ }).click();
    await page.getByRole('button', { name: /Reset to my usual area/ }).click();
    await expect(page.getByText('Orchard', { exact: true }).first()).toBeVisible();
  });

  test('the location set in Hangouts also drives the rewards store', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Hangouts');
    await page.getByRole('button', { name: 'Near you' }).click();
    await page.getByRole('button', { name: /Change your location/ }).click();
    await page.getByRole('button', { name: /^Ang Mo Kio/ }).click();

    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();

    // The campus food court is on Alex's doorstep now, and Orchard is not.
    await expect(page.getByText(/outlets within 5 km of Ang Mo Kio/)).toBeVisible();
    await page.getByRole('button', { name: /Near me/ }).click();
    await expect(page.getByText('NYP Campus Food Court')).toBeVisible();
    await expect(page.getByText('LiHO TEA')).toHaveCount(0);
  });
});

test.describe('Nearby rewards', () => {
  test('the store shows how far each outlet is', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();

    // Nearby food outlets are labelled with a real distance from Orchard.
    await expect(page.getByText(/outlets within 5 km of Orchard/)).toBeVisible();
    expect((await distancesOnScreen(page)).length).toBeGreaterThan(0);
  });

  test('Near me keeps close outlets and drops far ones', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();

    // Off: the far-away campus food court in Ang Mo Kio is listed.
    await expect(page.getByText('NYP Campus Food Court')).toBeVisible();

    await page.getByRole('button', { name: /Near me/ }).click();

    // On: only outlets within 5 km of Orchard remain.
    await expect(page.getByText(/rewards near Orchard/)).toBeVisible();
    await expect(page.getByText('NYP Campus Food Court')).toHaveCount(0);
    await expect(page.getByText('LiHO TEA').first()).toBeVisible();

    for (const distance of await distancesOnScreen(page)) {
      expect(distance).toBeLessThanOrEqual(5);
    }
  });

  test('rewards are illustrated with an emoji that fits the merchant', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();

    await expect(page.getByText('🧋')).toBeVisible();  // LiHO bubble tea
    await expect(page.getByText('☕')).toBeVisible();  // Kopitiam coffee
    await expect(page.getByText('🍗')).toBeVisible();  // chicken rice
    await expect(page.getByText('💵').first()).toBeVisible();  // wallet cashback
  });

  test('a reward detail names the outlet and its distance', async ({ page }) => {
    await signInAsCustomer(page, USERS.alex);
    await tapNav(page, 'Rewards');
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.getByRole('button', { name: /\$2 Off Chicken Rice Set/ }).click();

    await expect(page.getByText(/Tiong Bahru · .* away/)).toBeVisible();
  });
});
