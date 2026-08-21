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
  tierMultiplier, TIERS, buildQuestEntries, compareRewards, goalProgressFor,
  type RewardSort, type XPHistoryEntry,
} from './rewardStorage';
import { buildLedger, expiryFor, type XPLedgerInput } from './xpLedger';
import {
  currentStreak, evaluateDay, MISSIONS, rollingWeek, weekKey, WEEKLY_MISSION_XP_CAP,
  type QuestSignal,
} from './questStorage';
import { daysUntil, groupExpiringXP } from './xpExpiryScheduler';
import { encodeQr, qrPath } from './qrCode';
import { voucherScanUrl } from './voucherLink';
import { effectiveBonus, isCampaignActive, type Merchant } from './merchantStorage';
import { billKeyFor } from './reminderStorage';

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
    // Derived from the mission definitions so a rebalance does not silently
    // turn this into a test of stale numbers.
    const expected = MISSIONS
      .filter(mission => done.includes(mission.id))
      .reduce((sum, mission) => sum + mission.xp, 0);
    expect(evaluated.xpEarned).toBe(expected);
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

describe('non-expiring grants', () => {
  it('never expires the welcome bonus, whose timestamp is a sentinel', () => {
    // Pinned to createdAt 1, so a date-derived expiry would kill it in 1970 and
    // a brand new user would open the store with nothing to spend.
    const ledger = buildLedger([
      { id: 'welcome', title: 'Welcome', subtitle: '', xp: 500, type: 'earn', createdAt: 1, neverExpires: true },
    ], new Date('2030-01-01T00:00:00').getTime());
    expect(ledger.balance).toBe(500);
    expect(ledger.totalExpired).toBe(0);
  });

  it('does not count a non-expiring grant as expiring soon', () => {
    const ledger = buildLedger([
      { id: 'welcome', title: 'Welcome', subtitle: '', xp: 500, type: 'earn', createdAt: 1, neverExpires: true },
    ]);
    expect(ledger.expiringSoon).toBe(0);
    expect(ledger.expiringSoonAt).toBeNull();
  });

  it('still spends the oldest expiring XP before a permanent grant', () => {
    const aug = new Date('2026-08-10T10:00:00').getTime();
    const ledger = buildLedger([
      { id: 'welcome', title: 'Welcome', subtitle: '', xp: 500, type: 'earn', createdAt: 1, neverExpires: true },
      { id: 'txn-1', title: 'Kopitiam', subtitle: '', xp: 100, type: 'earn', createdAt: aug },
      { id: 'r1', title: 'Voucher', subtitle: '', xp: 200, type: 'spend', createdAt: aug + 1000 },
    ], aug + 2000);
    // FIFO is by earn time, and the welcome bonus is the oldest lot.
    expect(ledger.lots.find(l => l.id === 'welcome')!.spent).toBe(200);
    expect(ledger.balance).toBe(400);
  });
});

describe('weekly mission XP cap', () => {
  // A full day of missions, every day, on a fresh signal set.
  const fullDay = (day: number): QuestSignal[] => {
    const at = (hour: number) => new Date(2026, 7, day, hour).getTime();
    return [
      { at: at(9), kind: 'login' },
      { at: at(12), kind: 'heartland-payment' },
      { at: at(13), kind: 'payment' },
      { at: at(14), kind: 'payment' },
      { at: at(15), kind: 'split' },
    ];
  };

  it('a full day is worth every mission', () => {
    // 10 + 25 + 40 + 50 + 25
    expect(evaluateDay(fullDay(17), '2026-08-17').xpEarned).toBe(150);
  });

  it('stops paying out once the weekly allowance is spent', () => {
    // Mon 17 Aug through Fri 21 Aug: 5 full days at 150 = 750 uncapped.
    const signals = [17, 18, 19, 20, 21].flatMap(fullDay);
    const total = buildQuestEntries(signals).reduce((sum, entry) => sum + entry.xp, 0);
    expect(total).toBe(WEEKLY_MISSION_XP_CAP);
  });

  it('spends the allowance chronologically', () => {
    const signals = [17, 18, 19, 20, 21].flatMap(fullDay);
    const entries = buildQuestEntries(signals).sort((a, b) => a.createdAt - b.createdAt);
    // 150 + 150 + 100 (clamped) = 400, then nothing further that week.
    expect(entries.map(entry => entry.xp)).toEqual([150, 150, 100]);
    expect(entries[2].subtitle).toContain('weekly cap reached');
  });

  it('resets the allowance in the following week', () => {
    // Mon 17-Fri 21, then Mon 24 starts a fresh week.
    const signals = [...[17, 18, 19, 20, 21].flatMap(fullDay), ...fullDay(24)];
    const total = buildQuestEntries(signals).reduce((sum, entry) => sum + entry.xp, 0);
    expect(total).toBe(WEEKLY_MISSION_XP_CAP + 150);
  });

  it('anchors weeks to Monday', () => {
    // Sun 23 Aug belongs to the week starting Mon 17; Mon 24 starts the next.
    expect(weekKey(new Date(2026, 7, 23, 12).getTime())).toBe('2026-08-17');
    expect(weekKey(new Date(2026, 7, 24, 12).getTime())).toBe('2026-08-24');
    expect(weekKey(new Date(2026, 7, 17, 0).getTime())).toBe('2026-08-17');
  });
});

