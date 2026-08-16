import { describe, expect, it } from 'vitest';
import {
  computeMerchantInsight, computePopularRewards, matchesMerchant,
  type PurchaseRow, type RedemptionRow,
} from './merchantInsights';
import type { Reward } from './rewardStorage';

const DAY = 24 * 60 * 60 * 1000;
const MON_8AM = new Date('2026-03-09T08:00:00').getTime();

function purchase(over: Partial<PurchaseRow> = {}): PurchaseRow {
  return {
    userId: '1',
    name: 'Kopitiam Toa Payoh',
    amount: 6.80,
    category: 'Food & Dining',
    createdAt: MON_8AM,
    ...over,
  };
}

function redemption(over: Partial<RedemptionRow> = {}): RedemptionRow {
  return {
    userId: '1',
    rewardId: 6,
    title: '$3 Coffee Voucher',
    merchant: 'Kopitiam',
    xpCost: 300,
    redeemedAt: MON_8AM,
    used: false,
    ...over,
  };
}

describe('matching a sale to a merchant', () => {
  it('matches the merchant inside a longer transaction name', () => {
    // Payments are named freely — "Kopitiam Toa Payoh" is a sale at Kopitiam.
    expect(matchesMerchant('Kopitiam Toa Payoh', 'Kopitiam')).toBe(true);
  });

  it('ignores case and padding', () => {
    expect(matchesMerchant('  FAIRPRICE Finest ', 'FairPrice')).toBe(true);
  });

  it('does not match an unrelated merchant', () => {
    expect(matchesMerchant('Kopitiam Toa Payoh', 'FairPrice')).toBe(false);
  });

  it('never matches on an empty name', () => {
    expect(matchesMerchant('', 'Kopitiam')).toBe(false);
    expect(matchesMerchant('Kopitiam', '')).toBe(false);
  });
});

describe('what a merchant is told about its sales', () => {
  const purchases = [
    purchase({ userId: '1', amount: 6.80 }),
    purchase({ userId: '1', amount: 3.20, createdAt: MON_8AM + DAY }),
    purchase({ userId: '2', amount: 10.00, createdAt: MON_8AM + 2 * DAY }),
    purchase({ userId: '3', name: 'FairPrice Finest', amount: 68.40 }),   // another merchant
  ];

  const insight = computeMerchantInsight(purchases, [], 'Kopitiam');

  it('counts only its own sales', () => {
    expect(insight.sales).toBe(3);
    expect(insight.revenue).toBeCloseTo(20.00, 2);
  });

  it('reports the average basket', () => {
    expect(insight.averageSpend).toBeCloseTo(20 / 3, 4);
  });

  it('separates customers from visits, and finds the regulars', () => {
    expect(insight.customers).toBe(2);      // users 1 and 2
    expect(insight.repeatCustomers).toBe(1); // user 1 came twice
    expect(insight.repeatRate).toBeCloseTo(0.5, 6);
  });

  it('finds the busiest hour and day', () => {
    expect(insight.peakHour).toBe('8am');
    expect(insight.peakDay).toBe('Monday');
  });

  it('ranks what customers spend on', () => {
    expect(insight.categories[0]).toMatchObject({ label: 'Food & Dining', count: 3, share: 1 });
  });

  it('says nothing rather than guessing when there are no sales', () => {
    const empty = computeMerchantInsight([], [], 'Nowhere');
    expect(empty.sales).toBe(0);
    expect(empty.averageSpend).toBe(0);
    expect(empty.repeatRate).toBe(0);
    expect(empty.peakHour).toBeNull();
    expect(empty.peakDay).toBeNull();
  });
});

