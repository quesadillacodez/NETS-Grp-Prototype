import { getAllUsers, switchUser, type User } from './userStorage';

const SESSION_KEY = 'nets-session-user-id';

// Prototype accounts all share one passcode — there is no real credential store
// behind this screen, and the login exists to demo the entry flow.
export const DEMO_PASSCODE = '1234';

export function isLoggedIn(): boolean {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return false;
  return getAllUsers().some(user => user.id === id);
}

// PIN-only sign-in: the PIN itself identifies the account. Each user has a
// unique 6-digit PIN in the users table; entering it logs straight into that
// account. Returns the matched user (so the caller can route), or null if no
// account has that PIN.
export function loginByPin(pin: string): User | null {
  const user = getAllUsers().find(u => u.password && u.password === pin);
  if (!user) return null;
  localStorage.setItem(SESSION_KEY, user.id);
  switchUser(user.id);
  window.dispatchEvent(new CustomEvent('sessionChanged'));
  return user;
}

// Each account has its own 6-digit PIN, stored in the users table. Login checks
// the entered PIN against that user's stored PIN — no shared passcode.
export function login(userId: string, pin: string): boolean {
  const user = getAllUsers().find(u => u.id === userId);
  if (!user || !user.password || pin !== user.password) return false;
  localStorage.setItem(SESSION_KEY, user.id);
  switchUser(user.id);
  window.dispatchEvent(new CustomEvent('sessionChanged'));
  return true;
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
