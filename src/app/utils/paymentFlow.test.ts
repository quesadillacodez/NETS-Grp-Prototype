import { describe, expect, it } from 'vitest';
import { resolvePaymentCategory, splitAmountExactly } from './paymentFlow';
import { resolveSpendCategory } from './spendingInsights';
import { classifyTransaction, countsAsSpending } from './transactionModel';
import {
  getLeadingActivityIds, hasEveryoneVoted, validateBudget,
  type Activity, type Hangout, type HangoutVote,
} from './hangoutStorage';
import {
  applyTierMultipliers, getTier, getTierProgress, listXPMonths, summariseMonth,
  tierMultiplier, TIERS, type XPHistoryEntry,
} from './rewardStorage';
import { buildLedger, expiryFor, type XPLedgerInput } from './xpLedger';
import {
  currentStreak, evaluateDay, rollingWeek, type QuestSignal,
} from './questStorage';
import { effectiveBonus, isCampaignActive, type Merchant } from './merchantStorage';

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

describe('classifyTransaction', () => {
  it('keeps wallet flows separate from purchases', () => {
    expect(classifyTransaction({ name: 'Top-up via PayNow', amount: 50, category: 'topup' })).toBe('topup');
    expect(classifyTransaction({ name: 'NETS XP Cashback', amount: 5, category: 'reward' })).toBe('cashback');
    expect(classifyTransaction({ name: 'Kopitiam', amount: -8.5, category: 'payment' })).toBe('purchase');
  });

  it('separates the two sides of a repayment', () => {
    expect(classifyTransaction({ name: 'Sarah Tan', amount: 20, status: 'received' })).toBe('repayment_received');
    expect(classifyTransaction({ name: 'Dinner (split with Alex)', amount: -20, status: 'sent' })).toBe('repayment_sent');
  });

  it('reclassifies legacy rows that stored repayments as transfers', () => {
    expect(classifyTransaction({ name: 'Alex Chen', amount: 18, kind: 'transfer', status: 'received' }))
      .toBe('repayment_received');
    expect(classifyTransaction({ name: 'Lunch (split with Alex)', amount: -18, kind: 'transfer', status: 'sent' }))
      .toBe('repayment_sent');
  });

  it('never labels a top-up or cashback as a repayment', () => {
    expect(classifyTransaction({ name: 'Top-up via DBS/POSB', amount: 50, kind: 'income', status: 'received' }))
      .toBe('topup');
    expect(classifyTransaction({ name: 'NETS XP Cashback', amount: 5, category: 'reward', status: 'received' }))
      .toBe('cashback');
  });

  it('counts only money the user actually spent', () => {
    expect(countsAsSpending({ name: 'Kopitiam', amount: -8.5, kind: 'purchase' })).toBe(true);
    expect(countsAsSpending({ name: 'Lunch (split with Alex)', amount: -18, kind: 'repayment_sent' })).toBe(true);
    expect(countsAsSpending({ name: 'Top-up via PayNow', amount: 50, kind: 'topup' })).toBe(false);
    expect(countsAsSpending({ name: 'Sarah Tan', amount: 20, kind: 'repayment_received' })).toBe(false);
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

describe('XP ledger', () => {
  const AUG = new Date('2026-08-10T10:00:00').getTime();
  const SEP = new Date('2026-09-10T10:00:00').getTime();
  const earn = (id: string, xp: number, at: number): XPLedgerInput =>
    ({ id, title: id, subtitle: '', xp, type: 'earn', createdAt: at });

  it('expires XP at the end of the month after it was earned', () => {
    // Earned 10 Aug -> expires 30 Sep, so it is still live in mid-September.
    expect(expiryFor(AUG)).toBe(new Date('2026-09-30T23:59:59.999').getTime());
    expect(buildLedger([earn('a', 100, AUG)], SEP).balance).toBe(100);
    expect(buildLedger([earn('a', 100, AUG)], new Date('2026-10-01T00:00:00').getTime()).balance).toBe(0);
  });

  it('records expiry in the audit trail instead of silently dropping XP', () => {
    const ledger = buildLedger([earn('a', 100, AUG)], new Date('2026-11-01T00:00:00').getTime());
    expect(ledger.totalExpired).toBe(100);
    expect(ledger.events.some(e => e.type === 'expire' && e.xp === 100)).toBe(true);
  });

  it('spends the oldest XP first so nothing lapses unnecessarily', () => {
    const ledger = buildLedger([
      earn('old', 100, AUG),
      earn('new', 100, SEP),
      { id: 'r1', title: 'Voucher', subtitle: '', xp: 60, type: 'spend', createdAt: SEP + 1000 },
    ], SEP + 2000);
    const oldLot = ledger.lots.find(l => l.id === 'old')!;
    const newLot = ledger.lots.find(l => l.id === 'new')!;
    expect(oldLot.spent).toBe(60);
    expect(newLot.spent).toBe(0);
    expect(ledger.balance).toBe(140);
  });

  it('cannot spend XP that already expired', () => {
    const ledger = buildLedger([
      earn('old', 100, AUG),
      { id: 'r1', title: 'Voucher', subtitle: '', xp: 100, type: 'spend', createdAt: new Date('2026-10-05T10:00:00').getTime() },
    ], new Date('2026-10-06T10:00:00').getTime());
    expect(ledger.totalExpired).toBe(100);
    expect(ledger.balance).toBe(0);
  });

  it('claws back a refund from the reversed payment’s own lot', () => {
    const ledger = buildLedger([
      earn('txn-1', 100, SEP),
      earn('txn-2', 50, SEP + 1000),
      { id: 'refund-1', title: 'Refund', subtitle: '', xp: 100, type: 'refund', createdAt: SEP + 2000, reversesId: 'txn-1' },
    ], SEP + 3000);
    expect(ledger.lots.find(l => l.id === 'txn-1')!.refunded).toBe(100);
    expect(ledger.lots.find(l => l.id === 'txn-2')!.refunded).toBe(0);
    expect(ledger.balance).toBe(50);
    expect(ledger.totalRefunded).toBe(100);
  });

  it('flags XP expiring within the warning window', () => {
    const nearExpiry = new Date('2026-09-25T10:00:00').getTime();
    const ledger = buildLedger([earn('a', 100, AUG)], nearExpiry);
    expect(ledger.expiringSoon).toBe(100);
    expect(ledger.expiringSoonAt).toBe(expiryFor(AUG));
  });
});

describe('tier multipliers', () => {
  it('scales the earn rate with the tier ladder', () => {
    expect(tierMultiplier(1)).toBe(1);
    expect(tierMultiplier(2)).toBe(1.1);
    expect(tierMultiplier(3)).toBe(1.2);
    expect(tierMultiplier(4)).toBe(1.3);
  });

  it('applies the tier held at the time of each transaction', () => {
    const at = (day: number) => new Date(2026, 7, day).getTime();
    const entries: XPHistoryEntry[] = [
      // Starts at level 1 (1x), crosses 1000 lifetime and moves to 1.1x.
      { id: 'a', title: 'a', subtitle: '', xp: 600, type: 'earn', createdAt: at(1) },
      { id: 'b', title: 'b', subtitle: '', xp: 600, type: 'earn', createdAt: at(2) },
      { id: 'c', title: 'c', subtitle: '', xp: 100, type: 'earn', createdAt: at(3) },
    ];
    const result = applyTierMultipliers(entries);
    expect(result[0].xp).toBe(600);            // level 1, 1x
    expect(result[1].xp).toBe(600);            // still level 1 at the time (600 lifetime)
    expect(result[2].xp).toBe(110);            // now level 2 (1200 lifetime), 1.1x
    expect(result[2].bonus).toContain('1.1x tier bonus');
  });

  it('leaves spends untouched', () => {
    const entries: XPHistoryEntry[] = [
      { id: 's', title: 's', subtitle: '', xp: 300, type: 'spend', createdAt: 5000 },
    ];
    expect(applyTierMultipliers(entries)[0].xp).toBe(300);
  });
});

describe('daily missions', () => {
  const day = '2026-08-18';
  const at = (hour: number) => new Date(2026, 7, 18, hour).getTime();
  const now = new Date(2026, 7, 18, 23).getTime();

  it('resets per day instead of counting lifetime activity', () => {
    // Three payments yesterday must not complete today's missions.
    const yesterday: QuestSignal[] = [
      { at: new Date(2026, 7, 17, 12).getTime(), kind: 'payment' },
      { at: new Date(2026, 7, 17, 13).getTime(), kind: 'payment' },
      { at: new Date(2026, 7, 17, 14).getTime(), kind: 'payment' },
    ];
    const today = evaluateDay(yesterday, day, now);
    expect(today.completedCount).toBe(0);
    expect(today.xpEarned).toBe(0);
  });

  it('completes missions from real signals on the day', () => {
    const signals: QuestSignal[] = [
      { at: at(9), kind: 'login' },
      { at: at(12), kind: 'heartland-payment' },
      { at: at(13), kind: 'payment' },
      { at: at(14), kind: 'payment' },
    ];
    const evaluated = evaluateDay(signals, day, now);
    const done = evaluated.missions.filter(m => m.complete).map(m => m.id);
    expect(done).toEqual(['daily-login', 'daily-payment', 'heartland-visit', 'three-payments']);
    expect(evaluated.xpEarned).toBe(20 + 50 + 80 + 100);
  });

  it('tracks partial progress on multi-step missions', () => {
    const signals: QuestSignal[] = [
      { at: at(12), kind: 'payment' },
      { at: at(13), kind: 'payment' },
    ];
    const roll = evaluateDay(signals, day, now).missions.find(m => m.id === 'three-payments')!;
    expect(roll.progress).toBe(2);
    expect(roll.complete).toBe(false);
  });

  it('counts consecutive active days as a streak', () => {
    const signals: QuestSignal[] = [
      { at: new Date(2026, 7, 18, 9).getTime(), kind: 'login' },
      { at: new Date(2026, 7, 17, 9).getTime(), kind: 'login' },
      { at: new Date(2026, 7, 16, 9).getTime(), kind: 'login' },
      // Gap on the 15th breaks the streak.
      { at: new Date(2026, 7, 14, 9).getTime(), kind: 'login' },
    ];
    expect(currentStreak(signals, now)).toBe(3);
  });

  it('returns seven days for the rolling week', () => {
    const week = rollingWeek([], now);
    expect(week).toHaveLength(7);
    expect(week[6].isToday).toBe(true);
  });
});

describe('merchant campaign windows', () => {
  const merchant = (over: Partial<Merchant> = {}): Merchant => ({
    id: 'm', name: 'Kopitiam', amount: 5, xpRate: 10, xpBonus: 2,
    campaignStart: null, campaignEnd: null, aliases: [], active: true, ...over,
  });

  it('applies an open-ended bonus at any time', () => {
    expect(effectiveBonus(merchant(), Date.now())).toBe(2);
  });

  it('only pays the bonus inside the scheduled window', () => {
    const m = merchant({
      campaignStart: new Date('2026-08-01T00:00:00').getTime(),
      campaignEnd: new Date('2026-08-31T23:59:59').getTime(),
    });
    expect(effectiveBonus(m, new Date('2026-07-20T12:00:00').getTime())).toBe(1);
    expect(effectiveBonus(m, new Date('2026-08-15T12:00:00').getTime())).toBe(2);
    expect(effectiveBonus(m, new Date('2026-09-05T12:00:00').getTime())).toBe(1);
  });

  it('ignores a window when there is no bonus to gate', () => {
    expect(isCampaignActive(merchant({ xpBonus: 1 }))).toBe(false);
  });
});
