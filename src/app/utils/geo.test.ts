import { describe, expect, it } from 'vitest';
import {
  byDistance, distanceKm, formatDistance, getUserArea, isWithinRadius,
  proximityTo, resolveArea, AREA_COORDINATES,
} from './geo';

const ALEX = '1';

describe('resolveArea', () => {
  it('resolves a plain area name', () => {
    expect(resolveArea('Bugis').coordinates).toEqual(AREA_COORDINATES['bugis']);
    expect(resolveArea('  ORCHARD ').coordinates).toEqual(AREA_COORDINATES['orchard']);
  });

  it('finds the area inside a longer label', () => {
    // Deals describe themselves like this.
    expect(resolveArea('Jalan Kubor, Kampong Glam').coordinates).toEqual(AREA_COORDINATES['kampong glam']);
    expect(resolveArea('Mandai, North').coordinates).toEqual(AREA_COORDINATES['mandai']);
  });

  it('prefers the most specific match', () => {
    // "marina bay sands" must win over the shorter "marina south".
    expect(resolveArea('Marina Bay Sands').coordinates).toEqual(AREA_COORDINATES['marina bay sands']);
  });

  it('treats chains as available everywhere rather than nowhere', () => {
    expect(resolveArea('Multiple outlets')).toEqual({ coordinates: null, islandwide: true });
    expect(resolveArea('Participating outlets').islandwide).toBe(true);
  });

  it('returns nothing for an unknown or missing area', () => {
    expect(resolveArea('Atlantis').coordinates).toBeNull();
    expect(resolveArea(undefined)).toEqual({ coordinates: null, islandwide: false });
  });
});

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm(AREA_COORDINATES['orchard'], AREA_COORDINATES['orchard'])).toBeCloseTo(0, 5);
  });

  it('matches known Singapore distances', () => {
    // Orchard to Bugis is roughly 2.7 km as the crow flies.
    const orchardToBugis = distanceKm(AREA_COORDINATES['orchard'], AREA_COORDINATES['bugis']);
    expect(orchardToBugis).toBeGreaterThan(2);
    expect(orchardToBugis).toBeLessThan(3.5);

    // Orchard to Tampines is much further.
    expect(distanceKm(AREA_COORDINATES['orchard'], AREA_COORDINATES['tampines'])).toBeGreaterThan(11);
  });

  it('is symmetric', () => {
    const there = distanceKm(AREA_COORDINATES['orchard'], AREA_COORDINATES['mandai']);
    const back = distanceKm(AREA_COORDINATES['mandai'], AREA_COORDINATES['orchard']);
    expect(there).toBeCloseTo(back, 6);
  });
});

describe('formatDistance', () => {
  it('uses metres below a kilometre and kilometres above', () => {
    expect(formatDistance(0.62)).toBe('600 m');
    expect(formatDistance(2.44)).toBe('2.4 km');
    expect(formatDistance(12)).toBe('12.0 km');
  });

  it('never reports a distance of zero metres', () => {
    expect(formatDistance(0)).toBe('50 m');
  });
});

describe('proximity for the demo customer', () => {
  it('places Alex in Orchard', () => {
    expect(getUserArea(ALEX)).toBe('Orchard');
  });

  it('reports how far an outlet is', () => {
    const orchard = proximityTo(ALEX, 'Orchard');
    expect(orchard.km).toBeCloseTo(0, 3);
    expect(orchard.label).toContain('away');

    const tampines = proximityTo(ALEX, 'Tampines');
    expect(tampines.km!).toBeGreaterThan(11);
  });

  it('labels chains as multiple outlets instead of a distance', () => {
    expect(proximityTo(ALEX, 'Multiple outlets')).toEqual({
      km: null, label: 'Multiple outlets', islandwide: true,
    });
  });

  it('has nothing to say about a reward with no outlet', () => {
    // Wallet cashback carries no area at all.
    expect(proximityTo(ALEX, undefined).label).toBeNull();
  });
});

describe('nearby filtering', () => {
  it('keeps close outlets and drops far ones', () => {
    expect(isWithinRadius(proximityTo(ALEX, 'Somerset'), 5)).toBe(true);
    expect(isWithinRadius(proximityTo(ALEX, 'Tiong Bahru'), 5)).toBe(true);
    expect(isWithinRadius(proximityTo(ALEX, 'Tampines'), 5)).toBe(false);
    expect(isWithinRadius(proximityTo(ALEX, 'Mandai'), 5)).toBe(false);
  });

  it('counts everywhere-available rewards as nearby', () => {
    expect(isWithinRadius(proximityTo(ALEX, 'Multiple outlets'), 2)).toBe(true);
  });

  it('excludes things with no location at all', () => {
    expect(isWithinRadius(proximityTo(ALEX, undefined), 100)).toBe(false);
  });

  it('sorts closest first, then chains, then unknown', () => {
    const sorted = ['Tampines', undefined, 'Multiple outlets', 'Somerset']
      .map(area => proximityTo(ALEX, area))
      .sort(byDistance);

    expect(sorted[0].km!).toBeLessThan(2);          // Somerset
    expect(sorted[1].km!).toBeGreaterThan(11);      // Tampines
    expect(sorted[2].islandwide).toBe(true);        // Multiple outlets
    expect(sorted[3].label).toBeNull();             // no location
  });
});
