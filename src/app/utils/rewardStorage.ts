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

export function getTier(lifetimeXP: number): {
  name: string;
  level: number;
  start: number;
  next: number | null;
  color: string;
} {
  if (lifetimeXP >= 10000) return { name: 'Kampung Spirit', level: 4, start: 10000, next: null, color: '#f59e0b' };
  if (lifetimeXP >= 4000) return { name: 'Heartland Insider', level: 3, start: 4000, next: 10000, color: '#8b5cf6' };
  if (lifetimeXP >= 1000) return { name: 'Local Legend', level: 2, start: 1000, next: 4000, color: '#00a94f' };
  return { name: 'Neighbourhood Explorer', level: 1, start: 0, next: 1000, color: '#2563eb' };
}
