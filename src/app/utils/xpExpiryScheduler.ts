import { queryOne, run } from './db';
import { addNotification } from './notificationStorage';
import { getXPLedger } from './rewardStorage';
import { getCurrentUser, isAdminUser, isMerchantUser } from './userStorage';

/**
 * Warns before XP lapses.
 *
 * Expiry was only visible to someone who happened to open the Rewards tab, so
 * the rule that takes XP away was quieter than the one that grants it. This
 * mirrors the voucher reminder scheduler: same tiers, same dedupe through
 * `app_meta`, same notification channel.
 *
 * Lots are grouped by the day they expire rather than notified individually -
 * a month of payments is dozens of lots that all lapse together, and the user
 * cares about the total, not the ledger rows behind it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function reminderTier(days: number): 7 | 3 | 1 | 0 | null {
  if (days < 0) return null;
  if (days <= 0) return 0;
  if (days <= 1) return 1;
  if (days <= 3) return 3;
  if (days <= 7) return 7;
  return null;
}

/** Whole days until `at`, rounded up so "tomorrow" never reads as today. */
export function daysUntil(at: number, now: number): number {
  return Math.ceil((at - now) / DAY_MS);
}

/** Local `YYYY-MM-DD` for an expiry moment, used as the grouping key. */
function expiryDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface ExpiryGroup {
  /** Day the XP lapses, as a `YYYY-MM-DD` key. */
  day: string;
  expiresAt: number;
  xp: number;
}

/**
 * Groups still-spendable XP by expiry day, soonest first. Permanent grants
 * (the welcome bonus) have no finite expiry and are excluded.
 */
export function groupExpiringXP(
  lots: { remaining: number; expiresAt: number }[],
  now: number,
  withinDays = 7,
): ExpiryGroup[] {
  const groups = new Map<string, ExpiryGroup>();
  for (const lot of lots) {
    if (lot.remaining <= 0 || !Number.isFinite(lot.expiresAt)) continue;
    if (lot.expiresAt < now || lot.expiresAt - now > withinDays * DAY_MS) continue;
    const day = expiryDayKey(lot.expiresAt);
    const existing = groups.get(day);
    if (existing) {
      existing.xp += lot.remaining;
      existing.expiresAt = Math.min(existing.expiresAt, lot.expiresAt);
    } else {
      groups.set(day, { day, expiresAt: lot.expiresAt, xp: lot.remaining });
    }
  }
  return [...groups.values()].sort((a, b) => a.expiresAt - b.expiresAt);
}

export function checkXPExpiryReminders(now = Date.now()): number {
  try {
    const user = getCurrentUser();
    if (isAdminUser(user) || isMerchantUser(user)) return 0;
    let created = 0;

    for (const group of groupExpiringXP(getXPLedger(user.id).lots, now)) {
      const days = daysUntil(group.expiresAt, now);
      const tier = reminderTier(days);
      if (tier == null) continue;
      const metaKey = `xp-expiry:${user.id}:${group.day}:${tier}`;
      if (queryOne('SELECT value FROM app_meta WHERE key = ?', [metaKey])) continue;

      const timing = tier === 0 ? 'expires today' : `expires in ${days} day${days === 1 ? '' : 's'}`;
      addNotification({
        userId: user.id,
        fromUserId: 'nets-rewards',
        fromUserName: 'NETS Rewards',
        fromUserAvatar: '⏳',
        message: `${group.xp.toLocaleString()} XP ${timing}. Spend it in the Rewards Store before it is gone.`,
        amount: 0,
        category: 'XP expiry',
        timestamp: new Date(now).toISOString(),
        read: false,
        channel: 'rewards',
        link: '/rewards?tab=ledger',
      });
      run('INSERT INTO app_meta (key, value) VALUES (?, ?)', [metaKey, new Date(now).toISOString()]);
      created += 1;
    }
    return created;
  } catch {
    // Loaded before SQLite finishes booting; the databaseReady listener below
    // performs the first real check.
    return 0;
  }
}

// Guarded so the pure grouping helpers above can be unit tested without a DOM.
if (typeof window !== 'undefined') {
  const check = () => checkXPExpiryReminders();
  window.addEventListener('databaseReady', check);
  window.addEventListener('userSwitched', check);
  window.addEventListener('transactionsUpdated', check);
  window.addEventListener('rewardRedemptionsUpdated', check);
  window.addEventListener('focus', check);
  window.setInterval(check, 15 * 60 * 1000);
}
