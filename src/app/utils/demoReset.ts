import { flushSave, run, syncDatabaseFilesNow } from './db';
import { addTransactions } from './transactionStorage';
import { addReminders } from './reminderStorage';
import { addNotification } from './notificationStorage';
import { createHangout, getActivities, voteForActivity } from './hangoutStorage';
import { seedDealsIfEmpty } from './dealStorage';
import { ensureFashionMerchants, seedMerchantsIfEmpty } from './merchantStorage';
import { getAllUsers } from './userStorage';

/**
 * Presentation controls.
 *
 * "Clear All Data" wipes everything including the merchant and rewards
 * catalogues, which leaves the app empty — useful once, but not what you want
 * before a demo. These two functions are the controlled alternative:
 *
 *  - `clearActivityData` removes only what a demo generates (payments, splits,
 *    reminders, notifications, plans, redemptions), keeping accounts, PINs and
 *    catalogues intact.
 *  - `loadPresentationScenario` clears that same activity and then seeds a
 *    known, repeatable starting state, so every run-through of the demo begins
 *    from identical numbers.
 */

export interface DemoScenarioSummary {
  transactions: number;
  reminders: number;
  notifications: number;
  hangouts: number;
}

const ALEX = '1';
const SARAH = '2';
const MIKE = '3';

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function isoDaysAgo(days: number): string {
  return new Date(daysAgo(days)).toISOString();
}

