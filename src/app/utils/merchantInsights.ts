// ─── What a merchant learns from accepting NETS ──────────────────────────────
// The business case for the rewards store is that a hawker stall gets analytics
// it could never build alone. This module is that promise made real: every
// figure below is derived from the transactions and redemptions the app already
// records, so nothing here is a mock-up.
//
// Deliberately read-only. It owns no tables and stores no aggregates — a stored
// summary is a second copy of the truth that can drift from the ledger, which is
// exactly the bug that made savings goals disagree with the wallet.

import { query } from './db';
import { classifyTransaction } from './transactionModel';
import {
  getAllMerchants, getMerchants, matchesMerchant as matchesConfiguredMerchant,
} from './merchantStorage';
import { getRewardsCatalog, type Reward } from './rewardStorage';

export interface PurchaseRow {
  userId: string;
  name: string;
  amount: number;
  category: string;
  createdAt: number;
}

export interface RedemptionRow {
  userId: string;
  rewardId: number;
  title: string;
  merchant: string;
  xpCost: number;
  redeemedAt: number;
  used: boolean;
}

/** Every purchase in the ledger. Wallet flows are excluded — they are not sales. */
export function getPurchases(): PurchaseRow[] {
  return query(
    'SELECT user_id, name, amount, category, kind, status, created_at FROM transactions WHERE amount < 0',
  )
    .filter(row => classifyTransaction(row) === 'purchase')
    .map(row => ({
      userId: String(row.user_id),
      name: String(row.name),
      amount: Math.abs(Number(row.amount)),
      category: String(row.category ?? ''),
      createdAt: Number(row.created_at ?? 0),
    }));
}

export function getAllRedemptions(): RedemptionRow[] {
  return query('SELECT * FROM reward_redemptions').map(row => ({
    userId: String(row.user_id),
    rewardId: Number(row.reward_id),
    title: String(row.title),
    merchant: String(row.merchant),
    xpCost: Number(row.xp_cost),
    redeemedAt: Number(row.redeemed_at),
    used: Number(row.used) === 1,
  }));
}

/**
 * Whether a transaction's free-text merchant name refers to this merchant.
 *
 * Delegates to the one matching rule in merchantStorage, so a sale that earns
 * XP is always the same sale that shows up in that merchant's insights. That
 * rule is exact-name-or-declared-alias: a loose substring match let a merchant
 * named "Kopi" claim every "Kopitiam Food Court" payment, so name variants are
 * declared explicitly instead of guessed.
 */
export function matchesMerchant(
  transactionName: string,
  merchantName: string,
  aliases: string[] = [],
): boolean {
  if (!merchantName.trim()) return false;
  return matchesConfiguredMerchant(transactionName, { name: merchantName, aliases });
}

/** The declared aliases for a merchant name, if it is one NETS has configured. */
function aliasesFor(merchantName: string): string[] {
  const needle = merchantName.trim().toLowerCase();
  return getAllMerchants().find(m => m.name.trim().toLowerCase() === needle)?.aliases ?? [];
}

