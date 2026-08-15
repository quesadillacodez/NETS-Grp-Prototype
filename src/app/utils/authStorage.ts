import { getAllUsers, switchUser, type User } from './userStorage';

const SESSION_KEY = 'nets-session-user-id';

export function isLoggedIn(): boolean {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return false;
  return getAllUsers().some(user => user.id === id);
}


function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function findUserByLoginId(loginId: string): User | null {
  const normalizedLoginId = normalizeLoginId(loginId);
  return getAllUsers().find(u =>
    u.loginId && normalizeLoginId(u.loginId) === normalizedLoginId,
  ) ?? null;
}

// Customer-facing sign-in uses a memorable login ID while the rest of the app
// continues to use stable internal IDs for database relationships.
export function loginWithCredentials(loginId: string, pin: string): User | null {
  const user = findUserByLoginId(loginId);
  if (!user || !user.password || pin !== user.password) return null;
  localStorage.setItem(SESSION_KEY, user.id);
  switchUser(user.id);
  window.dispatchEvent(new CustomEvent('sessionChanged'));
  return user;
}

export function verifyRecoveryIdentity(loginId: string, phone: string): User | null {
  const user = findUserByLoginId(loginId);
  if (!user || normalizePhone(user.phone) !== normalizePhone(phone)) return null;
  return user;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent('sessionChanged'));
}

// Keeps the session in step with the in-app account switcher, so switching
// profiles doesn't leave the session pointing at the previous account.
export function setSessionUser(user: User): void {
  localStorage.setItem(SESSION_KEY, user.id);
}
