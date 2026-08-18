export const MAX_LOGIN_ATTEMPTS = 3;
export const LOCKOUT_DURATION_MS = 30_000;

const STORAGE_KEY = 'nets-login-security-v1';

export interface LoginSecurityState {
  failedAttempts: number;
  lockedUntil: number | null;
}

export const EMPTY_LOGIN_SECURITY_STATE: LoginSecurityState = {
  failedAttempts: 0,
  lockedUntil: null,
};

export function applyFailedLogin(
  state: LoginSecurityState,
  now = Date.now(),
): LoginSecurityState {
  const activeState = state.lockedUntil && state.lockedUntil <= now
    ? EMPTY_LOGIN_SECURITY_STATE
    : state;
  const failedAttempts = activeState.failedAttempts + 1;

  if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
    return { failedAttempts, lockedUntil: now + LOCKOUT_DURATION_MS };
  }
  return { failedAttempts, lockedUntil: null };
}

export function remainingLockoutSeconds(state: LoginSecurityState, now = Date.now()): number {
  if (!state.lockedUntil || state.lockedUntil <= now) return 0;
  return Math.ceil((state.lockedUntil - now) / 1000);
}

export function isAcceptablePin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return false;
  if (/^(\d)\1{5}$/.test(pin)) return false;
  return pin !== '123456' && pin !== '654321';
}

export function loadLoginSecurityState(now = Date.now()): LoginSecurityState {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as LoginSecurityState | null;
    if (!stored || typeof stored.failedAttempts !== 'number') return EMPTY_LOGIN_SECURITY_STATE;
    if (stored.lockedUntil && stored.lockedUntil <= now) {
      resetLoginSecurity();
      return EMPTY_LOGIN_SECURITY_STATE;
    }
    return stored;
  } catch {
    return EMPTY_LOGIN_SECURITY_STATE;
  }
}

export function storeLoginSecurityState(state: LoginSecurityState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetLoginSecurity(): void {
  localStorage.removeItem(STORAGE_KEY);
}
