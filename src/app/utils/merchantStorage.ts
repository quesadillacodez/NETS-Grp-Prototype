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
}

export const DEFAULT_XP_RATE = 10;
export const DEFAULT_XP_BONUS = 1;

const DEFAULT_MERCHANTS: Merchant[] = [
  { id: 'kopi',    name: 'Kopitiam',       amount: 4.20,  reference: 'Set A', xpRate: 10, xpBonus: 2 },
  { id: 'bev-eat', name: 'BEV EAT PTE',    amount: 12.50, reference: 'Table 5', xpRate: 10, xpBonus: 1 },
  { id: 'grocer',  name: 'FairPrice',      amount: 23.90, xpRate: 10, xpBonus: 1 },
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
  };
}

export function seedMerchantsIfEmpty(): void {
  const rows = query('SELECT COUNT(*) AS count FROM merchants');
  const count = rows.length ? Number(rows[0].count) : 0;
  if (count > 0) return;

  for (const m of DEFAULT_MERCHANTS) {
    run(
      'INSERT INTO merchants (id, name, amount, reference, active, xp_rate, xp_bonus) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [m.id, m.name, m.amount, m.reference ?? null, m.xpRate, m.xpBonus]
    );
  }
  notifyUpdated();
}

export function getMerchants(): Merchant[] {
  seedMerchantsIfEmpty();
  return query('SELECT * FROM merchants WHERE active = 1 ORDER BY name').map(rowToMerchant);
}

// Matches a transaction's merchant name back to a configured merchant so its XP
// settings can be applied. Names are stored free-form, so compare loosely.
export function getMerchantByName(name: string): Merchant | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return getMerchants().find(m => {
    const candidate = m.name.trim().toLowerCase();
    return candidate === needle || needle.includes(candidate);
  }) ?? null;
}

export function saveMerchant(merchant: Merchant): void {
  run(
    `INSERT INTO merchants (id, name, amount, reference, active, xp_rate, xp_bonus)
     VALUES (?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name      = excluded.name,
       amount    = excluded.amount,
       reference = excluded.reference,
       xp_rate   = excluded.xp_rate,
       xp_bonus  = excluded.xp_bonus,
       active    = 1`,
    [merchant.id, merchant.name, merchant.amount, merchant.reference ?? null,
      merchant.xpRate, merchant.xpBonus]
  );
  notifyUpdated();
}

export function deactivateMerchant(id: string): void {
  run('UPDATE merchants SET active = 0 WHERE id = ?', [id]);
  notifyUpdated();
}
