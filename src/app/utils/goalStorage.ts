import { query, run } from './db';
import { addTransaction, formatDateForTransaction, getWalletBalance } from './transactionStorage';

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface Goal {
  id: number;
  name: string;
  target: number;
  current: number;
  icon: string;
  color: string;
  deadline: string;
}

export interface Budget {
  id: number;
  category: string;
  monthlyLimit: number;
}

function notifyGoals() { window.dispatchEvent(new CustomEvent('goalsUpdated')); }
function notifyBudgets() { window.dispatchEvent(new CustomEvent('budgetsUpdated')); }

// ─── Goals ───────────────────────────────────────────────────────────────────
export function getGoals(userId: string): Goal[] {
  return query('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY id', [userId]).map((r) => ({
    id: Number(r.id), name: String(r.name), target: Number(r.target),
    current: Number(r.current), icon: String(r.icon ?? '🎯'),
    color: String(r.color ?? '#00a94f'), deadline: String(r.deadline ?? ''),
  }));
}

export function addGoal(userId: string, g: Omit<Goal, 'id'>): void {
  run('INSERT INTO savings_goals (user_id, name, target, current, icon, color, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, g.name, g.target, g.current, g.icon, g.color, g.deadline]);
  notifyGoals();
}

export function updateGoal(g: Goal): void {
  run('UPDATE savings_goals SET name = ?, target = ?, current = ?, icon = ?, color = ?, deadline = ? WHERE id = ?',
    [g.name, g.target, g.current, g.icon, g.color, g.deadline, g.id]);
  notifyGoals();
}

export function getGoal(userId: string, goalId: number): Goal | null {
  return getGoals(userId).find(goal => goal.id === goalId) ?? null;
}

export interface GoalTransferResult {
  ok: boolean;
  /** How much actually moved. Zero on failure. */
  moved: number;
  reason?: string;
}

function refuse(reason: string): GoalTransferResult {
  return { ok: false, moved: 0, reason };
}

/**
 * Move money from the wallet into a goal.
 *
 * A contribution is a real movement of the customer's money, so it is recorded
 * as a transaction and leaves the spendable balance. It is not spending — the
 * money is still theirs, just earmarked — so it does not count towards the
 * spending dashboard's category totals.
 */
export function contributeToGoal(userId: string, goalId: number, amount: number): GoalTransferResult {
  if (!Number.isFinite(amount) || amount <= 0) return refuse('Enter an amount greater than zero.');

  const goal = getGoal(userId, goalId);
  if (!goal) return refuse('That goal no longer exists.');

  const available = getWalletBalance(userId);
  if (amount > available) return refuse(`You only have ${money(available)} available in your wallet.`);

  const room = goal.target - goal.current;
  if (room <= 0) return refuse('This goal is already fully funded.');
  if (amount > room) return refuse(`Only ${money(room)} left to reach this goal.`);

  run('UPDATE savings_goals SET current = ? WHERE id = ? AND user_id = ?',
    [goal.current + amount, goalId, userId]);
  addTransaction({
    name: goal.name,
    amount: -amount,
    date: formatDateForTransaction(),
    category: 'savings',
    kind: 'goal_contribution',
  }, userId);
  notifyGoals();
  return { ok: true, moved: amount };
}

/** Return money from a goal to the spendable wallet balance. */
export function withdrawFromGoal(userId: string, goalId: number, amount: number): GoalTransferResult {
  if (!Number.isFinite(amount) || amount <= 0) return refuse('Enter an amount greater than zero.');

  const goal = getGoal(userId, goalId);
  if (!goal) return refuse('That goal no longer exists.');
  if (goal.current <= 0) return refuse('There is nothing saved in this goal yet.');
  if (amount > goal.current) return refuse(`This goal only holds ${money(goal.current)}.`);

  run('UPDATE savings_goals SET current = ? WHERE id = ? AND user_id = ?',
    [goal.current - amount, goalId, userId]);
  addTransaction({
    name: goal.name,
    amount,
    date: formatDateForTransaction(),
    category: 'savings',
    kind: 'goal_withdrawal',
  }, userId);
  notifyGoals();
  return { ok: true, moved: amount };
}

/** Deleting a goal returns whatever it holds to the wallet rather than losing it. */
export function deleteGoal(userId: string, goalId: number): void {
  const goal = getGoal(userId, goalId);
  if (goal && goal.current > 0) withdrawFromGoal(userId, goalId, goal.current);
  run('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, userId]);
  notifyGoals();
}

// ─── Budgets ──────────────────────────────────────────────────────────────────
export function getBudgets(userId: string): Budget[] {
  return query('SELECT * FROM budgets WHERE user_id = ? ORDER BY id', [userId]).map((r) => ({
    id: Number(r.id), category: String(r.category), monthlyLimit: Number(r.monthly_limit),
  }));
}

export function setBudget(userId: string, category: string, monthlyLimit: number): void {
  const existing = query('SELECT id FROM budgets WHERE user_id = ? AND category = ?', [userId, category]);
  if (existing.length) {
    run('UPDATE budgets SET monthly_limit = ? WHERE id = ?', [monthlyLimit, Number(existing[0].id)]);
  } else {
    run('INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)', [userId, category, monthlyLimit]);
  }
  notifyBudgets();
}

export function deleteBudget(budgetId: number): void {
  run('DELETE FROM budgets WHERE id = ?', [budgetId]);
  notifyBudgets();
}

// Wipes all goals and budgets for every user. Used by "Clear All Data".
export function clearAllGoalsAndBudgets(): void {
  run('DELETE FROM savings_goals');
  run('DELETE FROM budgets');
  notifyGoals();
  notifyBudgets();
}
