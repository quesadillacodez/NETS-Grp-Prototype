import { lastInsertId, query, run } from './db';
import { getDeals } from './dealStorage';
import { DEFAULT_XP_RATE, effectiveBonus, getMerchantByName } from './merchantStorage';
import {
  evaluateDay, getQuestSignals, dayKey, weekKey, WEEKLY_MISSION_XP_CAP, type QuestSignal,
} from './questStorage';
import { buildLedger, type XPLedger, type XPLedgerInput } from './xpLedger';
import { publishVouchers, registerVoucher } from './voucherRegistry';

export type RewardCategory = 'Cashback' | 'Vouchers' | 'Partner Deals';

export interface Reward {
  id: number;
  merchant: string;
  title: string;
  xpCost: number;
  category: RewardCategory;
  icon: string;
  tags: string[];
  description: string;
  validityDays: number;
  /**
   * Where the reward can be redeemed, used to sort and filter by distance.
   * Omitted for rewards with no physical outlet (wallet cashback); use
   * "Multiple outlets" for chains that are available everywhere.
   */
  area?: string;
}

export interface RewardRedemption {
  id: number;
  userId: string;
  rewardId: number;
  title: string;
  merchant: string;
  xpCost: number;
  refCode: string;
  redeemedAt: number;
  used: boolean;
  /** Epoch ms the voucher lapses. 0 means it never expires (instant cashback). */
  expiresAt: number;
  usedAt?: number;
}

/**
 * A voucher is in exactly one state at a time. `applied` is reserved for
 * instant wallet cashback, which is credited immediately and has nothing left
 * to redeem at a merchant.
 */
export type RedemptionStatus = 'applied' | 'used' | 'expired' | 'active';

export function isCashbackRedemption(redemption: Pick<RewardRedemption, 'merchant' | 'title'>): boolean {
  return redemption.merchant === 'NETS Wallet' && /cashback/i.test(redemption.title);
}

export function getRedemptionStatus(redemption: RewardRedemption, now = Date.now()): RedemptionStatus {
  if (isCashbackRedemption(redemption)) return 'applied';
  if (redemption.used) return 'used';
  if (redemption.expiresAt > 0 && redemption.expiresAt < now) return 'expired';
  return 'active';
}

export const REDEMPTION_STATUS_LABELS: Record<RedemptionStatus, string> = {
  applied: 'Applied',
  used: 'Used',
  expired: 'Expired',
  active: 'Active',
};

