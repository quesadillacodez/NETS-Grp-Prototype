import { query, queryOne, run } from './db';
import { getMerchantByName, type Merchant } from './merchantStorage';
import { calculateTransactionXP } from './rewardStorage';

export interface MerchantSale {
  id: number;
  merchantId: string;
  userId: string;
  itemName: string;
  amount: number;
  quantity: number;
  paymentId?: string;
  createdAt: number;
  xpEarned: number;
  source: 'payment' | 'demo';
}

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
  sales: MerchantSale[];
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
  hasDemoData: boolean;
  recommendations: string[];
}

function rowToSale(row: Record<string, any>): MerchantSale {
  return {
    id: Number(row.id),
    merchantId: String(row.merchant_id),
    userId: String(row.user_id),
    itemName: String(row.item_name),
    amount: Number(row.amount),
    quantity: Number(row.quantity),
    paymentId: row.payment_id == null ? undefined : String(row.payment_id),
    createdAt: Number(row.created_at),
    xpEarned: Number(row.xp_earned),
    source: row.source === 'demo' ? 'demo' : 'payment',
  };
}

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
  const itemName = input.itemName?.trim() || merchant.reference?.trim() || 'General purchase';
  const { xp } = calculateTransactionXP(merchant.name, -Math.abs(input.amount));
  run(
    `INSERT OR IGNORE INTO merchant_sales
       (merchant_id, user_id, item_name, amount, quantity, payment_id, created_at, xp_earned, source)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'payment')`,
    [merchant.id, input.userId, itemName, input.amount, input.paymentId ?? null, input.createdAt ?? Date.now(), xp],
  );
  window.dispatchEvent(new CustomEvent('merchantSalesUpdated'));
}

/**
 * Gives the new merchant account enough history to demonstrate trend analysis.
 * Rows are explicitly tagged as demo data and are replaced naturally by real
 * NETS payments recorded through `recordMerchantSale`.
 */
export function seedMerchantSalesIfEmpty(): void {
  const existing = queryOne("SELECT COUNT(*) AS n FROM merchant_sales WHERE merchant_id = 'kopi'");
  if (existing && Number(existing.n) > 0) return;

  const products = [
    ['Nasi Lemak', 4.8], ['Nasi Lemak', 5.2], ['Nasi Lemak', 4.8],
    ['Kaya Toast Set', 3.5], ['Chicken Rice', 5.5], ['Kopi C', 1.8],
    ['Nasi Lemak', 4.8], ['Mee Rebus', 4.5], ['Kopi C', 1.8],
    ['Nasi Lemak', 5.2], ['Kaya Toast Set', 3.5], ['Chicken Rice', 5.5],
    ['Nasi Lemak', 4.8], ['Nasi Lemak', 5.2], ['Mee Rebus', 4.5],
    ['Kopi C', 1.8], ['Nasi Lemak', 4.8], ['Chicken Rice', 5.5],
    ['Kaya Toast Set', 3.5], ['Nasi Lemak', 5.2], ['Nasi Lemak', 4.8],
    ['Mee Rebus', 4.5], ['Kopi C', 1.8], ['Nasi Lemak', 4.8],
    ['Chicken Rice', 5.5], ['Nasi Lemak', 5.2], ['Kaya Toast Set', 3.5],
    ['Nasi Lemak', 4.8], ['Kopi C', 1.8], ['Nasi Lemak', 5.2],
  ] as const;
  const customerIds = ['1', '2', '1', '3', '2', '4', '1', '3', '2', '1'];
  const now = new Date();
  now.setMinutes(0, 0, 0);

  products.forEach(([itemName, amount], index) => {
    const daysAgo = 6 - (index % 7);
    const hour = index % 3 === 0 ? 8 : index % 3 === 1 ? 12 : 18;
    const createdAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, 15 + (index % 4) * 10).getTime();
    const xp = Math.round(amount * 20);
    run(
      `INSERT INTO merchant_sales
         (merchant_id, user_id, item_name, amount, quantity, payment_id, created_at, xp_earned, source)
       VALUES ('kopi', ?, ?, ?, 1, ?, ?, ?, 'demo')`,
      [customerIds[index % customerIds.length], itemName, amount, `demo-kopi-${index + 1}`, createdAt, xp],
    );
  });
}

