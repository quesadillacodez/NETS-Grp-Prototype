// ─── The NETS cards a customer holds ─────────────────────────────────────────
// The Home screen shows these as a swipeable carousel. Two of them hold their
// own float and can be loaded from the wallet; the vCashCard *is* the wallet,
// so its balance is never stored here — it is read from the transaction ledger
// like everywhere else in the app.

import { query, queryOne, run } from './db';
import { addTransaction, formatDateForTransaction, getWalletBalance } from './transactionStorage';

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type CardKind = 'vcashcard' | 'prepaid' | 'motoring';

export interface CardKindMeta {
  /** Product name as NETS calls it. */
  label: string;
  /** What the card is for, in one line. */
  purpose: string;
  /** Where it is accepted, shown in the card's detail sheet. */
  acceptedAt: string;
  /** Whether the balance is this card's own float rather than the wallet's. */
  holdsOwnBalance: boolean;
  /** Tailwind gradient for the card face, so each product is recognisable. */
  face: string;
}

export const CARD_KIND_META: Record<CardKind, CardKindMeta> = {
  vcashcard: {
    label: 'NETS vCashCard',
    purpose: 'Your main wallet balance',
    acceptedAt: 'Anywhere NETS is accepted, plus every payment made in this app.',
    holdsOwnBalance: false,
    face: 'from-[#0057ff] to-[#0038b8]',
  },
  prepaid: {
    label: 'NETS Prepaid Card',
    purpose: 'Load it, then tap and pay',
    acceptedAt: 'Contactless terminals and online checkouts, with no bank account needed.',
    holdsOwnBalance: true,
    face: 'from-[#00a94f] to-[#00753a]',
  },
  motoring: {
    label: 'NETS Motoring CashCard',
    purpose: 'ERP, carparks and petrol',
    acceptedAt: 'In-vehicle units at ERP gantries, carparks and participating petrol kiosks.',
    holdsOwnBalance: true,
    face: 'from-[#f59e0b] to-[#b45309]',
  },
};

export interface Card {
  id: number;
  userId: string;
  kind: CardKind;
  meta: CardKindMeta;
  /** Last four digits of the card number — the prototype stores nothing more. */
  lastFour: string;
  /** The card's own float, or the wallet balance for the vCashCard. */
  balance: number;
  frozen: boolean;
}

function notifyUpdated(): void {
  window.dispatchEvent(new CustomEvent('cardsUpdated'));
}

/**
 * Every account starts with the three cards the demo talks about. Seeded on
 * first read so an existing database picks them up without a migration.
 */
