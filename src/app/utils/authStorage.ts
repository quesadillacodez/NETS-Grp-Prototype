import { getAllUsers, switchUser, type User } from './userStorage';
import { getServerSession, serverLogin, serverLogout } from './serverApi';
import { synchronizeDatabaseWithServer } from './db';

const SESSION_KEY = 'nets-session-user-id';

export function isLoggedIn(): boolean {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return false;
  return getAllUsers().some(user => user.id === id);
}

// Guards a post-login redirect target so it can only ever be an in-app path,
// never an absolute/external URL — prevents an open-redirect via a crafted
// deep link.
export function isSafeInternalPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://')) return false;
  return true;
}


function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function findUserByLoginId(loginId: string): User | null {
  const normalizedLoginId = normalizeLoginId(loginId);
  return getAllUsers().find(u =>
    u.loginId && normalizeLoginId(u.loginId) === normalizedLoginId,
  ) ?? null;
}

// Customer-facing sign-in uses a memorable login ID while the rest of the app
// continues to use stable internal IDs for database relationships.
export async function loginWithCredentials(loginId: string, pin: string): Promise<User> {
  const authenticatedUser = await serverLogin(loginId, pin);
  const user = getAllUsers().find(candidate => candidate.id === authenticatedUser.id) ?? authenticatedUser;
  localStorage.setItem(SESSION_KEY, user.id);
  switchUser(user.id);
  await synchronizeDatabaseWithServer();
  window.dispatchEvent(new CustomEvent('sessionChanged'));
  return user;
}

export async function restoreServerSession(): Promise<User | null> {
  try {
    const session = await getServerSession();
    if (!session.authenticated || !session.user) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const user = getAllUsers().find(candidate => candidate.id === session.user!.id) ?? session.user;
    localStorage.setItem(SESSION_KEY, user.id);
    switchUser(user.id);
    await synchronizeDatabaseWithServer();
    return user;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
  void serverLogout().catch(() => {});
  window.dispatchEvent(new CustomEvent('sessionChanged'));
}

// Keeps the session in step with the in-app account switcher, so switching
// profiles doesn't leave the session pointing at the previous account.
export function setSessionUser(user: User): void {
  localStorage.setItem(SESSION_KEY, user.id);
}
