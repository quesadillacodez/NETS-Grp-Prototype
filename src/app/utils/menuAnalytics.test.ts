import { describe, expect, it } from 'vitest';
import {
  computeHourlyPattern, computeItemPerformance, computeSlowMovers,
  type ItemSale, type MenuItem,
} from './menuStorage';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-03-10T12:00:00').getTime();

function at(daysAgo: number, hour: number): number {
  const when = new Date(NOW - daysAgo * DAY);
  when.setHours(hour, 0, 0, 0);
  return when.getTime();
}

function sale(over: Partial<ItemSale> = {}): ItemSale {
  return {
    merchantId: 'kopi',
    itemId: 1,
    name: 'Nasi Lemak',
    unitPrice: 3.5,
    quantity: 1,
    userId: '1',
    createdAt: at(1, 8),
    ...over,
  };
}

function item(over: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 1, merchantId: 'kopi', name: 'Nasi Lemak', price: 3.5,
    category: 'Mains', active: true, createdAt: NOW - 30 * DAY,
    ...over,
  };
}

describe('what sells', () => {
  const sales = [
    sale({ itemId: 1, name: 'Nasi Lemak', unitPrice: 3.5, createdAt: at(1, 8) }),
    sale({ itemId: 1, name: 'Nasi Lemak', unitPrice: 3.5, createdAt: at(2, 8), userId: '2' }),
    sale({ itemId: 1, name: 'Nasi Lemak', unitPrice: 3.5, createdAt: at(3, 12), userId: '3' }),
    sale({ itemId: 2, name: 'Kopi O', unitPrice: 1.4, createdAt: at(1, 7) }),
  ];

  const ranked = computeItemPerformance(sales, NOW);

  it('puts the best seller first', () => {
    expect(ranked[0].name).toBe('Nasi Lemak');
    expect(ranked[0].quantity).toBe(3);
    expect(ranked[1].name).toBe('Kopi O');
  });

  it('adds up the takings per item', () => {
    expect(ranked[0].revenue).toBeCloseTo(10.5, 2);
    expect(ranked[1].revenue).toBeCloseTo(1.4, 2);
  });

  it('reports each item as a share of everything sold', () => {
    expect(ranked[0].share).toBeCloseTo(3 / 4, 6);
    expect(ranked[1].share).toBeCloseTo(1 / 4, 6);
  });

  it('counts units sold, not receipts', () => {
    const bulk = computeItemPerformance([sale({ quantity: 6 })], NOW);
    expect(bulk[0].quantity).toBe(6);
    expect(bulk[0].revenue).toBeCloseTo(21, 2);
  });

  it('finds the hour an item sells most', () => {
    // Two of the three plates went at 8am.
    expect(ranked[0].peakHour).toBe('8am');
    expect(ranked[1].peakHour).toBe('7am');
  });

  it('counts distinct customers rather than visits', () => {
    expect(ranked[0].customers).toBe(3);
    expect(ranked[1].customers).toBe(1);
  });

  it('has nothing to rank when nothing sold', () => {
    expect(computeItemPerformance([], NOW)).toEqual([]);
  });
});

describe('week-on-week trend', () => {
  it('reports a rise against the previous week', () => {
    const sales = [
      // Previous week: two.
      sale({ createdAt: at(10, 8) }),
      sale({ createdAt: at(11, 8) }),
      // This week: three.
      sale({ createdAt: at(1, 8) }),
      sale({ createdAt: at(2, 8) }),
      sale({ createdAt: at(3, 8) }),
    ];
    expect(computeItemPerformance(sales, NOW)[0].trend).toBeCloseTo(0.5, 6);
  });

  it('reports a fall', () => {
    const sales = [
      sale({ createdAt: at(9, 8) }), sale({ createdAt: at(10, 8) }),
      sale({ createdAt: at(11, 8) }), sale({ createdAt: at(12, 8) }),
      sale({ createdAt: at(1, 8) }),
    ];
    expect(computeItemPerformance(sales, NOW)[0].trend).toBeCloseTo(-0.75, 6);
  });

  it('shows no trend rather than a fake rise off a base of nothing', () => {
    // A dish first sold this week has no previous week to compare against.
    expect(computeItemPerformance([sale({ createdAt: at(1, 8) })], NOW)[0].trend).toBeNull();
  });

  it('ignores sales older than the two weeks being compared', () => {
    const sales = [
      sale({ createdAt: at(60, 8) }),   // ancient, counts in the total only
      sale({ createdAt: at(10, 8) }),   // previous week
      sale({ createdAt: at(1, 8) }),    // this week
    ];
    const ranked = computeItemPerformance(sales, NOW);
    expect(ranked[0].quantity).toBe(3);
    expect(ranked[0].recentQuantity).toBe(1);
    expect(ranked[0].trend).toBeCloseTo(0, 6);
  });
});

describe('when the stall is busy', () => {
  it('buckets sales by hour, in clock order', () => {
    const pattern = computeHourlyPattern([
      sale({ createdAt: at(1, 12) }),
      sale({ createdAt: at(1, 8) }),
      sale({ createdAt: at(2, 8) }),
    ]);

    expect(pattern.map(bucket => bucket.hour)).toEqual(['8am', '12pm']);
    expect(pattern[0].quantity).toBe(2);
  });

  it('leaves out hours with no trade rather than drawing empty bars', () => {
    const pattern = computeHourlyPattern([sale({ createdAt: at(1, 8) })]);
    expect(pattern).toHaveLength(1);
  });

  it('counts quantity, not lines', () => {
    expect(computeHourlyPattern([sale({ quantity: 4, createdAt: at(1, 8) })])[0].quantity).toBe(4);
  });
});

describe('what is not selling', () => {
  it('names menu items that have never sold', () => {
    const menu = [item({ id: 1, name: 'Nasi Lemak' }), item({ id: 2, name: 'Milo Dinosaur' })];
    const slow = computeSlowMovers(menu, [sale({ itemId: 1 })]);

    expect(slow.map(entry => entry.name)).toEqual(['Milo Dinosaur']);
  });

  it('says nothing when everything has sold at least once', () => {
    const menu = [item({ id: 1 })];
    expect(computeSlowMovers(menu, [sale({ itemId: 1 })])).toEqual([]);
  });

  it('counts a sold-out item that used to sell as selling', () => {
    // Being off today does not make it a slow mover.
    const menu = [item({ id: 1, active: false })];
    expect(computeSlowMovers(menu, [sale({ itemId: 1 })])).toEqual([]);
  });
});