export function formatExpiry(expiresAt: number): string {
  if (expiresAt <= 0) return 'No expiry';
  return new Date(expiresAt).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function daysUntilExpiry(expiresAt: number, now = Date.now()): number | null {
  if (expiresAt <= 0) return null;
  return Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
}

/**
 * Terms are derived from the reward itself rather than stored per row, so a
 * voucher's conditions always match the validity and merchant it was issued
 * against.
 */
export function getRewardTerms(reward: Pick<Reward, 'merchant' | 'validityDays' | 'category'>): string[] {
  const terms = [
    'One voucher code per redemption. A code cannot be reissued once it has been marked as used.',
  ];

  if (reward.validityDays > 0) {
    terms.push(
      `Valid for ${reward.validityDays} days from the date of redemption. Expired vouchers cannot be used and the XP spent is not refunded.`,
      `Redeemable at participating ${reward.merchant} outlets that accept NETS payment.`,
      'Cannot be exchanged for cash, and cannot be combined with other promotions or discounts.',
    );
  } else {
    terms.push(
      'Cashback is credited to your NETS wallet immediately and cannot be reversed once redeemed.',
      'The credited amount forms part of your wallet balance and is subject to the wallet limit.',
    );
  }

  terms.push('NETS may withdraw or amend this reward at any time without prior notice.');
  return terms;
}

export interface XPHistoryEntry {
  id: string;
  title: string;
  subtitle: string;
  xp: number;
  type: 'earn' | 'spend' | 'refund';
  createdAt: number;
  bonus?: string;
  /** Starter grants that never lapse. See XPLedgerInput.neverExpires. */
  neverExpires?: boolean;
}

export interface Tier {
  name: string;
  level: number;
  /** Lifetime XP at which this tier begins. */
  start: number;
  /** Lifetime XP at which the next tier begins, or null for the top tier. */
  next: number | null;
  color: string;
  /** Short description of what reaching this tier represents. */
  blurb: string;
}

/** Month bucket used by the XP breakdown screen. */
export interface XPMonth {
  /** Sortable `YYYY-MM` key. */
  key: string;
  /** Short label for the tab strip, e.g. "Aug". */
  label: string;
  /** Full label for headings, e.g. "August 2026". */
  longLabel: string;
}

export interface MonthlyXPSummary {
  key: string;
  earned: number;
  spent: number;
  net: number;
  /** Earn entries for the month, newest first. */
  entries: XPHistoryEntry[];
  /** XP earned from entries carrying a bonus multiplier. */
  bonusXP: number;
  transactionCount: number;
  /** Merchant contributing the most XP this month, if any. */
  topSource: { title: string; xp: number } | null;
}

export const WELCOME_XP = 500;

export const REWARDS: Reward[] = [
  { id: 1, merchant: 'NETS Wallet', title: '$5 Wallet Cashback', xpCost: 500, category: 'Cashback', icon: '💵', tags: ['Instant'], description: 'Credit $5 directly to your NETS wallet balance.', validityDays: 0 },
  { id: 2, merchant: 'Hawker Centres', title: '$5 Heartland Voucher', xpCost: 500, category: 'Vouchers', icon: '🍜', tags: ['Local', 'Food'], description: 'Use at participating NETS-enabled hawker stalls.', validityDays: 30, area: 'Multiple outlets' },
  { id: 3, merchant: 'NYP Campus Food Court', title: '$1.50 Student Meal Credit', xpCost: 150, category: 'Vouchers', icon: '🍱', tags: ['Campus'], description: 'A student-friendly meal credit for participating campus stalls.', validityDays: 21, area: 'Ang Mo Kio' },
  { id: 4, merchant: 'Tiong Bahru Chicken Rice', title: '$2 Off Chicken Rice Set', xpCost: 200, category: 'Vouchers', icon: '🍗', tags: ['Local', 'Food'], description: 'Redeem on one chicken rice set at the participating stall.', validityDays: 30, area: 'Tiong Bahru' },
  { id: 5, merchant: 'Old Chang Kee', title: 'Free Curry Puff', xpCost: 180, category: 'Vouchers', icon: '🥟', tags: ['Food'], description: 'One classic curry puff with any two-item purchase.', validityDays: 14, area: 'Somerset' },
  { id: 6, merchant: 'Kopitiam', title: '$3 Coffee Voucher', xpCost: 300, category: 'Vouchers', icon: '☕', tags: ['Local', 'Drinks'], description: 'Valid at participating Kopitiam drink stalls.', validityDays: 30, area: 'Dhoby Ghaut' },
  { id: 7, merchant: 'Ya Kun Kaya Toast', title: '$5 Breakfast Set', xpCost: 450, category: 'Partner Deals', icon: '🍞', tags: ['Food'], description: 'Redeem a selected traditional breakfast set.', validityDays: 30, area: 'Raffles Place' },
  { id: 8, merchant: 'Grab', title: '$10 Ride Credit', xpCost: 1000, category: 'Partner Deals', icon: '🚗', tags: ['Travel'], description: 'Receive a digital ride credit code in your rewards wallet.', validityDays: 45, area: 'Multiple outlets' },
  { id: 9, merchant: 'Popular Bookstore', title: '15% Off Stationery', xpCost: 600, category: 'Partner Deals', icon: '📚', tags: ['Campus'], description: 'Save on one stationery purchase at participating outlets.', validityDays: 30, area: 'Bras Basah' },
  // Aspirational rewards. Without something priced above a top-tier balance the
  // catalogue runs out: a Kampung Spirit customer can buy all of it outright,
  // which leaves the tier ladder, the affordability filter and a saved goal
  // with nothing to act on.
  { id: 15, merchant: 'Hawker Centres', title: '$25 Hawker Feast Bundle', xpCost: 2500, category: 'Vouchers', icon: '🥡', tags: ['Local', 'Food'], description: 'Five $5 heartland vouchers to use across participating hawker stalls.', validityDays: 60, area: 'Multiple outlets' },
  { id: 16, merchant: 'NETS Travel', title: '$150 Travel Voucher', xpCost: 15000, category: 'Partner Deals', icon: '✈️', tags: ['Travel', 'Flagship'], description: 'The flagship reward — redeemable against flights and hotels with NETS travel partners.', validityDays: 90, area: 'Multiple outlets' },
  // Neighbourhood stalls, each tied to one estate. These are what make a
  // sponsored slot local: an Ang Mo Kio customer sees Cheng San, a Woodlands
  // customer sees Marsiling, and neither sees the other's.
  { id: 13, merchant: 'Cheng San Nasi Lemak', title: '$2 Off Nasi Lemak Set', xpCost: 200, category: 'Vouchers', icon: '🍚', tags: ['Local', 'Food'], description: 'Redeem on one nasi lemak set at the Cheng San Market stall.', validityDays: 30, area: 'Ang Mo Kio' },
  { id: 14, merchant: 'Marsiling Mee Pok', title: '$2 Off Mee Pok Bowl', xpCost: 200, category: 'Vouchers', icon: '🍜', tags: ['Local', 'Food'], description: 'Redeem on one bowl at the Marsiling hawker stall.', validityDays: 30, area: 'Woodlands' },
  { id: 10, merchant: 'LiHO TEA', title: '1-for-1 Medium Milk Tea', xpCost: 350, category: 'Partner Deals', icon: '🧋', tags: ['Drinks'], description: 'Redeem one complimentary medium drink with purchase.', validityDays: 14, area: 'Orchard' },
  { id: 11, merchant: 'FairPrice', title: '$8 Grocery Voucher', xpCost: 800, category: 'Vouchers', icon: '🛒', tags: ['Essentials'], description: 'Use on a minimum $40 grocery purchase.', validityDays: 30, area: 'Toa Payoh' },
  { id: 12, merchant: 'NETS Wallet', title: '$10 Wallet Cashback', xpCost: 1000, category: 'Cashback', icon: '💵', tags: ['Instant'], description: 'Credit $10 directly to your NETS wallet balance.', validityDays: 0 },
];

/**
 * Picks the emoji shown on a reward. Matched on the merchant and title first so
 * a bubble tea shop looks like bubble tea, then falling back to the kind of
 * reward it is.
 */
const REWARD_EMOJI_KEYWORDS: [RegExp, string][] = [
  [/bubble tea|milk tea|liho|gong cha|chagee|boba/i, '🧋'],
  [/chicken rice/i, '🍗'],
  [/curry puff|chang kee/i, '🥟'],
  [/kaya|toast|bakery|bread/i, '🍞'],
  [/coffee|kopi/i, '☕'],
  [/hawker|food court|food centre|heartland/i, '🍜'],
  [/campus|student|nyp|polytechnic/i, '🍱'],
  [/peking|duck/i, '🦆'],
  [/omakase|sushi|nobu|japanese/i, '🍣'],
  [/brunch|caf[eé]|breakfast/i, '🥐'],
  [/dessert|cake|sweet/i, '🍰'],
  [/aquarium|s\.e\.a\.|marine/i, '🐠'],
  [/garden|flower|botanic|forest/i, '🌿'],
  [/safari|wildlife|zoo|night safari/i, '🦁'],
  [/ride|grab|taxi|transport/i, '🚗'],
  [/book|stationery|popular/i, '📚'],
  [/fairprice|grocer|supermarket|ntuc/i, '🛒'],
  [/cashback|wallet/i, '💵'],
  [/restaurant|dining|set meal|lunch|dinner/i, '🍽️'],
];

const CATEGORY_EMOJI: Record<RewardCategory, string> = {
  Cashback: '💵',
  Vouchers: '🎟️',
  'Partner Deals': '🎁',
};

export function rewardEmoji(input: {
  merchant: string;
  title: string;
  category: RewardCategory;
  /** The Hangout-style category a partner deal came from, when known. */
  dealCategory?: string;
}): string {
  const haystack = `${input.merchant} ${input.title}`;
  const keyword = REWARD_EMOJI_KEYWORDS.find(([pattern]) => pattern.test(haystack));
  if (keyword) return keyword[1];
  if (input.dealCategory === 'food') return '🍽️';
  if (input.dealCategory) return '🎢';
  return CATEGORY_EMOJI[input.category];
}

export function getRewardsCatalog(): Reward[] {
  const partnerRewards: Reward[] = getDeals().map(deal => ({
    id: 10000 + deal.id,
    merchant: deal.merchant,
    title: deal.title,
    xpCost: Math.max(150, Math.round(deal.savings * 20 / 50) * 50),
    category: 'Partner Deals',
    icon: rewardEmoji({
      merchant: deal.merchant,
      title: deal.title,
      category: 'Partner Deals',
      dealCategory: deal.category,
    }),
    tags: [deal.category === 'food' ? 'Food' : 'Experience', deal.location],
    description: deal.description,
    validityDays: 30,
    area: deal.location,
  }));
  return [...REWARDS, ...partnerRewards];
}

const HEARTLAND_KEYWORDS = [
  'hawker', 'kopitiam', 'food court', 'breadtalk', 'old chang kee',
  'chicken rice', 'maxwell', 'amoy', 'tiong bahru',
];

function isHeartlandMerchant(name: string): boolean {
  const normalized = name.toLowerCase();
  return HEARTLAND_KEYWORDS.some(keyword => normalized.includes(keyword));
}

/**
 * XP a payment earns before the tier multiplier.
 *
 * Merchants configured in the management portal carry their own XP rate and
 * bonus multiplier; anything else falls back to the standard rate plus the
 * automatic heartland bonus. `at` is the time of the payment, so a scheduled
 * campaign only pays out for transactions inside its window - historical
 * transactions keep the rate that was live when they happened.
 */
export function calculateTransactionXP(
  name: string,
  amount: number,
  at: number = Date.now(),
): { xp: number; bonus?: string } {
  if (amount >= 0) return { xp: 0 };
  const spend = Math.abs(amount);
  const merchant = getMerchantByName(name);

  if (merchant) {
    const bonus = effectiveBonus(merchant, at);
    const xp = Math.max(1, Math.round(spend * merchant.xpRate * bonus));
    return bonus > 1 ? { xp, bonus: `${bonus}x merchant bonus` } : { xp };
  }

  const base = Math.max(1, Math.round(spend * DEFAULT_XP_RATE));
  if (isHeartlandMerchant(name)) return { xp: base * 2, bonus: 'Heartland 2x' };
  return { xp: base };
}

const TIER_MULTIPLIERS = [1, 1.1, 1.2, 1.3];

/**
 * Earn multiplier granted by the user's tier. Kept deliberately small so it
 * rewards loyalty without dwarfing the merchant campaigns it stacks with -
 * the ceiling is a 2x heartland campaign at the top tier, i.e. 2.6x.
 */
export function tierMultiplier(level: number): number {
  return TIER_MULTIPLIERS[level - 1] ?? 1;
}

/**
 * Applies the tier multiplier to a chronological run of earn entries.
 *
 * Each entry is multiplied by the tier the user actually held at that moment,
 * derived from the total accumulated by the entries before it. Every step only
 * reads earlier totals, so there is no circularity between "tier determines
 * earnings" and "earnings determine tier".
 */
export function applyTierMultipliers(entries: XPHistoryEntry[]): XPHistoryEntry[] {
  const ascending = [...entries].sort((a, b) => a.createdAt - b.createdAt);
  let lifetime = 0;
  return ascending.map(entry => {
    if (entry.type !== 'earn') return entry;
    const multiplier = tierMultiplier(getTier(lifetime).level);
    const xp = Math.max(1, Math.round(entry.xp * multiplier));
    lifetime += xp;
    if (multiplier === 1) return { ...entry, xp };
    const suffix = `${multiplier}x tier bonus`;
    return { ...entry, xp, bonus: entry.bonus ? `${entry.bonus} + ${suffix}` : suffix };
  });
}

const MISSION_COUNT = 5;

/**
 * Quest XP for every day the user completed at least one mission, clamped to
 * the weekly allowance.
 *
 * Days are credited oldest first so the cap is spent chronologically: earning
 * it early in the week is what stops later days paying out, rather than the
 * order the rows happen to come back in.
 */
export function buildQuestEntries(signals: QuestSignal[]): XPHistoryEntry[] {
  const days = [...new Set(signals.map(signal => dayKey(signal.at)))].sort();
  const entries: XPHistoryEntry[] = [];
  const weeklyTotals = new Map<string, number>();

  for (const day of days) {
    const evaluated = evaluateDay(signals, day);
    const done = evaluated.missions.filter(mission => mission.complete);
    if (done.length === 0) continue;

    const at = evaluated.date.getTime();
    const week = weekKey(at);
    const alreadyEarned = weeklyTotals.get(week) ?? 0;
    const allowance = Math.max(0, WEEKLY_MISSION_XP_CAP - alreadyEarned);
    const awarded = Math.min(evaluated.xpEarned, allowance);
    if (awarded === 0) continue;
    weeklyTotals.set(week, alreadyEarned + awarded);

    const capped = awarded < evaluated.xpEarned;
    entries.push({
      id: `quest-${day}`,
      title: `Daily missions - ${done.length} complete`,
      subtitle: capped
        ? `${done.map(mission => mission.title).join(', ')} (weekly cap reached)`
        : done.map(mission => mission.title).join(', '),
      xp: awarded,
      type: 'earn',
      // Credit at the end of the day the missions were completed.
      createdAt: at + 23 * 60 * 60 * 1000,
      bonus: !capped && done.length === MISSION_COUNT ? 'All missions cleared' : undefined,
    });
  }
  return entries;
}

function rowToRedemption(row: Record<string, any>): RewardRedemption {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    rewardId: Number(row.reward_id),
    title: String(row.title),
    merchant: String(row.merchant),
    xpCost: Number(row.xp_cost),
    refCode: String(row.ref_code),
    redeemedAt: Number(row.redeemed_at),
    used: Number(row.used) === 1,
    expiresAt: Number(row.expires_at ?? 0),
    usedAt: row.used_at == null ? undefined : Number(row.used_at),
  };
}

