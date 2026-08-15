/**
 * Whether the user has asked their operating system to reduce motion.
 *
 * CSS handles animations and transitions via a media query, and Framer Motion
 * is covered by `<MotionConfig reducedMotion="user">`. This helper is for the
 * effects neither of those can reach — currently the confetti canvas, which
 * draws directly and would otherwise ignore the preference entirely.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Fire confetti unless the user prefers reduced motion. */
export function celebrate<Options>(
  confetti: (options?: Options) => unknown,
  options?: Options,
): void {
  if (prefersReducedMotion()) return;
  confetti(options);
}