describe('XP expiry warnings', () => {
  const NOW = new Date('2026-08-18T10:00:00').getTime();
  const inDays = (days: number) => NOW + days * 24 * 60 * 60 * 1000;

  it('groups everything lapsing on one day into a single warning', () => {
    const groups = groupExpiringXP([
      { remaining: 100, expiresAt: inDays(3) },
      { remaining: 250, expiresAt: inDays(3) + 60_000 },
      { remaining: 40, expiresAt: inDays(6) },
    ], NOW);
    expect(groups).toHaveLength(2);
    expect(groups[0].xp).toBe(350);
    expect(groups[1].xp).toBe(40);
  });

  it('ignores XP that is already spent, already lapsed or still far off', () => {
    const groups = groupExpiringXP([
      { remaining: 0, expiresAt: inDays(2) },      // fully spent
      { remaining: 500, expiresAt: inDays(-1) },   // already gone
      { remaining: 800, expiresAt: inDays(30) },   // not yet a worry
    ], NOW);
    expect(groups).toEqual([]);
  });

  it('never warns about a grant that does not expire', () => {
    expect(groupExpiringXP([{ remaining: 500, expiresAt: Infinity }], NOW)).toEqual([]);
  });

  it('rounds up so tomorrow never reads as today', () => {
    expect(daysUntil(NOW + 90_000, NOW)).toBe(1);
    expect(daysUntil(inDays(3), NOW)).toBe(3);
  });

  it('orders the soonest expiry first', () => {
    const groups = groupExpiringXP([
      { remaining: 10, expiresAt: inDays(6) },
      { remaining: 20, expiresAt: inDays(1) },
    ], NOW);
    expect(groups.map(group => group.xp)).toEqual([20, 10]);
  });
});

describe('QR encoding', () => {
  // A QR that does not decode is worse than no QR at all, so these assert the
  // structure a scanner depends on. Round-trip decoding is covered separately
  // against an independent decoder.
  const modulesOf = (text: string) => encodeQr(text);

  it('sizes the symbol to the payload', () => {
    // size = 17 + 4 x version, so version 1 is 21x21.
    expect(modulesOf('XP-000001').length).toBe(21);
    expect(modulesOf('https://nets.example.sg/v/XP-AB12CD').length).toBe(29); // version 3
    expect(modulesOf('x'.repeat(200)).length).toBe(57); // version 10
  });

  it('places the three finder patterns', () => {
    const m = modulesOf('https://nets.example.sg/v/XP-AB12CD');
    const n = m.length;
    // Each finder is a dark 7x7 ring with a dark 3x3 core and a light ring between.
    for (const [top, left] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
      expect(m[top][left]).toBe(true);          // outer corner
      expect(m[top + 1][left + 1]).toBe(false); // light ring
      expect(m[top + 3][left + 3]).toBe(true);  // core
    }
  });

  it('draws the timing patterns and the dark module', () => {
    const m = modulesOf('XP-000001');
    for (let i = 8; i < m.length - 8; i += 1) {
      expect(m[6][i]).toBe(i % 2 === 0);
      expect(m[i][6]).toBe(i % 2 === 0);
    }
    expect(m[m.length - 8][8]).toBe(true);
  });

  it('is deterministic for the same payload', () => {
    expect(modulesOf('XP-QWERTY')).toEqual(modulesOf('XP-QWERTY'));
  });

  it('refuses a payload it cannot encode rather than truncating it', () => {
    expect(() => encodeQr('x'.repeat(400))).toThrow(/too long/i);
  });

  it('renders a path with one subpath per dark module', () => {
    const m = modulesOf('XP-000001');
    const dark = m.flat().filter(Boolean).length;
    expect(qrPath(m).match(/M/g)?.length).toBe(dark);
  });
});

