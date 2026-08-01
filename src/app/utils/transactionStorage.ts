import { query, run } from './db';

export interface Transaction {
  id: number;
  name: string;
  amount: number;
  date: string;
  category: string;
  status?: 'received' | 'sent';
  kind?: TransactionKind;
  paymentId?: string;
  userId: string;
}

export type TransactionKind =
  | 'purchase'
  | 'income'
  | 'topup'
  | 'transfer'
  | 'cashback'
  | 'refund';

function rowToTransaction(r: Record<string, any>): Transaction {
  return {
    id: Number(r.id),
    name: r.name,
    amount: r.amount,
    date: r.date,
    category: r.category,
    status: r.status ?? undefined,
    kind: r.kind ?? undefined,
    paymentId: r.payment_id == null ? undefined : String(r.payment_id),
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

export function addTransaction(transaction: Omit<Transaction, 'id' | 'userId'>, userId: string): void {
  run(
    `INSERT OR IGNORE INTO transactions
      (user_id, name, amount, date, category, status, kind, payment_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, transaction.name, transaction.amount, transaction.date, transaction.category,
      transaction.status ?? null, transaction.kind ?? null, transaction.paymentId ?? null, Date.now()]
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
        t.kind ?? null, t.paymentId ?? null, Date.now()]
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
  if (fields.length === 0) return;

  values.push(id);
  run(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, values);
  notifyUpdated();
}

export function clearAllTransactions(): void {
  run('DELETE FROM transactions');
  notifyUpdated();
}

export function formatDateForTransaction(): string {
  return 'Just now';
}

export function getRelativeTime(dateString: string): string {
  return dateString;
}
