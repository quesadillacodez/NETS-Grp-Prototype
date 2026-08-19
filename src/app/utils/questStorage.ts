import { query, run } from './db';
import { classifyTransaction } from './transactionModel';

/**
 * Daily missions.
 *
 * The old "weekly quest" counted lifetime transactions, so it pinned to 3/3
 * forever once a user had ever made three payments. Missions are now evaluated
 * per calendar day against real activity - payments recorded by the payment
 * flow and app opens recorded at startup - so they reset every day on their own
 * without any scheduled job.
 */

export type MissionId = 'daily-login' | 'daily-payment' | 'heartland-visit' | 'three-payments' | 'split-a-bill';

export interface Mission {
  id: MissionId;
  title: string;
  description: string;
  /** XP granted when the mission is completed on a given day. */
  xp: number;
  /** How many qualifying actions are needed that day. */
  target: number;
  icon: string;
}

export interface MissionProgress extends Mission {
  progress: number;
  complete: boolean;
}

export interface QuestDay {
  /** Local `YYYY-MM-DD` key. */
  day: string;
  date: Date;
  missions: MissionProgress[];
  completedCount: number;
  xpEarned: number;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Mission values are deliberately modest next to the 150-1000 XP reward prices.
 * Clearing every mission every day would otherwise mint far more XP than
 * spending does - a $6 kopi earns 60 XP, so a full day of missions must not be
 * worth several times a real purchase.
 */
export const MISSIONS: Mission[] = [
  { id: 'daily-login',     title: 'Daily check-in',    description: 'Open the NETS app',                    xp: 10, target: 1, icon: '👋' },
  { id: 'daily-payment',   title: 'Pay with NETS',     description: 'Make at least one NETS payment',       xp: 25, target: 1, icon: '💳' },
  { id: 'heartland-visit', title: 'Support heartland', description: 'Pay at a hawker, kopitiam or market',  xp: 40, target: 1, icon: '🍜' },
  { id: 'three-payments',  title: 'On a roll',         description: 'Make 3 NETS payments in a day',        xp: 50, target: 3, icon: '🔥' },
  { id: 'split-a-bill',    title: 'Split the bill',    description: 'Share a bill with friends',            xp: 25, target: 1, icon: '🤝' },
];

/**
 * Ceiling on mission XP per week. Missions reward habit, not grinding: without
 * a cap a committed user mints more XP from missions alone than from actually
 * spending, and the reward catalogue loses its meaning.
 */
export const WEEKLY_MISSION_XP_CAP = 400;

/** Monday-anchored `YYYY-MM-DD` key for the week containing `timestamp`. */
export function weekKey(timestamp: number): string {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  // getDay() is Sunday-based; shift so Monday starts the week.
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dayKey(date.getTime());
}

/** One qualifying action, extracted from a real transaction row. */
export interface QuestSignal {
  at: number;
  kind: 'payment' | 'heartland-payment' | 'split' | 'login';
}

const HEARTLAND_KEYWORDS = [
  'hawker', 'kopitiam', 'food court', 'market', 'chicken rice',
  'old chang kee', 'breadtalk', 'maxwell', 'amoy', 'tiong bahru',
];

export function isHeartlandName(name: string): boolean {
  const normalized = name.toLowerCase();
  return HEARTLAND_KEYWORDS.some(keyword => normalized.includes(keyword));
}

/** Local day key. Uses local time so "today" matches the user's calendar. */
export function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function countFor(signals: QuestSignal[], mission: Mission): number {
  switch (mission.id) {
    case 'daily-login':
      return signals.filter(s => s.kind === 'login').length;
    case 'daily-payment':
    case 'three-payments':
      return signals.filter(s => s.kind === 'payment' || s.kind === 'heartland-payment').length;
    case 'heartland-visit':
      return signals.filter(s => s.kind === 'heartland-payment').length;
    case 'split-a-bill':
      return signals.filter(s => s.kind === 'split').length;
  }
}

/** Evaluates every mission for one day against that day's signals. */
export function evaluateDay(signals: QuestSignal[], day: string, now: number = Date.now()): QuestDay {
  const ofDay = signals.filter(signal => dayKey(signal.at) === day);
  const [year, month, date] = day.split('-').map(Number);
  const dayDate = new Date(year, month - 1, date);
  const startOfDay = dayDate.getTime();

  const missions: MissionProgress[] = MISSIONS.map(mission => {
    const progress = Math.min(mission.target, countFor(ofDay, mission));
    return { ...mission, progress, complete: progress >= mission.target };
  });

  return {
    day,
    date: dayDate,
    missions,
    completedCount: missions.filter(m => m.complete).length,
    xpEarned: missions.filter(m => m.complete).reduce((sum, m) => sum + m.xp, 0),
    isToday: day === dayKey(now),
    isFuture: startOfDay > now,
  };
}

/** The seven days ending today, oldest first. */
export function rollingWeek(signals: QuestSignal[], now: number = Date.now()): QuestDay[] {
  const days: QuestDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    days.push(evaluateDay(signals, dayKey(date.getTime()), now));
  }
  return days;
}

