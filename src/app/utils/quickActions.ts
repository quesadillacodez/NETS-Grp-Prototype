// ─── Quick Actions ───────────────────────────────────────────────────────────
// The four shortcuts under the card carousel on Home. Which four is the
// customer's choice, so this module owns the catalogue, the default set and
// the stored selection. The Home screen only renders what it is given.

import { queryOne, run } from './db';

export interface QuickActionDefinition {
  id: string;
  label: string;
  /** Longer wording for the editor, where there is room to explain. */
  description: string;
  path: string;
  /** lucide-react icon name; resolved to a component by the Home screen. */
  icon: string;
}

/**
 * Everything that can occupy a slot. Each entry is a screen the app already
 * has — a shortcut that led nowhere would be worse than no shortcut.
 */
export const QUICK_ACTION_CATALOGUE: QuickActionDefinition[] = [
  { id: 'top-up',        label: 'Top-up',     description: 'Add money to your wallet',        path: '/top-up',           icon: 'CreditCard' },
  { id: 'history',       label: 'History',    description: 'Every transaction, searchable',   path: '/all-transactions', icon: 'History' },
  { id: 'split',         label: 'Split Bill', description: 'Scan a bill and split it',        path: '/scan',             icon: 'Split' },
  { id: 'reminders',     label: 'Reminders',  description: 'Who owes you, and who you owe',   path: '/reminders',        icon: 'Bell' },
  { id: 'wrapped',       label: 'Wrapped',    description: 'Your spending year in review',    path: '/wrapped',          icon: 'Sparkles' },
  { id: 'dashboard',     label: 'Dashboard',  description: 'Spending insights and goals',     path: '/dashboard',        icon: 'ChartColumn' },
  { id: 'hangouts',      label: 'Hangouts',   description: 'Plan an outing with friends',     path: '/hangouts',         icon: 'UsersRound' },
  { id: 'rewards',       label: 'Rewards',    description: 'Spend your XP in the store',      path: '/rewards',          icon: 'Award' },
  { id: 'notifications', label: 'Alerts',     description: 'Your notification centre',        path: '/notifications',    icon: 'BellRing' },
  { id: 'cards',         label: 'Cards',      description: 'Manage your payment methods',     path: '/profile/payment-methods', icon: 'Wallet' },
  { id: 'help',          label: 'Help',       description: 'FAQs, contacts and reporting',    path: '/profile/help',     icon: 'LifeBuoy' },
];

/** How many fit across the row without wrapping, at 320px too. */
export const QUICK_ACTION_SLOTS = 4;

export const DEFAULT_QUICK_ACTION_IDS = ['top-up', 'history', 'split', 'reminders'];

const PREFERENCE_KEY = 'quick-actions';

export function findQuickAction(id: string): QuickActionDefinition | undefined {
  return QUICK_ACTION_CATALOGUE.find(action => action.id === id);
}

/**
 * Keep only ids the catalogue still knows about, drop duplicates, and top the
 * selection up from the defaults if it is short — so a stored preference from
 * an older build can never leave the row with a gap or a dead shortcut.
 */
export function normaliseQuickActionIds(ids: unknown): string[] {
  const requested = Array.isArray(ids) ? ids.map(String) : [];
  const chosen: string[] = [];

  for (const id of [...requested, ...DEFAULT_QUICK_ACTION_IDS]) {
    if (chosen.length === QUICK_ACTION_SLOTS) break;
    if (!chosen.includes(id) && findQuickAction(id)) chosen.push(id);
  }
  return chosen;
}

export function getQuickActionIds(userId: string): string[] {
  const row = queryOne(
    'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
    [userId, PREFERENCE_KEY],
  );
  if (!row?.value) return [...DEFAULT_QUICK_ACTION_IDS];

  try {
    return normaliseQuickActionIds(JSON.parse(String(row.value)));
  } catch {
    return [...DEFAULT_QUICK_ACTION_IDS];
  }
}

export function getQuickActions(userId: string): QuickActionDefinition[] {
  return getQuickActionIds(userId)
    .map(findQuickAction)
    .filter((action): action is QuickActionDefinition => action !== undefined);
}

export function setQuickActionIds(userId: string, ids: string[]): string[] {
  const chosen = normaliseQuickActionIds(ids);
  run(
    `INSERT INTO user_preferences (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [userId, PREFERENCE_KEY, JSON.stringify(chosen), Date.now()],
  );
  window.dispatchEvent(new CustomEvent('quickActionsUpdated'));
  return chosen;
}

export function resetQuickActions(userId: string): string[] {
  run('DELETE FROM user_preferences WHERE user_id = ? AND key = ?', [userId, PREFERENCE_KEY]);
  window.dispatchEvent(new CustomEvent('quickActionsUpdated'));
  return [...DEFAULT_QUICK_ACTION_IDS];
}

export function isDefaultQuickActions(ids: string[]): boolean {
  return ids.length === DEFAULT_QUICK_ACTION_IDS.length
    && ids.every((id, index) => id === DEFAULT_QUICK_ACTION_IDS[index]);
}
