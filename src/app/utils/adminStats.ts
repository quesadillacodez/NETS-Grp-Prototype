import { query } from './db';

export interface DayBucket {
  label: string;   // 'M', 'T', ...
  date: string;    // 'Mon 28'
  count: number;   // transactions that day
  volume: number;  // absolute SGD moved that day
}

export interface AdminStats {
  totalUsers: number;        // non-admin accounts
  totalTransactions: number; // all-time
  transactionsToday: number;
  dealsRedeemed: number;
  hangoutsPlanned: number;   // group plans created by users
  hangoutsConfirmed: number; // plans where voting has closed
  walletVolume: number;      // total absolute SGD moved
  last7Days: DayBucket[];
  weekOverWeekTxnChange: number | null; // % change vs previous 7 days, null if no baseline
}

function num(sql: string, params: any[] = []): number {
  const rows = query(sql, params);
  if (!rows.length) return 0;
  const v = Object.values(rows[0])[0];
  return v == null ? 0 : Number(v);
}

const DAY = 24 * 60 * 60 * 1000;
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getAdminStats(): AdminStats {
  const totalUsers = num("SELECT COUNT(*) FROM users WHERE COALESCE(is_admin,0) = 0 AND COALESCE(merchant_id,'') = ''");
  const totalTransactions = num('SELECT COUNT(*) FROM transactions');
  const dealsRedeemed = num('SELECT COUNT(*) FROM reward_redemptions');
  const hangoutsPlanned = num('SELECT COUNT(*) FROM hangouts');
  const hangoutsConfirmed = num("SELECT COUNT(*) FROM hangouts WHERE status = 'confirmed'");
  const walletVolume = num('SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions');

  const todayStart = startOfDay(Date.now());
  const transactionsToday = num(
    'SELECT COUNT(*) FROM transactions WHERE created_at >= ?',
    [todayStart]
  );

  // Real last-7-days series, bucketed by calendar day from created_at.
  const last7Days: DayBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfDay(Date.now() - i * DAY);
    const dayEnd = dayStart + DAY;
    const d = new Date(dayStart);
    const count = num(
      'SELECT COUNT(*) FROM transactions WHERE created_at >= ? AND created_at < ?',
      [dayStart, dayEnd]
    );
    const volume = num(
      'SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions WHERE created_at >= ? AND created_at < ?',
      [dayStart, dayEnd]
    );
    last7Days.push({
      label: DOW[d.getDay()],
      date: `${DOW_FULL[d.getDay()]} ${d.getDate()}`,
      count,
      volume,
    });
  }

  // Week-over-week: this 7 days vs the previous 7 days (only if there's a baseline).
  const now = Date.now();
  const thisWeek = num(
    'SELECT COUNT(*) FROM transactions WHERE created_at >= ?',
    [now - 7 * DAY]
  );
  const prevWeek = num(
    'SELECT COUNT(*) FROM transactions WHERE created_at >= ? AND created_at < ?',
    [now - 14 * DAY, now - 7 * DAY]
  );
  const weekOverWeekTxnChange =
    prevWeek > 0 ? ((thisWeek - prevWeek) / prevWeek) * 100 : null;

  return {
    totalUsers,
    totalTransactions,
    transactionsToday,
    dealsRedeemed,
    hangoutsPlanned,
    hangoutsConfirmed,
    walletVolume,
    last7Days,
    weekOverWeekTxnChange,
  };
}

export interface UserActivity {
  id: string;
  name: string;
  avatar: string;
  transactions: number;
  redemptions: number;
  volume: number;
}

export function getUserActivity(): UserActivity[] {
  const users = query("SELECT id, name, avatar FROM users WHERE COALESCE(is_admin,0) = 0 AND COALESCE(merchant_id,'') = '' ORDER BY name");
  return users.map(u => {
    const id = String(u.id);
    return {
      id,
      name: String(u.name),
      avatar: String(u.avatar),
      transactions: num('SELECT COUNT(*) FROM transactions WHERE user_id = ?', [id]),
      redemptions: num('SELECT COUNT(*) FROM reward_redemptions WHERE user_id = ?', [id]),
      volume: num('SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions WHERE user_id = ?', [id]),
    };
  });
}