export function getRewardRedemptions(userId: string): RewardRedemption[] {
  return query('SELECT * FROM reward_redemptions WHERE user_id = ? ORDER BY redeemed_at DESC', [userId])
    .map(rowToRedemption);
}

/**
 * Publishes every voucher a user holds to the server index.
 *
 * Run on startup and whenever the rewards wallet is opened — the screen that
 * renders the QR — so a code is verifiable from another device before anyone
 * can scan it. Registering only at the moment of redemption is not enough: the
 * seeded demo vouchers are inserted straight into SQLite, and a redemption made
 * while offline gets no second chance.
 *
 * Only the given user's vouchers are sent. The index needs no one else's, and
 * the device publishing is the one whose voucher is about to be presented.
 */
export async function syncVoucherIndex(userId: string): Promise<boolean> {
  return publishVouchers(getRewardRedemptions(userId));
}

export function getXPHistory(userId: string): XPHistoryEntry[] {
  const transactions = query(
    `SELECT id, name, amount, date, created_at, kind, status
       FROM transactions
      WHERE user_id = ? AND amount < 0
        AND (kind = 'purchase' OR (kind IS NULL AND (status IS NULL OR status != 'sent')))`,
    [userId],
  );
  const earned: XPHistoryEntry[] = transactions.map(row => {
    const at = Number(row.created_at ?? row.id);
    const result = calculateTransactionXP(String(row.name), Number(row.amount), at);
    return {
      id: `txn-${row.id}`,
      title: String(row.name),
      subtitle: `NETS payment - $${Math.abs(Number(row.amount)).toFixed(2)}`,
      xp: result.xp,
      type: 'earn',
      createdAt: at,
      bonus: result.bonus,
    };
  });

  // A refunded payment claws back the XP it earned, so the ledger keeps an
  // explicit reversal rather than silently recomputing a smaller balance.
  const refunds: XPHistoryEntry[] = query(
    `SELECT id, name, amount, created_at FROM transactions WHERE user_id = ? AND kind = 'refund'`,
    [userId],
  ).map(row => {
    const at = Number(row.created_at ?? row.id);
    const result = calculateTransactionXP(String(row.name), -Math.abs(Number(row.amount)), at);
    return {
      id: `refund-${row.id}`,
      title: String(row.name),
      subtitle: `Refund - $${Math.abs(Number(row.amount)).toFixed(2)} returned`,
      xp: result.xp,
      type: 'refund' as const,
      createdAt: at,
    };
  });
  const spent: XPHistoryEntry[] = getRewardRedemptions(userId).map(redemption => ({
    id: `redemption-${redemption.id}`,
    title: redemption.title,
    subtitle: `Redeemed from ${redemption.merchant}`,
    xp: redemption.xpCost,
    type: 'spend',
    createdAt: redemption.redeemedAt,
  }));
  const welcome: XPHistoryEntry = {
    id: 'welcome',
    title: 'Welcome to NETS XP',
    subtitle: 'Starter bonus',
    xp: WELCOME_XP,
    type: 'earn',
    // Sentinel timestamp so it always sorts last; it is never expired, see
    // `neverExpires` on the ledger input.
    createdAt: 1,
    neverExpires: true,
  };
  // XP carried over from before the demo window. Only the presentation
  // scenario writes this, so a real account never has one; it exists because a
  // long-standing customer would not start the demo from zero, and stating it
  // as one grant is more honest than inventing months of transactions to reach
  // the same figure.
  const carried = query('SELECT value FROM app_meta WHERE key = ?', [`demo-xp-carryover:${userId}`]);
  const carryOver: XPHistoryEntry[] = carried.length && Number(carried[0].value) > 0
    ? [{
        id: 'carry-over',
        title: 'Earlier NETS activity',
        subtitle: 'XP carried into this account',
        xp: Number(carried[0].value),
        type: 'earn',
        createdAt: 2,
        neverExpires: true,
      }]
    : [];

  const quests = buildQuestEntries(getQuestSignals(userId));
  const withTiers = applyTierMultipliers([welcome, ...carryOver, ...earned, ...quests]);
  return [...withTiers, ...spent, ...refunds].sort((a, b) => b.createdAt - a.createdAt);
}

