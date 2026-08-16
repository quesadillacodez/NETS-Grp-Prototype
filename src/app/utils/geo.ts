// ─── Location & distance ─────────────────────────────────────────────────────
// Hangout ideas, partner deals and reward outlets all describe where they are
// as a Singapore area name ("Bugis", "Marina Bay Sands", "Jalan Kubor, Kampong
// Glam"). This module turns those names into coordinates so the app can sort
// and filter by how close something actually is.

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Approximate centres of the Singapore areas used across the catalogues.
 * Keys are lower-case; lookup also matches an area name appearing anywhere in a
 * longer label, so "Jalan Kubor, Kampong Glam" resolves via "kampong glam".
 */
export const AREA_COORDINATES: Record<string, Coordinates> = {
  'orchard':            { lat: 1.3048, lng: 103.8318 },
  'somerset':           { lat: 1.3006, lng: 103.8388 },
  'dhoby ghaut':        { lat: 1.2993, lng: 103.8455 },
  'river valley':       { lat: 1.2933, lng: 103.8360 },
  'bras basah':         { lat: 1.2971, lng: 103.8506 },
  'clarke quay':        { lat: 1.2884, lng: 103.8465 },
  'bugis':              { lat: 1.3009, lng: 103.8559 },
  'arab street':        { lat: 1.3021, lng: 103.8586 },
  'kampong glam':       { lat: 1.3025, lng: 103.8590 },
  'chinatown':          { lat: 1.2839, lng: 103.8437 },
  'ann siang hill':     { lat: 1.2809, lng: 103.8465 },
  'tiong bahru':        { lat: 1.2863, lng: 103.8267 },
  'downtown':           { lat: 1.2795, lng: 103.8515 },
  'raffles place':      { lat: 1.2839, lng: 103.8515 },
  'marina bay sands':   { lat: 1.2834, lng: 103.8607 },
  'marina south':       { lat: 1.2816, lng: 103.8636 },
  'four seasons hotel': { lat: 1.3062, lng: 103.8281 },
  'holland village':    { lat: 1.3111, lng: 103.7963 },
  'bukit timah':        { lat: 1.3294, lng: 103.8021 },
  'toa payoh':          { lat: 1.3343, lng: 103.8563 },
  'ang mo kio':         { lat: 1.3691, lng: 103.8454 },
  'serangoon':          { lat: 1.3496, lng: 103.8737 },
  'clementi':           { lat: 1.3151, lng: 103.7654 },
  'jurong east':        { lat: 1.3329, lng: 103.7436 },
  'bedok':              { lat: 1.3240, lng: 103.9300 },
  'tampines':           { lat: 1.3536, lng: 103.9450 },
  'punggol':            { lat: 1.4041, lng: 103.9025 },
  'woodlands':          { lat: 1.4380, lng: 103.7890 },
  'mandai':             { lat: 1.4043, lng: 103.7930 },
  'sentosa island':     { lat: 1.2494, lng: 103.8303 },
  'sentosa':            { lat: 1.2494, lng: 103.8303 },
};

/** Labels that describe a chain or a digital reward rather than one outlet. */
const ISLANDWIDE_PATTERNS = [
  'multiple outlets', 'islandwide', 'island-wide', 'all outlets',
  'nationwide', 'online', 'participating',
];

export interface ResolvedArea {
  coordinates: Coordinates | null;
  /** True when the thing is available everywhere rather than at one place. */
  islandwide: boolean;
}

// Longest keys first so "marina bay sands" wins over a bare "marina".
const AREA_KEYS_BY_LENGTH = Object.keys(AREA_COORDINATES).sort((a, b) => b.length - a.length);

export function resolveArea(area?: string | null): ResolvedArea {
  const value = String(area ?? '').trim().toLowerCase();
  if (!value) return { coordinates: null, islandwide: false };
  if (ISLANDWIDE_PATTERNS.some(pattern => value.includes(pattern))) {
    return { coordinates: null, islandwide: true };
  }

  const exact = AREA_COORDINATES[value];
  if (exact) return { coordinates: exact, islandwide: false };

  const partial = AREA_KEYS_BY_LENGTH.find(key => value.includes(key));
  return { coordinates: partial ? AREA_COORDINATES[partial] : null, islandwide: false };
}

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** "650 m" under a kilometre, "2.4 km" above it. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toFixed(1)} km`;
}

// ─── Where the customer is ───────────────────────────────────────────────────
// The prototype has no device location permission, so each demo account is
// given a fixed home area. A production build would replace `getUserArea` with
// the Geolocation API (and fall back to this when permission is refused);
// everything downstream already works from coordinates.

export const DEFAULT_USER_AREA = 'Orchard';

const DEMO_USER_AREAS: Record<string, string> = {
  '1': 'Orchard', // Alex Chen
};

export function getUserArea(userId: string): string {
  return DEMO_USER_AREAS[userId] ?? DEFAULT_USER_AREA;
}

export function getUserCoordinates(userId: string): Coordinates {
  return resolveArea(getUserArea(userId)).coordinates
    ?? AREA_COORDINATES[DEFAULT_USER_AREA.toLowerCase()];
}

export interface Proximity {
  /** Distance in km, or null when there is no single place to measure to. */
  km: number | null;
  /** Ready-to-render text: "1.2 km away", "Multiple outlets", or null. */
  label: string | null;
  islandwide: boolean;
}

/** How far something in `area` is from the customer. */
export function proximityTo(userId: string, area?: string | null): Proximity {
  const resolved = resolveArea(area);
  if (resolved.islandwide) return { km: null, label: 'Multiple outlets', islandwide: true };
  if (!resolved.coordinates) return { km: null, label: null, islandwide: false };

  const km = distanceKm(getUserCoordinates(userId), resolved.coordinates);
  return { km, label: `${formatDistance(km)} away`, islandwide: false };
}

export const NEARBY_RADIUS_OPTIONS_KM = [2, 5, 10] as const;
export const DEFAULT_NEARBY_RADIUS_KM = 5;

/**
 * Whether something belongs in a "near you" list. Anything available
 * everywhere counts as nearby; anything with no location at all does not.
 */
export function isWithinRadius(proximity: Proximity, radiusKm: number): boolean {
  if (proximity.islandwide) return true;
  return proximity.km !== null && proximity.km <= radiusKm;
}

/** Sort helper: closest first, islandwide next, unknown last. */
export function byDistance(a: Proximity, b: Proximity): number {
  const rank = (p: Proximity) => (p.km !== null ? p.km : p.islandwide ? 1e6 : 1e7);
  return rank(a) - rank(b);
}