function labelDaysAgo(days: number): string {
  if (days === 0) return 'Just now';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/** Remove everything a demo run produces, keeping accounts and catalogues. */
export function clearActivityData(): void {
  run(`
    DELETE FROM notifications;
    DELETE FROM reminders;
    DELETE FROM transactions;
    DELETE FROM redemptions;
    DELETE FROM reward_redemptions;
    DELETE FROM saved_deals;
    DELETE FROM saved_activities;
    DELETE FROM hangout_votes;
    DELETE FROM hangouts;
    DELETE FROM savings_goals;
    DELETE FROM budgets;
    DELETE FROM processed_payments;
    DELETE FROM insights;
    DELETE FROM cards;
  `);
  // Let the one-off demo history seed run again on the next reload.
  run("DELETE FROM app_meta WHERE key IN ('seeded-demo-history', 'user-cleared-fresh')");

  window.dispatchEvent(new CustomEvent('transactionsUpdated'));
  window.dispatchEvent(new CustomEvent('remindersUpdated'));
  window.dispatchEvent(new CustomEvent('notificationsUpdated'));
  window.dispatchEvent(new CustomEvent('hangoutsUpdated'));
  window.dispatchEvent(new CustomEvent('rewardRedemptionsUpdated'));
  // Cards are re-seeded with their starting float on the next read, so the
  // demo begins from the same card balances every time.
  window.dispatchEvent(new CustomEvent('cardsUpdated'));
}

/**
 * Seed the exact state the presentation walks through. Everything here is
 * dated relative to today, so the dashboard, Wrapped and the spending trend all
 * have real history no matter when the demo is run.
 */
export function loadPresentationScenario(): DemoScenarioSummary {
  clearActivityData();

  // Catalogues are needed for XP rates and Hangout ideas; these are no-ops when
  // the catalogues already exist.
  seedMerchantsIfEmpty();
  ensureFashionMerchants();
  seedDealsIfEmpty();

  const users = getAllUsers();
  const sarah = users.find(user => user.id === SARAH);
  const mike = users.find(user => user.id === MIKE);

  // ── Alex's own spending, spread across categories and weeks ──
  const purchases: { name: string; amount: number; category: string; days: number }[] = [
    { name: 'Kopitiam Toa Payoh',     amount: -6.80,  category: 'Food & Dining',      days: 26 },
    { name: 'FairPrice Finest',       amount: -68.40, category: 'Groceries',          days: 24 },
    { name: 'Grab',                   amount: -14.50, category: 'Transport',          days: 21 },
    { name: 'Guardian Pharmacy',      amount: -23.90, category: 'Healthcare',         days: 18 },
    { name: 'Ya Kun Kaya Toast',      amount: -9.20,  category: 'Food & Dining',      days: 15 },
    { name: 'Singtel',                amount: -42.00, category: 'Bills & Utilities',  days: 12 },
    { name: 'Uniqlo Bugis',           amount: -59.90, category: 'Shopping',           days: 9 },
    { name: 'Golden Village',         amount: -27.00, category: 'Entertainment',      days: 6 },
    { name: 'Sheng Siong',            amount: -34.15, category: 'Groceries',          days: 4 },
    { name: 'LiHO TEA',               amount: -5.60,  category: 'Food & Dining',      days: 2 },
  ];

  addTransactions(purchases.map(purchase => ({
    userId: ALEX,
    name: purchase.name,
    amount: purchase.amount,
    date: labelDaysAgo(purchase.days),
    category: purchase.category,
    kind: 'purchase' as const,
    createdAt: daysAgo(purchase.days),
  })));

  // ── Wallet flows: a top-up and a cashback credit, so the history shows every
  // transaction type rather than purchases alone ──
  addTransactions([
    {
      userId: ALEX, name: 'Top-up via PayNow', amount: 120, date: labelDaysAgo(20),
      category: 'topup', kind: 'topup', createdAt: daysAgo(20),
    },
    {
      userId: ALEX, name: 'NETS XP Cashback', amount: 5, date: labelDaysAgo(7),
      category: 'reward', kind: 'cashback', createdAt: daysAgo(7),
    },
    {
      userId: ALEX, name: 'Golden Village', amount: 13.50, date: labelDaysAgo(5),
      category: 'Entertainment', kind: 'refund', createdAt: daysAgo(5),
    },
  ]);

  // ── A settled split from last week: Sarah already repaid Alex ──
  addReminders([{
    fromUserId: ALEX, toUserId: SARAH, fromUserName: 'Alex Chen', toUserName: 'Sarah Tan',
    name: 'Sarah Tan', amount: 18.00, status: 'paid', date: isoDaysAgo(11),
    category: 'Dinner at Marina Bay', avatar: sarah?.avatar ?? '👩',
    reminderSent: true, lastReminderDate: isoDaysAgo(11),
    totalBillAmount: 36.00, payerShare: 18.00, reminderCount: 1,
    createdDate: isoDaysAgo(11), paidDate: isoDaysAgo(9), thankYou: '🙏 Thanks for covering!',
  }]);

  addTransactions([
    {
      userId: ALEX, name: 'Dinner at Marina Bay', amount: -36.00, date: labelDaysAgo(11),
      category: 'Food & Dining', kind: 'purchase', createdAt: daysAgo(11),
    },
    {
      userId: ALEX, name: 'Sarah Tan', amount: 18.00, date: labelDaysAgo(9),
      category: 'Food & Dining', status: 'received', kind: 'repayment_received', createdAt: daysAgo(9),
    },
    {
      userId: SARAH, name: 'Dinner at Marina Bay (split with Alex Chen)', amount: -18.00,
      date: labelDaysAgo(9), category: 'Food & Dining', status: 'sent',
      kind: 'repayment_sent', createdAt: daysAgo(9),
    },
  ]);

  // ── An open split from yesterday: Sarah and Mike still owe Alex ──
  const openBill = 54.60;
  const share = 18.20;
  addTransactions([{
    userId: ALEX, name: 'Din Tai Fung', amount: -openBill, date: labelDaysAgo(1),
    category: 'Food & Dining', kind: 'purchase', createdAt: daysAgo(1),
  }]);

  const openReminderIds = addReminders([
    {
      fromUserId: ALEX, toUserId: SARAH, fromUserName: 'Alex Chen', toUserName: 'Sarah Tan',
      name: 'Sarah Tan', amount: share, status: 'pending', date: isoDaysAgo(1),
      category: 'Din Tai Fung', avatar: sarah?.avatar ?? '👩',
      totalBillAmount: openBill, payerShare: share, reminderCount: 0,
      createdDate: isoDaysAgo(1),
    },
    {
      fromUserId: ALEX, toUserId: MIKE, fromUserName: 'Alex Chen', toUserName: 'Mike Wong',
      name: 'Mike Wong', amount: share, status: 'pending', date: isoDaysAgo(1),
      category: 'Din Tai Fung', avatar: mike?.avatar ?? '👨',
      totalBillAmount: openBill, payerShare: share, reminderCount: 0,
      createdDate: isoDaysAgo(1),
    },
  ]);

  // Each debtor gets the request in their own Notification Centre.
  [{ userId: SARAH, reminderId: openReminderIds[0] }, { userId: MIKE, reminderId: openReminderIds[1] }]
    .forEach(({ userId, reminderId }) => {
      addNotification({
        userId,
        fromUserId: ALEX,
        fromUserName: 'Alex Chen',
        fromUserAvatar: '👨‍💼',
        message: `Hey! Remember to pay Alex Chen $${share.toFixed(2)} for Din Tai Fung. Total bill was $${openBill.toFixed(2)}`,
        amount: share,
        category: 'Din Tai Fung',
        timestamp: isoDaysAgo(1),
        read: false,
        reminderId,
        channel: 'reminders',
        link: '/reminders',
      });
    });

  // ── A Hangout mid-vote, so the voting flow can be shown without setup ──
  const activities = getActivities();
  const activityIds = activities.slice(0, 3).map(activity => activity.id);
  let hangouts = 0;
  if (activityIds.length >= 2) {
    const preferredDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const hangoutId = createHangout({
      ownerUserId: ALEX,
      name: 'Weekend Catch-up',
      activityIds,
      invitedUserIds: [SARAH, MIKE],
      preferredDate,
      budgetPerPerson: 40,
    });
    // One friend has already voted; the plan is deliberately left un-confirmed.
    voteForActivity(hangoutId, SARAH, activityIds[0]);
    hangouts = 1;

    addNotification({
      userId: ALEX,
      fromUserId: SARAH,
      fromUserName: sarah?.name ?? 'Sarah Tan',
      fromUserAvatar: sarah?.avatar ?? '👩',
      message: `${sarah?.name ?? 'Sarah Tan'} voted in Weekend Catch-up`,
      amount: 0,
      category: 'Weekend Catch-up',
      timestamp: isoDaysAgo(0),
      read: false,
      channel: 'hangouts',
      link: '/hangouts',
    });
  }

  syncDatabaseFilesNow();

  return {
    transactions: purchases.length + 3 + 3 + 1,
    reminders: 3,
    notifications: 2 + hangouts,
    hangouts,
  };
}

/** Reset and reseed, then persist immediately so a reload keeps the new state. */
export async function loadPresentationScenarioAndSave(): Promise<DemoScenarioSummary> {
  const summary = loadPresentationScenario();
  await flushSave();
  return summary;
}

export async function clearActivityDataAndSave(): Promise<void> {
  clearActivityData();
  await flushSave();
}
