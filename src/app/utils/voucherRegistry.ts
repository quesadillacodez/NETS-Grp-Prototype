// Type-only, deliberately: rewardStorage imports this module to publish a
// redemption as it is made, so a runtime import back would close a cycle.
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
 *
 * Publishing happens at redemption *and* as a sweep of the whole wallet, because
 * redemption-time registration alone leaves gaps: the seeded demo vouchers are
 * written straight into SQLite and never pass through it, a redemption made
 * offline loses its one attempt, and vouchers issued before this index existed
 * were never published at all. Any of those scans as "no voucher matches this
 * code" from a second device.
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
 * Vouchers whose reference code the counter can be shown.
 *
 * Cashback is credited to the wallet on redemption. It has no counter to be
 * presented at, so putting it in the merchant-facing index would only create a
 * code that appears redeemable and is not. The test matches
 * `isCashbackRedemption`, repeated here rather than imported to keep this
 * module free of a runtime dependency on rewardStorage.
 */
function publishable(redemptions: RewardRedemption[]): RewardRedemption[] {
  return redemptions.filter(
    redemption => !(redemption.merchant === 'NETS Wallet' && /cashback/i.test(redemption.title)),
  );
}

function wireFormat(redemption: RewardRedemption) {
  return {
    refCode: redemption.refCode,
    title: redemption.title,
    merchant: redemption.merchant,
    xpCost: redemption.xpCost,
    redeemedAt: redemption.redeemedAt,
    expiresAt: redemption.expiresAt,
    used: redemption.used,
    usedAt: redemption.usedAt ?? 0,
  };
}

/**
 * Publishes a batch of vouchers. Resolves false when the server could not be
 * reached, so the caller can decide whether to retry; it never throws, because
 * a failure here must not break a redemption the customer has just completed.
 */
export async function publishVouchers(redemptions: RewardRedemption[]): Promise<boolean> {
  const vouchers = publishable(redemptions).map(wireFormat);
  if (!vouchers.length) return true;
  try {
    const response = await fetch('/api/vouchers', {
      method: 'POST',
      credentials: 'same-origin',
      headers: HEADERS,
      body: JSON.stringify({ vouchers }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Publishes a redemption so it can be verified from another device.
 *
 * Retried rather than fire-and-forget: this is the only moment the voucher is
 * guaranteed to be in hand, and an unpublished voucher is one that fails at the
 * counter. If every attempt fails the startup sweep will publish it later.
 */
export function registerVoucher(redemption: RewardRedemption): void {
  void (async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await publishVouchers([redemption])) return;
      await new Promise(resolve => window.setTimeout(resolve, 400 * (attempt + 1)));
    }
    // Offline, or the API is not deployed. The local record is still
    // authoritative, and syncVoucherIndex() republishes on the next start.
  })();
}

/** Empties the index, so a demo reset does not leave codes reading as spent. */
export async function clearRemoteVouchers(): Promise<void> {
  try {
    await fetch('/api/vouchers', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: HEADERS,
    });
  } catch {
    // Nothing to do: the reset still rebuilt the local database.
  }
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
  /** True when the server answered but holds no voucher under this code. */
  unknownCode: boolean;
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
    if (response.ok) {
      return { ok: true, voucher: body.voucher ?? null, reachable: true, unknownCode: false };
    }
    return {
      ok: false,
      reason: body.error ?? 'This voucher could not be verified.',
      voucher: body.voucher ?? null,
      // The server answered, so it is reachable whatever the verdict. A 404
      // means only that this code is not indexed — the scanning device should
      // still try its own records before refusing the customer.
      reachable: true,
      unknownCode: response.status === 404,
    };
  } catch {
    return { ok: false, voucher: null, reachable: false, unknownCode: false };
  }
}
