import { describe, expect, it } from 'vitest';
import {
  applyFailedLogin,
  EMPTY_LOGIN_SECURITY_STATE,
  isAcceptablePin,
  LOCKOUT_DURATION_MS,
  remainingLockoutSeconds,
} from './loginSecurity';

describe('login lockout policy', () => {
  it('locks sign-in after the third failed attempt', () => {
    const now = 1_000_000;
    const once = applyFailedLogin(EMPTY_LOGIN_SECURITY_STATE, now);
    const twice = applyFailedLogin(once, now);
    const third = applyFailedLogin(twice, now);

    expect(once).toEqual({ failedAttempts: 1, lockedUntil: null });
    expect(twice).toEqual({ failedAttempts: 2, lockedUntil: null });
    expect(third).toEqual({ failedAttempts: 3, lockedUntil: now + LOCKOUT_DURATION_MS });
    expect(remainingLockoutSeconds(third, now + 1_000)).toBe(29);
  });

  it('starts a fresh attempt sequence after a lockout expires', () => {
    const expired = { failedAttempts: 3, lockedUntil: 10_000 };
    expect(applyFailedLogin(expired, 10_001)).toEqual({ failedAttempts: 1, lockedUntil: null });
  });
});

describe('replacement PIN policy', () => {
  it('accepts six-digit PINs that are not repeated or sequential', () => {
    expect(isAcceptablePin('482951')).toBe(true);
    expect(isAcceptablePin('111111')).toBe(false);
    expect(isAcceptablePin('123456')).toBe(false);
    expect(isAcceptablePin('654321')).toBe(false);
    expect(isAcceptablePin('12345')).toBe(false);
  });
});
