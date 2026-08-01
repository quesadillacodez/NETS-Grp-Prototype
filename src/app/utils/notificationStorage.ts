import { query, run } from './db';

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
}

function rowToNotification(r: Record<string, any>): Notification {
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

export function addNotification(notification: Omit<Notification, 'id'>): void {
  run(
    `INSERT INTO notifications (
       user_id, from_user_id, from_user_name, from_user_avatar,
       message, amount, category, timestamp, read, reminder_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      notification.userId, notification.fromUserId, notification.fromUserName, notification.fromUserAvatar,
      notification.message, notification.amount, notification.category, notification.timestamp,
      notification.read ? 1 : 0, notification.reminderId ?? null,
    ]
  );
  notifyUpdated();
}

export function markNotificationAsRead(id: number): void {
  run('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
  notifyUpdated();
}

export function markAllNotificationsAsRead(userId: string): void {
  run('UPDATE notifications SET read = 1 WHERE user_id = ?', [userId]);
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