/** The user's XP ledger: balance, lots and the full audit trail. */
export function getXPLedger(userId: string): XPLedger {
  return buildLedger(getXPHistory(userId) as XPLedgerInput[]);
}

export function getXPStats(userId: string): {
  /** Spendable XP, after expiry and refunds. */
  currentXP: number;
  lifetimeXP: number;
  spentXP: number;
  expiredXP: number;
  refundedXP: number;
  expiringSoon: number;
  expiringSoonAt: number | null;
  earnedThisMonth: number;
  transactionCount: number;
} {
  const history = getXPHistory(userId);
  const ledger = buildLedger(history as XPLedgerInput[]);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const earnedThisMonth = history
    .filter(entry => entry.type === 'earn' && entry.createdAt >= monthStart.getTime())
    .reduce((sum, entry) => sum + entry.xp, 0);
  return {
    currentXP: ledger.balance,
    // Tier standing is lifetime XP *earned*, so expiry never demotes anyone.
    lifetimeXP: ledger.totalEarned,
    spentXP: ledger.totalSpent,
    expiredXP: ledger.totalExpired,
    refundedXP: ledger.totalRefunded,
    expiringSoon: ledger.expiringSoon,
    expiringSoonAt: ledger.expiringSoonAt,
    earnedThisMonth,
    transactionCount: history.filter(entry => entry.id.startsWith('txn-')).length,
  };
}