describe('voucher scan links', () => {
  it('carries only the reference code, not the reward details', () => {
    // The scan screen looks everything else up, so a code cannot be edited into
    // a voucher for a different reward or a larger amount.
    const url = voucherScanUrl('XP-AB12CD');
    expect(url.endsWith('/v/XP-AB12CD')).toBe(true);
    expect(url.split('/v/')[1]).toBe('XP-AB12CD');
  });

  it('escapes a code so it cannot alter the path', () => {
    expect(voucherScanUrl('XP-A/B?c=1')).toContain('/v/XP-A%2FB%3Fc%3D1');
  });
});

describe('grouping reminders into bills', () => {
  const base = {
    category: 'Din Tai Fung', fromUserId: '1',
    createdDate: '2026-08-20T10:00:00.000Z', date: 'Just now',
  };

  it('keeps two splits at the same merchant apart', () => {
    // The bug this fixes: two splits at one merchant merged into a single bill
    // whose total was double-counted. Separate payments, separate bills.
    expect(billKeyFor({ ...base, billId: 'pay-1' }))
      .not.toBe(billKeyFor({ ...base, billId: 'pay-2' }));
  });

  it('keeps everyone in one split together', () => {
    const sarah = { ...base, billId: 'pay-1', toUserName: 'Sarah' };
    const mike = { ...base, billId: 'pay-1', toUserName: 'Mike' };
    expect(billKeyFor(sarah)).toBe(billKeyFor(mike));
  });

  it('falls back to merchant, payer and time for rows written before bill ids', () => {
    // Legacy rows have no id to group on. They still separate by when the split
    // was made, which is what the app keyed on before bill_id existed.
    expect(billKeyFor(base)).toBe(billKeyFor({ ...base }));
    expect(billKeyFor(base))
      .not.toBe(billKeyFor({ ...base, createdDate: '2026-08-21T10:00:00.000Z' }));
  });

  it('never collides a legacy row with a bill id', () => {
    expect(billKeyFor({ ...base, billId: 'pay-1' })).not.toBe(billKeyFor(base));
  });
});

describe('working toward a reward', () => {
  it('reports how far off a goal is', () => {
    expect(goalProgressFor(500, 320)).toEqual({ remaining: 180, percent: 64, reached: false });
  });

  it('caps a reached goal at 100% rather than overshooting', () => {
    expect(goalProgressFor(500, 900)).toEqual({ remaining: 0, percent: 100, reached: true });
  });

  it('treats a free reward as already reached', () => {
    expect(goalProgressFor(0, 0).reached).toBe(true);
  });

  it('never reports negative progress from a negative balance', () => {
    const progress = goalProgressFor(500, -50);
    expect(progress.percent).toBe(0);
    expect(progress.remaining).toBe(500);
  });
});

describe('ordering the store', () => {
  const reward = (xpCost: number, distanceKm: number | null = null, redemptions = 0) =>
    ({ xpCost, distanceKm, redemptions });
  const order = (items: ReturnType<typeof reward>[], sort: RewardSort, xp: number) =>
    [...items].sort((a, b) => compareRewards(a, b, sort, xp)).map(r => r.xpCost);

  it('leads with what the customer can afford', () => {
    // A store that opens on rewards out of reach reads as a wall.
    const items = [reward(1000), reward(150), reward(600), reward(200)];
    expect(order(items, 'recommended', 300)).toEqual([150, 200, 600, 1000]);
  });

  it('sorts by price when asked', () => {
    expect(order([reward(600), reward(150), reward(300)], 'cheapest', 0))
      .toEqual([150, 300, 600]);
  });

  it('sorts by popularity, breaking ties on price', () => {
    const items = [reward(600, null, 1), reward(150, null, 9), reward(300, null, 9)];
    expect(order(items, 'popular', 0)).toEqual([150, 300, 600]);
  });

  it('puts rewards with no single outlet last when sorting by distance', () => {
    const items = [reward(600, null), reward(150, 8), reward(300, 2)];
    expect(order(items, 'nearest', 0)).toEqual([300, 150, 600]);
  });
});
