/**
 * The URL a voucher's QR code carries.
 *
 * Absolute, because a scanner opens it in a browser with no notion of the app's
 * routing — and built from the running origin so a code scanned from a laptop
 * demo, a preview deployment or production each resolve to the right host.
 *
 * The link carries only the reference code. Everything the scan screen shows is
 * looked up from the rewards record, so a code cannot be edited into a voucher
 * for a different reward or a larger amount.
 */
export function voucherScanUrl(refCode: string): string {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://nets.example.sg';
  return `${origin}/v/${encodeURIComponent(refCode)}`;
}
