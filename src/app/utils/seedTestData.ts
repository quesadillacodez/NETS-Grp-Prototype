import { addReminders, type Reminder } from './reminderStorage';
import { getAllUsers } from './userStorage';
import { query, run } from './db';

const DAY = 24 * 60 * 60 * 1000;
const HAS_SEEDED_KEY = 'has-seeded';

interface SeedBill {
  category: string;
  totalAmount: number;
  daysToPay: [number, number, number];
}

const SAMPLE_BILLS: { bill: SeedBill; daysAgo: number }[] = [
  { daysAgo: 15, bill: { category: 'Hawker Haven', totalAmount: 156.0, daysToPay: [1, 5, 3] } },
  { daysAgo: 10, bill: { category: 'KTV Session', totalAmount: 200.0, daysToPay: [2, 7, 4] } },
];

function hasSeeded(): boolean {
  const row = query('SELECT value FROM app_meta WHERE key = ?', [HAS_SEEDED_KEY]);
  return row.length > 0 && row[0].value === 'true';
}

function markSeeded(): void {
  run('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [HAS_SEEDED_KEY, 'true']);
}

export function seedTestReminders(): void {
  if (hasSeeded()) return;

  const users = getAllUsers();
  if (users.length < 4) return;

  const [alex, sarah, mike, jenny] = users;
  const debtors = [sarah, mike, jenny];
  const now = Date.now();

  const reminders: Omit<Reminder, 'id'>[] = [];

  for (const { bill, daysAgo } of SAMPLE_BILLS) {
    const billDate = new Date(now - daysAgo * DAY);
    const share = parseFloat((bill.totalAmount / 4).toFixed(2));

    debtors.forEach((debtor, index) => {
      const daysToPay = bill.daysToPay[index];
      const paidDate = new Date(billDate.getTime() + daysToPay * DAY);

      reminders.push({
        name: debtor.name,
        amount: share,
        status: 'paid',
        date: billDate.toISOString().split('T')[0],
        category: bill.category,
        avatar: debtor.avatar,
        fromUserId: alex.id,
        toUserId: debtor.id,
        fromUserName: alex.name,
        toUserName: debtor.name,
        totalBillAmount: bill.totalAmount,
        payerShare: share,
        reminderSent: true,
        lastReminderDate: paidDate.toISOString(),
        reminderCount: daysToPay,
        createdDate: billDate.toISOString(),
        paidDate: paidDate.toISOString(),
      });
    });
  }

  addReminders(reminders);
  markSeeded();
}

const HAS_SEEDED_TXNS_KEY = 'has-seeded-txns';

function hasSeededTxns(): boolean {
  const row = query('SELECT value FROM app_meta WHERE key = ?', [HAS_SEEDED_TXNS_KEY]);
  return row.length > 0 && row[0].value === 'true';
}

// Seed a realistic spread of real transactions across the last 7 days for all
// users. These are genuine DB rows (with real created_at timestamps) that flow
// through the same queries the dashboard, home screen, and history use — nothing
// about the numbers is hardcoded in the UI. Runs once, independently of the
// reminder seed, so databases seeded before this feature existed still get data.
export function seedTransactions(): void {
  if (hasSeededTxns()) return;

  // Don't seed if the user already has real transactions of their own.
  const existing = query('SELECT COUNT(*) AS n FROM transactions');
  if (existing.length && Number(existing[0].n) > 0) {
    run('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [HAS_SEEDED_TXNS_KEY, 'true']);
    return;
  }

  const users = getAllUsers().filter(u => !u.isAdmin);
  if (users.length === 0) return;

  const now = Date.now();
  const merchants = [
    { name: 'FairPrice Xtra', cat: 'payment', amt: -43.2 },
    { name: 'Hawker Chan', cat: 'payment', amt: -6.5 },
    { name: 'Starbucks Orchard', cat: 'payment', amt: -8.9 },
    { name: 'Grab Taxi', cat: 'payment', amt: -12.4 },
    { name: 'Top-up via PayNow', cat: 'topup', amt: 50.0 },
    { name: 'BreadTalk Bugis', cat: 'payment', amt: -4.8 },
    { name: 'Kopitiam Food Court', cat: 'payment', amt: -7.3 },
    { name: 'Top-up via DBS/POSB', cat: 'topup', amt: 30.0 },
    { name: 'Din Tai Fung', cat: 'payment', amt: -28.6 },
    { name: 'Guardian Pharmacy', cat: 'payment', amt: -15.9 },
    { name: 'Top-up via Card', cat: 'topup', amt: 100.0 },
    { name: 'BEV EAT PTE', cat: 'payment', amt: -12.5 },
  ];

  users.forEach((u, ui) => {
    const count = 6 + (ui % 3) * 2; // 6-10 transactions per user
    for (let i = 0; i < count; i++) {
      const m = merchants[(ui * 3 + i) % merchants.length];
      const ts = Math.round(now - Math.random() * 7 * DAY);
      const d = new Date(ts);
      const dateLabel = `${d.getDate()}/${d.getMonth() + 1}`;
      run(
        `INSERT INTO transactions
          (user_id, name, amount, date, category, status, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, m.name, m.amt, dateLabel, m.cat, null, m.amt < 0 ? 'purchase' : 'topup', ts]
      );
    }
  });

  run('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [HAS_SEEDED_TXNS_KEY, 'true']);
}

if (typeof window !== 'undefined') {
  (window as any).seedTestReminders = seedTestReminders;
}
