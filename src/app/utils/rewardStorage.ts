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
  type: 'earn' | 'spend';
  createdAt: number;
  bonus?: string;
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
      expiresAt: Number(row.expires_at ?? 0),
      usedAt: row.used_at == null ? undefined : Number(row.used_at),
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
  window.dispatchEvent(new CustomEvent('rewardRedemptionsUpdated'));
  return redemption;
}

/**
 * Mark a voucher as used at the merchant. An expired voucher is refused, so the
 * status shown on the voucher and what the app allows can never disagree.
 */
export function markRewardUsed(redemptionId: number, userId: string): { ok: boolean; reason?: string } {
  const redemption = getRewardRedemptions(userId).find(item => item.id === redemptionId);
  if (!redemption) return { ok: false, reason: 'That voucher could not be found.' };

  const status = getRedemptionStatus(redemption);
  if (status === 'expired') {
    return { ok: false, reason: `This voucher expired on ${formatExpiry(redemption.expiresAt)}.` };
  }
  if (status === 'used') return { ok: false, reason: 'This voucher has already been used.' };

  run(
    'UPDATE reward_redemptions SET used = 1, used_at = ? WHERE id = ? AND user_id = ?',
    [Date.now(), redemptionId, userId],
  );
  window.dispatchEvent(new CustomEvent('rewardRedemptionsUpdated'));
  return { ok: true };
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
