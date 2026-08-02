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

export function login(userId: string, passcode: string): boolean {
  if (passcode !== DEMO_PASSCODE) return false;
  const user = getAllUsers().find(item => item.id === userId);
  if (!user) return false;
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
