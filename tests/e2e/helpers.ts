import { expect, type Page } from '@playwright/test';

export interface TestUser {
  loginId: string;
  pin: string;
  name: string;
  firstName: string;
}

export const USERS: Record<'alex' | 'sarah' | 'mike' | 'admin' | 'merchant', TestUser> = {
  alex:  { loginId: 'alexchen140896',  pin: '111111', name: 'Alex Chen',  firstName: 'Alex' },
  sarah: { loginId: 'sarahtan230394',  pin: '222222', name: 'Sarah Tan',  firstName: 'Sarah' },
  mike:  { loginId: 'mikewong081192',  pin: '333333', name: 'Mike Wong',  firstName: 'Mike' },
  admin: { loginId: 'admin010180',     pin: '888888', name: 'Admin',      firstName: 'Admin' },
  merchant: { loginId: 'kopitiammerchant', pin: '555555', name: 'Kopitiam Merchant', firstName: 'Kopitiam' },
};

/**
 * The QR screen talks to the live NETS sandbox, which needs credentials that CI
 * does not have. Failing the request fast puts the screen into the simulation
 * fallback it already implements, so the payment journey is exercised without
 * depending on a third-party service being reachable.
 */
export async function stubNetsSandbox(page: Page): Promise<void> {
  await page.route('**/nets-qr/**', route => route.abort());
  await page.route('**/payments/nets/webhook**', route => route.abort());
}

/**
 * Open the app at the sign-in screen.
 *
 * Each Playwright browser context starts without a session. The production app
 * restores its HttpOnly session across reloads, so tests should sign out when
 * they specifically need to verify the signed-out state.
 */
export async function openApp(page: Page): Promise<void> {
  await stubNetsSandbox(page);
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in securely' }))
    .toBeVisible({ timeout: 45_000 });
}

export async function signIn(page: Page, user: TestUser): Promise<void> {
  // After signOut the app is already on the login screen, having navigated
  // there client-side. Reloading would throw away the loaded database and
  // replay the whole startup sequence for no benefit, so only load the page
  // when we are not already looking at the form.
  const submit = page.getByRole('button', { name: 'Sign in securely' });
  if (!await submit.isVisible().catch(() => false)) {
    await openApp(page);
  }

  await page.locator('#login-user-id').fill(user.loginId);
  await page.locator('#login-pin').fill(user.pin);
  await submit.click();
}

export async function signInAsCustomer(page: Page, user: TestUser): Promise<void> {
  await signIn(page, user);
  await expect(page.getByText(`Welcome back, ${user.firstName}!`)).toBeVisible();
}

/** Bottom navigation. The tab labels double as their accessible names. */
export async function tapNav(page: Page, tab: 'Home' | 'Scan' | 'Hangouts' | 'Rewards' | 'Profile'): Promise<void> {
  await page.getByRole('button', { name: tab, exact: true }).click();
}

/** Sign out from the Profile screen and return to the sign-in form. */
export async function signOut(page: Page): Promise<void> {
  const profileTab = page.getByRole('button', { name: 'Profile', exact: true });
  try {
    await profileTab.waitFor({ state: 'visible', timeout: 5_000 });
  } catch {
    // A detail screen (receipt, history) has no bottom navigation — step back once.
    await page.getByRole('button', { name: /^Back from / }).click();
    await profileTab.waitFor({ state: 'visible' });
  }
  await profileTab.click();
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in securely' })).toBeVisible();
}

/**
 * Sign out of the management portal, which has its own control rather than the
 * customer app's Profile screen.
 */
export async function signOutOfAdmin(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out of the management portal' }).click();
  await expect(page.getByRole('button', { name: 'Sign in securely' })).toBeVisible();
}

/**
 * Put the app into the repeatable presentation state via the in-app Demo
 * Controls, so a test that needs existing bills, repayments and plans does not
 * have to click through creating them first.
 */
export async function loadDemoScenario(page: Page): Promise<void> {
  await tapNav(page, 'Profile');
  await page.getByRole('button', { name: /Demo Controls/ }).click();
  await page.getByRole('button', { name: 'Load presentation scenario', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, load it' }).click();
  await expect(page.getByText(/Presentation scenario loaded/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Back from Demo Controls' }).click();
}

/** Open Transaction History from the Home screen's quick actions. */
export async function openHistory(page: Page): Promise<void> {
  await tapNav(page, 'Home');
  await page.getByRole('button', { name: 'History', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Transaction History' })).toBeVisible();
}
