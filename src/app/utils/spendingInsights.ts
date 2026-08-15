import { query } from './db';
import { classifyTransaction, countsAsSpending, type TransactionType } from './transactionModel';

// ─── Category derivation ─────────────────────────────────────────────────────
// Real transactions store category as 'payment' / 'topup', so we derive a
// meaningful spending category from the merchant name via keywords.
export type SpendCategory =
  | 'Food & Dining' | 'Transport' | 'Shopping' | 'Groceries'
  | 'Healthcare' | 'Entertainment' | 'Bills & Utilities' | 'Other';

const CATEGORY_META: Record<SpendCategory, { color: string; emoji: string }> = {
  'Food & Dining':   { color: '#f59e0b', emoji: '🍔' },
  'Groceries':       { color: '#00a94f', emoji: '🛒' },
  'Transport':       { color: '#1565c0', emoji: '🚗' },
  'Shopping':        { color: '#8b5cf6', emoji: '🛍️' },
  'Healthcare':      { color: '#ec4899', emoji: '💊' },
  'Entertainment':   { color: '#d32f2f', emoji: '🎬' },
  'Bills & Utilities': { color: '#38bdf8', emoji: '⚡' },
  'Other':           { color: '#94a3b8', emoji: '💳' },
};

const KEYWORDS: [SpendCategory, string[]][] = [
  ['Groceries', ['fairprice', 'ntuc', 'giant', 'cold storage', 'sheng siong', 'grocery', 'supermarket']],
  ['Food & Dining', ['starbucks', 'kopitiam', 'hawker', 'breadtalk', 'din tai fung', 'mcdonald', 'kfc', 'restaurant', 'cafe', 'coffee', 'food', 'bev eat', 'chan', 'bakery', 'eatery', 'toast', 'bubble tea', 'boba', 'milk tea', 'liho', 'gong cha', 'chagee']],
  ['Transport', ['grab', 'gojek', 'taxi', 'mrt', 'bus', 'transit', 'comfort', 'shell', 'esso', 'petrol', 'fuel', 'ez-link', 'ezlink']],
  ['Healthcare', ['guardian', 'pharmacy', 'clinic', 'hospital', 'watsons', 'unity', 'health', 'dental', 'cvs']],
  ['Entertainment', ['netflix', 'spotify', 'disney', 'cinema', 'gv', 'cathay', 'ktv', 'game', 'steam', 'movie']],
  ['Bills & Utilities', ['bill', 'sp group', 'electric', 'water', 'singtel', 'starhub', 'm1', 'utility', 'insurance', 'town council']],
  ['Shopping', ['amazon', 'lazada', 'shopee', 'uniqlo', 'zara', 'shop', 'mall', 'store', 'watsons', 'challenger']],
];

const SPEND_CATEGORIES = Object.keys(CATEGORY_META) as SpendCategory[];

export function isSpendCategory(value: string): value is SpendCategory {
  return (SPEND_CATEGORIES as string[]).includes(value);
}

export function categorizeMerchant(name: string): SpendCategory {
  const n = name.toLowerCase();
  for (const [cat, kws] of KEYWORDS) {
    if (kws.some((k) => n.includes(k))) return cat;
  }
  return 'Other';
}

// Payments made through the app (split bills, Hangout outings, QR pays) write a
// real spending category onto the transaction, so trust that over guessing from
// the merchant name. Seeded/legacy rows store 'payment' or 'topup' instead and
// still fall back to keyword matching.
export function resolveSpendCategory(name: string, storedCategory?: string): SpendCategory {
  if (storedCategory && isSpendCategory(storedCategory)) return storedCategory;
  return categorizeMerchant(name);
}

export function categoryColor(cat: SpendCategory): string { return CATEGORY_META[cat].color; }
export function categoryEmoji(cat: SpendCategory): string { return CATEGORY_META[cat].emoji; }

// ─── Raw spend rows for a user ───────────────────────────────────────────────
interface SpendRow { name: string; amount: number; ts: number; kind: TransactionType; category: SpendCategory; }

function getSpendRows(userId: string): SpendRow[] {
  const rows = query(
    'SELECT name, amount, created_at, date, category, status, kind FROM transactions WHERE user_id = ?',
    [userId]
  );
  return rows.map((r) => ({
    name: String(r.name),
    amount: Number(r.amount),
    ts: r.created_at != null ? Number(r.created_at) : Date.parse(String(r.date)) || Date.now(),
    kind: classifyTransaction(r),
    category: resolveSpendCategory(String(r.name), r.category == null ? undefined : String(r.category)),
  }));
}

