import { query, run } from './db';

export interface Merchant {
  id: string;
  name: string;
  amount: number;
  reference?: string;
}

const DEFAULT_MERCHANTS: Merchant[] = [
  { id: 'kopi',    name: 'Kopitiam',          amount: 4.20,  reference: 'Set A' },
  { id: 'bev-eat', name: 'BEV EAT PTE',       amount: 12.50, reference: 'Table 5' },
  { id: 'grocer',  name: 'FairPrice',         amount: 23.90 },
  { id: 'bubble',  name: 'Bubble Tea Bar',    amount: 6.40,  reference: 'Brown sugar, less ice' },
];

function notifyUpdated(): void {
  window.dispatchEvent(new CustomEvent('merchantsUpdated'));
}

export function seedMerchantsIfEmpty(): void {
  const rows = query('SELECT COUNT(*) AS count FROM merchants');
  const count = rows.length ? Number(rows[0].count) : 0;
  if (count > 0) return;

  for (const m of DEFAULT_MERCHANTS) {
    run(
      'INSERT INTO merchants (id, name, amount, reference, active) VALUES (?, ?, ?, ?, 1)',
      [m.id, m.name, m.amount, m.reference ?? null]
    );
  }
  notifyUpdated();
}

export function getMerchants(): Merchant[] {
  seedMerchantsIfEmpty();

  const rows = query(
    'SELECT id, name, amount, reference FROM merchants WHERE active = 1 ORDER BY name'
  );

  return rows.map(r => ({
    id: String(r.id),
    name: String(r.name),
    amount: Number(r.amount),
    reference: r.reference == null ? undefined : String(r.reference),
  }));
}

export function getRandomMerchant(): Merchant | null {
  const list = getMerchants();
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export function getMerchantById(id: string): Merchant | null {
  const rows = query(
    'SELECT id, name, amount, reference FROM merchants WHERE id = ? AND active = 1',
    [id]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    name: String(r.name),
    amount: Number(r.amount),
    reference: r.reference == null ? undefined : String(r.reference),
  };
}

export function saveMerchant(merchant: Merchant): void {
  run(
    `INSERT INTO merchants (id, name, amount, reference, active)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET
       name      = excluded.name,
       amount    = excluded.amount,
       reference = excluded.reference,
       active    = 1`,
    [merchant.id, merchant.name, merchant.amount, merchant.reference ?? null]
  );
  notifyUpdated();
}

export function deactivateMerchant(id: string): void {
  run('UPDATE merchants SET active = 0 WHERE id = ?', [id]);
  notifyUpdated();
}
