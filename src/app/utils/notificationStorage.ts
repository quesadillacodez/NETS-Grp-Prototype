import { query, queryOne, run } from './db';

/**
 * Every notification belongs to exactly one channel. The channel drives the
 * Notification Centre filters, the icon shown on the row and the per-channel
 * push preference.
 */
export type NotificationChannel = 'payments' | 'reminders' | 'rewards' | 'hangouts';

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ['payments', 'reminders', 'rewards', 'hangouts'];

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  payments: 'Payments',
  reminders: 'Reminders',
  rewards: 'Rewards',
  hangouts: 'Hangouts',
};

export const CHANNEL_DESCRIPTIONS: Record<NotificationChannel, string> = {
  payments: 'Money sent, received and repaid',
  reminders: 'Bills you owe and automatic nudges',
  rewards: 'XP earned, vouchers and expiry warnings',
  hangouts: 'Invites, votes and confirmed plans',
};

export interface Notification {
  id: number;
  userId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar: string;
  message: string;
  amount: number;
  category: string;
  timestamp: string;
  read: boolean;
  reminderId?: number;
  channel: NotificationChannel;
  /** In-app route this notification opens, e.g. `/reminders` or `/transaction/12`. */
  link?: string;
  /** Whether the push banner for this notification was dismissed with its (x). */
  bannerDismissed: boolean;
}

/**
 * Work out the channel for a row written before notifications were channelled.
 * Reads the same signals a person would: a linked reminder means it is about a
 * bill, otherwise the wording decides.
 */
export function inferNotificationChannel(row: {
  channel?: unknown; reminderId?: unknown; reminder_id?: unknown; message?: unknown; category?: unknown;
}): NotificationChannel {
  const stored = String(row.channel ?? '');
  if ((NOTIFICATION_CHANNELS as string[]).includes(stored)) return stored as NotificationChannel;

  const message = String(row.message ?? '').toLowerCase();
  const category = String(row.category ?? '').toLowerCase();
  const text = `${message} ${category}`;

  if (/\bxp\b|cashback|voucher|reward|redeem/.test(text)) return 'rewards';
  if (/hangout|vote|plan is confirmed|group plan/.test(text)) return 'hangouts';
  if (/paid you back|payment received|topped up|top-up|refund/.test(text)) return 'payments';

  const reminderId = row.reminderId ?? row.reminder_id;
  if (reminderId != null) return 'reminders';
  return 'payments';
}

function defaultLinkFor(channel: NotificationChannel): string {
  switch (channel) {
    case 'reminders': return '/reminders';
    case 'rewards':   return '/rewards';
    case 'hangouts':  return '/hangouts';
    case 'payments':  return '/all-transactions';
  }
}

function rowToNotification(r: Record<string, any>): Notification {
  const channel = inferNotificationChannel(r);
  return {
    id: Number(r.id),
    userId: String(r.user_id),
    fromUserId: String(r.from_user_id),
    fromUserName: r.from_user_name,
    fromUserAvatar: r.from_user_avatar,
    message: r.message,
    amount: r.amount,
    category: r.category,
    timestamp: r.timestamp,
    read: r.read === 1,
    reminderId: r.reminder_id ?? undefined,
    channel,
    link: r.link ?? defaultLinkFor(channel),
    bannerDismissed: r.banner_dismissed === 1,
  };
}

function notifyUpdated(): void {
  window.dispatchEvent(new CustomEvent('notificationsUpdated'));
}

export function getAllNotifications(userId: string): Notification[] {
  return query('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC', [userId]).map(rowToNotification);
}

export function getUnreadNotifications(userId: string): Notification[] {
  return query('SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY id DESC', [userId]).map(rowToNotification);
}

/**
 * Unread notifications eligible for the push banner: excludes anything whose
 * banner was already dismissed with its (x), so a dismissed notification does
 * not pop back up on another page or after reopening the app. It still counts
 * as unread in the Notification Centre — dismissing the banner is not the same
 * as reading it.
 */
