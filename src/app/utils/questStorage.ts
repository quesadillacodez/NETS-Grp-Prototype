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

export const MISSIONS: Mission[] = [
  { id: 'daily-login',     title: 'Daily check-in',    description: 'Open the NETS app',                    xp: 20,  target: 1, icon: '👋' },
  { id: 'daily-payment',   title: 'Pay with NETS',     description: 'Make at least one NETS payment',       xp: 50,  target: 1, icon: '💳' },
  { id: 'heartland-visit', title: 'Support heartland', description: 'Pay at a hawker, kopitiam or market',  xp: 80,  target: 1, icon: '🍜' },
  { id: 'three-payments',  title: 'On a roll',         description: 'Make 3 NETS payments in a day',        xp: 100, target: 3, icon: '🔥' },
  { id: 'split-a-bill',    title: 'Split the bill',    description: 'Share a bill with friends',            xp: 60,  target: 1, icon: '🤝' },
];

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

/**
 * Turns the user's real transactions into quest signals. Split payments are
 * recognised by the payment flow's shared `payment_id`, so a mission cannot be
 * completed by anything other than genuine activity.
 */
export function getTransactionSignals(userId: string): QuestSignal[] {
  const rows = query(
    `SELECT name, amount, category, created_at, kind, status, payment_id
       FROM transactions
      WHERE user_id = ? AND amount < 0`,
    [userId],
  ).filter(row => classifyTransaction(row) === 'purchase');
  const signals: QuestSignal[] = [];
  for (const row of rows) {
    const at = Number(row.created_at ?? 0);
    if (!at) continue;
    signals.push({ at, kind: isHeartlandName(String(row.name)) ? 'heartland-payment' : 'payment' });
    if (row.payment_id != null) signals.push({ at, kind: 'split' });
  }
  return signals;
}

export function getQuestSignals(userId: string): QuestSignal[] {
  return [...getTransactionSignals(userId), ...getLoginSignals(userId)];
}