// ─── Ordering the store ──────────────────────────────────────────────────────

export type RewardSort = 'recommended' | 'cheapest' | 'nearest' | 'popular';

export const REWARD_SORT_LABELS: Record<RewardSort, string> = {
  recommended: 'Recommended',
  cheapest: 'Lowest XP',
  nearest: 'Nearest',
  popular: 'Most redeemed',
};

export interface SortableReward {
  xpCost: number;
  /** Distance in km, or null when the reward has no single outlet. */
  distanceKm: number | null;
  redemptions: number;
}

/**
 * Comparator for the store listing.
 *
 * "Recommended" puts what the customer can afford first, cheapest within that,
 * because a store that leads with rewards out of reach reads as a wall. The
 * other orders are literal, and each falls back to price so the listing is
 * stable rather than shuffling between renders.
 */
export function compareRewards(
  a: SortableReward,
  b: SortableReward,
  sort: RewardSort,
  currentXP: number,
): number {
  switch (sort) {
    case 'cheapest':
      return a.xpCost - b.xpCost;
    case 'popular':
      return b.redemptions - a.redemptions || a.xpCost - b.xpCost;
    case 'nearest': {
      // Rewards with no single outlet sort last rather than pretending to be
      // at distance zero.
      const left = a.distanceKm ?? Infinity;
      const right = b.distanceKm ?? Infinity;
      return left - right || a.xpCost - b.xpCost;
    }
    case 'recommended':
    default: {
      const affordable = (reward: SortableReward) => (reward.xpCost <= currentXP ? 0 : 1);
      return affordable(a) - affordable(b) || a.xpCost - b.xpCost;
    }
  }
}