// Anything leaving the wallet counts as spending: merchant purchases plus the
// outgoing side of a split-bill settlement, which is the user's own share.
function isSpend(row: SpendRow): boolean {
  return countsAsSpending(row);
}

function inMonth(ts: number, year: number, month: number): boolean {
  const d = new Date(ts);
  return d.getFullYear() === year && d.getMonth() === month;
}

// ─── Category breakdown (this month) ─────────────────────────────────────────
export interface CategorySlice { name: SpendCategory; amount: number; value: number; color: string; emoji: string; }

export function getCategoryBreakdown(userId: string, year: number, month: number): CategorySlice[] {
  const rows = getSpendRows(userId).filter((r) => isSpend(r) && inMonth(r.ts, year, month));
  const totals: Record<string, number> = {};
  rows.forEach((r) => {
    totals[r.category] = (totals[r.category] || 0) + Math.abs(r.amount);
  });
  const grand = Object.values(totals).reduce((s, v) => s + v, 0) || 1;
  return (Object.entries(totals) as [SpendCategory, number][])
    .map(([name, amount]) => ({
      name, amount: +amount.toFixed(2),
      value: Math.round((amount / grand) * 100),
      color: categoryColor(name), emoji: categoryEmoji(name),
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ─── Monthly spending / income trend (last 6 months) ─────────────────────────
export interface TrendPoint { month: string; spending: number; income: number; }

export function getSpendingTrend(userId: string, months = 6): TrendPoint[] {
  const rows = getSpendRows(userId);
  const now = new Date();
  const out: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    let spending = 0, income = 0;
    rows.forEach((r) => {
      if (inMonth(r.ts, y, m)) {
        if (isSpend(r)) spending += Math.abs(r.amount);
        else if (r.amount > 0) income += r.amount;
      }
    });
    out.push({ month: d.toLocaleString('en-US', { month: 'short' }), spending: +spending.toFixed(2), income: +income.toFixed(2) });
  }
  return out;
}

// ─── Summary stats (this month vs last) ──────────────────────────────────────
export interface SpendSummary {
  spentThisMonth: number; spentLastMonth: number; moneyInThisMonth: number;
  netCashFlow: number; topCategory: CategorySlice | null;
  txnCount: number;
  /** Money in, split by where it came from — none of it is salary income. */
  topUpsThisMonth: number; cashbackThisMonth: number; repaymentsThisMonth: number;
}

export function getSpendSummary(userId: string, year: number, month: number): SpendSummary {
  const rows = getSpendRows(userId);
  const prev = new Date(year, month - 1, 1);
  let spent = 0, moneyIn = 0, txnCount = 0, spentPrev = 0;
  let topUps = 0, cashback = 0, repayments = 0;
  rows.forEach((r) => {
    if (inMonth(r.ts, year, month)) {
      if (isSpend(r)) { spent += Math.abs(r.amount); txnCount++; }
      else if (r.amount > 0) {
        moneyIn += r.amount;
        if (r.kind === 'topup') topUps += r.amount;
        else if (r.kind === 'cashback') cashback += r.amount;
        else if (r.kind === 'repayment_received') repayments += r.amount;
      }
    } else if (inMonth(r.ts, prev.getFullYear(), prev.getMonth())) {
      if (isSpend(r)) spentPrev += Math.abs(r.amount);
    }
  });
  const cats = getCategoryBreakdown(userId, year, month);
  return {
    spentThisMonth: +spent.toFixed(2), spentLastMonth: +spentPrev.toFixed(2),
    moneyInThisMonth: +moneyIn.toFixed(2), netCashFlow: +(moneyIn - spent).toFixed(2),
    topCategory: cats[0] ?? null, txnCount,
    topUpsThisMonth: +topUps.toFixed(2), cashbackThisMonth: +cashback.toFixed(2),
    repaymentsThisMonth: +repayments.toFixed(2),
  };
}

// ─── Financial Health Score (0–100) ──────────────────────────────────────────
// Transparent, rule-based — no black box. Combines savings rate, spending
// stability month-over-month, budget adherence, and spending diversification.
export interface HealthScore { score: number; grade: string; label: string; factors: { label: string; points: number; max: number }[]; }

export function getHealthScore(userId: string, year: number, month: number): HealthScore {
  const s = getSpendSummary(userId, year, month);
  const cats = getCategoryBreakdown(userId, year, month);

  if (s.txnCount === 0) {
    return {
      score: 50,
      grade: 'Building',
      label: 'Make a payment to complete your score',
      factors: [
        { label: 'Budget adherence', points: 20, max: 40 },
        { label: 'Spending control', points: 15, max: 35 },
        { label: 'Diversification', points: 15, max: 25 },
      ],
    };
  }

  // Factor 1 — budget adherence. No configured budget receives neutral points.
  const budgetRows = query('SELECT monthly_limit FROM budgets WHERE user_id = ?', [userId]);
  const totalBudget = budgetRows.reduce((sum, row) => sum + Number(row.monthly_limit || 0), 0);
  const budgetRatio = totalBudget > 0 ? s.spentThisMonth / totalBudget : null;
  const budgetPts = budgetRatio == null
    ? 20
    : Math.max(0, Math.min(40, Math.round(40 - Math.max(0, budgetRatio - 0.8) * 100)));

  // Factor 2 — spending control versus last month (up to 35 pts).
  // down = full; big increase = fewer points.
  let controlPts = 22;
  if (s.spentLastMonth > 0) {
    const change = (s.spentThisMonth - s.spentLastMonth) / s.spentLastMonth;
    controlPts = Math.max(0, Math.min(35, Math.round(35 - Math.max(0, change) * 70)));
  }

  // Factor 3 — diversification (up to 25 pts).
  let diversePts = 15;
  if (cats.length > 0) {
    const topShare = cats[0].value; // percent
    diversePts = Math.max(0, Math.min(25, Math.round(25 - Math.max(0, topShare - 50) * 0.5)));
  }

  const score = Math.max(0, Math.min(100, budgetPts + controlPts + diversePts));
  let grade = 'Needs work', label = 'Room to improve';
  if (score >= 80) { grade = 'Excellent'; label = 'Great financial health'; }
  else if (score >= 65) { grade = 'Good'; label = 'Solid, with room to grow'; }
  else if (score >= 45) { grade = 'Fair'; label = 'On the right track'; }

  return {
    score, grade, label,
    factors: [
      { label: 'Budget adherence', points: budgetPts, max: 40 },
      { label: 'Spending control', points: controlPts, max: 35 },
      { label: 'Diversification', points: diversePts, max: 25 },
    ],
  };
}

// ─── Transparent smart insights (rule-based, from real data) ────────────────
export interface Insight { type: 'warning' | 'success' | 'tip'; title: string; body: string; }

export function getInsights(userId: string, year: number, month: number): Insight[] {
  const s = getSpendSummary(userId, year, month);
  const cats = getCategoryBreakdown(userId, year, month);
  const out: Insight[] = [];

  // Overspending vs last month
  if (s.spentLastMonth > 0) {
    const change = ((s.spentThisMonth - s.spentLastMonth) / s.spentLastMonth) * 100;
    if (change > 15) {
      out.push({ type: 'warning', title: `Spending up ${Math.round(change)}%`,
        body: `You've spent $${s.spentThisMonth.toFixed(0)} this month — $${(s.spentThisMonth - s.spentLastMonth).toFixed(0)} more than last month. Worth reviewing where it went.` });
    } else if (change < -10) {
      out.push({ type: 'success', title: `Spending down ${Math.abs(Math.round(change))}%`,
        body: `Nice — you spent $${Math.abs(s.spentThisMonth - s.spentLastMonth).toFixed(0)} less than last month. Keep it up.` });
    }
  }

  // Top category concentration
  if (cats.length > 0 && cats[0].value >= 40) {
    out.push({ type: 'warning', title: `${cats[0].name} is ${cats[0].value}% of spend`,
      body: `${cats[0].emoji} ${cats[0].name} took $${cats[0].amount.toFixed(0)} this month. Spreading spend out a bit lowers risk if that category spikes.` });
  }

  if (s.netCashFlow > 0) {
    out.push({ type: 'success', title: `Wallet up $${s.netCashFlow.toFixed(0)}`,
      body: 'Money into your NETS wallet exceeded merchant spending this month. Top-ups, repayments and cashback are cash flow, not salary income.' });
  }

  // Fallback tip
  if (out.length === 0) {
    out.push({ type: 'tip', title: 'Building your picture',
      body: 'Make a few more payments and top-ups and your dashboard will surface personalised insights based on your real spending.' });
  }
  return out;
}
