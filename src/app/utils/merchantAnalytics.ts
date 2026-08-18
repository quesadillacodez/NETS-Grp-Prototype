import { calculateTransactionXP } from './rewardStorage';
import { effectiveBonus, getAllMerchants, getMerchantByName, type Merchant } from './merchantStorage';
import { getPurchases } from './merchantInsights';

/**
 * Merchant-side XP reporting.
 *
 * Admins could configure a 2x campaign but had no way to see what it cost or
 * what it drove. Everything here is derived from the same transaction rows the
 * customer-facing XP history reads, so the two can never disagree.
 */

export interface MerchantXPStats {
  merchant: Merchant;
  transactionCount: number;
  totalSpend: number;
  averageSpend: number;
  /** XP actually issued across all payments. */
  xpIssued: number;
  /** XP that would have been issued at the base rate, with no campaign bonus. */
  baselineXP: number;
  /** XP attributable to the campaign bonus. */
  bonusXP: number;
  /** Share of spend that happened while a campaign was running, 0-1. */
  campaignShare: number;
  /** Spend per day while a campaign ran, versus outside it. */
  campaignDailySpend: number;
  baselineDailySpend: number;
  /** Uplift in daily spend during the campaign, as a ratio (1 = no change). */
  uplift: number | null;
  campaignActive: boolean;
  lastPaymentAt: number | null;
}

interface PaymentRow {
  name: string;
  amount: number;
  at: number;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Purchases only, read through the same helper the merchant portal uses, so
 * "XP issued" and "sales" can never be counted off different row sets.
 */
function loadPayments(): PaymentRow[] {
  return getPurchases()
    .map(row => ({ name: row.name, amount: row.amount, at: row.createdAt }))
    .filter(row => row.at > 0);
}

/** Distinct days covered by a set of timestamps, floored to at least 1. */
function spanDays(timestamps: number[]): number {
  if (timestamps.length === 0) return 0;
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  return Math.max(1, Math.round((max - min) / DAY) + 1);
}

export function getMerchantXPStats(now: number = Date.now()): MerchantXPStats[] {
  const payments = loadPayments();
  const merchants = getAllMerchants();

  return merchants
    .map(merchant => {
      // Match through getMerchantByName so aliases and the exact-match rule
      // apply here exactly as they do when XP is awarded.
      const mine = payments.filter(payment => getMerchantByName(payment.name)?.id === merchant.id);

      const totalSpend = mine.reduce((sum, payment) => sum + payment.amount, 0);
      const xpIssued = mine.reduce(
        (sum, payment) => sum + calculateTransactionXP(payment.name, -payment.amount, payment.at).xp,
        0,
      );
      const baselineXP = mine.reduce(
        (sum, payment) => sum + Math.max(1, Math.round(payment.amount * merchant.xpRate)),
        0,
      );

      const inCampaign = mine.filter(payment => effectiveBonus(merchant, payment.at) > 1);
      const outCampaign = mine.filter(payment => effectiveBonus(merchant, payment.at) <= 1);
      const campaignSpend = inCampaign.reduce((sum, payment) => sum + payment.amount, 0);
      const outsideSpend = outCampaign.reduce((sum, payment) => sum + payment.amount, 0);

      const campaignDays = spanDays(inCampaign.map(p => p.at));
      const outsideDays = spanDays(outCampaign.map(p => p.at));
      const campaignDailySpend = campaignDays > 0 ? campaignSpend / campaignDays : 0;
      const baselineDailySpend = outsideDays > 0 ? outsideSpend / outsideDays : 0;

      return {
        merchant,
        transactionCount: mine.length,
        totalSpend,
        averageSpend: mine.length > 0 ? totalSpend / mine.length : 0,
        xpIssued,
        baselineXP,
        bonusXP: Math.max(0, xpIssued - baselineXP),
        campaignShare: totalSpend > 0 ? campaignSpend / totalSpend : 0,
        campaignDailySpend,
        baselineDailySpend,
        // Only meaningful when there is activity on both sides to compare.
        uplift: campaignDailySpend > 0 && baselineDailySpend > 0
          ? campaignDailySpend / baselineDailySpend
          : null,
        campaignActive: effectiveBonus(merchant, now) > 1,
        lastPaymentAt: mine.length > 0 ? Math.max(...mine.map(p => p.at)) : null,
      };
    })
    .sort((a, b) => b.xpIssued - a.xpIssued);
}

export interface MerchantXPTotals {
  xpIssued: number;
  bonusXP: number;
  transactionCount: number;
  totalSpend: number;
  activeCampaigns: number;
}

export function getMerchantXPTotals(stats: MerchantXPStats[]): MerchantXPTotals {
  return {
    xpIssued: stats.reduce((sum, item) => sum + item.xpIssued, 0),
    bonusXP: stats.reduce((sum, item) => sum + item.bonusXP, 0),
    transactionCount: stats.reduce((sum, item) => sum + item.transactionCount, 0),
    totalSpend: stats.reduce((sum, item) => sum + item.totalSpend, 0),
    activeCampaigns: stats.filter(item => item.campaignActive).length,
  };
}
