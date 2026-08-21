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
import { isHeartlandName } from './questStorage';
import { DEFAULT_NEARBY_RADIUS_KM, distanceKm, resolveArea } from './geo';

/** How many paid slots the store will show at once. */
export const MAX_LIVE_PROMOTIONS = 4;

/**
 * The spotlight is sold in two lanes.
 *
 * A single banner meant a chain with a marketing budget could hold it against
 * every hawker stall in the country, which is the opposite of what a heartland
 * payments network should sell. One lane is reserved for hawkers and heartland
 * stalls, the other for chains, so both are always represented and neither
 * outbids the other for the same slot.
 */
export type Lane = 'hawker' | 'brand';

export const LANE_LABELS: Record<Lane, string> = {
  hawker: 'Hawker & heartland',
  brand: 'Brands & chains',
};

/** Which lane a merchant sells in, from its name. */
export function laneFor(merchant: string): Lane {
  return isHeartlandName(merchant) ? 'hawker' : 'brand';
}

/**
 * A merchant may hold the spotlight for this many days out of the trailing
 * window before it has to stand down.
 */
export const SPOTLIGHT_MAX_RUN_DAYS = 14;
export const SPOTLIGHT_WINDOW_DAYS = 30;
export const SPOTLIGHT_COOLDOWN_DAYS = 7;

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

/**
 * Narrows live placements to the ones that reach a customer standing in
 * `viewerArea`.
 *
 * A placement is bought against the outlet the reward belongs to, so a stall in
 * Ang Mo Kio is sold to people in Ang Mo Kio rather than to the whole island —
 * that is what a heartland merchant is actually paying for. Rewards with no
 * outlet, or with outlets everywhere, still reach everyone.
 *
 * The catalogue is a parameter so the rule can be tested without a database;
 * the app leaves it to default.
 */
export function localisePromotions(
  promotions: Promotion[],
  viewerArea: string,
  radiusKm = DEFAULT_NEARBY_RADIUS_KM,
  catalogue: Pick<Reward, 'id' | 'area'>[] = getRewardsCatalog(),
): Promotion[] {
  const viewer = resolveArea(viewerArea).coordinates;
  return promotions.filter(promotion => {
    const reward = catalogue.find(entry => entry.id === promotion.rewardId);
    // A reward that is gone from the catalogue keeps its placement rather than
    // vanishing silently; the booking is still real and still billed.
    if (!reward) return true;
    const outlet = resolveArea(reward.area);
    // No outlet, or outlets everywhere: nothing to localise against.
    if (outlet.islandwide || !outlet.coordinates || !viewer) return true;
    return distanceKm(viewer, outlet.coordinates) <= radiusKm;
  });
}

/** The live spotlight for each lane — at most one hawker and one brand. */
export function getSpotlightPromotions(now = Date.now()): Promotion[] {
  const spotlights = getLivePromotions(now).filter(promotion => promotion.placement === 'spotlight');
  const lanes: Lane[] = ['hawker', 'brand'];
  return lanes
    .map(lane => spotlights.find(promotion => laneFor(promotion.merchant) === lane))
    .filter((promotion): promotion is Promotion => promotion !== undefined);
}

/**
 * How long a merchant must wait before booking the spotlight again, or null if
 * it is free to book now.
 *
 * Without this, a merchant could rebook the banner the moment its own placement
 * ended and hold it indefinitely — the cap on concurrent slots does nothing
 * against a single merchant booking back to back.
 */
export function spotlightCooldownUntil(
  existing: Promotion[],
  merchant: string,
  now = Date.now(),
): number | null {
  const windowStart = now - SPOTLIGHT_WINDOW_DAYS * DAY;
  const mine = existing.filter(promotion =>
    promotion.placement === 'spotlight'
    && promotion.merchant === merchant
    && promotion.endsAt > windowStart);
  if (mine.length === 0) return null;

  // Days held inside the trailing window, clipped so a booking that started
  // before it only counts the part that falls within.
  const heldDays = mine.reduce((sum, promotion) => {
    const from = Math.max(promotion.startsAt, windowStart);
    const to = Math.min(promotion.endsAt, now);
    return sum + Math.max(0, to - from) / DAY;
  }, 0);
  if (heldDays < SPOTLIGHT_MAX_RUN_DAYS) return null;

  const lastEnd = Math.max(...mine.map(promotion => promotion.endsAt));
  const until = lastEnd + SPOTLIGHT_COOLDOWN_DAYS * DAY;
  return until > now ? until : null;
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
  input: { rewardId: number; title: string; merchant: string; days: number; startsAt: number; placement: Placement },
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

  if (input.placement === 'spotlight') {
    // One banner per lane, so a hawker booking never collides with a chain.
    const lane = laneFor(input.merchant);
    const taken = existing.some(promotion =>
      promotion.placement === 'spotlight'
      && laneFor(promotion.merchant) === lane
      && overlaps(promotion));
    if (taken) {
      return {
        ok: false,
        reason: `The ${LANE_LABELS[lane].toLowerCase()} spotlight is taken over those dates. Book Featured instead.`,
        endsAt,
      };
    }

    const cooldownUntil = spotlightCooldownUntil(existing, input.merchant, input.startsAt);
    if (cooldownUntil !== null && input.startsAt < cooldownUntil) {
      const days = Math.ceil((cooldownUntil - input.startsAt) / DAY);
      return {
        ok: false,
        reason: `You have held the spotlight for ${SPOTLIGHT_MAX_RUN_DAYS} of the last ${SPOTLIGHT_WINDOW_DAYS} days. It frees up again in ${days} day${days === 1 ? '' : 's'}.`,
        endsAt,
      };
    }
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
    rewardId: reward.id, title: reward.title, merchant: reward.merchant,
    days: input.days, startsAt, placement,
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