// ─── Working toward a reward ─────────────────────────────────────────────────
// A points store that only says "locked" gives a customer nothing to aim at.
// Picking a goal turns the balance on XP Home from a number into a distance.

export interface GoalProgress {
  reward: Reward;
  /** Spendable XP right now. */
  currentXP: number;
  /** XP still needed, zero once the goal is affordable. */
  remaining: number;
  /** 0-100, for the progress bar. */
  percent: number;
  reached: boolean;
}

/** How close a balance is to a target cost. Pure, so it is unit-testable. */
export function goalProgressFor(xpCost: number, currentXP: number): {
  remaining: number;
  percent: number;
  reached: boolean;
} {
  const cost = Math.max(0, xpCost);
  const held = Math.max(0, currentXP);
  if (cost === 0) return { remaining: 0, percent: 100, reached: true };
  const remaining = Math.max(0, cost - held);
  return {
    remaining,
    percent: Math.min(100, Math.round((held / cost) * 100)),
    reached: remaining === 0,
  };
}

const GOAL_KEY = (userId: string) => `reward-goal:${userId}`;

export function getGoalRewardId(userId: string): number | null {
  const rows = query('SELECT value FROM app_meta WHERE key = ?', [GOAL_KEY(userId)]);
  if (rows.length === 0) return null;
  const id = Number(rows[0].value);
  return Number.isFinite(id) ? id : null;
}

