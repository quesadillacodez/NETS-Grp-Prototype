import { query, queryOne, run } from './db';
import { resolveSpendCategory, type SpendCategory } from './spendingInsights';
import {
  classifyTransaction, transactionReference, TRANSACTION_TYPE_META,
  type TransactionType, type TransactionTypeMeta,
} from './transactionModel';

export interface Transaction {
  id: number;
  name: string;
  amount: number;
  date: string;
  category: string;
  status?: 'received' | 'sent';
  kind?: TransactionType;
  paymentId?: string;
  createdAt?: number;
  userId: string;
}

/** @deprecated Use `TransactionType` from `transactionModel`. Kept so older imports keep compiling. */
export type TransactionKind = TransactionType;

function rowToTransaction(r: Record<string, any>): Transaction {
  return {
    id: Number(r.id),
    name: r.name,
    amount: r.amount,
    date: r.date,
    category: r.category,
    status: r.status ?? undefined,
    // Always classified through the shared model, so a legacy row that stored
    // `transfer` still reads back as a repayment rather than an unknown kind.
    kind: classifyTransaction(r),
    paymentId: r.payment_id == null ? undefined : String(r.payment_id),
    createdAt: r.created_at == null ? undefined : Number(r.created_at),
    userId: String(r.user_id),
  };
}

function notifyUpdated(): void {
  window.dispatchEvent(new CustomEvent('transactionsUpdated'));
}

export function getAllTransactions(userId?: string): Transaction[] {
  const rows = userId
    ? query('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC', [userId])
    : query('SELECT * FROM transactions ORDER BY id DESC');
  return rows.map(rowToTransaction);
}

export function getTransactionById(id: number, userId?: string): Transaction | null {
  const rows = userId
    ? query('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [id, userId])
    : query('SELECT * FROM transactions WHERE id = ?', [id]);
  return rows.length ? rowToTransaction(rows[0]) : null;
}

export function addTransaction(transaction: Omit<Transaction, 'id' | 'userId'>, userId: string): void {
  run(
    `INSERT OR IGNORE INTO transactions
      (user_id, name, amount, date, category, status, kind, payment_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, transaction.name, transaction.amount, transaction.date, transaction.category,
      transaction.status ?? null, transaction.kind ?? null, transaction.paymentId ?? null,
      transaction.createdAt ?? Date.now()]
  );
  notifyUpdated();
}

export function addTransactions(transactions: Omit<Transaction, 'id'>[]): void {
  for (const t of transactions) {
    run(
      `INSERT OR IGNORE INTO transactions
        (user_id, name, amount, date, category, status, kind, payment_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.userId, t.name, t.amount, t.date, t.category, t.status ?? null,
        t.kind ?? null, t.paymentId ?? null, t.createdAt ?? Date.now()]
    );
  }
  notifyUpdated();
}

export function hasProcessedPayment(paymentId: string): boolean {
  return query('SELECT 1 AS found FROM processed_payments WHERE payment_id = ?', [paymentId]).length > 0;
}

export function markPaymentProcessed(paymentId: string): void {
  run(
    'INSERT OR IGNORE INTO processed_payments (payment_id, processed_at) VALUES (?, ?)',
    [paymentId, Date.now()],
  );
}

export function updateTransaction(id: number, updates: Partial<Transaction>): void {
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.name !== undefined)     { fields.push('name = ?');     values.push(updates.name); }
  if (updates.amount !== undefined)   { fields.push('amount = ?');   values.push(updates.amount); }
  if (updates.date !== undefined)     { fields.push('date = ?');     values.push(updates.date); }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
  if (updates.status !== undefined)   { fields.push('status = ?');   values.push(updates.status ?? null); }
  if (updates.kind !== undefined)     { fields.push('kind = ?');     values.push(updates.kind); }
  if (fields.length === 0) return;

  values.push(id);
  run(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, values);
  notifyUpdated();
}

export function clearAllTransactions(): void {
  run('DELETE FROM transactions');
  notifyUpdated();
}

// ─── Wallet balance ──────────────────────────────────────────────────────────
// Every account starts from the same opening balance and the wallet is the sum
// of its transactions. This lives here, and only here, so a new money movement
// cannot be added without the balance following it — previously the constant
// and the sum were repeated in four screens, and a savings-goal contribution
// updated the goal without ever debiting the wallet.

export const OPENING_BALANCE = 2500.00;

export function walletBalanceFrom(transactions: Transaction[]): number {
  return OPENING_BALANCE + transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

export function getWalletBalance(userId: string): number {
  const row = queryOne('SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE user_id = ?', [userId]);
  return OPENING_BALANCE + Number(row?.total ?? 0);
}

export function formatDateForTransaction(): string {
  return 'Just now';
}

export function getRelativeTime(dateString: string): string {
  return dateString;
}

// ─── Presentation ────────────────────────────────────────────────────────────

export interface TransactionDescription {
  type: TransactionType;
  meta: TransactionTypeMeta;
  /** Wallet-flow label for money in, real spending category for money out. */
  categoryLabel: string;
  /** Spending category, resolved even for wallet flows (used by the dashboard). */
  spendCategory: SpendCategory;
  reference: string;
  signedAmount: string;
  isIncoming: boolean;
}

/**
 * The single place that turns a stored row into the words shown on screen.
 * Every list, receipt and admin table renders from this, so labels stay
 * identical everywhere.
 */
export function describeTransaction(tx: Transaction): TransactionDescription {
  const type = classifyTransaction(tx);
  const meta = TRANSACTION_TYPE_META[type];
  const spendCategory = resolveSpendCategory(tx.name, tx.category);
  return {
    type,
    meta,
    categoryLabel: meta.flowLabel ?? spendCategory,
    spendCategory,
    reference: transactionReference(tx.id, tx.createdAt),
    signedAmount: `${tx.amount >= 0 ? '+' : '-'}$${Math.abs(tx.amount).toFixed(2)}`,
    isIncoming: tx.amount >= 0,
  };
}

export interface TransactionFilter {
  /** Free text matched against the merchant/person name, category and reference. */
  term?: string;
  types?: TransactionType[];
  /** Inclusive bounds as epoch milliseconds. */
  from?: number;
  to?: number;
}

export function filterTransactions(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
  const term = filter.term?.trim().toLowerCase() ?? '';
  const types = filter.types && filter.types.length ? new Set(filter.types) : null;

  return transactions.filter((tx) => {
    const described = describeTransaction(tx);
    if (types && !types.has(described.type)) return false;

    if (filter.from != null || filter.to != null) {
      const ts = tx.createdAt ?? 0;
      if (filter.from != null && ts < filter.from) return false;
      if (filter.to != null && ts > filter.to) return false;
    }

    if (!term) return true;
    return [tx.name, described.categoryLabel, described.meta.label, described.reference, tx.date]
      .some(value => String(value).toLowerCase().includes(term));
  });
}
