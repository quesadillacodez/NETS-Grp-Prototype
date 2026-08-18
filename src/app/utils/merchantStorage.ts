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
  /** False once deactivated: hidden from scanning, but still used to price historical XP. */
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
];

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
    aliases: r.aliases ? String(r.aliases).split('|').map(a => a.trim()).filter(Boolean) : [],
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

export function getMerchants(): Merchant[] {
  seedMerchantsIfEmpty();
  return query('SELECT * FROM merchants WHERE active = 1 ORDER BY name').map(rowToMerchant);
}

/** Includes deactivated merchants, so historical XP keeps pricing correctly. */
export function getAllMerchants(): Merchant[] {
  seedMerchantsIfEmpty();
  return query('SELECT * FROM merchants ORDER BY name').map(rowToMerchant);
}

/**
 * Matches a transaction's merchant name back to a configured merchant.
 *
 * Matching is exact against the merchant name or one of its declared aliases.
 * The previous substring match meant any merchant whose name was a substring of
 * the transaction name would claim it - a merchant called "Kopi" captured every
 * "Kopitiam Food Court" payment and applied the wrong rate.
 *
 * Deactivated merchants are still matched: a payment made while a stall was
 * live should keep the XP it earned, and hiding the stall from the scan list
 * must not silently reprice history.
 */
export function getMerchantByName(name: string): Merchant | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const matches = (m: Merchant) =>
    m.name.trim().toLowerCase() === needle ||
    m.aliases.some(alias => alias.trim().toLowerCase() === needle);
  // Prefer a live merchant when an alias is shared with a retired one.
  const all = getAllMerchants();
  return all.find(m => m.active && matches(m)) ?? all.find(matches) ?? null;
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
 * Hides a merchant from the scan list. The row is kept so historical
 * transactions keep pricing against the rate that was live when they happened.
 */
export function deactivateMerchant(id: string): void {
  run('UPDATE merchants SET active = 0 WHERE id = ?', [id]);
  notifyUpdated();
}

export function reactivateMerchant(id: string): void {
  run('UPDATE merchants SET active = 1 WHERE id = ?', [id]);
  notifyUpdated();
}
