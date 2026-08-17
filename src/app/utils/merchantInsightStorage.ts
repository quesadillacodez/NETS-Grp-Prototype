// ─── The stall's own dashboard ───────────────────────────────────────────────
// Gross sales, the seven-day trend, dayparts and the suggestions that come out
// of them.
//
// This used to keep its own `merchant_sales` table, written alongside the
// transaction ledger. Two records of the same sale is one record too many —
// they drift, and then the takings disagree with the menu report. Everything
// here now reads `item_sales`, the single line-level record of what was sold,
// which `menuStorage` also reads for the per-dish view.

import { queryOne } from './db';
import { getItemSales, recordItemSale, type ItemSale } from './menuStorage';
import { getMerchantByName, type Merchant } from './merchantStorage';
import { calculateTransactionXP } from './rewardStorage';

export interface ProductInsight {
  name: string;
  orders: number;
  revenue: number;
  share: number;
}

export interface SalesDay {
  key: string;
  label: string;
  revenue: number;
  orders: number;
}

export interface DaypartInsight {
  label: string;
  orders: number;
  revenue: number;
}

export interface MerchantDashboardData {
  sales: ItemSale[];
  grossSales: number;
  transactionCount: number;
  averageTicket: number;
  uniqueCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  xpAwarded: number;
  voucherRedemptions: number;
  topProducts: ProductInsight[];
  salesByDay: SalesDay[];
  dayparts: DaypartInsight[];
  recommendations: string[];
}

/**
 * Record a payment as a line of trade.
 *
 * Called for every NETS payment at a configured merchant. Where the customer
 * picked something off the stall's menu, that item is already recorded by the
 * pay screen; this covers the rest, so a merchant without a menu still sees
 * their takings rather than an empty dashboard.
 */
export function recordMerchantSale(input: {
  merchantName: string;
  itemName?: string;
  amount: number;
  userId: string;
  paymentId?: string;
  createdAt?: number;
}): void {
  const merchant = getMerchantByName(input.merchantName);
  if (!merchant || input.amount <= 0) return;

  const name = input.itemName?.trim() || merchant.reference?.trim() || 'General purchase';
  recordItemSale({
    // Without a payment id there is nothing to make the write idempotent, so
    // fall back to a per-sale key rather than silently allowing duplicates.
    paymentId: input.paymentId ?? `sale-${merchant.id}-${input.createdAt ?? Date.now()}`,
    merchantId: merchant.id,
    // Item id 0 means "not a menu item" — the sale is still counted and named,
    // it simply is not tied to a row the merchant can edit.
    item: { id: 0, name, price: input.amount },
    userId: input.userId,
    createdAt: input.createdAt,
  });
}

const DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const DAYPARTS = [
  { label: 'Breakfast', from: 5, to: 11 },
  { label: 'Lunch', from: 11, to: 15 },
  { label: 'Dinner', from: 15, to: 22 },
];

export function computeDayparts(sales: ItemSale[]): DaypartInsight[] {
  return DAYPARTS.map(part => {
    const rows = sales.filter(sale => {
      const hour = new Date(sale.createdAt).getHours();
      return hour >= part.from && hour < part.to;
    });
    return {
      label: part.label,
      orders: rows.reduce((sum, sale) => sum + sale.quantity, 0),
      revenue: rows.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0),
    };
  });
}

export function computeSalesByDay(sales: ItemSale[], now = Date.now()): SalesDay[] {
  const today = startOfLocalDay(now);
  return Array.from({ length: 7 }, (_, index) => {
    const from = today - (6 - index) * DAY;
    const to = from + DAY;
    const rows = sales.filter(sale => sale.createdAt >= from && sale.createdAt < to);
    return {
      key: new Date(from).toISOString().slice(0, 10),
      label: new Date(from).toLocaleDateString('en-SG', { weekday: 'short' }),
      revenue: rows.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0),
      orders: rows.reduce((sum, sale) => sum + sale.quantity, 0),
    };
  });
}

/**
 * What the stall should do about what it just read. Each line is tied to a
 * figure on the same screen, so a merchant can check the advice against the
 * evidence rather than taking it on faith.
 */
export function makeRecommendations(
  merchant: Pick<Merchant, 'xpBonus'>,
  topProducts: ProductInsight[],
  dayparts: DaypartInsight[],
  repeatRate: number,
): string[] {
  const suggestions: string[] = [];
  const top = topProducts[0];
  const quietest = [...dayparts].filter(part => part.orders > 0).sort((a, b) => a.orders - b.orders)[0];

  if (top) {
    suggestions.push(
      `${top.name} drives ${Math.round(top.share * 100)}% of your orders. Keep it visible and stocked through the rush.`,
    );
  }
  if (quietest) {
    suggestions.push(
      `${quietest.label} is your quietest period. A time-limited ${merchant.xpBonus > 1 ? 'bonus-item' : '2x XP'} offer would fill it.`,
    );
  }
  suggestions.push(repeatRate >= 40
    ? `${repeatRate.toFixed(0)}% of your customers came back. A regulars-only bundle would deepen that.`
    : 'Repeat visits have room to grow. Try a "buy twice this week" XP booster.');

  return suggestions;
}

export function getMerchantDashboard(merchant: Merchant, now = Date.now()): MerchantDashboardData {
  const sales = getItemSales(merchant.id);

  const grossSales = sales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
  const transactionCount = sales.reduce((sum, sale) => sum + sale.quantity, 0);

  const customers = new Map<string, number>();
  for (const sale of sales) {
    if (sale.userId) customers.set(sale.userId, (customers.get(sale.userId) ?? 0) + 1);
  }
  const uniqueCustomers = customers.size;
  const repeatCustomers = [...customers.values()].filter(count => count > 1).length;
  const repeatRate = uniqueCustomers ? (repeatCustomers / uniqueCustomers) * 100 : 0;

  const productMap = new Map<string, { orders: number; revenue: number }>();
  for (const sale of sales) {
    const current = productMap.get(sale.name) ?? { orders: 0, revenue: 0 };
    current.orders += sale.quantity;
    current.revenue += sale.quantity * sale.unitPrice;
    productMap.set(sale.name, current);
  }
  const topProducts = [...productMap.entries()]
    .map(([name, value]) => ({
      name, ...value, share: transactionCount ? value.orders / transactionCount : 0,
    }))
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);

  const dayparts = computeDayparts(sales);

  // XP is derived from the sale rather than stored: the customer's XP already
  // lives in the transaction ledger, and a second copy could disagree with it.
  const xpAwarded = sales.reduce(
    (sum, sale) => sum + calculateTransactionXP(merchant.name, -(sale.unitPrice * sale.quantity)).xp,
    0,
  );

  const voucherRow = queryOne(
    'SELECT COUNT(*) AS n FROM reward_redemptions WHERE lower(merchant) = lower(?) AND used = 1',
    [merchant.name],
  );

  return {
    sales,
    grossSales,
    transactionCount,
    averageTicket: transactionCount ? grossSales / transactionCount : 0,
    uniqueCustomers,
    repeatCustomers,
    repeatRate,
    xpAwarded,
    voucherRedemptions: Number(voucherRow?.n ?? 0),
    topProducts,
    salesByDay: computeSalesByDay(sales, now),
    dayparts,
    recommendations: makeRecommendations(merchant, topProducts, dayparts, repeatRate),
  };
}
