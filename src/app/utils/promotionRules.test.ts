import { describe, expect, it } from 'vitest';
import {
  MAX_LIVE_PROMOTIONS, PLACEMENT_RATES, SPOTLIGHT_COOLDOWN_DAYS, calculateReport,
  checkBooking, chooseLivePromotions, laneFor, localisePromotions, promotionStatus,
  spotlightCooldownUntil, type Placement, type Promotion,
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
    rewardId: 99, title: '1-for-1 Medium Milk Tea', merchant: 'LiHO TEA', days: 7, startsAt: NOW,
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

  it('sells each lane\'s banner to one merchant at a time', () => {
    // LiHO holds the brand banner, so another brand cannot also be sold it.
    const held = [promo({
      rewardId: 1, merchant: 'LiHO TEA', placement: 'spotlight',
      startsAt: NOW, endsAt: NOW + 7 * DAY,
    })];
    expect(checkBooking(held, { ...booking, placement: 'spotlight' }).reason)
      .toMatch(/spotlight is taken/i);

    // The same dates are still available as a featured slot.
    expect(checkBooking(held, booking).ok).toBe(true);
  });

  it('keeps a hawker banner available while a chain holds the brand one', () => {
    // The whole point of two lanes: a chain's budget cannot shut every hawker
    // out of the spotlight.
    const brandHolds = [promo({
      rewardId: 1, merchant: 'LiHO TEA', placement: 'spotlight',
      startsAt: NOW, endsAt: NOW + 7 * DAY,
    })];
    const hawkerBooking = {
      ...booking, rewardId: 42, merchant: 'Kopitiam', title: '$3 Coffee Voucher',
      placement: 'spotlight' as const,
    };
    expect(checkBooking(brandHolds, hawkerBooking).ok).toBe(true);

    // And a second hawker cannot take the lane once it is held.
    const bothHeld = [...brandHolds, promo({
      rewardId: 42, merchant: 'Kopitiam', placement: 'spotlight',
      startsAt: NOW, endsAt: NOW + 7 * DAY,
    })];
    expect(checkBooking(bothHeld, {
      ...hawkerBooking, rewardId: 43, merchant: 'Hawker Centres',
    }).reason).toMatch(/spotlight is taken/i);
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

describe('spotlight cooldown', () => {
  const spotlight = (merchant: string, from: number, to: number) =>
    promo({ merchant, placement: 'spotlight', startsAt: from, endsAt: to });

  it('lets a merchant book again after a short run', () => {
    const held = [spotlight('LiHO TEA', NOW - 10 * DAY, NOW - 3 * DAY)]; // 7 days
    expect(spotlightCooldownUntil(held, 'LiHO TEA', NOW)).toBeNull();
  });

  it('stands a merchant down once it has held the banner too long', () => {
    // 20 days inside the trailing 30, over the 14-day allowance.
    const held = [spotlight('LiHO TEA', NOW - 22 * DAY, NOW - 2 * DAY)];
    const until = spotlightCooldownUntil(held, 'LiHO TEA', NOW);
    expect(until).toBe(NOW - 2 * DAY + SPOTLIGHT_COOLDOWN_DAYS * DAY);
  });

  it('adds up consecutive bookings rather than judging them one at a time', () => {
    // Three back-to-back weeks is how a merchant would hold the slot without
    // any single booking looking long.
    const held = [
      spotlight('LiHO TEA', NOW - 21 * DAY, NOW - 14 * DAY),
      spotlight('LiHO TEA', NOW - 14 * DAY, NOW - 7 * DAY),
      spotlight('LiHO TEA', NOW - 7 * DAY, NOW),
    ];
    expect(spotlightCooldownUntil(held, 'LiHO TEA', NOW)).not.toBeNull();
  });

  it('only counts the days that fall inside the trailing window', () => {
    // A long run that finished well before the window should not still bite.
    const held = [spotlight('LiHO TEA', NOW - 80 * DAY, NOW - 40 * DAY)];
    expect(spotlightCooldownUntil(held, 'LiHO TEA', NOW)).toBeNull();
  });

  it('judges each merchant separately', () => {
    const held = [spotlight('LiHO TEA', NOW - 22 * DAY, NOW - 2 * DAY)];
    expect(spotlightCooldownUntil(held, 'Kopitiam', NOW)).toBeNull();
  });

  it('refuses the booking while the cooldown is running', () => {
    const held = [spotlight('LiHO TEA', NOW - 22 * DAY, NOW - 2 * DAY)];
    const result = checkBooking(held, {
      rewardId: 99, title: '1-for-1 Medium Milk Tea', merchant: 'LiHO TEA',
      days: 7, startsAt: NOW, placement: 'spotlight',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/held the spotlight/i);
  });

  it('lets the same merchant book a featured slot during the cooldown', () => {
    // The cooldown is on the banner, not on advertising altogether.
    const held = [spotlight('LiHO TEA', NOW - 22 * DAY, NOW - 2 * DAY)];
    expect(checkBooking(held, {
      rewardId: 99, title: '1-for-1 Medium Milk Tea', merchant: 'LiHO TEA',
      days: 7, startsAt: NOW, placement: 'featured',
    }).ok).toBe(true);
  });
});

describe('spotlight lanes', () => {
  it('reads a merchant\'s lane from its name', () => {
    expect(laneFor('Kopitiam')).toBe('hawker');
    expect(laneFor('Hawker Centres')).toBe('hawker');
    expect(laneFor('Tiong Bahru Chicken Rice')).toBe('hawker');
    expect(laneFor('LiHO TEA')).toBe('brand');
    expect(laneFor('Grab')).toBe('brand');
    expect(laneFor('Popular Bookstore')).toBe('brand');
  });
});

describe('localising placements', () => {
  // A stall buys the customers near its outlet.
  const catalogue = [
    { id: 13, area: 'Ang Mo Kio' },   // Cheng San stall
    { id: 14, area: 'Woodlands' },    // Marsiling stall
    { id: 8, area: 'Multiple outlets' }, // a chain
    { id: 1 },                        // wallet cashback, no outlet
  ];
  const promoFor = (rewardId: number) =>
    promo({ rewardId, startsAt: NOW - DAY, endsAt: NOW + DAY });
  const seenFrom = (area: string, ids: number[]) =>
    localisePromotions(ids.map(promoFor), area, 5, catalogue).map(p => p.rewardId);

  it('shows an estate stall to someone in that estate', () => {
    expect(seenFrom('Ang Mo Kio', [13])).toEqual([13]);
  });

  it('hides it from someone in another estate', () => {
    expect(seenFrom('Woodlands', [13])).toEqual([]);
  });

  it('gives each estate its own stall', () => {
    expect(seenFrom('Ang Mo Kio', [13, 14])).toEqual([13]);
    expect(seenFrom('Woodlands', [13, 14])).toEqual([14]);
  });

  it('still reaches everyone for a chain or a reward with no outlet', () => {
    expect(seenFrom('Woodlands', [8, 1])).toEqual([8, 1]);
    expect(seenFrom('Ang Mo Kio', [8, 1])).toEqual([8, 1]);
  });

  it('keeps a placement whose reward has left the catalogue', () => {
    // The booking is real and still billed, so it must not vanish silently.
    expect(seenFrom('Woodlands', [99999])).toEqual([99999]);
  });
});
