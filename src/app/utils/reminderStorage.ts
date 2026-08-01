import { query, run, lastInsertId } from './db';

export interface Reminder {
  id: number;
  name: string;
  amount: number;
  status: 'overdue' | 'pending' | 'paid' | 'sent';
  date: string;
  category: string;
  avatar: string;
  reminderSent?: boolean;
  lastReminderDate?: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  toUserName: string;
  totalBillAmount?: number;
  payerShare?: number;
  reminderCount?: number;
  createdDate?: string;
  paidDate?: string;
}

function rowToReminder(r: Record<string, any>): Reminder {
  return {
    id: Number(r.id),
    name: r.name,
    amount: r.amount,
    status: r.status,
    date: r.date,
    category: r.category,
    avatar: r.avatar,
    reminderSent: r.reminder_sent === 1,
    lastReminderDate: r.last_reminder_date ?? undefined,
    fromUserId: String(r.from_user_id),
    toUserId: String(r.to_user_id),
    fromUserName: r.from_user_name,
    toUserName: r.to_user_name,
    totalBillAmount: r.total_bill_amount ?? undefined,
    payerShare: r.payer_share ?? undefined,
    reminderCount: r.reminder_count ?? 0,
    createdDate: r.created_date ?? undefined,
    paidDate: r.paid_date ?? undefined,
  };
}

function notifyUpdated(): void {
  window.dispatchEvent(new CustomEvent('remindersUpdated'));
}

export function getRemindersToReceive(userId: string): Reminder[] {
  return query('SELECT * FROM reminders WHERE from_user_id = ? ORDER BY id DESC', [userId]).map(rowToReminder);
}

export function getRemindersToPay(userId: string): Reminder[] {
  return query('SELECT * FROM reminders WHERE to_user_id = ? ORDER BY id DESC', [userId]).map(rowToReminder);
}

export function getAllReminders(userId?: string): Reminder[] {
  const rows = userId
    ? query('SELECT * FROM reminders WHERE from_user_id = ? OR to_user_id = ? ORDER BY id DESC', [userId, userId])
    : query('SELECT * FROM reminders ORDER BY id DESC');
  return rows.map(rowToReminder);
}

export function addReminders(newReminders: Omit<Reminder, 'id'>[]): number[] {
  const ids: number[] = [];
  for (const r of newReminders) {
    run(
      `INSERT INTO reminders (
         from_user_id, to_user_id, from_user_name, to_user_name,
         name, amount, status, date, category, avatar,
         reminder_sent, last_reminder_date, total_bill_amount, payer_share,
         reminder_count, created_date, paid_date
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.fromUserId, r.toUserId, r.fromUserName, r.toUserName,
        r.name, r.amount, r.status, r.date, r.category, r.avatar,
        r.reminderSent ? 1 : 0, r.lastReminderDate ?? null,
        r.totalBillAmount ?? null, r.payerShare ?? null,
        r.reminderCount ?? 0, r.createdDate ?? new Date().toISOString(), r.paidDate ?? null,
      ]
    );
    ids.push(lastInsertId());
  }
  notifyUpdated();
  return ids;
}

export function updateReminderStatus(id: number, status: Reminder['status']): void {
  run('UPDATE reminders SET status = ? WHERE id = ?', [status, id]);
  notifyUpdated();
}

export function clearAllReminders(): void {
  run('DELETE FROM reminders');
  notifyUpdated();
}

export function markReminderAsPaid(id: number): Reminder | null {
  const rows = query('SELECT * FROM reminders WHERE id = ?', [id]);
  if (!rows.length) return null;
  const reminder = rowToReminder(rows[0]);

  run('UPDATE reminders SET status = ?, paid_date = ? WHERE id = ?',
    ['paid', new Date().toISOString(), id]);
  notifyUpdated();
  return reminder;
}

export function incrementReminderCount(id: number): void {
  run('UPDATE reminders SET reminder_count = reminder_count + 1, last_reminder_date = ? WHERE id = ?',
    [new Date().toISOString(), id]);
  notifyUpdated();
}

export interface PersonInsight {
  userId: string;
  userName: string;
  avatar: string;
  totalReminders: number;
  paidReminders: number;
  pendingReminders: number;
  averageReminderCount: number;
  averagePaymentTime: number;
  fastestPayment: number;
  slowestPayment: number;
}

export function getUserInsights(currentUserId: string): PersonInsight[] {
  const rows = query(
    `SELECT
       to_user_id                                         AS userId,
       to_user_name                                       AS userName,
       avatar,
       COUNT(*)                                           AS totalReminders,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)   AS paidReminders,
       SUM(CASE WHEN status != 'paid' THEN 1 ELSE 0 END)  AS pendingReminders,
       AVG(reminder_count)                                AS averageReminderCount,
       AVG(CASE WHEN status = 'paid' AND paid_date IS NOT NULL AND created_date IS NOT NULL
             THEN julianday(paid_date) - julianday(created_date) END) AS averagePaymentTime,
       MIN(CASE WHEN status = 'paid' AND paid_date IS NOT NULL AND created_date IS NOT NULL
             THEN julianday(paid_date) - julianday(created_date) END) AS fastestPayment,
       MAX(CASE WHEN status = 'paid' AND paid_date IS NOT NULL AND created_date IS NOT NULL
             THEN julianday(paid_date) - julianday(created_date) END) AS slowestPayment
     FROM reminders
     WHERE from_user_id = ?
     GROUP BY to_user_id
     ORDER BY totalReminders DESC`,
    [currentUserId]
  );

  return rows.map(r => ({
    userId: String(r.userId),
    userName: r.userName as string,
    avatar: r.avatar as string,
    totalReminders: Number(r.totalReminders),
    paidReminders: Number(r.paidReminders),
    pendingReminders: Number(r.pendingReminders),
    averageReminderCount: parseFloat((Number(r.averageReminderCount) || 0).toFixed(1)),
    averagePaymentTime: parseFloat((Number(r.averagePaymentTime) || 0).toFixed(2)),
    fastestPayment: parseFloat((Number(r.fastestPayment) || 0).toFixed(2)),
    slowestPayment: parseFloat((Number(r.slowestPayment) || 0).toFixed(2)),
  }));
}