/** Every day of the month containing `monthAnchor`, oldest first. */
export function calendarMonth(signals: QuestSignal[], monthAnchor: number, now: number = Date.now()): QuestDay[] {
  const anchor = new Date(monthAnchor);
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const days: QuestDay[] = [];
  for (let date = 1; date <= daysInMonth; date += 1) {
    const stamp = new Date(anchor.getFullYear(), anchor.getMonth(), date).getTime();
    days.push(evaluateDay(signals, dayKey(stamp), now));
  }
  return days;
}

/** Consecutive completed days ending today (or yesterday, if today is still open). */
export function currentStreak(signals: QuestSignal[], now: number = Date.now()): number {
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const evaluated = evaluateDay(signals, dayKey(date.getTime()), now);
    if (evaluated.completedCount > 0) {
      streak += 1;
    } else if (offset > 0) {
      break;
    }
  }
  return streak;
}

// ── Persistence ────────────────────────────────────────────────────────────

/** Records that the user opened the app today. Idempotent per day. */
export function recordLogin(userId: string, at: number = Date.now()): void {
  run('INSERT OR IGNORE INTO daily_logins (user_id, day, at) VALUES (?, ?, ?)', [userId, dayKey(at), at]);
}

export function getLoginSignals(userId: string): QuestSignal[] {
  return query('SELECT at FROM daily_logins WHERE user_id = ?', [userId])
    .map(row => ({ at: Number(row.at), kind: 'login' as const }));
}

/** Turns the user's real purchases into payment signals. */
export function getTransactionSignals(userId: string): QuestSignal[] {
  const rows = query(
    `SELECT name, amount, category, created_at, kind, status
       FROM transactions
      WHERE user_id = ? AND amount < 0`,
    [userId],
  ).filter(row => classifyTransaction(row) === 'purchase');
  const signals: QuestSignal[] = [];
  for (const row of rows) {
    const at = Number(row.created_at ?? 0);
    if (!at) continue;
    signals.push({ at, kind: isHeartlandName(String(row.name)) ? 'heartland-payment' : 'payment' });
  }
  return signals;
}

/**
 * Splits the user started, taken from the bills they are owed on.
 *
 * Not from the transaction's `payment_id`: that is an idempotency key carried
 * by every payment, so keying off it completed "Split the bill" whenever
 * somebody paid for a kopi on their own.
 */
export function getSplitSignals(userId: string): QuestSignal[] {
  const signals: QuestSignal[] = [];
  for (const row of query('SELECT created_date, date FROM reminders WHERE from_user_id = ?', [userId])) {
    const raw = row.created_date ?? row.date;
    const at = raw ? Date.parse(String(raw)) : NaN;
    if (!Number.isNaN(at)) signals.push({ at, kind: 'split' });
  }
  return signals;
}

export function getQuestSignals(userId: string): QuestSignal[] {
  return [...getTransactionSignals(userId), ...getSplitSignals(userId), ...getLoginSignals(userId)];
}
