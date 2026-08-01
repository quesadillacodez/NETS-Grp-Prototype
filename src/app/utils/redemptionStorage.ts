import { query, run } from './db';
import { getDeals, type Deal } from './dealStorage';

export interface Redemption {
  id: number;
  dealId: number;
  refCode: string;
  date: string;
  deal: Deal | null;
}

function notifyUpdated(): void {
  window.dispatchEvent(new CustomEvent('redemptionsUpdated'));
}

export function getRedemptions(userId: string): Redemption[] {
  const deals = getDeals();
  const rows = query(
    'SELECT * FROM redemptions WHERE user_id = ? ORDER BY id DESC',
    [userId]
  );
  return rows.map(r => ({
    id: Number(r.id),
    dealId: Number(r.deal_id),
    refCode: String(r.ref_code),
    date: String(r.date),
    deal: deals.find(d => d.id === Number(r.deal_id)) ?? null,
  }));
}

export function addRedemption(userId: string, dealId: number, refCode: string): void {
  run(
    'INSERT INTO redemptions (user_id, deal_id, ref_code, date) VALUES (?, ?, ?, ?)',
    [userId, dealId, refCode, 'Just now']
  );
  notifyUpdated();
}

export function getTotalRedemptionsCount(): number {
  const rows = query('SELECT COUNT(*) AS n FROM redemptions');
  return rows.length ? Number(rows[0].n) : 0;
}

export function clearAllRedemptions(): void {
  run('DELETE FROM redemptions');
  window.dispatchEvent(new CustomEvent('redemptionsUpdated'));
}
