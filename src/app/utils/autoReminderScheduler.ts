import { getCurrentUser, updateLastAutoReminderSent, type User } from './userStorage';
import { getRemindersToPay } from './reminderStorage';
import { addNotification } from './notificationStorage';

const CHECK_INTERVAL_MS = 60 * 1000;
const HOUR = 60 * 60 * 1000;
const ACTIVE_HOURS = { start: 8, end: 22 };

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

function getFrequencyInMs(user: User): number {
  switch (user.reminderFrequency || 'daily') {
    case 'hourly': return HOUR;
    case '3hours': return 3 * HOUR;
    case '5hours': return 5 * HOUR;
    case '12hours': return 12 * HOUR;
    case '48hours': return 48 * HOUR;
    case 'weekly': return 7 * 24 * HOUR;
    case 'custom': {
      const ms = ((user.customReminderHours || 0) * 60 + (user.customReminderMinutes || 0)) * 60 * 1000;
      return ms > 0 ? ms : 24 * HOUR;
    }
    case 'daily':
    default:
      return 24 * HOUR;
  }
}

function isWithinActiveHours(): boolean {
  const hour = new Date().getHours();
  return hour >= ACTIVE_HOURS.start && hour < ACTIVE_HOURS.end;
}

function isReminderDue(user: User): boolean {
  if (user.autoRemindersEnabled === false) return false;
  if (!isWithinActiveHours()) return false;

  const elapsed = Date.now() - (user.lastAutoReminderSent ? new Date(user.lastAutoReminderSent).getTime() : 0);
  return elapsed >= getFrequencyInMs(user);
}

function sendAutoReminder(): void {
  const user = getCurrentUser();
  if (!isReminderDue(user)) return;

  const owed = getRemindersToPay(user.id).filter(r => r.status !== 'paid');
  if (owed.length === 0) return;

  const totalOwed = owed.reduce((sum, r) => sum + r.amount, 0);
  const first = owed[0];
  const message =
    owed.length === 1
      ? `Don't forget: You owe ${first.fromUserName} $${first.amount.toFixed(2)} for ${first.category}. Time to pay back!`
      : `Don't forget: You have ${owed.length} pending payments totaling $${totalOwed.toFixed(2)}. Time to pay back!`;

  addNotification({
    userId: user.id,
    fromUserId: user.id,
    fromUserName: 'Self Reminder',
    fromUserAvatar: '⏰',
    message,
    amount: totalOwed,
    category: owed.length === 1 ? first.category : 'Multiple bills',
    timestamp: new Date().toISOString(),
    read: false,
    reminderId: first.id,
  });

  updateLastAutoReminderSent(user.id);

  window.dispatchEvent(new CustomEvent('notificationsUpdated'));
  window.dispatchEvent(new CustomEvent('remindersUpdated'));

  const showToast = (window as any).showAutoReminderToast;
  if (typeof showToast === 'function') {
    const count = owed.length;
    showToast(`Reminder: You have ${count} pending ${count === 1 ? 'payment' : 'payments'} to make`);
  }
}

export function startAutoReminderScheduler(): void {
  if (schedulerInterval) clearInterval(schedulerInterval);

  const user = getCurrentUser();
  if (!user.lastAutoReminderSent) {
    updateLastAutoReminderSent(user.id);
  }

  schedulerInterval = setInterval(sendAutoReminder, CHECK_INTERVAL_MS);
}

export function stopAutoReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('databaseReady', startAutoReminderScheduler);

  window.addEventListener('userSwitched', startAutoReminderScheduler);
  window.addEventListener('reminderSettingsUpdated', startAutoReminderScheduler);
}
