import { lastInsertId, query, run } from './db';
import { getDeals } from './dealStorage';
import { DEFAULT_XP_RATE, getMerchantByName } from './merchantStorage';

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
}

export interface XPHistoryEntry {
  id: string;
  title: string;
  subtitle: string;
  xp: number;
  type: 'earn' | 'spend';
  createdAt: number;
  bonus?: string;
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
  { id: 1, merchant: 'NETS Wallet', title: '$5 Wallet Cashback', xpCost: 500, category: 'Cashback', icon: 'S$', tags: ['Instant'], description: 'Credit $5 directly to your NETS wallet balance.', validityDays: 0 },
  { id: 2, merchant: 'Hawker Centres', title: '$5 Heartland Voucher', xpCost: 500, category: 'Vouchers', icon: 'HC', tags: ['Local', 'Food'], description: 'Use at participating NETS-enabled hawker stalls.', validityDays: 30 },
  { id: 3, merchant: 'NYP Campus Food Court', title: '$1.50 Student Meal Credit', xpCost: 150, category: 'Vouchers', icon: 'NYP', tags: ['Campus'], description: 'A student-friendly meal credit for participating campus stalls.', validityDays: 21 },
  { id: 4, merchant: 'Tiong Bahru Chicken Rice', title: '$2 Off Chicken Rice Set', xpCost: 200, category: 'Vouchers', icon: 'TB', tags: ['Local', 'Food'], description: 'Redeem on one chicken rice set at the participating stall.', validityDays: 30 },
  { id: 5, merchant: 'Old Chang Kee', title: 'Free Curry Puff', xpCost: 180, category: 'Vouchers', icon: 'OCK', tags: ['Food'], description: 'One classic curry puff with any two-item purchase.', validityDays: 14 },
  { id: 6, merchant: 'Kopitiam', title: '$3 Coffee Voucher', xpCost: 300, category: 'Vouchers', icon: 'K', tags: ['Local', 'Drinks'], description: 'Valid at participating Kopitiam drink stalls.', validityDays: 30 },
  { id: 7, merchant: 'Ya Kun Kaya Toast', title: '$5 Breakfast Set', xpCost: 450, category: 'Partner Deals', icon: 'YK', tags: ['Food'], description: 'Redeem a selected traditional breakfast set.', validityDays: 30 },
  { id: 8, merchant: 'Grab', title: '$10 Ride Credit', xpCost: 1000, category: 'Partner Deals', icon: 'G', tags: ['Travel'], description: 'Receive a digital ride credit code in your rewards wallet.', validityDays: 45 },
  { id: 9, merchant: 'Popular Bookstore', title: '15% Off Stationery', xpCost: 600, category: 'Partner Deals', icon: 'P', tags: ['Campus'], description: 'Save on one stationery purchase at participating outlets.', validityDays: 30 },
  { id: 10, merchant: 'LiHO TEA', title: '1-for-1 Medium Milk Tea', xpCost: 350, category: 'Partner Deals', icon: 'L', tags: ['Drinks'], description: 'Redeem one complimentary medium drink with purchase.', validityDays: 14 },
  { id: 11, merchant: 'FairPrice', title: '$8 Grocery Voucher', xpCost: 800, category: 'Vouchers', icon: 'FP', tags: ['Essentials'], description: 'Use on a minimum $40 grocery purchase.', validityDays: 30 },
  { id: 12, merchant: 'NETS Wallet', title: '$10 Wallet Cashback', xpCost: 1000, category: 'Cashback', icon: 'S$', tags: ['Instant'], description: 'Credit $10 directly to your NETS wallet balance.', validityDays: 0 },
];

