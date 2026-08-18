/**
 * XP ledger.
 *
 * The balance used to be recomputed as `lifetime earned - lifetime spent`,
 * which left no room for expiry, refunds or an audit trail. This module turns
 * the XP history into an explicit ledger of lots:
 *
 *   - every earn creates a lot that expires at the end of the month AFTER the
 *     one it was earned in (earn in August -> expires 30 Sep 23:59:59), so a
 *     lot is usable for between one and two months depending on when in the
 *     month it landed;
 *   - redemptions consume the oldest still-valid lot first (FIFO), so XP that
 *     is about to expire is always spent before fresher XP;
 *   - refunds claw back the XP awarded for a reversed payment, drawing from
 *     that payment's own lot first so the audit trail lines up.
 *
 * Everything here is a pure function over history entries, so it is fully
 * unit-testable without a database.
 */

export type XPLedgerEventType = 'earn' | 'spend' | 'expire' | 'refund';

export interface XPLedgerInput {
  id: string;
  title: string;
  subtitle: string;
  xp: number;
  type: 'earn' | 'spend' | 'refund';
  createdAt: number;
  bonus?: string;
  /** For refunds: the id of the earn entry being reversed. */
  reversesId?: string;
  /**
   * Grants that never lapse. The welcome bonus is pinned to a sentinel
   * timestamp rather than a real date, so an expiry derived from it would be
   * meaningless - and a starter bonus that vanishes before the user has spent
   * it is not a starter bonus.
   */
  neverExpires?: boolean;
}

export interface XPLot {
  id: string;
  title: string;
  earnedAt: number;
  expiresAt: number;
  /** XP originally granted. */
  amount: number;
  /** XP consumed by redemptions. */
  spent: number;
  /** XP clawed back by a refund. */
  refunded: number;
  /** XP lost to expiry. */
  expired: number;
  /** XP still available to spend right now. */
  remaining: number;
}

export interface XPLedgerEvent {
  id: string;
  type: XPLedgerEventType;
  title: string;
  subtitle: string;
  xp: number;
  at: number;
  bonus?: string;
}

export interface XPLedger {
  /** Spendable XP as of `asOf`. */
  balance: number;
  /** Every lot ever created, newest first. */
  lots: XPLot[];
  /** Full audit trail including synthetic expiry events, newest first. */
  events: XPLedgerEvent[];
  totalEarned: number;
  totalSpent: number;
  totalExpired: number;
  totalRefunded: number;
  /** XP that will expire within `EXPIRING_SOON_DAYS`. */
  expiringSoon: number;
  /** When that soonest-expiring XP lapses, if any is at risk. */
  expiringSoonAt: number | null;
}

export const EXPIRING_SOON_DAYS = 14;

/** End of the month following `timestamp` - the moment XP earned then lapses. */
export function expiryFor(timestamp: number): number {
  const date = new Date(timestamp);
  // Day 0 of month+2 is the last day of month+1.
  return new Date(date.getFullYear(), date.getMonth() + 2, 0, 23, 59, 59, 999).getTime();
}

/**
 * Draws `amount` from the given lots, oldest first, calling back with how much
 * each lot gave up. Returns the amount that could not be covered.
 */
function drawFrom(lots: XPLot[], amount: number, take: (lot: XPLot, taken: number) => void): number {
  let outstanding = amount;
  for (const lot of lots) {
    if (outstanding <= 0) break;
    if (lot.remaining <= 0) continue;
    const taken = Math.min(lot.remaining, outstanding);
    lot.remaining -= taken;
    outstanding -= taken;
    take(lot, taken);
  }
  return outstanding;
}

export function buildLedger(entries: XPLedgerInput[], asOf: number = Date.now()): XPLedger {
  // Process chronologically so FIFO consumption and expiry interleave correctly.
  const ordered = [...entries].sort((a, b) => a.createdAt - b.createdAt);

  const lots: XPLot[] = [];
  const events: XPLedgerEvent[] = [];
  const byId = new Map<string, XPLot>();
  let totalEarned = 0;
  let totalSpent = 0;
  let totalExpired = 0;
  let totalRefunded = 0;

  /** Expires every lot that lapsed at or before `at`, recording an event each. */
  const expireThrough = (at: number) => {
    for (const lot of lots) {
      if (lot.expiresAt > at || lot.remaining <= 0) continue;
      const lost = lot.remaining;
      lot.remaining = 0;
      lot.expired += lost;
      totalExpired += lost;
      events.push({
        id: `expire-${lot.id}`,
        type: 'expire',
        title: 'XP expired',
        subtitle: `From ${lot.title}`,
        xp: lost,
        at: lot.expiresAt,
      });
    }
  };

  for (const entry of ordered) {
    expireThrough(entry.createdAt);

    if (entry.type === 'earn') {
      const lot: XPLot = {
        id: entry.id,
        title: entry.title,
        earnedAt: entry.createdAt,
        expiresAt: entry.neverExpires ? Infinity : expiryFor(entry.createdAt),
        amount: entry.xp,
        spent: 0,
        refunded: 0,
        expired: 0,
        remaining: entry.xp,
      };
      lots.push(lot);
      byId.set(lot.id, lot);
      totalEarned += entry.xp;
      events.push({
        id: entry.id, type: 'earn', title: entry.title, subtitle: entry.subtitle,
        xp: entry.xp, at: entry.createdAt, bonus: entry.bonus,
      });
      continue;
    }

    if (entry.type === 'refund') {
      // Claw back from the reversed payment's own lot first, then oldest-first
      // for whatever it could not cover (that XP may already have been spent).
      let outstanding = entry.xp;
      const origin = entry.reversesId ? byId.get(entry.reversesId) : undefined;
      if (origin && origin.remaining > 0) {
        const taken = Math.min(origin.remaining, outstanding);
        origin.remaining -= taken;
        origin.refunded += taken;
        outstanding -= taken;
      }
      outstanding = drawFrom(lots, outstanding, (lot, taken) => { lot.refunded += taken; });
      const clawed = entry.xp - outstanding;
      totalRefunded += clawed;
      events.push({
        id: entry.id, type: 'refund', title: entry.title, subtitle: entry.subtitle,
        xp: clawed, at: entry.createdAt,
      });
      continue;
    }

    // Redemption: spend oldest valid XP first.
    drawFrom(lots, entry.xp, (lot, taken) => { lot.spent += taken; });
    totalSpent += entry.xp;
    events.push({
      id: entry.id, type: 'spend', title: entry.title, subtitle: entry.subtitle,
      xp: entry.xp, at: entry.createdAt,
    });
  }

  expireThrough(asOf);

  const balance = lots.reduce((sum, lot) => sum + lot.remaining, 0);
  const soonCutoff = asOf + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
  const atRisk = lots.filter(lot => lot.remaining > 0 && lot.expiresAt <= soonCutoff);
  const expiringSoon = atRisk.reduce((sum, lot) => sum + lot.remaining, 0);
  const expiringSoonAt = atRisk.length
    ? atRisk.reduce((earliest, lot) => Math.min(earliest, lot.expiresAt), Infinity)
    : null;

  return {
    balance,
    lots: lots.slice().sort((a, b) => b.earnedAt - a.earnedAt),
    events: events.sort((a, b) => b.at - a.at),
    totalEarned,
    totalSpent,
    totalExpired,
    totalRefunded,
    expiringSoon,
    expiringSoonAt,
  };
}