export function seedCardsIfEmpty(userId: string): void {
  const row = queryOne('SELECT COUNT(*) AS n FROM cards WHERE user_id = ?', [userId]);
  if (row && Number(row.n) > 0) return;

  const defaults: { kind: CardKind; lastFour: string; balance: number }[] = [
    { kind: 'vcashcard', lastFour: '4417', balance: 0 },
    { kind: 'prepaid',   lastFour: '8102', balance: 120 },
    { kind: 'motoring',  lastFour: '5563', balance: 48.6 },
  ];

  const now = Date.now();
  defaults.forEach((card, index) => {
    run(
      `INSERT INTO cards (user_id, kind, last_four, balance, frozen, position, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [userId, card.kind, card.lastFour, card.balance, index, now + index],
    );
  });
  notifyUpdated();
}

function rowToCard(row: Record<string, any>, walletBalance: number): Card {
  const kind = (String(row.kind) in CARD_KIND_META ? String(row.kind) : 'prepaid') as CardKind;
  const meta = CARD_KIND_META[kind];
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    kind,
    meta,
    lastFour: String(row.last_four ?? '0000'),
    // The wallet card's stored balance is deliberately ignored: duplicating it
    // is exactly how the savings-goal balance drifted out of step before.
    balance: meta.holdsOwnBalance ? Number(row.balance ?? 0) : walletBalance,
    frozen: Number(row.frozen) === 1,
  };
}

export function getCards(userId: string): Card[] {
  seedCardsIfEmpty(userId);
  const walletBalance = getWalletBalance(userId);
  return query(
    'SELECT * FROM cards WHERE user_id = ? ORDER BY position ASC, id ASC',
    [userId],
  ).map(row => rowToCard(row, walletBalance));
}

export function getCard(userId: string, cardId: number): Card | null {
  return getCards(userId).find(card => card.id === cardId) ?? null;
}

export interface CardTransferResult {
  ok: boolean;
  /** How much actually moved. Zero on failure. */
  moved: number;
  reason?: string;
}

function refuse(reason: string): CardTransferResult {
  return { ok: false, moved: 0, reason };
}

/** Shared guards for both directions of a wallet ↔ card transfer. */
function transferableCard(
  userId: string, cardId: number, amount: number,
): { card: Card; error?: undefined } | { card?: undefined; error: CardTransferResult } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: refuse('Enter an amount greater than zero.') };
  }

  const card = getCard(userId, cardId);
  if (!card) return { error: refuse('That card no longer exists.') };
  if (!card.meta.holdsOwnBalance) {
    return { error: refuse('Your vCashCard is your wallet — top it up from the Top-up screen instead.') };
  }
  if (card.frozen) return { error: refuse('This card is frozen. Unfreeze it to move money.') };
  return { card };
}

/** The maximum a NETS CashCard may hold, which is what caps a card load. */
export const CARD_BALANCE_LIMIT = 500;

/**
 * Move money from the wallet onto a card.
 *
 * The money has not been spent — it has moved from one of the customer's cards
 * to another — so this is recorded as a `card_load` transaction, which leaves
 * the spendable wallet balance without counting towards spending totals.
 */
export function loadCard(userId: string, cardId: number, amount: number): CardTransferResult {
  const { card, error } = transferableCard(userId, cardId, amount);
  if (error) return error;

  const available = getWalletBalance(userId);
  if (amount > available) return refuse(`You only have ${money(available)} available in your wallet.`);

  const room = CARD_BALANCE_LIMIT - card.balance;
  if (room <= 0) return refuse(`This card is already at its ${money(CARD_BALANCE_LIMIT)} limit.`);
  if (amount > room) return refuse(`This card can only hold ${money(room)} more.`);

  run('UPDATE cards SET balance = ? WHERE id = ? AND user_id = ?',
    [card.balance + amount, cardId, userId]);
  addTransaction({
    name: card.meta.label,
    amount: -amount,
    date: formatDateForTransaction(),
    category: 'card',
    kind: 'card_load',
  }, userId);
  notifyUpdated();
  return { ok: true, moved: amount };
}

/** Return money from a card to the spendable wallet balance. */
export function unloadCard(userId: string, cardId: number, amount: number): CardTransferResult {
  const { card, error } = transferableCard(userId, cardId, amount);
  if (error) return error;

  if (card.balance <= 0) return refuse('There is nothing on this card yet.');
  if (amount > card.balance) return refuse(`This card only holds ${money(card.balance)}.`);

  run('UPDATE cards SET balance = ? WHERE id = ? AND user_id = ?',
    [card.balance - amount, cardId, userId]);
  addTransaction({
    name: card.meta.label,
    amount,
    date: formatDateForTransaction(),
    category: 'card',
    kind: 'card_unload',
  }, userId);
  notifyUpdated();
  return { ok: true, moved: amount };
}

/**
 * Freeze or unfreeze a card. The vCashCard cannot be frozen: it is the wallet
 * every other flow in the app pays from, so freezing it would stop payments
 * without any way to explain why from the screens that use it.
 */
export function setCardFrozen(userId: string, cardId: number, frozen: boolean): CardTransferResult {
  const card = getCard(userId, cardId);
  if (!card) return refuse('That card no longer exists.');
  if (!card.meta.holdsOwnBalance) {
    return refuse('Your vCashCard is your wallet and cannot be frozen.');
  }
  run('UPDATE cards SET frozen = ? WHERE id = ? AND user_id = ?', [frozen ? 1 : 0, cardId, userId]);
  notifyUpdated();
  return { ok: true, moved: 0 };
}

/** Used by the demo controls: cards go back to their seeded balances. */
export function clearAllCards(): void {
  run('DELETE FROM cards');
  notifyUpdated();
}
