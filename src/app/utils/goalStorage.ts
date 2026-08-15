import { query, run } from './db';

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

export function contributeToGoal(goalId: number, amount: number): void {
  const rows = query('SELECT target, current FROM savings_goals WHERE id = ?', [goalId]);
  if (!rows.length) return;
  const target = Number(rows[0].target);
  const next = Math.min(Number(rows[0].current) + amount, target);
  run('UPDATE savings_goals SET current = ? WHERE id = ?', [next, goalId]);
  notifyGoals();
}

export function deleteGoal(goalId: number): void {
  run('DELETE FROM savings_goals WHERE id = ?', [goalId]);
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
