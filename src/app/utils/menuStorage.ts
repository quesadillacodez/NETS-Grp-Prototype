// ─── A merchant's menu, and what actually sold ───────────────────────────────
// "$6.80 at Kopitiam" tells a stallholder nothing they did not already know.
// "Nasi Lemak, 34 plates this week, mostly before 9am" is worth opening the app
// for. This module is the difference between the two: merchants keep a menu, a
// payment can name the item it was for, and the dashboard reads the result.

import { lastInsertId, query, queryOne, run } from './db';
import { addTransactions } from './transactionStorage';

export interface MenuItem {
  id: number;
  merchantId: string;
  name: string;
  price: number;
  category: string;
  /** A sold-out item stays in the menu and its history, but cannot be sold. */
  active: boolean;
  createdAt: number;
}

export interface ItemSale {
  merchantId: string;
  itemId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  userId: string | null;
  createdAt: number;
}

function notifyMenu(): void {
  window.dispatchEvent(new CustomEvent('menuUpdated'));
}

function rowToItem(row: Record<string, any>): MenuItem {
  return {
    id: Number(row.id),
    merchantId: String(row.merchant_id),
    name: String(row.name),
    price: Number(row.price),
    category: String(row.category ?? 'Mains'),
    active: Number(row.active) === 1,
    createdAt: Number(row.created_at ?? 0),
  };
}

export const MENU_CATEGORIES = ['Mains', 'Sides', 'Drinks', 'Desserts', 'Other'] as const;

export function getMenu(merchantId: string): MenuItem[] {
  return query(
    'SELECT * FROM merchant_items WHERE merchant_id = ? ORDER BY category, name',
    [merchantId],
  ).map(rowToItem);
}

/** Only what a customer can actually order right now. */
export function getSellableMenu(merchantId: string): MenuItem[] {
  return getMenu(merchantId).filter(item => item.active);
}

export function addMenuItem(item: {
  merchantId: string; name: string; price: number; category: string;
}): { ok: boolean; reason?: string; id?: number } {
  const name = item.name.trim();
  if (!name) return { ok: false, reason: 'Give the item a name.' };
  if (!Number.isFinite(item.price) || item.price <= 0) {
    return { ok: false, reason: 'Enter a price greater than zero.' };
  }
  // Two items with the same name would split that dish's sales in the report.
  if (getMenu(item.merchantId).some(existing => existing.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, reason: `${name} is already on your menu.` };
  }

  run(
    'INSERT INTO merchant_items (merchant_id, name, price, category, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
    [item.merchantId, name, item.price, item.category, Date.now()],
  );
  notifyMenu();
  return { ok: true, id: lastInsertId() };
}

export function updateMenuItem(
  merchantId: string,
  id: number,
  changes: { name?: string; price?: number; category?: string },
): { ok: boolean; reason?: string } {
  const item = getMenu(merchantId).find(entry => entry.id === id);
  if (!item) return { ok: false, reason: 'That item is not on your menu.' };

  const name = (changes.name ?? item.name).trim();
  const price = changes.price ?? item.price;
  if (!name) return { ok: false, reason: 'Give the item a name.' };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: 'Enter a price greater than zero.' };

  run(
    'UPDATE merchant_items SET name = ?, price = ?, category = ? WHERE id = ? AND merchant_id = ?',
    [name, price, changes.category ?? item.category, id, merchantId],
  );
  notifyMenu();
  return { ok: true };
}

/** Sold out and back again. The item keeps its history either way. */
export function setMenuItemActive(merchantId: string, id: number, active: boolean): void {
  run('UPDATE merchant_items SET active = ? WHERE id = ? AND merchant_id = ?',
    [active ? 1 : 0, id, merchantId]);
  notifyMenu();
}

export function removeMenuItem(merchantId: string, id: number): void {
  run('DELETE FROM merchant_items WHERE id = ? AND merchant_id = ?', [id, merchantId]);
  notifyMenu();
}

/**
 * Record what a payment was for.
 *
 * Keyed on the payment id the QR flow already generates, so pressing back on
 * the success screen cannot sell the same nasi lemak twice — the same guard the
 * transaction ledger uses, applied to the item lines.
 */
