import { describe, expect, it } from 'vitest';
import { resolvePaymentCategory, splitAmountExactly } from './paymentFlow';
import { inferTransactionKind, resolveSpendCategory } from './spendingInsights';
import {
  getLeadingActivityIds, hasEveryoneVoted, validateBudget,
  type Activity, type Hangout, type HangoutVote,
} from './hangoutStorage';
import {
  getTier, getTierProgress, listXPMonths, summariseMonth, TIERS,
  type XPHistoryEntry,
} from './rewardStorage';

describe('splitAmountExactly', () => {
  it('assigns rounding cents without changing the bill total', () => {
    const shares = splitAmountExactly(100, 3);
    expect(shares).toEqual([33.34, 33.33, 33.33]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(100, 2);
  });

  it('handles values smaller than the participant count', () => {
    expect(splitAmountExactly(0.02, 3)).toEqual([0.01, 0.01, 0]);
  });

  it('rejects invalid inputs', () => {
    expect(() => splitAmountExactly(-1, 2)).toThrow();
    expect(() => splitAmountExactly(10, 0)).toThrow();
  });
});

describe('inferTransactionKind', () => {
  it('keeps wallet flows separate from purchases', () => {
    expect(inferTransactionKind({ name: 'Top-up via PayNow', amount: 50, category: 'topup' })).toBe('topup');
    expect(inferTransactionKind({ name: 'NETS XP Cashback', amount: 5, category: 'reward' })).toBe('cashback');
    expect(inferTransactionKind({ name: 'Sarah Tan', amount: 20, status: 'received' })).toBe('transfer');
    expect(inferTransactionKind({ name: 'Kopitiam', amount: -8.5, category: 'payment' })).toBe('purchase');
  });
});

describe('Hangout vote totals', () => {
  const plan: Hangout = {
    id: 1,
    ownerUserId: '1',
    name: 'Weekend',
    activityIds: [10, 20],
    invitedUserIds: ['2', '3'],
    preferredDate: '2026-08-08',
    budgetPerPerson: 40,
    status: 'voting',
    confirmedActivityId: null,
    createdAt: 1,
  };

  it('returns every leading option during a tie', () => {
    const votes: HangoutVote[] = [
      { hangoutId: 1, userId: '1', activityId: 10 },
      { hangoutId: 1, userId: '2', activityId: 20 },
    ];
    expect(getLeadingActivityIds(plan, votes)).toEqual([10, 20]);
  });

  it('requires a real vote before reporting a leader', () => {
    expect(getLeadingActivityIds(plan, [])).toEqual([]);
  });

  it('only reports everyone voted once each participant has', () => {
    const partial: HangoutVote[] = [{ hangoutId: 1, userId: '1', activityId: 10 }];
    expect(hasEveryoneVoted(plan, partial)).toBe(false);
    expect(hasEveryoneVoted(plan, [
      ...partial,
      { hangoutId: 1, userId: '2', activityId: 10 },
      { hangoutId: 1, userId: '3', activityId: 20 },
    ])).toBe(true);
  });
});

describe('validateBudget', () => {
  const activity = (id: number, pricePerPerson: number): Activity => ({
    id, category: 'food', title: `Idea ${id}`, venue: 'Venue', location: 'Bugis',
    pricePerPerson, duration: '1 hour', groupSize: '2-6 people', rating: 4.5,
    image: '', description: '',
  });

  it('rejects empty, zero and out-of-range budgets', () => {
    expect(validateBudget('', [])).toMatch(/Enter a budget/);
    expect(validateBudget('0', [])).toMatch(/greater than \$0/);
    expect(validateBudget('3', [])).toMatch(/at least \$5/);
    expect(validateBudget('900', [])).toMatch(/cannot exceed/);
  });

  it('flags selected ideas the budget cannot cover', () => {
    expect(validateBudget('20', [activity(1, 18), activity(2, 45)])).toMatch(/at least \$45/);
    expect(validateBudget('50', [activity(1, 18), activity(2, 45)])).toBeNull();
  });
});

describe('spending categories', () => {
  it('routes Hangout outings to Entertainment', () => {
    expect(resolvePaymentCategory('Laser Quest Singapore', { hangoutId: 7 })).toBe('Entertainment');
    expect(resolvePaymentCategory('Laser Quest Singapore', { spendCategory: 'Shopping' })).toBe('Shopping');
  });

  it('falls back to merchant keywords for plain payments', () => {
    expect(resolvePaymentCategory('FairPrice Xtra')).toBe('Groceries');
    expect(resolvePaymentCategory('Grab Taxi')).toBe('Transport');
  });

  it('prefers a real category stored on the transaction over the merchant name', () => {
    expect(resolveSpendCategory('Gardens by the Bay', 'Entertainment')).toBe('Entertainment');
    expect(resolveSpendCategory('Kopitiam', 'payment')).toBe('Food & Dining');
  });
});

describe('XP tiers', () => {
  it('places lifetime XP in the right tier band', () => {
    expect(getTier(0).name).toBe('Neighbourhood Explorer');
    expect(getTier(999).name).toBe('Neighbourhood Explorer');
    expect(getTier(1000).name).toBe('Local Legend');
    expect(getTier(4000).name).toBe('Heartland Insider');
    expect(getTier(10000).name).toBe('Kampung Spirit');
    expect(getTier(999999).next).toBeNull();
  });

  it('reports progress through the current tier', () => {
    expect(getTierProgress(0)).toBe(0);
    expect(getTierProgress(500)).toBe(50);
    expect(getTierProgress(2500)).toBe(50);
    expect(getTierProgress(25195)).toBe(100); // top tier is always full
  });

  it('keeps every tier boundary contiguous', () => {
    TIERS.forEach((tier, index) => {
      const next = TIERS[index + 1];
      expect(tier.next).toBe(next ? next.start : null);
    });
  });
});

describe('XP month grouping', () => {
  const entry = (id: string, xp: number, date: string, extra: Partial<XPHistoryEntry> = {}): XPHistoryEntry => ({
    id, title: id, subtitle: '', xp, type: 'earn', createdAt: new Date(date).getTime(), ...extra,
  });

  const history: XPHistoryEntry[] = [
    entry('txn-1', 120, '2026-08-04T10:00:00'),
    entry('txn-2', 80, '2026-08-19T10:00:00', { bonus: 'Heartland 2x' }),
    entry('txn-3', 200, '2026-07-11T10:00:00'),
    { id: 'welcome', title: 'Welcome', subtitle: '', xp: 500, type: 'earn', createdAt: 1 },
    { id: 'redemption-1', title: 'Voucher', subtitle: '', xp: 300, type: 'spend', createdAt: new Date('2026-08-20T10:00:00').getTime() },
  ];

  it('lists months newest first and drops the starter bonus', () => {
    expect(listXPMonths(history).map(m => m.key)).toEqual(['2026-08', '2026-07']);
  });

  it('can force a month into the list even when it has no activity', () => {
    expect(listXPMonths(history, '2026-09').map(m => m.key)).toEqual(['2026-09', '2026-08', '2026-07']);
  });

  it('totals earned, spent and bonus XP for one month only', () => {
    const august = summariseMonth(history, '2026-08');
    expect(august.earned).toBe(200);
    expect(august.spent).toBe(300);
    expect(august.net).toBe(-100);
    expect(august.bonusXP).toBe(80);
    expect(august.transactionCount).toBe(2);
    expect(august.entries.map(e => e.id)).toEqual(['txn-2', 'txn-1']); // newest first
  });

  it('groups repeat visits to one merchant into a single top source', () => {
    const repeat: XPHistoryEntry[] = [
      entry('txn-1', 40, '2026-08-01T10:00:00', { title: 'Kopitiam' }),
      entry('txn-2', 50, '2026-08-02T10:00:00', { title: 'Kopitiam' }),
      entry('txn-3', 70, '2026-08-03T10:00:00', { title: 'FairPrice' }),
    ];
    expect(summariseMonth(repeat, '2026-08').topSource).toEqual({ title: 'Kopitiam', xp: 90 });
  });

  it('returns an empty summary for a month with no activity', () => {
    const empty = summariseMonth(history, '2026-01');
    expect(empty.earned).toBe(0);
    expect(empty.entries).toEqual([]);
    expect(empty.topSource).toBeNull();
  });
});