export function getPushableNotifications(userId: string): Notification[] {
  return query(
    'SELECT * FROM notifications WHERE user_id = ? AND read = 0 AND banner_dismissed = 0 ORDER BY id DESC',
    [userId],
  ).map(rowToNotification);
}

/** Permanently dismiss a notification's push banner (does not mark it read). */
export function dismissNotificationBanner(id: number): void {
  run('UPDATE notifications SET banner_dismissed = 1 WHERE id = ?', [id]);
  notifyUpdated();
}

export function getUnreadCount(userId: string): number {
  const row = queryOne('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0', [userId]);
  return row ? Number(row.n) : 0;
}

/** Unread counts per channel, used for the filter badges in the Notification Centre. */
export function getUnreadCountsByChannel(userId: string): Record<NotificationChannel, number> {
  const counts: Record<NotificationChannel, number> = { payments: 0, reminders: 0, rewards: 0, hangouts: 0 };
  for (const notification of getUnreadNotifications(userId)) {
    counts[notification.channel] += 1;
  }
  return counts;
}

export function addNotification(
  notification: Omit<Notification, 'id' | 'channel' | 'link' | 'bannerDismissed'> & {
    channel?: NotificationChannel;
    link?: string;
  },
): void {
  const channel = notification.channel ?? inferNotificationChannel(notification);
  run(
    `INSERT INTO notifications (
       user_id, from_user_id, from_user_name, from_user_avatar,
       message, amount, category, timestamp, read, reminder_id, channel, link
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      notification.userId, notification.fromUserId, notification.fromUserName, notification.fromUserAvatar,
      notification.message, notification.amount, notification.category, notification.timestamp,
      notification.read ? 1 : 0, notification.reminderId ?? null,
      channel, notification.link ?? defaultLinkFor(channel),
    ]
  );
  notifyUpdated();
}

export function markNotificationAsRead(id: number): void {
  run('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
  notifyUpdated();
}

export function markNotificationAsUnread(id: number): void {
  run('UPDATE notifications SET read = 0 WHERE id = ?', [id]);
  notifyUpdated();
}

export function markAllNotificationsAsRead(userId: string): void {
  run('UPDATE notifications SET read = 1 WHERE user_id = ?', [userId]);
  notifyUpdated();
}

export function deleteNotification(id: number): void {
  run('DELETE FROM notifications WHERE id = ?', [id]);
  notifyUpdated();
}

export function clearAllNotifications(): void {
  run('DELETE FROM notifications');
  notifyUpdated();
}

export function deleteNotificationByReminder(reminderId: number): void {
  run('DELETE FROM notifications WHERE reminder_id = ?', [reminderId]);
  notifyUpdated();
}

// ─── Push preferences ────────────────────────────────────────────────────────
// Notifications are always recorded in the Centre so nothing is silently lost.
// The preference decides whether the user is actively interrupted by the
// in-app push banner — the same split a real banking app makes between an
// inbox and a device notification.

export type NotificationPreferences = Record<NotificationChannel, boolean>;

export function getNotificationPreferences(userId: string): NotificationPreferences {
  const preferences: NotificationPreferences = {
    payments: true, reminders: true, rewards: true, hangouts: true,
  };
  for (const row of query('SELECT channel, push_enabled FROM notification_preferences WHERE user_id = ?', [userId])) {
    const channel = String(row.channel) as NotificationChannel;
    if (channel in preferences) preferences[channel] = Number(row.push_enabled) === 1;
  }
  return preferences;
}

export function setNotificationPreference(
  userId: string,
  channel: NotificationChannel,
  enabled: boolean,
): void {
  run(
    `INSERT OR REPLACE INTO notification_preferences (user_id, channel, push_enabled, updated_at)
     VALUES (?, ?, ?, ?)`,
    [userId, channel, enabled ? 1 : 0, Date.now()],
  );
  window.dispatchEvent(new CustomEvent('notificationPreferencesUpdated'));
}

/** Whether the in-app push banner should interrupt the user for this channel. */
export function isPushEnabled(userId: string, channel: NotificationChannel): boolean {
  return getNotificationPreferences(userId)[channel];
}
