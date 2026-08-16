// ─── Paid placement in the rewards store ─────────────────────────────────────
// A merchant can pay to have one of its rewards shown first. This is the
// revenue line the business case rests on, so the prototype implements it
// properly rather than describing it: a booking with a price and a window, a
// hard cap on how many can run at once, and measured results.
//
// Two rules are deliberate and enforced here rather than in the UI:
//  1. A paid slot buys position, never a lie. Distance, XP price and
//     affordability are untouched, and every promoted card is labelled.
//  2. Placements expire on their own. Status is derived from the window each
//     time it is read, so a finished booking cannot keep running because
//     something forgot to switch it off.

import { lastInsertId, query, queryOne, run } from './db';
import { getRewardsCatalog, type Reward } from './rewardStorage';

/** How many paid slots the store will show at once. */
export const MAX_LIVE_PROMOTIONS = 3;

/** What a week of placement costs the merchant, by slot type. */
export const PLACEMENT_RATES = {
  featured: 40,
  spotlight: 90,
} as const;

export type Placement = keyof typeof PLACEMENT_RATES;

export const PLACEMENT_LABELS: Record<Placement, string> = {
  featured: 'Featured',
  spotlight: 'Spotlight',
};

export const PLACEMENT_DESCRIPTIONS: Record<Placement, string> = {
  featured: 'Pinned to the top of the rewards store, above the normal listing.',
  spotlight: 'Featured placement plus the large banner card at the top of the store.',
};

export type PromotionStatus = 'scheduled' | 'live' | 'ended';

export interface Promotion {
  id: number;
  rewardId: number;
  title: string;
  merchant: string;
  placement: Placement;
  weeklyFee: number;
  startsAt: number;
  endsAt: number;
  /** Times the promoted card has been shown to a customer. */
  impressions: number;
  createdAt: number;
}

export interface PromotionReport extends Promotion {
  status: PromotionStatus;
  /** Redemptions of this reward inside the booked window. */
  redemptions: number;
  /** Fee owed for the booked duration, prorated by the week. */
  fee: number;
  /** What each redemption cost the merchant, or null with none yet. */
  costPerRedemption: number | null;
  daysRemaining: number;
}

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

function notifyUpdated(): void {
  window.dispatchEvent(new CustomEvent('promotionsUpdated'));
}

function rowToPromotion(row: Record<string, any>): Promotion {
  const placement = String(row.placement) in PLACEMENT_RATES
    ? (String(row.placement) as Placement)
    : 'featured';
  return {
    id: Number(row.id),
    rewardId: Number(row.reward_id),
    title: String(row.title),
    merchant: String(row.merchant),
    placement,
    weeklyFee: Number(row.weekly_fee ?? PLACEMENT_RATES[placement]),
    startsAt: Number(row.starts_at),
    endsAt: Number(row.ends_at),
    impressions: Number(row.impressions ?? 0),
    createdAt: Number(row.created_at ?? 0),
  };
}

export function promotionStatus(promotion: Promotion, now = Date.now()): PromotionStatus {
  if (now < promotion.startsAt) return 'scheduled';
  if (now >= promotion.endsAt) return 'ended';
  return 'live';
}

export function getPromotions(): Promotion[] {
  return query('SELECT * FROM reward_promotions ORDER BY starts_at DESC, id DESC').map(rowToPromotion);
}

/**
 * Which bookings a customer should be seeing, in the order they appear.
 * Spotlight outranks featured; within a tier the earlier booking wins, so a
 * position cannot be bought away from a merchant who booked first.
 */
export function chooseLivePromotions(promotions: Promotion[], now = Date.now()): Promotion[] {
  return promotions
    .filter(promotion => promotionStatus(promotion, now) === 'live')
    .sort((a, b) =>
      (a.placement === b.placement ? a.startsAt - b.startsAt : a.placement === 'spotlight' ? -1 : 1))
    .slice(0, MAX_LIVE_PROMOTIONS);
}

/** Only the placements a customer should be seeing right now. */
export function getLivePromotions(now = Date.now()): Promotion[] {
  return chooseLivePromotions(getPromotions(), now);
}

/** The single reward, if any, that has bought the banner at the top. */
export function getSpotlightPromotion(now = Date.now()): Promotion | null {
  return getLivePromotions(now).find(promotion => promotion.placement === 'spotlight') ?? null;
}

export interface PromotionResult {
  ok: boolean;
  promotion?: Promotion;
  reason?: string;
}

/**
 * Book a placement.
 *
 * Refused when the slots are full or the reward is already promoted over the
 * same dates, so a merchant cannot pay twice for the same window and NETS
 * cannot oversell the store.
 */
