import type { RewardRedemption } from './rewardStorage';

/**
 * The server-side voucher index.
 *
 * A voucher is scanned at the counter by a phone that is not signed in as the
 * customer holding it, and the synchronized database is only served to an
 * authenticated session — so a cross-device scan cannot read the voucher from
 * there. Redemptions are therefore also published to a small server index keyed
 * by reference code, which the scan screen can verify against from any device.
 *
 * The index holds only what a merchant needs to honour the voucher. No user
 * identity, no wallet, no transaction history.
 */

export interface RemoteVoucher {
  refCode: string;
  title: string;
  merchant: string;
  xpCost: number;
  redeemedAt: number;
  expiresAt: number;
  used: boolean;
  usedAt: number;
}

const HEADERS = { 'Content-Type': 'application/json', 'x-nets-csrf': '1' };

/**
 * Publishes a redemption so it can be verified from another device.
 * Deliberately best-effort: a voucher still works on the device that redeemed
 * it if the network is unavailable, so a failure here must not break the
 * redemption the customer just completed.
 */
export function registerVoucher(redemption: RewardRedemption): void {
  void fetch('/api/voucher', {
    method: 'POST',
    credentials: 'same-origin',
    headers: HEADERS,
    body: JSON.stringify({
      refCode: redemption.refCode,
      title: redemption.title,
      merchant: redemption.merchant,
      xpCost: redemption.xpCost,
      redeemedAt: redemption.redeemedAt,
      expiresAt: redemption.expiresAt,
      used: redemption.used,
      usedAt: redemption.usedAt ?? 0,
    }),
  }).catch(() => {
    // Offline, or the API is not deployed. The local record is still authoritative.
  });
}

export async function fetchVoucher(refCode: string): Promise<RemoteVoucher | null> {
  try {
    const response = await fetch(`/api/voucher/${encodeURIComponent(refCode)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    return response.ok ? (await response.json() as RemoteVoucher) : null;
  } catch {
    return null;
  }
}

export interface RemoteRedeemResult {
  ok: boolean;
  reason?: string;
  voucher: RemoteVoucher | null;
  /** False when the server could not be reached at all, so the caller can fall back. */
  reachable: boolean;
}

/** Marks a voucher used on the server, from whichever device scanned it. */
export async function redeemVoucherRemotely(refCode: string): Promise<RemoteRedeemResult> {
  try {
    const response = await fetch(`/api/voucher/${encodeURIComponent(refCode)}/redeem`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: HEADERS,
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) return { ok: true, voucher: body.voucher ?? null, reachable: true };
    return {
      ok: false,
      reason: body.error ?? 'This voucher could not be verified.',
      voucher: body.voucher ?? null,
      reachable: response.status !== 404 || Boolean(body.error),
    };
  } catch {
    return { ok: false, voucher: null, reachable: false };
  }
}
