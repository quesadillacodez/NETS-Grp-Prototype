import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * Guards pages that expect data to be passed via react-router's `location.state`
 * (e.g. amount, recipient, selected contacts passed from the previous screen).
 *
 * If the page is opened directly — a hard refresh, a bookmarked/shared deep link, or
 * back/forward navigation that dropped state — `location.state` is `null`. Without a
 * guard, pages would silently render "undefined"/"NaN" or throw. This hook redirects
 * back to a safe fallback route instead.
 *
 * Returns the state object once validated, so callers can pull required fields off it
 * with confidence.
 */
export function useRequiredState<T extends Record<string, unknown>>(
  requiredKeys: (keyof T)[],
  fallbackPath = '/'
): T | null {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as T) || null;

  const isValid = !!state && requiredKeys.every((key) => state[key] !== undefined && state[key] !== null);

  useEffect(() => {
    if (!isValid) {
      navigate(fallbackPath, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, fallbackPath]);

  return isValid ? state : null;
}
