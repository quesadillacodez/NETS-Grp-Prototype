import { query, run } from './db';

export interface Deal {
  id: number;
  category: 'food' | 'attractions';
  title: string;
  merchant: string;
  location: string;
  discount: number;
  originalPrice: number;
  dealPrice: number;
  savings: number;
  expiry: string;
  rating: number;
  image: string;
  featured: boolean;
  terms: string;
  description: string;
  redeemedCount: number;
}

// Seed catalog carried over from the standalone Admin Access app so no deal is lost.
const DEFAULT_DEALS: Omit<Deal, 'redeemedCount'>[] = [
  {
    id: 1, category: 'food',
    title: '30% Off Peking Duck Set',
    merchant: 'Imperial Treasure',
    location: 'Marina Bay Sands',
    discount: 30, originalPrice: 88, dealPrice: 61.60, savings: 26.40,
    expiry: '31 Jul 2026', rating: 4.8,
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop&auto=format',
    featured: true,
    terms: 'Valid Mon–Thu only. Dine-in only. Not valid with other promotions. Min 2 pax.',
    description: 'Enjoy an exquisite Peking Duck set for two at Imperial Treasure Fine Chinese Cuisine. Includes appetisers, soup, and dessert.',
  },
  {
    id: 2, category: 'food',
    title: '1-for-1 Omakase Lunch',
    merchant: 'Nobu Restaurant',
    location: 'Four Seasons Hotel',
    discount: 50, originalPrice: 120, dealPrice: 60.00, savings: 60.00,
    expiry: '15 Aug 2026', rating: 4.9,
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&h=400&fit=crop&auto=format',
    featured: false,
    terms: 'Valid weekdays only. Reservation required. Dine-in only.',
    description: "Experience Chef Nobu's signature Japanese-Peruvian fusion cuisine with this exclusive 1-for-1 lunch set.",
  },
  {
    id: 3, category: 'food',
    title: '20% Off All-Day Brunch',
    merchant: 'Symmetry Café',
    location: 'Jalan Kubor, Kampong Glam',
    discount: 20, originalPrice: 45, dealPrice: 36.00, savings: 9.00,
    expiry: '20 Jul 2026', rating: 4.6,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop&auto=format',
    featured: false,
    terms: 'Valid daily 9am–3pm. Min spend $35.',
    description: "Savour award-winning all-day brunch dishes in Symmetry's rustic-chic dining room.",
  },
  {
    id: 4, category: 'food',
    title: 'Complimentary Dessert Platter',
    merchant: 'Lolla',
    location: 'Ann Siang Hill',
    discount: 15, originalPrice: 30, dealPrice: 0, savings: 30.00,
    expiry: '31 Jul 2026', rating: 4.7,
    image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&h=400&fit=crop&auto=format',
    featured: false,
    terms: 'Min spend $80 per table. One dessert platter per table.',
    description: "Complimentary dessert platter (worth $30) with min spend at Lolla's Mediterranean-inspired menu.",
  },
  {
    id: 5, category: 'attractions',
    title: '25% Off Gardens by the Bay',
    merchant: 'Gardens by the Bay',
    location: 'Marina South',
    discount: 25, originalPrice: 53, dealPrice: 39.75, savings: 13.25,
    expiry: '31 Aug 2026', rating: 4.8,
    image: 'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=600&h=400&fit=crop&auto=format',
    featured: false,
    terms: 'Valid daily. Includes Flower Dome and Cloud Forest entry.',
    description: 'Visit both Flower Dome and Cloud Forest at a special NETS Pulse rate. Family bundles available.',
  },
  {
    id: 6, category: 'attractions',
    title: '40% Off S.E.A. Aquarium',
    merchant: 'Resorts World Sentosa',
    location: 'Sentosa Island',
    discount: 40, originalPrice: 42, dealPrice: 25.20, savings: 16.80,
    expiry: '31 Jul 2026', rating: 4.5,
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop&auto=format',
    featured: false,
    terms: 'Advance booking required. Non-refundable.',
    description: "Explore the world's largest oceanarium with over 100,000 marine animals across 10 zones.",
  },
  {
    id: 7, category: 'attractions',
    title: 'Skip-the-Line: Night Safari',
    merchant: 'Wildlife Reserves Singapore',
    location: 'Mandai, North',
    discount: 20, originalPrice: 55, dealPrice: 44.00, savings: 11.00,
    expiry: '28 Jul 2026', rating: 4.7,
    image: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=600&h=400&fit=crop&auto=format',
    featured: false,
    terms: 'Valid daily. Entry from 7:15pm. Tram ride included.',
    description: "World's first nocturnal wildlife park. Includes express lane entry and guided tram ride.",
  },
  {
    id: 8, category: 'food',
    title: 'Free Kopi with Any Meal',
    merchant: 'Ya Kun Kaya Toast',
    location: 'Multiple outlets',
    discount: 10, originalPrice: 4.50, dealPrice: 0, savings: 4.50,
    expiry: '14 Jul 2026', rating: 4.4,
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=400&fit=crop&auto=format',
    featured: false,
    terms: 'Min spend $8. One kopi per transaction.',
    description: "Singapore's iconic kaya toast and soft-boiled eggs with a complimentary kopi.",
  },
];