export function getMerchantSales(merchantId: string): MerchantSale[] {
  return query(
    'SELECT * FROM merchant_sales WHERE merchant_id = ? ORDER BY created_at DESC',
    [merchantId],
  ).map(rowToSale);
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function makeRecommendations(
  merchant: Merchant,
  topProducts: ProductInsight[],
  dayparts: DaypartInsight[],
  repeatRate: number,
): string[] {
  const top = topProducts[0];
  const quietest = [...dayparts].sort((a, b) => a.orders - b.orders)[0];
  const suggestions: string[] = [];
  if (top) suggestions.push(`${top.name} drives ${Math.round(top.share * 100)}% of orders. Keep it visible and stocked during the rush.`);
  if (quietest) suggestions.push(`${quietest.label} is your quietest period. Test a time-limited ${merchant.xpBonus > 1 ? 'bonus-item' : '2x XP'} offer there.`);
  suggestions.push(repeatRate >= 40
    ? `${repeatRate.toFixed(0)}% of customers returned this week. A regulars-only bundle could deepen loyalty.`
    : 'Repeat visits have room to grow. Try a “buy twice this week” XP booster.');
  return suggestions;
}

export function getMerchantDashboard(merchant: Merchant): MerchantDashboardData {
  const sales = getMerchantSales(merchant.id);
  const grossSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const transactionCount = sales.length;
  const customers = new Map<string, number>();
  sales.forEach(sale => customers.set(sale.userId, (customers.get(sale.userId) ?? 0) + 1));
  const repeatCustomers = [...customers.values()].filter(count => count > 1).length;

  const productMap = new Map<string, { orders: number; revenue: number }>();
  for (const sale of sales) {
    const current = productMap.get(sale.itemName) ?? { orders: 0, revenue: 0 };
    current.orders += sale.quantity;
    current.revenue += sale.amount;
    productMap.set(sale.itemName, current);
  }
  const topProducts = [...productMap.entries()]
    .map(([name, value]) => ({ name, ...value, share: transactionCount ? value.orders / transactionCount : 0 }))
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);

  const today = startOfLocalDay(Date.now());
  const salesByDay: SalesDay[] = Array.from({ length: 7 }, (_, index) => {
    const timestamp = today - (6 - index) * 24 * 60 * 60 * 1000;
    const next = timestamp + 24 * 60 * 60 * 1000;
    const rows = sales.filter(sale => sale.createdAt >= timestamp && sale.createdAt < next);
    return {
      key: new Date(timestamp).toISOString().slice(0, 10),
      label: new Date(timestamp).toLocaleDateString('en-SG', { weekday: 'short' }),
      revenue: rows.reduce((sum, sale) => sum + sale.amount, 0),
      orders: rows.length,
    };
  });

  const definitions = [
    { label: 'Breakfast', from: 5, to: 11 },
    { label: 'Lunch', from: 11, to: 15 },
    { label: 'Dinner', from: 15, to: 22 },
  ];
  const dayparts = definitions.map(definition => {
    const rows = sales.filter(sale => {
      const hour = new Date(sale.createdAt).getHours();
      return hour >= definition.from && hour < definition.to;
    });
    return { label: definition.label, orders: rows.length, revenue: rows.reduce((sum, sale) => sum + sale.amount, 0) };
  });
  const uniqueCustomers = customers.size;
  const repeatRate = uniqueCustomers ? (repeatCustomers / uniqueCustomers) * 100 : 0;
  const voucherRow = queryOne(
    `SELECT COUNT(*) AS n FROM reward_redemptions
      WHERE lower(merchant) = lower(?) AND used = 1`,
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
    xpAwarded: sales.reduce((sum, sale) => sum + sale.xpEarned, 0),
    voucherRedemptions: Number(voucherRow?.n ?? 0),
    topProducts,
    salesByDay,
    dayparts,
    hasDemoData: sales.some(sale => sale.source === 'demo'),
    recommendations: makeRecommendations(merchant, topProducts, dayparts, repeatRate),
  };
}