export function recordItemSale(input: {
  paymentId: string;
  merchantId: string;
  item: Pick<MenuItem, 'id' | 'name' | 'price'>;
  quantity?: number;
  userId?: string;
  createdAt?: number;
}): void {
  const quantity = Math.max(1, Math.round(input.quantity ?? 1));
  run(
    `INSERT OR IGNORE INTO item_sales
      (payment_id, merchant_id, item_id, name, unit_price, quantity, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.paymentId, input.merchantId, input.item.id, input.item.name, input.item.price,
      quantity, input.userId ?? null, input.createdAt ?? Date.now()],
  );
  window.dispatchEvent(new CustomEvent('itemSalesUpdated'));
}

export function getItemSales(merchantId: string): ItemSale[] {
  return query(
    'SELECT * FROM item_sales WHERE merchant_id = ? ORDER BY created_at DESC',
    [merchantId],
  ).map(row => ({
    merchantId: String(row.merchant_id),
    itemId: Number(row.item_id),
    name: String(row.name),
    unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity),
    userId: row.user_id == null ? null : String(row.user_id),
    createdAt: Number(row.created_at),
  }));
}

// ─── What sells ──────────────────────────────────────────────────────────────

export interface ItemPerformance {
  itemId: number;
  name: string;
  /** Plates, cups, portions — units sold, not receipts. */
  quantity: number;
  revenue: number;
  /** Share of all units sold, 0–1. */
  share: number;
  /** Units sold in the last seven days. */
  recentQuantity: number;
  /** Change against the seven days before that: +0.25 is a quarter up. */
  trend: number | null;
  /** The hour this item sells most, e.g. "8am". */
  peakHour: string | null;
  /** Distinct customers who bought it. */
  customers: number;
}

const HOURS = [
  '12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am',
  '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm',
];

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/**
 * Rank a merchant's items by how many units moved. Pure, so the arithmetic
 * behind a stallholder's "most popular dish" is covered by unit tests.
 */
export function computeItemPerformance(sales: ItemSale[], now = Date.now()): ItemPerformance[] {
  const byItem = new Map<number, {
    name: string; quantity: number; revenue: number; recent: number; previous: number;
    hours: Map<string, number>; customers: Set<string>;
  }>();

  for (const sale of sales) {
    const entry = byItem.get(sale.itemId) ?? {
      name: sale.name, quantity: 0, revenue: 0, recent: 0, previous: 0,
      hours: new Map<string, number>(), customers: new Set<string>(),
    };
    entry.quantity += sale.quantity;
    entry.revenue += sale.quantity * sale.unitPrice;

    const age = now - sale.createdAt;
    if (age <= WEEK) entry.recent += sale.quantity;
    else if (age <= 2 * WEEK) entry.previous += sale.quantity;

    const hour = HOURS[new Date(sale.createdAt).getHours()];
    entry.hours.set(hour, (entry.hours.get(hour) ?? 0) + sale.quantity);
    if (sale.userId) entry.customers.add(sale.userId);

    byItem.set(sale.itemId, entry);
  }

  const totalUnits = [...byItem.values()].reduce((sum, entry) => sum + entry.quantity, 0);

  return [...byItem.entries()]
    .map(([itemId, entry]) => {
      const peak = [...entry.hours.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      return {
        itemId,
        name: entry.name,
        quantity: entry.quantity,
        revenue: entry.revenue,
        share: totalUnits ? entry.quantity / totalUnits : 0,
        recentQuantity: entry.recent,
        // No previous week to compare against means no trend, rather than a
        // made-up 100% rise off a base of nothing.
        trend: entry.previous > 0 ? (entry.recent - entry.previous) / entry.previous : null,
        peakHour: peak ? peak[0] : null,
        customers: entry.customers.size,
      };
    })
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
}

export function getItemPerformance(merchantId: string, now = Date.now()): ItemPerformance[] {
  return computeItemPerformance(getItemSales(merchantId), now);
}

export interface HourBucket {
  hour: string;
  quantity: number;
}

/** Units sold by hour of day, for the "when are we busy" chart. */
export function computeHourlyPattern(sales: ItemSale[]): HourBucket[] {
  const counts = new Map<string, number>();
  for (const sale of sales) {
    const hour = HOURS[new Date(sale.createdAt).getHours()];
    counts.set(hour, (counts.get(hour) ?? 0) + sale.quantity);
  }
  // Only the trading hours that actually saw sales, in clock order.
  return HOURS
    .map(hour => ({ hour, quantity: counts.get(hour) ?? 0 }))
    .filter(bucket => bucket.quantity > 0);
}

export function getHourlyPattern(merchantId: string): HourBucket[] {
  return computeHourlyPattern(getItemSales(merchantId));
}

/** Items on the menu that have never sold — the ones worth reconsidering. */
export function computeSlowMovers(menu: MenuItem[], sales: ItemSale[]): MenuItem[] {
  const sold = new Set(sales.map(sale => sale.itemId));
  return menu.filter(item => !sold.has(item.id));
}

export function getSlowMovers(merchantId: string): MenuItem[] {
  return computeSlowMovers(getMenu(merchantId), getItemSales(merchantId));
}

export function clearAllMenusAndSales(): void {
  run('DELETE FROM item_sales');
  run('DELETE FROM merchant_items');
  notifyMenu();
}

// ─── Demo trade ──────────────────────────────────────────────────────────────

/**
 * Give the demo stalls a menu and a fortnight of trade, so a merchant signing
 * in to a fresh database sees a working dashboard rather than an empty one.
 *
 * Every seeded sale is written as both an item line and a payment. Seeding one
 * without the other would leave a stall's takings disagreeing with its own menu
 * report — the split-truth problem this codebase avoids everywhere else.
 */
export function seedMerchantTradeIfEmpty(): void {
  const existing = queryOne('SELECT COUNT(*) AS n FROM merchant_items');
  if (existing && Number(existing.n) > 0) return;

  const daysAgo = (days: number) => Date.now() - days * 24 * 60 * 60 * 1000;
  const label = (days: number) =>
    days === 0 ? 'Just now' : days === 1 ? 'Yesterday' : `${days} days ago`;

  const STALLS: Record<string, {
    merchantName: string;
    items: { name: string; price: number; category: string; everyNDays: number; hours: number[] }[];
  }> = {
    kopi: {
      merchantName: 'Kopitiam',
      items: [
        { name: 'Nasi Lemak',       price: 3.50, category: 'Mains',  everyNDays: 1, hours: [7, 8, 8] },
        { name: 'Chicken Rice',     price: 4.50, category: 'Mains',  everyNDays: 2, hours: [12, 13] },
        { name: 'Mee Goreng',       price: 4.00, category: 'Mains',  everyNDays: 3, hours: [12] },
        { name: 'Kopi O',           price: 1.40, category: 'Drinks', everyNDays: 1, hours: [7, 15] },
        { name: 'Teh Tarik',        price: 1.60, category: 'Drinks', everyNDays: 2, hours: [8] },
        { name: 'Roti Prata (2pc)', price: 2.40, category: 'Mains',  everyNDays: 3, hours: [8] },
        // Never sold, so the "not selling" panel has something true to say.
        { name: 'Milo Dinosaur',    price: 3.20, category: 'Drinks', everyNDays: 0, hours: [] },
      ],
    },
    bubble: {
      merchantName: 'Bubble Tea Bar',
      items: [
        { name: 'Brown Sugar Milk Tea', price: 5.40, category: 'Drinks',   everyNDays: 1, hours: [15, 19] },
        { name: 'Classic Milk Tea',     price: 4.20, category: 'Drinks',   everyNDays: 2, hours: [16] },
        { name: 'Matcha Latte',         price: 5.80, category: 'Drinks',   everyNDays: 3, hours: [16] },
        { name: 'Egg Waffle',           price: 4.80, category: 'Desserts', everyNDays: 4, hours: [20] },
      ],
    },
  };

  // Attributed to Sarah and Mike, so Alex's own curated demo history on the
  // customer side stays exactly as the presentation script expects it.
  const BUYERS = ['2', '3'];
  let seq = 0;
  const payments: Parameters<typeof addTransactions>[0] = [];

  for (const [merchantId, stall] of Object.entries(STALLS)) {
    for (const item of stall.items) {
      run(
        'INSERT INTO merchant_items (merchant_id, name, price, category, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        [merchantId, item.name, item.price, item.category, daysAgo(30)],
      );
      const itemId = lastInsertId();
      if (item.everyNDays === 0) continue;

      for (let day = 13; day >= 0; day--) {
        if (day % item.everyNDays !== 0) continue;
        // Slightly busier in the most recent week, which is what the
        // week-on-week trend on each dish compares against.
        const timesToday = day < 7 ? item.hours.length : Math.max(1, item.hours.length - 1);

        for (let n = 0; n < timesToday; n++) {
          const when = new Date(daysAgo(day));
          when.setHours(item.hours[n % item.hours.length], (n * 17) % 60, 0, 0);
          seq += 1;

          const paymentId = `DEMO-ITEM-${seq}`;
          const buyer = BUYERS[seq % BUYERS.length];

          run(
            `INSERT OR IGNORE INTO item_sales
              (payment_id, merchant_id, item_id, name, unit_price, quantity, user_id, created_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
            [paymentId, merchantId, itemId, item.name, item.price, buyer, when.getTime()],
          );

          payments.push({
            userId: buyer,
            name: stall.merchantName,
            amount: -item.price,
            date: label(day),
            category: 'Food & Dining',
            kind: 'purchase' as const,
            paymentId,
            createdAt: when.getTime(),
          });
        }
      }
    }
  }

  addTransactions(payments);
  notifyMenu();
  window.dispatchEvent(new CustomEvent('itemSalesUpdated'));
}
