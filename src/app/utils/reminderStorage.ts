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
  thankYou?: string;
  /**
   * Which split this reminder belongs to. Stamped once per payment, so two
   * splits at the same merchant stay two separate bills. Absent on rows created
   * before the column existed.
   */
  billId?: string;
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
    thankYou: r.thank_you ?? undefined,
    billId: r.bill_id ?? undefined,
  };
}

/**
 * The key that decides which split a reminder belongs to.
 *
 * A reminder written since `bill_id` landed carries the payment's own id, so
 * two splits at the same merchant are two bills no matter how close together
 * they were made. Rows written before the column existed have no id to group
 * on, so they fall back to merchant + payer + when the split was made — which
 * separates same-merchant splits on different days but not within the same
 * second. The dashboard and the shared bill screen must build this key the same
 * way or a tapped bill opens as an empty one, so they both call this.
 */
export function billKeyFor(
  reminder: Pick<Reminder, 'billId' | 'category' | 'fromUserId' | 'createdDate' | 'date'>,
): string {
  if (reminder.billId) return `bill-${reminder.billId}`;
  return `${reminder.category}-${reminder.fromUserId}-${reminder.createdDate ?? reminder.date}`;
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
         reminder_count, created_date, paid_date, bill_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.fromUserId, r.toUserId, r.fromUserName, r.toUserName,
        r.name, r.amount, r.status, r.date, r.category, r.avatar,
        r.reminderSent ? 1 : 0, r.lastReminderDate ?? null,
        r.totalBillAmount ?? null, r.payerShare ?? null,
        r.reminderCount ?? 0, r.createdDate ?? new Date().toISOString(), r.paidDate ?? null,
        r.billId ?? null,
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

export function markReminderAsPaid(id: number, thankYou?: string): Reminder | null {
  const rows = query('SELECT * FROM reminders WHERE id = ?', [id]);
  if (!rows.length) return null;
  const reminder = rowToReminder(rows[0]);

  const note = thankYou?.trim() || null;
  run('UPDATE reminders SET status = ?, paid_date = ?, thank_you = ? WHERE id = ?',
    ['paid', new Date().toISOString(), note, id]);
  notifyUpdated();
  return { ...reminder, status: 'paid', thankYou: note ?? undefined };
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
  /** 0-100, or null when there's no reminder history yet to score. */
  reliabilityScore: number | null;
}

// How trustworthy a person is to pay you back: rewards a high share of paid
// reminders, then docks points the slower they tend to pay (capped at -30 so
// one slow payment doesn't wipe out an otherwise-reliable history).
export function computeReliabilityScore(
  paidReminders: number,
  totalReminders: number,
  averagePaymentTime: number
): number | null {
  if (totalReminders <= 0) return null;
  const completionRate = paidReminders / totalReminders;
  const latePenalty = paidReminders > 0 && averagePaymentTime > 3
    ? Math.min(30, (averagePaymentTime - 3) * 5)
    : 0;
  return Math.max(0, Math.min(100, Math.round(completionRate * 100 - latePenalty)));
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

  const insights = rows.map(r => {
    const paidReminders = Number(r.paidReminders);
    const totalReminders = Number(r.totalReminders);
    const averagePaymentTime = parseFloat((Number(r.averagePaymentTime) || 0).toFixed(2));
    return {
      userId: String(r.userId),
      userName: r.userName as string,
      avatar: r.avatar as string,
      totalReminders,
      paidReminders,
      pendingReminders: Number(r.pendingReminders),
      averageReminderCount: parseFloat((Number(r.averageReminderCount) || 0).toFixed(1)),
      averagePaymentTime,
      fastestPayment: parseFloat((Number(r.fastestPayment) || 0).toFixed(2)),
      slowestPayment: parseFloat((Number(r.slowestPayment) || 0).toFixed(2)),
      reliabilityScore: computeReliabilityScore(paidReminders, totalReminders, averagePaymentTime),
    };
  });

  // Materialise the result into the insights table so it can be viewed in the
  // database. Recomputed from live reminders each time, so it's never stale or
  // hard-coded: replace this owner's rows with the current ones.
  run('DELETE FROM insights WHERE owner_user_id = ?', [currentUserId]);
  const now = Date.now();
  for (const item of insights) {
    run(
      `INSERT OR REPLACE INTO insights
         (owner_user_id, person_user_id, person_name, avatar, total_reminders, paid_reminders,
          pending_reminders, average_reminder_count, average_payment_time, fastest_payment,
          slowest_payment, reliability_score, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        currentUserId, item.userId, item.userName, item.avatar, item.totalReminders,
        item.paidReminders, item.pendingReminders, item.averageReminderCount,
        item.averagePaymentTime, item.fastestPayment, item.slowestPayment,
        item.reliabilityScore, now,
      ],
    );
  }

  return insights;
}

// Seeds ONE already-paid shared bill (Alex paid, Sarah repaid) so the demo has
// history: Sarah then shows "Usually pays in ~2 days" next to her name in the
// To-Receive tab when you create a new split with her. Runs once, guarded by an
// app_meta flag. Alex = id '1' (current user), Sarah = id '2'.
export function seedDemoHistoryIfEmpty(): void {
  const seen = query("SELECT value FROM app_meta WHERE key = 'seeded-demo-history'");
  if (seen.length > 0) return;

  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };

  addReminders([
    {
      fromUserId: '1', toUserId: '2', fromUserName: 'Alex Chen', toUserName: 'Sarah Tan',
      name: 'Sarah Tan', amount: 18.00, status: 'paid', date: daysAgo(12), category: 'Dinner at Marina Bay',
      avatar: '👩', reminderSent: true, lastReminderDate: daysAgo(12),
      totalBillAmount: 36.00, payerShare: 18.00, reminderCount: 1,
      createdDate: daysAgo(12), paidDate: daysAgo(10), thankYou: '🙏 Thanks for covering!',
      billId: 'seed-bill-marina-bay',
    },
  ]);

  run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('seeded-demo-history', 'true')");
}
