import { query, run } from './db';

export interface Merchant {
  id: string;
  name: string;
  amount: number;
  reference?: string;
  /** XP awarded per $1 spent at this merchant. */
  xpRate: number;
  /** Multiplier applied on top of the rate, e.g. 2 for a heartland 2x campaign. */
  xpBonus: number;
  /** Campaign window for `xpBonus`. Null on either side means open-ended. */
  campaignStart: number | null;
  campaignEnd: number | null;
  /**
   * Other names this merchant's payments appear under. Matching is exact
   * against the name or one of these, so a merchant called "Kopi" can no
   * longer swallow every "Kopitiam Food Court" payment.
   */
  aliases: string[];
  /** False once hidden: kept out of the scan list, still used to price history. */
  active: boolean;
}

export const DEFAULT_XP_RATE = 10;
export const DEFAULT_XP_BONUS = 1;

type MerchantSeed = Omit<Merchant, 'campaignStart' | 'campaignEnd' | 'aliases' | 'active'>
  & Partial<Pick<Merchant, 'aliases'>>;

const DEFAULT_MERCHANTS: MerchantSeed[] = [
  { id: 'kopi',    name: 'Kopitiam',       amount: 4.20,  reference: 'Set A', xpRate: 10, xpBonus: 2, aliases: ['Kopitiam Food Court'] },
  { id: 'bev-eat', name: 'BEV EAT PTE',    amount: 12.50, reference: 'Table 5', xpRate: 10, xpBonus: 1 },
  { id: 'grocer',  name: 'FairPrice',      amount: 23.90, xpRate: 10, xpBonus: 1, aliases: ['FairPrice Xtra'] },
  { id: 'bubble',  name: 'Bubble Tea Bar', amount: 6.40,  reference: 'Brown sugar, less ice', xpRate: 10, xpBonus: 1 },
  { id: 'uniqlo',  name: 'Uniqlo',         amount: 39.90, reference: 'AIRism Tee', xpRate: 10, xpBonus: 1 },
  { id: 'zara',    name: 'ZARA',           amount: 79.90, reference: 'Order #ZR-2261', xpRate: 10, xpBonus: 1 },
];

// IDs of the fashion (Shopping) merchants added after the first release. Used to
// back-fill them into databases that were seeded before they existed.
const FASHION_MERCHANT_IDS = ['uniqlo', 'zara'];

function notifyUpdated(): void {
  window.dispatchEvent(new CustomEvent('merchantsUpdated'));
}

function rowToMerchant(r: Record<string, any>): Merchant {
  return {
    id: String(r.id),
    name: String(r.name),
    amount: Number(r.amount),
    reference: r.reference == null ? undefined : String(r.reference),
    xpRate: r.xp_rate == null ? DEFAULT_XP_RATE : Number(r.xp_rate),
    xpBonus: r.xp_bonus == null ? DEFAULT_XP_BONUS : Number(r.xp_bonus),
    campaignStart: r.campaign_start == null ? null : Number(r.campaign_start),
    campaignEnd: r.campaign_end == null ? null : Number(r.campaign_end),
    aliases: r.aliases ? String(r.aliases).split('|').map((a: string) => a.trim()).filter(Boolean) : [],
    active: r.active == null ? true : Number(r.active) === 1,
  };
}

export function seedMerchantsIfEmpty(): void {
  const rows = query('SELECT COUNT(*) AS count FROM merchants');
  const count = rows.length ? Number(rows[0].count) : 0;
  if (count > 0) return;

  for (const m of DEFAULT_MERCHANTS) {
    run(
      `INSERT INTO merchants (id, name, amount, reference, active, xp_rate, xp_bonus, aliases)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      [m.id, m.name, m.amount, m.reference ?? null, m.xpRate, m.xpBonus,
        (m.aliases ?? []).join('|') || null]
    );
  }
  notifyUpdated();
}

// Back-fills the fashion merchants into databases that were seeded before they
// were added. Runs at most once (guarded by an app_meta flag) so a merchant the
// user later deletes does not reappear on the next launch.
export function ensureFashionMerchants(): void {
  const seen = query("SELECT value FROM app_meta WHERE key = 'seeded-fashion-merchants'");
  if (seen.length > 0) return;
  for (const m of DEFAULT_MERCHANTS.filter(x => FASHION_MERCHANT_IDS.includes(x.id))) {
    run(
      `INSERT OR IGNORE INTO merchants (id, name, amount, reference, active, xp_rate, xp_bonus, aliases)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      [m.id, m.name, m.amount, m.reference ?? null, m.xpRate, m.xpBonus,
        (m.aliases ?? []).join('|') || null]
    );
  }
  run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('seeded-fashion-merchants', 'true')");
  notifyUpdated();
}

