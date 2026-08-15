import { query } from './db';

// ─── Types (mirror the original Wrapped feature) ─────────────────────────────
export interface WrappedTxn {
  id: string;
  merchant: string;
  category: string;
  amount: number;   // negative = spending, positive = income/top-up
  date: Date;       // real Date from created_at
  time: string;
  icon: string;
}

// ─── Read the current user's transactions as Wrapped transactions ────────────
// Maps the app's `transactions` table into the shape the Wrapped stat functions
// expect. Uses the real `created_at` timestamp so month filtering works.
export function getWrappedTransactions(userId: string): WrappedTxn[] {
  const rows = query(
    `SELECT id, name, amount, category, created_at, date
       FROM transactions
      WHERE user_id = ? AND amount < 0
        AND (kind = 'purchase' OR (kind IS NULL AND (status IS NULL OR status != 'sent')))
      ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => {
    const ts = r.created_at != null ? Number(r.created_at) : Date.parse(String(r.date)) || Date.now();
    const d = new Date(ts);
    return {
      id: String(r.id),
      merchant: String(r.name),
      category: String(r.category || 'Other'),
      amount: Number(r.amount),
      date: d,
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      icon: 'shopping-bag',
    };
  });
}

function filterByMonth(txns: WrappedTxn[], year: number, month: number): WrappedTxn[] {
  return txns.filter((t) => t.date.getFullYear() === year && t.date.getMonth() === month);
}

// ─── Spending by category ────────────────────────────────────────────────────
export function calculateSpendingByCategory(year: number, month: number, txns: WrappedTxn[]) {
  const totals: Record<string, number> = {};
  filterByMonth(txns, year, month).forEach((t) => {
    if (t.amount < 0) {
      totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
    }
  });
  return Object.entries(totals)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

// ─── Financial personality ───────────────────────────────────────────────────
export function getFinancialPersonality(year: number, month: number, txns: WrappedTxn[]) {
  const filtered = filterByMonth(txns, year, month);
  const coffeeCount = filtered.filter((t) => /coffee/i.test(t.category)).length;
  const nightPurchases = filtered.filter((t) => t.amount < 0 && t.date.getHours() >= 22).length;
  const foodSpending = filtered
    .filter((t) => /food|coffee|dining/i.test(t.category))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const spending = filtered.filter((t) => t.amount < 0);
  const avgTxn = spending.length ? spending.reduce((s, t) => s + Math.abs(t.amount), 0) / spending.length : 0;

  if (coffeeCount >= 5) return { title: 'Coffee Connoisseur ☕', description: "You've mastered the daily caffeine ritual", color: 'from-[#fb923c] to-[#f97316]' };
  if (foodSpending > 150) return { title: 'Snack Spender 🍕', description: "Life's too short for boring meals", color: 'from-[#f43f5e] to-[#dc2626]' };
  if (nightPurchases >= 3) return { title: 'Night Owl Shopper 🦉', description: 'The best deals happen after dark', color: 'from-[#a855f7] to-[#ec4899]' };
  if (avgTxn > 0 && avgTxn < 20) return { title: 'Smart Spender 💡', description: 'Small purchases, big savings', color: 'from-[#0040ff] to-[#0028a8]' };
  return { title: 'Balanced Buyer ⚖️', description: "You've found the perfect spending rhythm", color: 'from-[#0040ff] to-[#0028a8]' };
}

// ─── Core wrapped stats ──────────────────────────────────────────────────────
export function getWrappedStats(year: number, month: number, txns: WrappedTxn[]) {
  const spending = filterByMonth(txns, year, month).filter((t) => t.amount < 0);
  if (spending.length === 0) {
    return {
      totalSpent: 0, totalTransactions: 0, biggestPurchase: null,
      topMerchant: { name: 'None', count: 0 },
      mostPaidPerson: { name: 'None', amount: 0 },
      avgPerDay: 0,
    };
  }
  const totalSpent = spending.reduce((s, t) => s + Math.abs(t.amount), 0);
  const biggestPurchase = spending.reduce((max, t) => (Math.abs(t.amount) > Math.abs(max.amount) ? t : max), spending[0]);

  const counts: Record<string, number> = {};
  const totals: Record<string, number> = {};
  spending.forEach((t) => {
    counts[t.merchant] = (counts[t.merchant] || 0) + 1;
    totals[t.merchant] = (totals[t.merchant] || 0) + Math.abs(t.amount);
  });
  const topMerchant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const mostPaid = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return {
    totalSpent,
    totalTransactions: spending.length,
    biggestPurchase,
    topMerchant: { name: topMerchant[0], count: topMerchant[1] },
    mostPaidPerson: { name: mostPaid[0], amount: mostPaid[1] },
    avgPerDay: totalSpent / daysInMonth,
  };
}

// ─── Top merchants by visit count ─────────────────────────────────────────────
export function getTopMerchants(year: number, month: number, txns: WrappedTxn[], limit = 3) {
  const spending = filterByMonth(txns, year, month).filter((t) => t.amount < 0);
  const counts: Record<string, number> = {};
  const totals: Record<string, number> = {};
  spending.forEach((t) => {
    counts[t.merchant] = (counts[t.merchant] || 0) + 1;
    totals[t.merchant] = (totals[t.merchant] || 0) + Math.abs(t.amount);
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count, total: parseFloat((totals[name] || 0).toFixed(2)) }));
}

// ─── Fun spending equivalence ─────────────────────────────────────────────────
// Converts the month's total spend into a relatable Singapore-context count,
// picking whichever item lands in a readable range instead of always using
// the same one (nobody wants "0.3 movie tickets" or "8,000 kopis").
const EQUIVALENTS = [
  { emoji: '☕', label: 'kopis', price: 1.5 },
  { emoji: '🧋', label: 'bubble teas', price: 5.5 },
  { emoji: '🍜', label: 'hawker meals', price: 5 },
  { emoji: '🎬', label: 'movie tickets', price: 14 },
  { emoji: '🚗', label: 'Grab rides', price: 12 },
] as const;

export function getFunEquivalent(totalSpent: number) {
  if (totalSpent <= 0) return null;
  const inRange = EQUIVALENTS
    .map((e) => ({ ...e, count: totalSpent / e.price }))
    .filter((e) => e.count >= 3 && e.count <= 60);
  const picked = inRange[0] ?? { ...EQUIVALENTS[0], count: totalSpent / EQUIVALENTS[0].price };
  return { emoji: picked.emoji, label: picked.label, count: Math.round(picked.count) };
}

// ─── Busiest day of the week ──────────────────────────────────────────────────
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getBusiestDay(year: number, month: number, txns: WrappedTxn[]) {
  const spending = filterByMonth(txns, year, month).filter((t) => t.amount < 0);
  if (spending.length === 0) return null;
  const byDay: Record<number, { amount: number; count: number }> = {};
  spending.forEach((t) => {
    const day = t.date.getDay();
    if (!byDay[day]) byDay[day] = { amount: 0, count: 0 };
    byDay[day].amount += Math.abs(t.amount);
    byDay[day].count += 1;
  });
  const [dayIndex, stats] = Object.entries(byDay)
    .map(([d, s]) => [Number(d), s] as const)
    .sort((a, b) => b[1].amount - a[1].amount)[0];
  return { name: DAY_NAMES[dayIndex], amount: parseFloat(stats.amount.toFixed(2)), count: stats.count };
}

export function getSpendingComparison(year: number, month: number, txns: WrappedTxn[]) {
  const cur = getWrappedStats(year, month, txns);
  const prevDate = new Date(year, month - 1, 1);
  const prev = getWrappedStats(prevDate.getFullYear(), prevDate.getMonth(), txns);

  const spentDiff = cur.totalSpent - prev.totalSpent;
  const spentPct = prev.totalSpent > 0 ? (spentDiff / prev.totalSpent) * 100 : 0;
  const txnDiff = cur.totalTransactions - prev.totalTransactions;

  const selectedMonth = new Date(year, month, 1).getTime();
  const historicalMonths = getAvailableMonths(txns)
    .filter(item => new Date(item.year, item.month, 1).getTime() < selectedMonth)
    .map(item => getWrappedStats(item.year, item.month, txns))
    .filter(stats => stats.totalTransactions > 0)
    .slice(0, 3);
  const personalAverage = historicalMonths.length
    ? {
        spending: historicalMonths.reduce((sum, stats) => sum + stats.totalSpent, 0) / historicalMonths.length,
        transactions: historicalMonths.reduce((sum, stats) => sum + stats.totalTransactions, 0) / historicalMonths.length,
      }
    : null;
  const personalDiff = personalAverage ? cur.totalSpent - personalAverage.spending : 0;
  const personalPct = personalAverage && personalAverage.spending > 0
    ? (personalDiff / personalAverage.spending) * 100
    : 0;

  return {
    lastMonthTotal: prev.totalSpent,
    vsLastMonth: { amount: spentDiff, percent: spentPct },
    vsLastMonthTxn: txnDiff,
    personalAverage,
    vsPersonalAverage: { amount: personalDiff, percent: personalPct },
  };
}

export function getAvailableMonths(txns: WrappedTxn[]) {
  const set = new Set<string>();
  txns.forEach((t) => set.add(`${t.date.getFullYear()}-${t.date.getMonth()}`));
  const months = Array.from(set)
    .map((k) => { const [y, m] = k.split('-').map(Number); return { year: y, month: m }; })
    .sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
  // Always give at least the current month so the UI has something to show.
  if (months.length === 0) {
    const now = new Date();
    return [{ year: now.getFullYear(), month: now.getMonth() }];
  }
  return months;
}

// ─── Split-bill / reminder stats (from the reminders table) ──────────────────
// Maps the app's reminders into the three "who owes / slowest / most reminders"
// slides. In this app, when money is owed TO you, YOU are `from_user_id` and the
// person who owes you is `to_user_id` / `to_user_name` (matches
// getRemindersToReceive, which queries WHERE from_user_id = you).
export function getSplitBillStats(userId: string, year: number, month: number) {
  const rows = query(
    `SELECT to_user_name AS name, status, amount, reminder_count,
            created_date, paid_date
       FROM reminders
      WHERE from_user_id = ?`,
    [userId]
  );

  const inMonth = rows.filter((r) => {
    const src = r.created_date ? String(r.created_date) : null;
    if (!src) return true; // no date → include rather than drop
    const d = new Date(src);
    if (isNaN(d.getTime())) return true;
    return d.getFullYear() === year && d.getMonth() === month;
  });

  if (inMonth.length === 0) return null;

  // Biggest debtor — most still-pending money owed to the viewer. If everything
  // is settled, fall back to who owed the most this month (so the slide still
  // has a story to tell instead of disappearing).
  const owedPending: Record<string, number> = {};
  const owedAll: Record<string, number> = {};
  inMonth.forEach((r) => {
    const name = String(r.name || 'Someone');
    owedAll[name] = (owedAll[name] || 0) + Number(r.amount || 0);
    if (r.status === 'pending' || r.status === 'overdue') {
      owedPending[name] = (owedPending[name] || 0) + Number(r.amount || 0);
    }
  });
  const hasPending = Object.keys(owedPending).length > 0;
  const biggestDebtorEntry = Object.entries(hasPending ? owedPending : owedAll).sort((a, b) => b[1] - a[1])[0];

  // Slowest payer — real average days between created_date and paid_date.
  const daysByPerson: Record<string, { total: number; count: number }> = {};
  inMonth.forEach((r) => {
    if (r.status === 'paid' && r.paid_date && r.created_date) {
      const paid = new Date(String(r.paid_date)).getTime();
      const created = new Date(String(r.created_date)).getTime();
      if (!isNaN(paid) && !isNaN(created) && paid >= created) {
        const days = Math.floor((paid - created) / (1000 * 60 * 60 * 24));
        const name = String(r.name || 'Someone');
        if (!daysByPerson[name]) daysByPerson[name] = { total: 0, count: 0 };
        daysByPerson[name].total += days;
        daysByPerson[name].count += 1;
      }
    }
  });
  const slowest = Object.entries(daysByPerson)
    .map(([name, d]) => ({ name, avgDays: d.total / d.count }))
    .sort((a, b) => b.avgDays - a.avgDays)[0];

  // Most reminders — summed reminder_count per person.
  const reminders: Record<string, number> = {};
  inMonth.forEach((r) => {
    const name = String(r.name || 'Someone');
    reminders[name] = (reminders[name] || 0) + Number(r.reminder_count || 0);
  });
  const mostReminders = Object.entries(reminders)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    biggestDebtor: biggestDebtorEntry ? { name: biggestDebtorEntry[0], amount: biggestDebtorEntry[1], settled: !hasPending } : null,
    slowestPayer: slowest ? { name: slowest.name, avgDays: slowest.avgDays } : null,
    mostReminders: mostReminders ? { name: mostReminders[0], totalReminders: mostReminders[1] } : null,
    totalSplitBills: inMonth.length,
  };
}