export function setGoalReward(userId: string, rewardId: number | null): void {
  if (rewardId === null) {
    run('DELETE FROM app_meta WHERE key = ?', [GOAL_KEY(userId)]);
  } else {
    run('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [GOAL_KEY(userId), String(rewardId)]);
  }
  window.dispatchEvent(new CustomEvent('rewardGoalUpdated'));
}

/**
 * The customer's goal and how far off it is, or null if none is set or the
 * reward has since left the catalogue — a goal pointing at something that can
 * no longer be redeemed would be worse than none.
 */
export function getGoalProgress(userId: string): GoalProgress | null {
  const rewardId = getGoalRewardId(userId);
  if (rewardId === null) return null;
  const reward = getRewardsCatalog().find(entry => entry.id === rewardId);
  if (!reward) return null;
  const currentXP = getXPStats(userId).currentXP;
  return { reward, currentXP, ...goalProgressFor(reward.xpCost, currentXP) };
}

export function redeemReward(userId: string, reward: Reward): RewardRedemption | null {
  if (getXPStats(userId).currentXP < reward.xpCost) return null;
  const now = Date.now();
  const refCode = `XP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const instantCashback = reward.merchant === 'NETS Wallet' && reward.category === 'Cashback';
  const expiresAt = reward.validityDays > 0 ? now + reward.validityDays * 24 * 60 * 60 * 1000 : 0;
  run(
    `INSERT INTO reward_redemptions
      (user_id, reward_id, title, merchant, xp_cost, ref_code, redeemed_at, used, expires_at, used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, reward.id, reward.title, reward.merchant, reward.xpCost, refCode, now,
      instantCashback ? 1 : 0, expiresAt, instantCashback ? now : null],
  );
  const redemption: RewardRedemption = {
    id: lastInsertId(),
    userId,
    rewardId: reward.id,
    title: reward.title,
    merchant: reward.merchant,
    xpCost: reward.xpCost,
    refCode,
    redeemedAt: now,
    used: instantCashback,
    expiresAt,
    usedAt: instantCashback ? now : undefined,
  };
  if (instantCashback) {
    const match = reward.title.match(/\$(\d+(?:\.\d+)?)/);
    const amount = match ? Number(match[1]) : 0;
    if (amount > 0) {
      run(
        `INSERT INTO transactions
          (user_id, name, amount, date, category, status, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, 'NETS XP Cashback', amount, 'Just now', 'reward', null, 'cashback', now],
      );
      window.dispatchEvent(new CustomEvent('transactionsUpdated'));
    }
  }
  // Publish it so the voucher can be verified by a phone scanning the QR, which
  // is not signed in as this customer and cannot read their database.
  registerVoucher(redemption);
  window.dispatchEvent(new CustomEvent('rewardRedemptionsUpdated'));
  return redemption;
}

/**
 * Mark a voucher as used at the merchant. An expired voucher is refused, so the
 * status shown on the voucher and what the app allows can never disagree.
 */
/**
 * Finds a redemption by its printed reference code, across all users.
 *
 * The voucher QR is scanned at the counter, so the lookup cannot assume the
 * scanning device is signed in as the customer who holds the voucher — the
 * reference code is the only thing the scanner has.
 */
export function getRedemptionByRefCode(refCode: string): RewardRedemption | null {
  const code = refCode.trim().toUpperCase();
  if (!code) return null;
  const rows = query(
    'SELECT * FROM reward_redemptions WHERE UPPER(ref_code) = ? LIMIT 1',
    [code],
  );
  return rows.length ? rowToRedemption(rows[0]) : null;
}

/**
 * Marks a voucher used from a scan, identified by reference code rather than
 * by id and owner. Returns the redemption either way so the scan screen can
 * show what the voucher was, even when it cannot be accepted.
 */
export function redeemByRefCode(refCode: string, now = Date.now()): {
  ok: boolean;
  reason?: string;
  redemption: RewardRedemption | null;
} {
  const redemption = getRedemptionByRefCode(refCode);
  if (!redemption) return { ok: false, reason: 'No voucher matches this code.', redemption: null };

  const status = getRedemptionStatus(redemption, now);
  if (status === 'applied') {
    return { ok: false, reason: 'This is wallet cashback, already credited.', redemption };
  }
  if (status === 'expired') {
    return { ok: false, reason: `This voucher expired on ${formatExpiry(redemption.expiresAt)}.`, redemption };
  }
  if (status === 'used') {
    return { ok: false, reason: 'This voucher has already been used.', redemption };
  }

  run(
    'UPDATE reward_redemptions SET used = 1, used_at = ? WHERE id = ?',
    [now, redemption.id],
  );
  // A scan honoured against the local record still has to reach the index, so
  // the next device to scan the same code sees it spent.
  void publishVouchers([{ ...redemption, used: true, usedAt: now }]);
  window.dispatchEvent(new CustomEvent('rewardRedemptionsUpdated'));
  return { ok: true, redemption: { ...redemption, used: true, usedAt: now } };
}

export function markRewardUsed(redemptionId: number, userId: string): { ok: boolean; reason?: string } {
  const redemption = getRewardRedemptions(userId).find(item => item.id === redemptionId);
  if (!redemption) return { ok: false, reason: 'That voucher could not be found.' };

  const status = getRedemptionStatus(redemption);
  if (status === 'expired') {
    return { ok: false, reason: `This voucher expired on ${formatExpiry(redemption.expiresAt)}.` };
  }
  if (status === 'used') return { ok: false, reason: 'This voucher has already been used.' };

  const usedAt = Date.now();
  run(
    'UPDATE reward_redemptions SET used = 1, used_at = ? WHERE id = ? AND user_id = ?',
    [usedAt, redemptionId, userId],
  );
  // Carry the spend to the index too, or the same code would still be honoured
  // by a merchant scanning the QR after the customer marked it used in-app.
  void publishVouchers([{ ...redemption, used: true, usedAt }]);
  window.dispatchEvent(new CustomEvent('rewardRedemptionsUpdated'));
  return { ok: true };
}

/**
 * The tier ladder, ordered from entry level upwards. `getTier` and the tier
 * breakdown sheet both read from this list so the breakpoints can never drift
 * apart between the two.
 */
export const TIERS: Tier[] = [
  { name: 'Neighbourhood Explorer', level: 1, start: 0,     next: 1000,  color: '#2563eb', blurb: 'Just getting started with NETS payments around the neighbourhood.' },
  { name: 'Local Legend',           level: 2, start: 1000,  next: 4000,  color: '#00a94f', blurb: 'A regular at your local stalls and kopitiams.' },
  { name: 'Heartland Insider',      level: 3, start: 4000,  next: 10000, color: '#8b5cf6', blurb: 'You know where the good heartland deals are.' },
  { name: 'Kampung Spirit',         level: 4, start: 10000, next: null,  color: '#f59e0b', blurb: 'The highest tier - a true supporter of local merchants.' },
];

export function getTier(lifetimeXP: number): Tier {
  // Walk down from the top so the first tier whose threshold is met wins.
  for (let index = TIERS.length - 1; index >= 0; index -= 1) {
    if (lifetimeXP >= TIERS[index].start) return TIERS[index];
  }
  return TIERS[0];
}

/** Progress through the current tier as a 0-100 percentage. */
export function getTierProgress(lifetimeXP: number, tier: Tier = getTier(lifetimeXP)): number {
  if (tier.next === null) return 100;
  const span = tier.next - tier.start;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, ((lifetimeXP - tier.start) / span) * 100));
}

function monthKeyOf(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthFromKey(key: string): XPMonth {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return {
    key,
    label: date.toLocaleDateString('en-SG', { month: 'short' }),
    longLabel: date.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }),
  };
}

/**
 * Distinct months present in the history, newest first. The starter bonus is
 * pinned to timestamp 1 so it is excluded - it would otherwise add a stray
 * 1970 tab. Pass `alwaysInclude` to keep a month (typically the current one)
 * in the list even when nothing was earned in it.
 */
export function listXPMonths(entries: XPHistoryEntry[], alwaysInclude?: string): XPMonth[] {
  const keys = new Set<string>();
  if (alwaysInclude) keys.add(alwaysInclude);
  for (const entry of entries) {
    if (entry.createdAt > 1) keys.add(monthKeyOf(entry.createdAt));
  }
  return [...keys].sort((a, b) => b.localeCompare(a)).map(monthFromKey);
}

export function summariseMonth(entries: XPHistoryEntry[], key: string): MonthlyXPSummary {
  const inMonth = entries.filter(entry => entry.createdAt > 1 && monthKeyOf(entry.createdAt) === key);
  const earnEntries = inMonth
    .filter(entry => entry.type === 'earn')
    .sort((a, b) => b.createdAt - a.createdAt);
  const earned = earnEntries.reduce((sum, entry) => sum + entry.xp, 0);
  const spent = inMonth.filter(entry => entry.type === 'spend').reduce((sum, entry) => sum + entry.xp, 0);

  // Group by merchant so repeat visits to one stall show as a single source.
  const bySource = new Map<string, number>();
  for (const entry of earnEntries) {
    bySource.set(entry.title, (bySource.get(entry.title) ?? 0) + entry.xp);
  }
  const topSource = [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([title, xp]) => ({ title, xp }))[0] ?? null;

  return {
    key,
    earned,
    spent,
    net: earned - spent,
    entries: earnEntries,
    bonusXP: earnEntries.filter(entry => entry.bonus).reduce((sum, entry) => sum + entry.xp, 0),
    transactionCount: earnEntries.filter(entry => entry.id.startsWith('txn-')).length,
    topSource,
  };
}

/** Current calendar month as a `YYYY-MM` key. */
export function currentMonthKey(): string {
  return monthKeyOf(Date.now());
}

export function getXPMonths(userId: string): XPMonth[] {
  return listXPMonths(getXPHistory(userId));
}

export function getMonthlyXPSummary(userId: string, key: string): MonthlyXPSummary {
  return summariseMonth(getXPHistory(userId), key);
}