export function checkBooking(
  existing: Promotion[],
  input: { rewardId: number; title: string; days: number; startsAt: number; placement: Placement },
): { ok: boolean; reason?: string; endsAt: number } {
  const days = Math.round(input.days);
  const endsAt = input.startsAt + Math.max(0, days) * DAY;

  if (!Number.isFinite(days) || days < 1) return { ok: false, reason: 'Book at least one day.', endsAt };
  if (days > 90) return { ok: false, reason: 'Placements run for at most 90 days.', endsAt };

  const overlaps = (promotion: Promotion) =>
    promotion.startsAt < endsAt && promotion.endsAt > input.startsAt;

  if (existing.some(promotion => promotion.rewardId === input.rewardId && overlaps(promotion))) {
    return { ok: false, reason: `${input.title} is already promoted over those dates.`, endsAt };
  }

  // There is only one banner, so only one merchant can be sold it at a time.
  // Without this a second spotlight would be billed the higher rate and get
  // nothing extra for it.
  if (input.placement === 'spotlight'
    && existing.some(promotion => promotion.placement === 'spotlight' && overlaps(promotion))) {
    return {
      ok: false,
      reason: 'Another merchant already holds the spotlight over those dates. Book Featured instead.',
      endsAt,
    };
  }

  // The cap applies to the busiest moment in the booked window, not to today,
  // so a booking cannot slip through by starting after the current ones end.
  if (existing.filter(overlaps).length >= MAX_LIVE_PROMOTIONS) {
    return {
      ok: false,
      reason: `All ${MAX_LIVE_PROMOTIONS} paid slots are taken for those dates. End a placement first.`,
      endsAt,
    };
  }

  return { ok: true, endsAt };
}

export function bookPromotion(input: {
  reward: Pick<Reward, 'id' | 'title' | 'merchant'>;
  placement: Placement;
  days: number;
  startsAt?: number;
}): PromotionResult {
  const { reward, placement } = input;
  const startsAt = input.startsAt ?? Date.now();

  const check = checkBooking(getPromotions(), {
    rewardId: reward.id, title: reward.title, days: input.days, startsAt, placement,
  });
  if (!check.ok) return { ok: false, reason: check.reason };
  const endsAt = check.endsAt;

  const weeklyFee = PLACEMENT_RATES[placement];
  run(
    `INSERT INTO reward_promotions
      (reward_id, title, merchant, placement, weekly_fee, starts_at, ends_at, impressions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [reward.id, reward.title, reward.merchant, placement, weeklyFee, startsAt, endsAt, Date.now()],
  );
  notifyUpdated();

  const promotion = getPromotions().find(item => item.id === lastInsertId());
  return promotion ? { ok: true, promotion } : { ok: false, reason: 'The placement could not be saved.' };
}

/** Stop a placement now. The booking is kept so its results stay reportable. */
export function endPromotion(id: number, now = Date.now()): void {
  const promotion = getPromotions().find(item => item.id === id);
  if (!promotion) return;
  // A placement that never started is removed; one that ran is truncated to now
  // so the merchant is billed for the days it actually appeared.
  if (now <= promotion.startsAt) {
    run('DELETE FROM reward_promotions WHERE id = ?', [id]);
  } else {
    run('UPDATE reward_promotions SET ends_at = ? WHERE id = ?', [now, id]);
  }
  notifyUpdated();
}

/** Counted once per store visit that shows the card, for the merchant's report. */
export function recordImpressions(ids: number[]): void {
  if (!ids.length) return;
  for (const id of ids) {
    run('UPDATE reward_promotions SET impressions = impressions + 1 WHERE id = ?', [id]);
  }
  // Deliberately silent: an impression must not re-render the store that just
  // counted it, or the count would climb on its own.
}

function redemptionsInWindow(promotion: Promotion): number {
  const row = queryOne(
    `SELECT COUNT(*) AS n FROM reward_redemptions
      WHERE reward_id = ? AND redeemed_at >= ? AND redeemed_at < ?`,
    [promotion.rewardId, promotion.startsAt, promotion.endsAt],
  );
  return Number(row?.n ?? 0);
}

/**
 * The merchant's report on a booking. The fee is prorated to the days it has
 * actually appeared for, so a placement stopped early is billed for what it
 * ran, not for what was booked.
 */
export function calculateReport(
  promotion: Promotion,
  redemptions: number,
  now = Date.now(),
): PromotionReport {
  const status = promotionStatus(promotion, now);
  const billableEnd = Math.min(now, promotion.endsAt);
  const daysRun = Math.max(0, (billableEnd - promotion.startsAt) / DAY);
  const fee = (daysRun / 7) * promotion.weeklyFee;

  return {
    ...promotion,
    status,
    redemptions,
    fee,
    costPerRedemption: redemptions > 0 ? fee / redemptions : null,
    daysRemaining: Math.max(0, Math.ceil((promotion.endsAt - now) / DAY)),
  };
}

export function reportOn(promotion: Promotion, now = Date.now()): PromotionReport {
  return calculateReport(promotion, redemptionsInWindow(promotion), now);
}

export function getPromotionReports(now = Date.now()): PromotionReport[] {
  return getPromotions().map(promotion => reportOn(promotion, now));
}

/** What NETS has earned from placements, and what is still to come. */
export function getPlacementRevenue(now = Date.now()): { earned: number; committed: number } {
  let earned = 0;
  let committed = 0;
  for (const promotion of getPromotions()) {
    const report = reportOn(promotion, now);
    earned += report.fee;
    const fullDays = (promotion.endsAt - promotion.startsAt) / DAY;
    committed += (fullDays / 7) * promotion.weeklyFee;
  }
  return { earned, committed };
}

/** Rewards a merchant could still book — the catalogue minus wallet cashback. */
export function getPromotableRewards(): Reward[] {
  return getRewardsCatalog().filter(reward => reward.merchant !== 'NETS Wallet');
}

export const PLACEMENT_WEEK_MS = WEEK;

/** Used by the demo controls, which reset placements along with other activity. */
export function clearAllPromotions(): void {
  run('DELETE FROM reward_promotions');
  notifyUpdated();
}
