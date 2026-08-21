import { flushSave, run, syncDatabaseFilesNow } from './db';
import { seedMerchantTradeIfEmpty } from './menuStorage';
import { addTransactions } from './transactionStorage';
import { addReminders } from './reminderStorage';
import { addNotification } from './notificationStorage';
import { createHangout, getActivities, voteForActivity } from './hangoutStorage';
import { seedDealsIfEmpty } from './dealStorage';
import { ensureFashionMerchants, seedMerchantsIfEmpty } from './merchantStorage';
import { getAllUsers } from './userStorage';
import { syncVoucherIndex } from './rewardStorage';
import { clearRemoteVouchers } from './voucherRegistry';

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

/**
 * XP the demo account carries in from before the scenario window. Tuned so
 * Alex's lifetime and spendable balances both sit just above the 10,000 XP
 * top tier, which is what the rewards walkthrough demonstrates.
 */
const DEMO_XP_CARRYOVER = 6100;

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
    DELETE FROM reward_promotions;
    DELETE FROM item_sales;
    DELETE FROM merchant_items;
  `);
  // Let the one-off demo history seed run again on the next reload.
  run("DELETE FROM app_meta WHERE key IN ('seeded-demo-history', 'user-cleared-fresh')");
  run("DELETE FROM app_meta WHERE key LIKE 'demo-xp-carryover:%'");

  window.dispatchEvent(new CustomEvent('transactionsUpdated'));
  window.dispatchEvent(new CustomEvent('remindersUpdated'));
  window.dispatchEvent(new CustomEvent('notificationsUpdated'));
  window.dispatchEvent(new CustomEvent('hangoutsUpdated'));
  window.dispatchEvent(new CustomEvent('rewardRedemptionsUpdated'));
  // Cards are re-seeded with their starting float on the next read, so the
  // demo begins from the same card balances every time.
  window.dispatchEvent(new CustomEvent('cardsUpdated'));
  window.dispatchEvent(new CustomEvent('promotionsUpdated'));
  window.dispatchEvent(new CustomEvent('menuUpdated'));
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

  // Alex is presented as a long-standing customer, so he does not start from
  // zero XP. The figure is stated once here rather than manufactured out of
  // months of invented transactions, and it lands him just past the top tier.
  run(
    'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
    [`demo-xp-carryover:${ALEX}`, String(DEMO_XP_CARRYOVER)],
  );

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
    billId: 'demo-bill-marina-bay',
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

  // Both debtors are in the SAME split, so they share one bill id and group
  // into a single bill.
  const openReminderIds = addReminders([
    {
      fromUserId: ALEX, toUserId: SARAH, fromUserName: 'Alex Chen', toUserName: 'Sarah Tan',
      name: 'Sarah Tan', amount: share, status: 'pending', date: isoDaysAgo(1),
      category: 'Din Tai Fung', avatar: sarah?.avatar ?? '👩',
      totalBillAmount: openBill, payerShare: share, reminderCount: 0,
      createdDate: isoDaysAgo(1), billId: 'demo-bill-din-tai-fung',
    },
    {
      fromUserId: ALEX, toUserId: MIKE, fromUserName: 'Alex Chen', toUserName: 'Mike Wong',
      name: 'Mike Wong', amount: share, status: 'pending', date: isoDaysAgo(1),
      category: 'Din Tai Fung', avatar: mike?.avatar ?? '👨',
      totalBillAmount: openBill, payerShare: share, reminderCount: 0,
      createdDate: isoDaysAgo(1), billId: 'demo-bill-din-tai-fung',
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

  // ── Reward history, so the merchant insights and the store's popularity
  // signals have something real to show the moment the demo loads ──
  //
  // Two of these are deliberately dated *before* a purchase at the same
  // merchant, which is what makes the "came back after redeeming" figure in the
  // merchant report non-zero — the single number that proves a reward worked.
  const redemptions: {
    userId: string; rewardId: number; title: string; merchant: string;
    xpCost: number; days: number; used: boolean; validityDays: number;
  }[] = [
    // Alex redeemed a coffee voucher, then paid at Kopitiam two days later.
    { userId: ALEX, rewardId: 6, title: '$3 Coffee Voucher', merchant: 'Kopitiam', xpCost: 300, days: 28, used: true, validityDays: 30 },
    // And a milk tea deal, then paid at LiHO three days later.
    { userId: ALEX, rewardId: 10, title: '1-for-1 Medium Milk Tea', merchant: 'LiHO TEA', xpCost: 350, days: 5, used: true, validityDays: 14 },
    { userId: ALEX, rewardId: 1, title: '$5 Wallet Cashback', merchant: 'NETS Wallet', xpCost: 500, days: 7, used: true, validityDays: 0 },
    // A top-tier customer has been spending, not just accumulating. Without a
    // redemption history the balance only ever grows, the whole catalogue is
    // affordable, and the affordability filter and a saved goal have nothing
    // to act on. The last two are left unused so the wallet holds live vouchers.
    { userId: ALEX, rewardId: 8, title: '$10 Ride Credit', merchant: 'Grab', xpCost: 1000, days: 21, used: true, validityDays: 45 },
    { userId: ALEX, rewardId: 11, title: '$8 Grocery Voucher', merchant: 'FairPrice', xpCost: 800, days: 18, used: true, validityDays: 30 },
    { userId: ALEX, rewardId: 9, title: '15% Off Stationery', merchant: 'Popular Bookstore', xpCost: 600, days: 16, used: true, validityDays: 30 },
    { userId: ALEX, rewardId: 12, title: '$10 Wallet Cashback', merchant: 'NETS Wallet', xpCost: 1000, days: 14, used: true, validityDays: 0 },
    { userId: ALEX, rewardId: 15, title: '$25 Hawker Feast Bundle', merchant: 'Hawker Centres', xpCost: 2500, days: 12, used: true, validityDays: 60 },
    { userId: ALEX, rewardId: 7, title: '$5 Breakfast Set', merchant: 'Ya Kun Kaya Toast', xpCost: 450, days: 9, used: true, validityDays: 30 },
    { userId: ALEX, rewardId: 4, title: '$2 Off Chicken Rice Set', merchant: 'Tiong Bahru Chicken Rice', xpCost: 200, days: 6, used: true, validityDays: 30 },
    { userId: ALEX, rewardId: 5, title: 'Free Curry Puff', merchant: 'Old Chang Kee', xpCost: 180, days: 4, used: false, validityDays: 14 },
    { userId: ALEX, rewardId: 2, title: '$5 Heartland Voucher', merchant: 'Hawker Centres', xpCost: 500, days: 2, used: false, validityDays: 30 },
    { userId: SARAH, rewardId: 2, title: '$5 Heartland Voucher', merchant: 'Hawker Centres', xpCost: 500, days: 10, used: false, validityDays: 30 },
    { userId: MIKE, rewardId: 6, title: '$3 Coffee Voucher', merchant: 'Kopitiam', xpCost: 300, days: 8, used: false, validityDays: 30 },
  ];

  redemptions.forEach((redemption, index) => {
    const redeemedAt = daysAgo(redemption.days);
    run(
      `INSERT INTO reward_redemptions
        (user_id, reward_id, title, merchant, xp_cost, ref_code, redeemed_at, used, expires_at, used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        redemption.userId, redemption.rewardId, redemption.title, redemption.merchant,
        redemption.xpCost, `XP-DEMO${String(index + 1).padStart(2, '0')}`, redeemedAt,
        redemption.used ? 1 : 0,
        redemption.validityDays > 0 ? redeemedAt + redemption.validityDays * 24 * 60 * 60 * 1000 : 0,
        redemption.used ? redeemedAt + 60 * 60 * 1000 : null,
      ],
    );
  });

  // A placement already running, so the store shows a sponsored reward and the
  // portal has a live booking to report on.
  run(
    `INSERT INTO reward_promotions
      (reward_id, title, merchant, placement, weekly_fee, starts_at, ends_at, impressions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [10, '1-for-1 Medium Milk Tea', 'LiHO TEA', 'spotlight', 90,
      daysAgo(3), daysAgo(-11), 148, daysAgo(3)],
  );

  // ── Merchant menus and a fortnight of item-level sales ──
  //
  // This is what a stallholder logs in to see: not "$6.80 at Kopitiam" but
  // "Nasi Lemak, 41 plates, mostly before 9am". Two weeks of history so the
  // week-on-week trend on each dish has a baseline to compare against.
  // Menus and a fortnight of stall trade. Shared with the fresh-database
  // seed so both paths produce identical numbers.
  seedMerchantTradeIfEmpty();

  window.dispatchEvent(new CustomEvent('rewardRedemptionsUpdated'));
  window.dispatchEvent(new CustomEvent('promotionsUpdated'));
  window.dispatchEvent(new CustomEvent('menuUpdated'));
  window.dispatchEvent(new CustomEvent('itemSalesUpdated'));

  syncDatabaseFilesNow();

  return {
    transactions: purchases.length + 3 + 3 + 1,
    reminders: 3,
    notifications: 2 + hangouts,
    hangouts,
  };
}

/**
 * Rebuilds the server voucher index to match the database that was just seeded.
 *
 * The seeded vouchers use fixed reference codes, so an index left over from an
 * earlier run still holds `XP-DEMO04` marked spent. Without the clear, the
 * wallet would show a fresh voucher that the counter refuses as already used —
 * the reset would appear not to have worked.
 */
async function rebuildVoucherIndex(): Promise<void> {
  await clearRemoteVouchers();
  for (const user of getAllUsers()) await syncVoucherIndex(user.id);
}

/** Reset and reseed, then persist immediately so a reload keeps the new state. */
export async function loadPresentationScenarioAndSave(): Promise<DemoScenarioSummary> {
  const summary = loadPresentationScenario();
  await flushSave();
  await rebuildVoucherIndex();
  return summary;
}

export async function clearActivityDataAndSave(): Promise<void> {
  clearActivityData();
  await flushSave();
  // Clearing activity removes every redemption, so the index must go with it.
  await clearRemoteVouchers();
}
