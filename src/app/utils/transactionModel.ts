// ─── One canonical transaction model ─────────────────────────────────────────
// Every screen (Home, History, receipts, the management portal, the spending
// dashboard) classifies a transaction through this module, so the same row can
// never be described as a "Top-up" in one place and "Paid you back" in another.
//
// Deliberately dependency-free: both `transactionStorage` and `spendingInsights`
// import it, and the database migration classifies legacy rows with it too.

export type TransactionType =
  | 'purchase'
  | 'repayment_received'
  | 'repayment_sent'
  | 'cashback'
  | 'refund'
  | 'topup'
  | 'goal_contribution'
  | 'goal_withdrawal'
  | 'card_load'
  | 'card_unload';

export interface TransactionTypeMeta {
  /** Full name used in receipts, filters and the admin portal. */
  label: string;
  /** Compact name for list rows and chips. */
  shortLabel: string;
  /** Plain-English description of what happened, shown under the merchant name. */
  activity: string;
  direction: 'in' | 'out';
  /**
   * What to show where a spending category would go. `null` means the row has a
   * real spending category (Groceries, Transport …); anything else is a wallet
   * flow that has no merchant category of its own.
   */
  flowLabel: string | null;
  /** Whether the money leaving the wallet is the user's own spending. */
  countsAsSpending: boolean;
}

export const TRANSACTION_TYPE_META: Record<TransactionType, TransactionTypeMeta> = {
  purchase: {
    label: 'Purchase', shortLabel: 'Purchase', activity: 'You paid',
    direction: 'out', flowLabel: null, countsAsSpending: true,
  },
  repayment_sent: {
    label: 'Repayment Sent', shortLabel: 'Repayment', activity: 'You repaid',
    direction: 'out', flowLabel: null, countsAsSpending: true,
  },
  repayment_received: {
    label: 'Repayment Received', shortLabel: 'Repayment', activity: 'Paid you back',
    direction: 'in', flowLabel: 'Bill split', countsAsSpending: false,
  },
  cashback: {
    label: 'Cashback', shortLabel: 'Cashback', activity: 'Cashback earned',
    direction: 'in', flowLabel: 'NETS Rewards', countsAsSpending: false,
  },
  refund: {
    label: 'Refund', shortLabel: 'Refund', activity: 'Refunded to you',
    direction: 'in', flowLabel: 'Refund', countsAsSpending: false,
  },
  topup: {
    label: 'Top-up', shortLabel: 'Top-up', activity: 'Added to wallet',
    direction: 'in', flowLabel: 'Wallet top-up', countsAsSpending: false,
  },
  // Money moved between the wallet and a savings goal. It leaves the spendable
  // balance but is not spending — it is still the customer's own money, so it
  // must never appear in the spending dashboard's category totals.
  goal_contribution: {
    label: 'Goal Contribution', shortLabel: 'To savings', activity: 'Moved to savings',
    direction: 'out', flowLabel: 'Savings goal', countsAsSpending: false,
  },
  goal_withdrawal: {
    label: 'Goal Withdrawal', shortLabel: 'From savings', activity: 'Returned from savings',
    direction: 'in', flowLabel: 'Savings goal', countsAsSpending: false,
  },
  // Money moved between the wallet and another NETS card the customer holds.
  // Same reasoning as a savings goal: the balance moves, but nothing has been
  // spent until the card is used at a merchant.
  card_load: {
    label: 'Card Load', shortLabel: 'To card', activity: 'Loaded onto card',
    direction: 'out', flowLabel: 'NETS card', countsAsSpending: false,
  },
  card_unload: {
    label: 'Card Unload', shortLabel: 'From card', activity: 'Returned from card',
    direction: 'in', flowLabel: 'NETS card', countsAsSpending: false,
  },
};

export const TRANSACTION_TYPES = Object.keys(TRANSACTION_TYPE_META) as TransactionType[];

export function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === 'string' && value in TRANSACTION_TYPE_META;
}

export function transactionTypeLabel(type: TransactionType): string {
  return TRANSACTION_TYPE_META[type].label;
}

/** Fields a row needs for classification — works on both DB rows and Transaction objects. */
export interface ClassifiableTransaction {
  kind?: unknown;
  status?: unknown;
  category?: unknown;
  name?: unknown;
  amount?: unknown;
}

/**
 * Resolve a row to exactly one transaction type.
 *
 * Rows written by the current app already carry a canonical `kind`. Everything
 * else is a legacy row — written before this model existed, when repayments
 * were stored as `transfer`, top-ups as category `topup` and cashback as
 * category `reward` — so those are classified from the remaining signals.
 */
export function classifyTransaction(row: ClassifiableTransaction): TransactionType {
  const kind = typeof row.kind === 'string' ? row.kind.trim() : '';
  if (isTransactionType(kind)) return kind;

  const amount = Number(row.amount ?? 0);
  const status = String(row.status ?? '').toLowerCase();
  const category = String(row.category ?? '').toLowerCase();
  const name = String(row.name ?? '');

  // Wallet flows are identified before the transfer rules, because a cashback
  // credit was historically written with status 'received' as well.
  if (category === 'savings') return amount < 0 ? 'goal_contribution' : 'goal_withdrawal';
  if (category === 'card') return amount < 0 ? 'card_load' : 'card_unload';
  if (category === 'topup' || /top.?up/i.test(name)) return 'topup';
  if (category === 'reward' || /cashback/i.test(name)) return 'cashback';
  if (category === 'refund' || /refund/i.test(name)) return 'refund';

  // Legacy `transfer` rows are always split-bill settlements between two users.
  if (kind === 'transfer' || status === 'sent' || status === 'received') {
    if (status === 'sent') return 'repayment_sent';
    if (status === 'received') return 'repayment_received';
    return amount < 0 ? 'repayment_sent' : 'repayment_received';
  }

  return amount < 0 ? 'purchase' : 'topup';
}

export function transactionDirection(row: ClassifiableTransaction): 'in' | 'out' {
  return TRANSACTION_TYPE_META[classifyTransaction(row)].direction;
}

export function countsAsSpending(row: ClassifiableTransaction): boolean {
  return TRANSACTION_TYPE_META[classifyTransaction(row)].countsAsSpending && Number(row.amount ?? 0) < 0;
}

/**
 * A stable, human-readable receipt reference. Derived from the row's own id and
 * creation time, so the same transaction always shows the same reference
 * without needing an extra stored column.
 */
export function transactionReference(id: number, createdAt?: number | null): string {
  const created = createdAt && Number.isFinite(createdAt) ? new Date(createdAt) : null;
  const year = created && !Number.isNaN(created.getTime()) ? created.getFullYear() : new Date().getFullYear();
  return `NETS${year}${String(id).padStart(6, '0')}`;
}