function notifyUpdated(): void {
  window.dispatchEvent(new CustomEvent('dealsUpdated'));
}

function rowToDeal(r: Record<string, any>): Deal {
  return {
    id: Number(r.id),
    category: r.category,
    title: r.title,
    merchant: r.merchant,
    location: r.location,
    discount: Number(r.discount),
    originalPrice: Number(r.original_price),
    dealPrice: Number(r.deal_price),
    savings: Number(r.savings),
    expiry: r.expiry,
    rating: Number(r.rating),
    image: r.image,
    featured: r.featured === 1,
    terms: r.terms ?? '',
    description: r.description ?? '',
    redeemedCount: Number(r.redeemed_count ?? 0),
  };
}

export function seedDealsIfEmpty(): void {
  const rows = query('SELECT COUNT(*) AS n FROM deals');
  const count = rows.length ? Number(rows[0].n) : 0;
  if (count > 0) return;

  for (const d of DEFAULT_DEALS) {
    run(
      `INSERT INTO deals
         (id, category, title, merchant, location, discount, original_price,
          deal_price, savings, expiry, rating, image, featured, terms, description, redeemed_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.id, d.category, d.title, d.merchant, d.location, d.discount, d.originalPrice,
        d.dealPrice, d.savings, d.expiry, d.rating, d.image, d.featured ? 1 : 0,
        d.terms, d.description, 0,
      ]
    );
  }
  notifyUpdated();
}

export function getDeals(): Deal[] {
  seedDealsIfEmpty();
  return query('SELECT * FROM deals ORDER BY id').map(rowToDeal);
}

export function addDeal(deal: Omit<Deal, 'id' | 'redeemedCount'>): Deal {
  const id = Date.now();
  run(
    `INSERT INTO deals
       (id, category, title, merchant, location, discount, original_price,
        deal_price, savings, expiry, rating, image, featured, terms, description, redeemed_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id, deal.category, deal.title, deal.merchant, deal.location, deal.discount,
      deal.originalPrice, deal.dealPrice, deal.savings, deal.expiry, deal.rating,
      deal.image, deal.featured ? 1 : 0, deal.terms, deal.description,
    ]
  );
  notifyUpdated();
  return { ...deal, id, redeemedCount: 0 };
}

// Updates an existing deal's editable fields (keeps id and redeemed_count).
export function updateDeal(deal: Deal): void {
  run(
    `UPDATE deals SET
       category = ?, title = ?, merchant = ?, location = ?, discount = ?,
       original_price = ?, deal_price = ?, savings = ?, expiry = ?, rating = ?,
       image = ?, featured = ?, terms = ?, description = ?
     WHERE id = ?`,
    [
      deal.category, deal.title, deal.merchant, deal.location, deal.discount,
      deal.originalPrice, deal.dealPrice, deal.savings, deal.expiry, deal.rating,
      deal.image, deal.featured ? 1 : 0, deal.terms, deal.description, deal.id,
    ]
  );
  notifyUpdated();
}

// Deletes a deal and any redemptions/saved rows that point to it, so the deal
// figures stay consistent.
export function deleteDeal(dealId: number): void {
  run('DELETE FROM redemptions WHERE deal_id = ?', [dealId]);
  run('DELETE FROM saved_deals WHERE deal_id = ?', [dealId]);
  run('DELETE FROM deals WHERE id = ?', [dealId]);
  notifyUpdated();
  window.dispatchEvent(new CustomEvent('redemptionsUpdated'));
  window.dispatchEvent(new CustomEvent('savedDealsUpdated'));
}

export function incrementDealRedeemed(dealId: number): void {
  run('UPDATE deals SET redeemed_count = redeemed_count + 1 WHERE id = ?', [dealId]);
  notifyUpdated();
}

// Resets every deal's redeemed_count to the ACTUAL number of redemption rows for
// that deal. Fixes databases seeded with the old random counts so the "redeemed"
// figure always reflects real redemptions. Runs once (guarded), and is safe to
// re-run — it only ever sets counts to the true value.
export function reconcileDealRedemptionCounts(): void {
  const guard = query("SELECT value FROM app_meta WHERE key = 'deal-counts-reconciled'");
  if (guard.length && guard[0].value === 'true') return;

  const deals = query('SELECT id FROM deals');
  for (const d of deals) {
    const id = Number(d.id);
    const rows = query('SELECT COUNT(*) AS n FROM redemptions WHERE deal_id = ?', [id]);
    const real = rows.length ? Number(rows[0].n) : 0;
    run('UPDATE deals SET redeemed_count = ? WHERE id = ?', [real, id]);
  }
  run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('deal-counts-reconciled', 'true')");
  notifyUpdated();
}

// ── Per-user saved deals ──────────────────────────────────────────────────

function notifySavedUpdated(): void {
  window.dispatchEvent(new CustomEvent('savedDealsUpdated'));
}

export function getSavedDealIds(userId: string): number[] {
  return query('SELECT deal_id FROM saved_deals WHERE user_id = ?', [userId])
    .map(r => Number(r.deal_id));
}

export function isDealSaved(userId: string, dealId: number): boolean {
  const rows = query(
    'SELECT 1 FROM saved_deals WHERE user_id = ? AND deal_id = ?',
    [userId, dealId]
  );
  return rows.length > 0;
}

export function toggleSavedDeal(userId: string, dealId: number): void {
  if (isDealSaved(userId, dealId)) {
    run('DELETE FROM saved_deals WHERE user_id = ? AND deal_id = ?', [userId, dealId]);
  } else {
    run('INSERT OR IGNORE INTO saved_deals (user_id, deal_id) VALUES (?, ?)', [userId, dealId]);
  }
  notifySavedUpdated();
}

// Wipes all per-user saved deals. Used by "Clear All Data".
export function clearAllSavedDeals(): void {
  run('DELETE FROM saved_deals');
  notifySavedUpdated();
}

// Sets every deal's redeemed_count back to 0 unconditionally. Used by "Clear All
// Data" so the deal performance figures start fresh alongside the empty
// redemptions table.
export function resetAllDealRedemptionCounts(): void {
  run('UPDATE deals SET redeemed_count = 0');
  notifyUpdated();
}

// ── Region mapping (Singapore) ─────────────────────────────────────────────
export type Region = 'all' | 'central' | 'north' | 'south' | 'east' | 'west';

// Maps a deal's location string to a Singapore region. Keyword-based so newly
// added deals with recognisable place names are auto-categorised.
const REGION_KEYWORDS: Record<Exclude<Region, 'all'>, string[]> = {
  central: ['marina', 'orchard', 'kampong glam', 'ann siang', 'city hall', 'bugis', 'raffles', 'chinatown', 'clarke quay', 'somerset', 'dhoby', 'newton', 'novena', 'four seasons', 'central'],
  north:   ['mandai', 'woodlands', 'yishun', 'sembawang', 'admiralty', 'kranji', 'canberra', 'north'],
  south:   ['sentosa', 'harbourfront', 'telok blangah', 'mount faber', 'keppel', 'south'],
  east:    ['changi', 'tampines', 'bedok', 'pasir ris', 'katong', 'east coast', 'simei', 'expo', 'paya lebar', 'geylang', 'east'],
  west:    ['jurong', 'clementi', 'bukit batok', 'boon lay', 'tuas', 'pioneer', 'chinese garden', 'west'],
};

export function getDealRegion(location: string): Exclude<Region, 'all'> | 'other' {
  const loc = location.toLowerCase();
  if (loc.includes('multiple')) return 'other'; // island-wide; shown under any filter
  for (const region of Object.keys(REGION_KEYWORDS) as Exclude<Region, 'all'>[]) {
    if (REGION_KEYWORDS[region].some(kw => loc.includes(kw))) return region;
  }
  return 'other';
}

export function dealInRegion(deal: Deal, region: Region): boolean {
  if (region === 'all') return true;
  const r = getDealRegion(deal.location);
  return r === region || r === 'other'; // 'other'/island-wide always shows
}