export function getMerchants(): Merchant[] {
  seedMerchantsIfEmpty();
  return query('SELECT * FROM merchants WHERE active = 1 ORDER BY name').map(rowToMerchant);
}

/** Includes hidden merchants, so historical XP keeps pricing correctly. */
export function getAllMerchants(): Merchant[] {
  seedMerchantsIfEmpty();
  return query('SELECT * FROM merchants ORDER BY name').map(rowToMerchant);
}

/**
 * Whether a transaction's free-text merchant name refers to this merchant.
 *
 * Matching is exact against the merchant name or one of its declared aliases.
 * A substring match meant any merchant whose name was contained in the
 * transaction name would claim it - a merchant called "Kopi" captured every
 * "Kopitiam Food Court" payment and applied the wrong rate. Transaction names
 * really are free-form, so the answer is to declare the variants explicitly
 * rather than to guess.
 *
 * This is the single rule used both to price XP and to attribute a sale in the
 * merchant portal, so a sale that earns XP is always the same sale a merchant
 * sees in their insights.
 */
export function matchesMerchant(transactionName: string, merchant: Pick<Merchant, 'name' | 'aliases'>): boolean {
  const needle = transactionName.trim().toLowerCase();
  if (!needle) return false;
  if (merchant.name.trim().toLowerCase() === needle) return true;
  return merchant.aliases.some(alias => alias.trim().toLowerCase() === needle);
}

/**
 * Matches a transaction's merchant name back to a configured merchant so its XP
 * settings can be applied.
 *
 * Hidden merchants are still matched: a payment made while a stall was live
 * should keep the XP it earned, and hiding the stall must not reprice history.
 */
export function getMerchantByName(name: string): Merchant | null {
  const all = getAllMerchants();
  return all.find(m => m.active && matchesMerchant(name, m))
    ?? all.find(m => matchesMerchant(name, m))
    ?? null;
}

/** True when the merchant's bonus multiplier applies at `at`. */
export function isCampaignActive(merchant: Merchant, at: number = Date.now()): boolean {
  if (merchant.xpBonus <= 1) return false;
  if (merchant.campaignStart !== null && at < merchant.campaignStart) return false;
  if (merchant.campaignEnd !== null && at > merchant.campaignEnd) return false;
  return true;
}

/** Effective bonus multiplier at `at` - 1 when no campaign is running. */
export function effectiveBonus(merchant: Merchant, at: number = Date.now()): number {
  return isCampaignActive(merchant, at) ? merchant.xpBonus : DEFAULT_XP_BONUS;
}

export function saveMerchant(merchant: Omit<Merchant, 'active'>): void {
  run(
    `INSERT INTO merchants
      (id, name, amount, reference, active, xp_rate, xp_bonus, campaign_start, campaign_end, aliases)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name           = excluded.name,
       amount         = excluded.amount,
       reference      = excluded.reference,
       xp_rate        = excluded.xp_rate,
       xp_bonus       = excluded.xp_bonus,
       campaign_start = excluded.campaign_start,
       campaign_end   = excluded.campaign_end,
       aliases        = excluded.aliases,
       active         = 1`,
    [merchant.id, merchant.name, merchant.amount, merchant.reference ?? null,
      merchant.xpRate, merchant.xpBonus, merchant.campaignStart, merchant.campaignEnd,
      merchant.aliases.join('|') || null]
  );
  notifyUpdated();
}

/**
 * Soft delete. The row is kept and only hidden from the scan list, because a
 * hard delete silently reprices every past payment at that merchant back to the
 * default rate - the XP a customer already earned would change retroactively.
 */
export function deleteMerchant(id: string): void {
  run('UPDATE merchants SET active = 0 WHERE id = ?', [id]);
  notifyUpdated();
}

export function restoreMerchant(id: string): void {
  run('UPDATE merchants SET active = 1 WHERE id = ?', [id]);
  notifyUpdated();
}
