import { lastInsertId, query, queryOne, run } from './db';

export type PaymentMethodType = 'wallet' | 'bank' | 'card' | 'paynow';

export interface PaymentMethod {
  id: number;
  userId: string;
  type: PaymentMethodType;
  label: string;
  /** Masked detail line, e.g. "Bank account ····4821". Never a full number. */
  detail: string;
  isDefault: boolean;
  /** A frozen method can't be used to pay or top up until it is unfrozen. */
  frozen: boolean;
  createdAt: number;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  wallet: 'NETS wallet',
  bank: 'Bank account',
  card: 'Debit card',
  paynow: 'PayNow',
};

function rowToMethod(r: Record<string, any>): PaymentMethod {
  return {
    id: Number(r.id),
    userId: String(r.user_id),
    type: String(r.type) as PaymentMethodType,
    label: String(r.label),
    detail: String(r.detail ?? ''),
    isDefault: Number(r.is_default) === 1,
    frozen: Number(r.frozen) === 1,
    createdAt: Number(r.created_at ?? 0),
  };
}

function notifyUpdated(): void {
  window.dispatchEvent(new CustomEvent('paymentMethodsUpdated'));
}

/**
 * Every account starts with the funding sources the app already offers on the
 * top-up screen, so Payment Methods is populated the first time it is opened
 * rather than showing an empty list.
 */
export function seedPaymentMethodsIfEmpty(userId: string): void {
  const row = queryOne('SELECT COUNT(*) AS n FROM payment_methods WHERE user_id = ?', [userId]);
  if (row && Number(row.n) > 0) return;

  const defaults: Omit<PaymentMethod, 'id' | 'userId' | 'createdAt'>[] = [
    { type: 'wallet', label: 'NETS vCashCard', detail: 'Primary wallet balance', isDefault: true, frozen: false },
    { type: 'paynow', label: 'PayNow', detail: 'Linked to your mobile number', isDefault: false, frozen: false },
    { type: 'bank', label: 'DBS/POSB', detail: 'Bank account ····4821', isDefault: false, frozen: false },
    { type: 'card', label: 'Visa Debit', detail: 'Card ····9034', isDefault: false, frozen: false },
  ];

  const now = Date.now();
  defaults.forEach((method, index) => {
    run(
      `INSERT INTO payment_methods (user_id, type, label, detail, is_default, frozen, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, method.type, method.label, method.detail, method.isDefault ? 1 : 0, 0, now + index],
    );
  });
  notifyUpdated();
}

export function getPaymentMethods(userId: string): PaymentMethod[] {
  seedPaymentMethodsIfEmpty(userId);
  return query(
    'SELECT * FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at ASC',
    [userId],
  ).map(rowToMethod);
}

export function addPaymentMethod(
  userId: string,
  method: { type: PaymentMethodType; label: string; detail: string },
): number {
  run(
    `INSERT INTO payment_methods (user_id, type, label, detail, is_default, frozen, created_at)
     VALUES (?, ?, ?, ?, 0, 0, ?)`,
    [userId, method.type, method.label.trim(), method.detail.trim(), Date.now()],
  );
  notifyUpdated();
  return lastInsertId();
}

export function setDefaultPaymentMethod(userId: string, id: number): void {
  run('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?', [userId]);
  run('UPDATE payment_methods SET is_default = 1 WHERE id = ? AND user_id = ?', [id, userId]);
  notifyUpdated();
}

export function setPaymentMethodFrozen(userId: string, id: number, frozen: boolean): void {
  run('UPDATE payment_methods SET frozen = ? WHERE id = ? AND user_id = ?', [frozen ? 1 : 0, id, userId]);
  notifyUpdated();
}

/**
 * The default method can't be removed — a wallet always needs one usable
 * funding source, so the user has to promote another method first.
 */
export function removePaymentMethod(userId: string, id: number): { removed: boolean; reason?: string } {
  const row = queryOne('SELECT is_default FROM payment_methods WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return { removed: false, reason: 'That payment method no longer exists.' };
  if (Number(row.is_default) === 1) {
    return { removed: false, reason: 'Make another method your default before removing this one.' };
  }
  run('DELETE FROM payment_methods WHERE id = ? AND user_id = ?', [id, userId]);
  notifyUpdated();
  return { removed: true };
}

/** Last four digits only — the prototype never stores a full account number. */
export function maskAccountNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `····${digits.slice(-4)}`;
}
