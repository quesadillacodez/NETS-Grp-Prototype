import { expect, test } from '@playwright/test';
import { USERS } from './helpers';

test.describe('Server security boundary', () => {
  test('uses an HttpOnly session and never returns a PIN hash', async ({ request }) => {
    const login = await request.post('/api/auth/login', {
      headers: { 'X-NETS-CSRF': '1' },
      data: { loginId: USERS.alex.loginId, pin: USERS.alex.pin },
    });
    expect(login.ok()).toBeTruthy();
    expect(login.headers()['set-cookie']).toContain('HttpOnly');
    expect(login.headers()['set-cookie']).toContain('SameSite=Strict');
    const body = await login.json();
    expect(body.user).not.toHaveProperty('credential');
    expect(body.user).not.toHaveProperty('password');
  });

  test('rejects state-changing requests without the CSRF header', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { loginId: USERS.alex.loginId, pin: USERS.alex.pin },
    });
    expect(response.status()).toBe(403);
  });

  test('provides an authenticated synchronized state endpoint', async ({ request }) => {
    const login = await request.post('/api/auth/login', {
      headers: { 'X-NETS-CSRF': '1' },
      data: { loginId: USERS.alex.loginId, pin: USERS.alex.pin },
    });
    expect(login.ok()).toBeTruthy();
    const state = await request.get('/api/sync/state');
    expect(state.ok()).toBeTruthy();
    const body = await state.json();
    expect(body).toEqual(expect.objectContaining({ revision: expect.any(Number) }));
  });
});

test('the PWA manifest contains installability metadata', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest).toEqual(expect.objectContaining({
    name: 'NETS Pay Together',
    start_url: '/login?source=pwa',
    display: 'standalone',
  }));
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192' }),
    expect.objectContaining({ sizes: '512x512' }),
  ]));
});
