import { describe, expect, it } from 'vitest';
import {
  MAX_LIVE_PROMOTIONS, PLACEMENT_RATES, calculateReport, checkBooking,
  chooseLivePromotions, promotionStatus, type Placement, type Promotion,
} from './promotionStorage';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-03-10T12:00:00Z').getTime();

let nextId = 1;
function promo(overrides: Partial<Promotion> = {}): Promotion {
  const placement: Placement = overrides.placement ?? 'featured';
  return {
    id: nextId++,
    rewardId: 10,
    title: '1-for-1 Medium Milk Tea',
    merchant: 'LiHO TEA',
    placement,
    weeklyFee: PLACEMENT_RATES[placement],
    startsAt: NOW - 2 * DAY,
    endsAt: NOW + 5 * DAY,
    impressions: 0,
    createdAt: NOW - 2 * DAY,
    ...overrides,
  };
}

describe('when a placement is running', () => {
  it('is live inside its window', () => {
    expect(promotionStatus(promo(), NOW)).toBe('live');
  });

  it('is scheduled before it starts', () => {
    expect(promotionStatus(promo({ startsAt: NOW + DAY, endsAt: NOW + 8 * DAY }), NOW))
      .toBe('scheduled');
  });

  it('ends itself, without anything having to switch it off', () => {
    const booking = promo();
    expect(promotionStatus(booking, NOW)).toBe('live');
    expect(promotionStatus(booking, NOW + 7 * DAY)).toBe('ended');
  });

  it('treats the closing instant as over rather than still running', () => {
    expect(promotionStatus(promo({ startsAt: NOW - DAY, endsAt: NOW }), NOW)).toBe('ended');
  });
});

describe('choosing what the store shows', () => {
  it('shows only live bookings', () => {
    const live = chooseLivePromotions([
      promo({ rewardId: 1, startsAt: NOW - DAY, endsAt: NOW + DAY }),
      promo({ rewardId: 2, startsAt: NOW + DAY, endsAt: NOW + 2 * DAY }),   // scheduled
      promo({ rewardId: 3, startsAt: NOW - 9 * DAY, endsAt: NOW - DAY }),   // ended
    ], NOW);

    expect(live.map(p => p.rewardId)).toEqual([1]);
  });

  it('puts spotlight above featured', () => {
    const live = chooseLivePromotions([
      promo({ rewardId: 1, placement: 'featured' }),
      promo({ rewardId: 2, placement: 'spotlight' }),
    ], NOW);

    expect(live.map(p => p.placement)).toEqual(['spotlight', 'featured']);
  });

  it('breaks a tie by who booked first, so position cannot be taken later', () => {
    const live = chooseLivePromotions([
      promo({ rewardId: 2, startsAt: NOW - DAY }),
      promo({ rewardId: 1, startsAt: NOW - 3 * DAY }),
    ], NOW);

    expect(live.map(p => p.rewardId)).toEqual([1, 2]);
  });

  it('never shows more than the paid slots, however many are booked', () => {
    const many = Array.from({ length: MAX_LIVE_PROMOTIONS + 4 }, (_, i) => promo({ rewardId: i }));
    expect(chooseLivePromotions(many, NOW)).toHaveLength(MAX_LIVE_PROMOTIONS);
  });
});

describe('booking a slot', () => {
  const booking = {
    rewardId: 99, title: 'Free Curry Puff', days: 7, startsAt: NOW,
    placement: 'featured' as const,
  };

  it('accepts a booking when there is room', () => {
    expect(checkBooking([], booking).ok).toBe(true);
  });

  it('rejects a duration that is not a real window', () => {
    expect(checkBooking([], { ...booking, days: 0 }).reason).toMatch(/at least one day/i);
    expect(checkBooking([], { ...booking, days: 400 }).reason).toMatch(/at most 90 days/i);
  });

  it('refuses to sell the same reward two overlapping placements', () => {
    const existing = [promo({ rewardId: 99, startsAt: NOW + 2 * DAY, endsAt: NOW + 9 * DAY })];
    expect(checkBooking(existing, booking).reason).toMatch(/already promoted/i);
  });

  it('allows the same reward again once the first placement is over', () => {
    const existing = [promo({ rewardId: 99, startsAt: NOW - 9 * DAY, endsAt: NOW - DAY })];
    expect(checkBooking(existing, booking).ok).toBe(true);
  });

  it('sells the banner to one merchant at a time', () => {
    // Spotlight is featured placement plus the single banner at the top of the
    // store. A second one would be billed the higher rate for nothing extra.
    const held = [promo({ rewardId: 1, placement: 'spotlight', startsAt: NOW, endsAt: NOW + 7 * DAY })];
    expect(checkBooking(held, { ...booking, placement: 'spotlight' }).reason)
      .toMatch(/already holds the spotlight/i);

    // The same dates are still available as a featured slot.
    expect(checkBooking(held, booking).ok).toBe(true);
  });

  it('refuses to oversell the slots', () => {
    const full = Array.from({ length: MAX_LIVE_PROMOTIONS }, (_, i) =>
      promo({ rewardId: i, startsAt: NOW, endsAt: NOW + 7 * DAY }));
    expect(checkBooking(full, booking).reason).toMatch(/slots are taken/i);
  });

  it('counts the slots over the booked window, not just today', () => {
    // Every slot is taken next week. A booking that starts then must still be
    // refused, even though nothing is running at this moment.
    const nextWeek = Array.from({ length: MAX_LIVE_PROMOTIONS }, (_, i) =>
      promo({ rewardId: i, startsAt: NOW + 10 * DAY, endsAt: NOW + 20 * DAY }));

    expect(checkBooking(nextWeek, { ...booking, startsAt: NOW + 12 * DAY }).reason)
      .toMatch(/slots are taken/i);
  });
});

describe('what the merchant is billed and what they got', () => {
  it('charges the weekly rate for a full week', () => {
    const week = promo({ startsAt: NOW - 7 * DAY, endsAt: NOW });
    expect(calculateReport(week, 0, NOW).fee).toBeCloseTo(PLACEMENT_RATES.featured, 6);
  });

  it('bills a running placement only for the days so far', () => {
    const halfway = promo({ startsAt: NOW - 7 * DAY, endsAt: NOW + 7 * DAY });
    const report = calculateReport(halfway, 0, NOW);
    expect(report.status).toBe('live');
    expect(report.fee).toBeCloseTo(PLACEMENT_RATES.featured, 6);
  });

  it('does not bill a placement that has not started', () => {
    const future = promo({ startsAt: NOW + DAY, endsAt: NOW + 8 * DAY });
    expect(calculateReport(future, 0, NOW).fee).toBe(0);
  });

  it('reports what each redemption cost', () => {
    const week = promo({ startsAt: NOW - 7 * DAY, endsAt: NOW });
    expect(calculateReport(week, 4, NOW).costPerRedemption)
      .toBeCloseTo(PLACEMENT_RATES.featured / 4, 6);
  });

  it('has nothing to report per redemption when there were none', () => {
    expect(calculateReport(promo(), 0, NOW).costPerRedemption).toBeNull();
  });

  it('counts down the days left, and stops at zero', () => {
    expect(calculateReport(promo({ endsAt: NOW + 3 * DAY }), 0, NOW).daysRemaining).toBe(3);
    expect(calculateReport(promo({ endsAt: NOW - DAY }), 0, NOW).daysRemaining).toBe(0);
  });

  it('prices spotlight above featured, or there is nothing to upgrade to', () => {
    expect(PLACEMENT_RATES.spotlight).toBeGreaterThan(PLACEMENT_RATES.featured);
  });
});
