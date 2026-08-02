import { describe, expect, it } from 'vitest';
import { resolvePaymentCategory, splitAmountExactly } from './paymentFlow';
import { inferTransactionKind, resolveSpendCategory } from './spendingInsights';
import {
  getLeadingActivityIds, hasEveryoneVoted, validateBudget,
  type Activity, type Hangout, type HangoutVote,
} from './hangoutStorage';

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