export function getRewardsCatalog(): Reward[] {
  const partnerRewards: Reward[] = getDeals().map(deal => ({
    id: 10000 + deal.id,
    merchant: deal.merchant,
    title: deal.title,
    xpCost: Math.max(150, Math.round(deal.savings * 20 / 50) * 50),
    category: 'Partner Deals',
    icon: deal.merchant.split(/\s+/).map(word => word[0]).join('').slice(0, 3).toUpperCase(),
    tags: [deal.category === 'food' ? 'Food' : 'Experience', deal.location],
    description: deal.description,
    validityDays: 30,
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

// Merchants configured in the management portal carry their own XP rate and
// bonus multiplier; anything else falls back to the standard rate plus the
// automatic heartland bonus.
export function calculateTransactionXP(name: string, amount: number): { xp: number; bonus?: string } {
  if (amount >= 0) return { xp: 0 };
  const spend = Math.abs(amount);
  const merchant = getMerchantByName(name);

  if (merchant) {
    const xp = Math.max(1, Math.round(spend * merchant.xpRate * merchant.xpBonus));
    return merchant.xpBonus > 1 ? { xp, bonus: `${merchant.xpBonus}x merchant bonus` } : { xp };
  }

  const base = Math.max(1, Math.round(spend * DEFAULT_XP_RATE));
  if (isHeartlandMerchant(name)) return { xp: base * 2, bonus: 'Heartland 2x' };
  return { xp: base };
}

export function getRewardRedemptions(userId: string): RewardRedemption[] {
  return query('SELECT * FROM reward_redemptions WHERE user_id = ? ORDER BY redeemed_at DESC', [userId])
    .map(row => ({
      id: Number(row.id),
      userId: String(row.user_id),
      rewardId: Number(row.reward_id),
      title: String(row.title),
      merchant: String(row.merchant),
      xpCost: Number(row.xp_cost),
      refCode: String(row.ref_code),
      redeemedAt: Number(row.redeemed_at),
      used: Number(row.used) === 1,
    }));
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
    const result = calculateTransactionXP(String(row.name), Number(row.amount));
    return {
      id: `txn-${row.id}`,
      title: String(row.name),
      subtitle: `NETS payment - $${Math.abs(Number(row.amount)).toFixed(2)}`,
      xp: result.xp,
      type: 'earn',
      createdAt: Number(row.created_at ?? row.id),
      bonus: result.bonus,
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
    createdAt: 1,
  };
  return [welcome, ...earned, ...spent].sort((a, b) => b.createdAt - a.createdAt);
}

export function getXPStats(userId: string): {
  currentXP: number;
  lifetimeXP: number;
  spentXP: number;
  earnedThisMonth: number;
  transactionCount: number;
} {
  const history = getXPHistory(userId);
  const lifetimeXP = history.filter(entry => entry.type === 'earn').reduce((sum, entry) => sum + entry.xp, 0);
  const spentXP = history.filter(entry => entry.type === 'spend').reduce((sum, entry) => sum + entry.xp, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const earnedThisMonth = history
    .filter(entry => entry.type === 'earn' && entry.createdAt >= monthStart.getTime())
    .reduce((sum, entry) => sum + entry.xp, 0);
  return {
    currentXP: Math.max(0, lifetimeXP - spentXP),
    lifetimeXP,
    spentXP,
    earnedThisMonth,
    transactionCount: history.filter(entry => entry.id.startsWith('txn-')).length,
  };
}

export function redeemReward(userId: string, reward: Reward): RewardRedemption | null {
  if (getXPStats(userId).currentXP < reward.xpCost) return null;
  const now = Date.now();
  const refCode = `XP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const instantCashback = reward.merchant === 'NETS Wallet' && reward.category === 'Cashback';
  run(
    `INSERT INTO reward_redemptions
      (user_id, reward_id, title, merchant, xp_cost, ref_code, redeemed_at, used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, reward.id, reward.title, reward.merchant, reward.xpCost, refCode, now, instantCashback ? 1 : 0],
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
  };
  if (instantCashback) {
    const match = reward.title.match(/\$(\d+(?:\.\d+)?)/);
    const amount = match ? Number(match[1]) : 0;
    if (amount > 0) {
      run(
        `INSERT INTO transactions
          (user_id, name, amount, date, category, status, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, 'NETS XP Cashback', amount, 'Just now', 'reward', 'received', 'cashback', now],
      );
      window.dispatchEvent(new CustomEvent('transactionsUpdated'));
    }
  }
  window.dispatchEvent(new CustomEvent('rewardRedemptionsUpdated'));
  return redemption;
}

export function markRewardUsed(redemptionId: number, userId: string): void {
  run('UPDATE reward_redemptions SET used = 1 WHERE id = ? AND user_id = ?', [redemptionId, userId]);
  window.dispatchEvent(new CustomEvent('rewardRedemptionsUpdated'));
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