describe('what a merchant is told about its rewards', () => {
  it('ranks the rewards customers actually redeem', () => {
    const insight = computeMerchantInsight([], [
      redemption({ title: '$3 Coffee Voucher' }),
      redemption({ title: '$3 Coffee Voucher', userId: '2' }),
      redemption({ title: 'Free Kaya Toast', userId: '3' }),
    ], 'Kopitiam');

    expect(insight.popularRewards[0]).toMatchObject({ label: '$3 Coffee Voucher', count: 2 });
    expect(insight.popularRewards[1]).toMatchObject({ label: 'Free Kaya Toast', count: 1 });
    expect(insight.redemptions).toBe(3);
    expect(insight.xpSpent).toBe(900);
  });

  it('counts a customer who came back after redeeming', () => {
    const insight = computeMerchantInsight(
      [purchase({ userId: '1', createdAt: MON_8AM + DAY })],
      [redemption({ userId: '1', redeemedAt: MON_8AM })],
      'Kopitiam',
    );

    expect(insight.redeemers).toBe(1);
    expect(insight.returned).toBe(1);
    expect(insight.returnRate).toBe(1);
  });

  it('does not count a purchase made before the redemption as a return', () => {
    // Redeeming after lunch is not evidence that the voucher brought them in.
    const insight = computeMerchantInsight(
      [purchase({ userId: '1', createdAt: MON_8AM })],
      [redemption({ userId: '1', redeemedAt: MON_8AM + DAY })],
      'Kopitiam',
    );

    expect(insight.redeemers).toBe(1);
    expect(insight.returned).toBe(0);
    expect(insight.returnRate).toBe(0);
  });

  it('separates a customer won over from a regular retained', () => {
    const insight = computeMerchantInsight(
      [
        // User 1 was already a regular before redeeming.
        purchase({ userId: '1', createdAt: MON_8AM - DAY }),
        purchase({ userId: '1', createdAt: MON_8AM + DAY }),
        // User 2 had never been here until the voucher.
        purchase({ userId: '2', createdAt: MON_8AM + DAY }),
      ],
      [
        redemption({ userId: '1', redeemedAt: MON_8AM }),
        redemption({ userId: '2', redeemedAt: MON_8AM }),
      ],
      'Kopitiam',
    );

    expect(insight.returned).toBe(2);
    expect(insight.wonOver).toBe(1);
  });

  it('uses a customer\'s first redemption, so redeeming twice is still one visitor', () => {
    const insight = computeMerchantInsight(
      [purchase({ userId: '1', createdAt: MON_8AM + DAY })],
      [
        redemption({ userId: '1', redeemedAt: MON_8AM }),
        redemption({ userId: '1', redeemedAt: MON_8AM + 2 * DAY }),
      ],
      'Kopitiam',
    );

    expect(insight.redemptions).toBe(2);
    expect(insight.redeemers).toBe(1);
    expect(insight.returned).toBe(1);
  });
});

describe('what NETS learns across every merchant', () => {
  const catalog = [{ id: 6, title: '$3 Coffee Voucher', merchant: 'Kopitiam' } as Reward];

  it('ranks rewards by how often they are redeemed', () => {
    const popular = computePopularRewards([
      redemption({ rewardId: 6 }),
      redemption({ rewardId: 6, userId: '2' }),
      redemption({ rewardId: 10, title: '1-for-1 Milk Tea', merchant: 'LiHO TEA', xpCost: 350 }),
    ], catalog, 10, MON_8AM);

    expect(popular[0]).toMatchObject({ rewardId: 6, redemptions: 2, xpSpent: 600 });
    expect(popular[1]).toMatchObject({ rewardId: 10, redemptions: 1 });
  });

  it('separates all-time from the last seven days', () => {
    const popular = computePopularRewards([
      redemption({ redeemedAt: MON_8AM - 30 * DAY }),
      redemption({ redeemedAt: MON_8AM - DAY, userId: '2' }),
    ], catalog, 10, MON_8AM);

    expect(popular[0].redemptions).toBe(2);
    expect(popular[0].recent).toBe(1);
  });

  it('keeps the reward from the catalogue when it is still listed', () => {
    const popular = computePopularRewards([redemption({ rewardId: 6 })], catalog, 10, MON_8AM);
    expect(popular[0].reward?.merchant).toBe('Kopitiam');
  });

  it('still reports a reward that has since left the catalogue', () => {
    // A withdrawn reward must not erase the redemptions it earned.
    const popular = computePopularRewards([redemption({ rewardId: 404 })], catalog, 10, MON_8AM);
    expect(popular[0].reward).toBeNull();
    expect(popular[0].redemptions).toBe(1);
  });

  it('honours the limit', () => {
    const many = Array.from({ length: 12 }, (_, i) => redemption({ rewardId: i }));
    expect(computePopularRewards(many, catalog, 5, MON_8AM)).toHaveLength(5);
  });
});