const HOURS = [
  '12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am',
  '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm',
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface RankedItem {
  label: string;
  count: number;
  /** Share of the total, 0–1. */
  share: number;
}

function rank(counts: Map<string, number>, limit = 5): RankedItem[] {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export interface MerchantInsight {
  merchant: string;
  /** Completed sales through NETS. */
  sales: number;
  revenue: number;
  averageSpend: number;
  customers: number;
  /** Customers who came back for a second purchase. */
  repeatCustomers: number;
  repeatRate: number;
  /** Busiest hour and day, or null until there is anything to rank. */
  peakHour: string | null;
  peakDay: string | null;
  /** What customers actually redeem here, most popular first. */
  popularRewards: RankedItem[];
  /** The spending categories this merchant's sales fall into. */
  categories: RankedItem[];
  redemptions: number;
  xpSpent: number;
  /** Distinct customers who redeemed something for this merchant. */
  redeemers: number;
  /** Of those, how many then came back and paid here. */
  returned: number;
  returnRate: number;
  /** Customers whose first purchase here came after redeeming a reward. */
  wonOver: number;
}

/**
 * The whole calculation, over rows handed in rather than read from the
 * database — so every figure a merchant is shown is covered by unit tests
 * rather than only being exercised by clicking through the portal.
 */
export function computeMerchantInsight(
  allPurchases: PurchaseRow[],
  allRedemptions: RedemptionRow[],
  merchantName: string,
  aliases: string[] = [],
): MerchantInsight {
  const purchases = allPurchases.filter(p => matchesMerchant(p.name, merchantName, aliases));
  const redemptions = allRedemptions.filter(r => matchesMerchant(r.merchant, merchantName, aliases));

  const revenue = purchases.reduce((sum, p) => sum + p.amount, 0);

  const perCustomer = new Map<string, number>();
  const hours = new Map<string, number>();
  const days = new Map<string, number>();
  const categories = new Map<string, number>();
  const firstPurchase = new Map<string, number>();

  for (const purchase of purchases) {
    perCustomer.set(purchase.userId, (perCustomer.get(purchase.userId) ?? 0) + 1);
    if (purchase.category) categories.set(purchase.category, (categories.get(purchase.category) ?? 0) + 1);
    if (purchase.createdAt > 0) {
      const when = new Date(purchase.createdAt);
      const hour = HOURS[when.getHours()];
      const day = DAYS[when.getDay()];
      hours.set(hour, (hours.get(hour) ?? 0) + 1);
      days.set(day, (days.get(day) ?? 0) + 1);
      const earliest = firstPurchase.get(purchase.userId);
      if (earliest === undefined || purchase.createdAt < earliest) {
        firstPurchase.set(purchase.userId, purchase.createdAt);
      }
    }
  }

  const popular = new Map<string, number>();
  const redeemerFirstRedemption = new Map<string, number>();
  for (const redemption of redemptions) {
    popular.set(redemption.title, (popular.get(redemption.title) ?? 0) + 1);
    const earliest = redeemerFirstRedemption.get(redemption.userId);
    if (earliest === undefined || redemption.redeemedAt < earliest) {
      redeemerFirstRedemption.set(redemption.userId, redemption.redeemedAt);
    }
  }

  // Did the voucher bring them back? A customer counts as returned when they
  // paid here after redeeming — the only evidence that a reward did its job.
  let returned = 0;
  let wonOver = 0;
  for (const [userId, redeemedAt] of redeemerFirstRedemption) {
    const cameBack = purchases.some(p => p.userId === userId && p.createdAt > redeemedAt);
    if (cameBack) {
      returned += 1;
      const first = firstPurchase.get(userId);
      // Their first-ever purchase here came after the redemption, so the reward
      // did not just retain a regular — it made a new customer.
      if (first === undefined || first > redeemedAt) wonOver += 1;
    }
  }

  const customers = perCustomer.size;
  const repeatCustomers = [...perCustomer.values()].filter(n => n >= 2).length;
  const redeemers = redeemerFirstRedemption.size;

  return {
    merchant: merchantName,
    sales: purchases.length,
    revenue,
    averageSpend: purchases.length ? revenue / purchases.length : 0,
    customers,
    repeatCustomers,
    repeatRate: customers ? repeatCustomers / customers : 0,
    peakHour: rank(hours, 1)[0]?.label ?? null,
    peakDay: rank(days, 1)[0]?.label ?? null,
    popularRewards: rank(popular),
    categories: rank(categories, 4),
    redemptions: redemptions.length,
    xpSpent: redemptions.reduce((sum, r) => sum + r.xpCost, 0),
    redeemers,
    returned,
    returnRate: redeemers ? returned / redeemers : 0,
    wonOver,
  };
}

export function getMerchantInsight(merchantName: string): MerchantInsight {
  return computeMerchantInsight(getPurchases(), getAllRedemptions(), merchantName, aliasesFor(merchantName));
}

/**
 * Every merchant NETS knows about — those configured for payment and those that
 * only appear as a reward partner — so a partner with vouchers but no terminal
 * sales is still visible rather than silently missing.
 */
export function getKnownMerchantNames(): string[] {
  const names = new Set<string>();
  for (const merchant of getMerchants()) names.add(merchant.name);
  for (const reward of getRewardsCatalog()) {
    // Wallet cashback is issued by NETS itself, not by a merchant.
    if (reward.merchant !== 'NETS Wallet') names.add(reward.merchant);
  }
  for (const redemption of getAllRedemptions()) {
    if (redemption.merchant !== 'NETS Wallet') names.add(redemption.merchant);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function getMerchantLeaderboard(): MerchantInsight[] {
  return getKnownMerchantNames()
    .map(getMerchantInsight)
    .sort((a, b) => b.revenue - a.revenue || b.redemptions - a.redemptions);
}

export interface PopularReward {
  reward: Reward | null;
  rewardId: number;
  title: string;
  merchant: string;
  redemptions: number;
  xpSpent: number;
  /** Redemptions in the last seven days, which is what "trending" means here. */
  recent: number;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * What customers are actually spending XP on, most redeemed first. This is the
 * signal NETS uses to decide which vendors are worth highlighting.
 */
export function computePopularRewards(
  redemptions: RedemptionRow[],
  catalog: Reward[],
  limit = 10,
  now = Date.now(),
): PopularReward[] {
  const byReward = new Map<number, PopularReward>();

  for (const redemption of redemptions) {
    const existing = byReward.get(redemption.rewardId) ?? {
      reward: catalog.find(r => r.id === redemption.rewardId) ?? null,
      rewardId: redemption.rewardId,
      title: redemption.title,
      merchant: redemption.merchant,
      redemptions: 0,
      xpSpent: 0,
      recent: 0,
    };
    existing.redemptions += 1;
    existing.xpSpent += redemption.xpCost;
    if (now - redemption.redeemedAt <= WEEK) existing.recent += 1;
    byReward.set(redemption.rewardId, existing);
  }

  return [...byReward.values()]
    .sort((a, b) => b.redemptions - a.redemptions || b.xpSpent - a.xpSpent)
    .slice(0, limit);
}

export function getPopularRewards(limit = 10, now = Date.now()): PopularReward[] {
  return computePopularRewards(getAllRedemptions(), getRewardsCatalog(), limit, now);
}

/** How many times each reward has been redeemed, for badging the store. */
export function getRedemptionCounts(): Map<number, number> {
  const counts = new Map<number, number>();
  for (const redemption of getAllRedemptions()) {
    counts.set(redemption.rewardId, (counts.get(redemption.rewardId) ?? 0) + 1);
  }
  return counts;
}

/**
 * What customers spend on across every merchant — the "customer favourites"
 * view, ranked by number of purchases rather than dollars so a weekly kopi
 * habit is not buried under one big electronics purchase.
 */
export function getCategoryFavourites(): RankedItem[] {
  const counts = new Map<string, number>();
  for (const purchase of getPurchases()) {
    if (purchase.category) counts.set(purchase.category, (counts.get(purchase.category) ?? 0) + 1);
  }
  return rank(counts, 8);
}
