import { expect, test } from '@playwright/test';
import { USERS, signInAsCustomer, tapNav } from './helpers';

test('a page whose chunk has gone recovers instead of dead-ending', async ({ page }) => {
  await signInAsCustomer(page, USERS.alex);

  // Exactly what a deployment does to a tab that was already open: the chunk
  // the app asks for is no longer on the server. Failing it once leaves the
  // second attempt — after the reload — to succeed, as a real redeploy would.
  await page.route('**/assets/WrappedPage-*.js', route => route.abort(), { times: 1 });

  await tapNav(page, 'Profile');
  await page.getByRole('button', { name: /NETS Wrapped/ }).click();

  // No "Something went wrong": the app reloads itself and arrives at the page
  // it was asked for, still signed in.
  await expect(page).toHaveURL(/\/wrapped/);
  await expect(page.getByText(/Wrapped/).first()).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('Failed to fetch dynamically imported module')).toHaveCount(0);
});
