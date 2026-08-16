import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowLeft, Sparkles, TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  Lightbulb, Target, Plus, X, Wallet, PieChart as PieIcon, PartyPopper,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AreaChart, Area, XAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';
import {
  getHealthScore, getSpendSummary, getCategoryBreakdown, getSpendingTrend, getInsights,
  type SpendCategory,
} from '../utils/spendingInsights';
import {
  getGoals, addGoal, contributeToGoal, withdrawFromGoal,
  getBudgets, setBudget, deleteBudget, type Goal,
} from '../utils/goalStorage';
import { getWalletBalance } from '../utils/transactionStorage';
import { celebrate } from '../utils/motionPreference';

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const money2 = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Tab = 'overview' | 'insights' | 'goals' | 'budgets';

export function SpendingDashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [tab, setTab] = useState<Tab>('overview');
  const now = new Date();
  const [tick, setTick] = useState(0);

  useAppEvents(['transactionsUpdated', 'goalsUpdated', 'budgetsUpdated', 'userSwitched', 'databaseReady', 'focus'], () => {
    setUser(getCurrentUser());
    setTick((t) => t + 1);
  });
  void tick;

  const y = now.getFullYear(), m = now.getMonth();
  const health = getHealthScore(user.id, y, m);
  const summary = getSpendSummary(user.id, y, m);
  const categories = getCategoryBreakdown(user.id, y, m);
  const trend = getSpendingTrend(user.id, 6);
  const insights = getInsights(user.id, y, m);
  const goals = getGoals(user.id);
  const budgets = getBudgets(user.id);

  const scoreColor = health.score >= 80 ? '#00a94f' : health.score >= 65 ? '#1565c0' : health.score >= 45 ? '#f59e0b' : '#d32f2f';
  const spendChange = summary.spentLastMonth > 0
    ? ((summary.spentThisMonth - summary.spentLastMonth) / summary.spentLastMonth) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-secondary">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#0d2b55] to-[#1565c0] px-5 pt-12 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/profile')}
            aria-label="Back to profile"
            className="w-11 h-11 flex-shrink-0 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft size={18} className="text-white" aria-hidden="true" />
          </button>
          <div>
            <div className="text-white font-bold text-base flex items-center gap-1.5">
              <Sparkles size={15} /> Spending Dashboard
            </div>
            <div className="text-white/60 text-xs">{now.toLocaleString('en-US', { month: 'long', year: 'numeric' })} · transparent smart insights</div>
          </div>
        </div>

        {/* Health score hero */}
        <div className="bg-white/12 backdrop-blur rounded-2xl p-4 flex items-center gap-4">
          <ScoreRing score={health.score} color={scoreColor} />
          <div className="flex-1 min-w-0">
            <div className="text-white/70 text-xs">Spending Health</div>
            <div className="text-white font-black text-xl">{health.grade}</div>
            <div className="text-white/70 text-xs">{health.label}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-scrollbar flex gap-1 px-3 py-2 bg-white border-b border-border flex-shrink-0 overflow-x-auto">
        {(['overview', 'insights', 'goals', 'budgets'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all ${tab === t ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {tab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Spent this month" value={money(summary.spentThisMonth)} accent="#d32f2f"
                sub={summary.spentLastMonth > 0 ? `${spendChange >= 0 ? '+' : ''}${spendChange.toFixed(0)}% vs last mo` : 'first month'}
                trendUp={spendChange > 0} icon={TrendingUp} />
              <StatCard label="Net wallet movement" value={money(summary.netCashFlow)} accent="#00a94f"
                sub="money in minus purchases" trendUp={summary.netCashFlow >= 0} icon={Target} />
              <StatCard label="Money in" value={money(summary.moneyInThisMonth)} accent="#1565c0"
                sub="top-ups, repayments & rewards" trendUp icon={Wallet} />
              <StatCard label="Transactions" value={String(summary.txnCount)} accent="#8b5cf6"
                sub={summary.topCategory ? `top: ${summary.topCategory.name}` : 'no spend yet'} trendUp icon={PieIcon} />
            </div>

            {/* Trend chart */}
            <div className="bg-white rounded-2xl border-2 border-border p-4">
              <div className="font-bold text-foreground text-sm mb-0.5">Money in vs Spending</div>
              <div className="text-muted-foreground text-xs mb-3">Last 6 months</div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={trend} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d32f2f" stopOpacity={0.3} /><stop offset="100%" stopColor="#d32f2f" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00a94f" stopOpacity={0.3} /><stop offset="100%" stopColor="#00a94f" stopOpacity={0} /></linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="income" stroke="#00a94f" strokeWidth={2} fill="url(#gInc)" />
                  <Area type="monotone" dataKey="spending" stroke="#d32f2f" strokeWidth={2} fill="url(#gSpend)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-1">
                <Legend color="#00a94f" label="Money in" />
                <Legend color="#d32f2f" label="Spending" />
              </div>
            </div>

            {/* Category breakdown */}
            <div className="bg-white rounded-2xl border-2 border-border p-4">
              <div className="font-bold text-foreground text-sm mb-3">Where your money went</div>
              {categories.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-6">No spending this month yet.</div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={110} height={110}>
                    <PieChart>
                      <Pie data={categories} dataKey="amount" innerRadius={32} outerRadius={52} paddingAngle={2}>
                        {categories.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {categories.slice(0, 5).map((c) => (
                      <div key={c.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                        <span className="text-foreground font-medium truncate flex-1">{c.emoji} {c.name}</span>
                        <span className="text-muted-foreground flex-shrink-0">{money2(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'insights' && (
          <div className="p-4 space-y-3">
            {/* Score breakdown */}
            <div className="bg-white rounded-2xl border-2 border-border p-4">
              <div className="font-bold text-foreground text-sm mb-3">Score breakdown ({health.score}/100)</div>
              {health.factors.map((f) => (
                <div key={f.label} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground font-medium">{f.label}</span>
                    <span className="text-muted-foreground">{f.points}/{f.max}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(f.points / f.max) * 100}%`, background: scoreColor }} />
                  </div>
                </div>
              ))}
            </div>

            {insights.map((ins, i) => {
              const cfg = ins.type === 'warning' ? { icon: AlertCircle, color: '#f59e0b', bg: '#fff8e6' }
                : ins.type === 'success' ? { icon: CheckCircle2, color: '#00a94f', bg: '#e6f6ed' }
                : { icon: Lightbulb, color: '#1565c0', bg: '#e8eef8' };
              const Icon = cfg.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-white rounded-2xl border-2 border-border p-4 flex gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                    <Icon size={17} style={{ color: cfg.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-foreground font-bold text-sm">{ins.title}</div>
                    <div className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{ins.body}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {tab === 'goals' && <GoalsTab userId={user.id} goals={goals} />}
        {tab === 'budgets' && <BudgetsTab userId={user.id} budgets={budgets} categories={categories} />}
      </div>
    </div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 30, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative w-[72px] h-[72px] flex-shrink-0">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
        <motion.circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white font-black text-lg leading-none">{score}</span>
        <span className="text-white/60 text-[9px]">/ 100</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent, trendUp, icon: Icon }: { label: string; value: string; sub: string; accent: string; trendUp: boolean; icon: any }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted-foreground text-xs">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: accent + '18' }}>
          <Icon size={13} style={{ color: accent }} />
        </div>
      </div>
      <div className="text-foreground font-black text-lg">{value}</div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
        {trendUp ? <TrendingUp size={10} className="text-green-600" /> : <TrendingDown size={10} className="text-red-500" />}
        {sub}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{label}</div>;
}

// ─── Goals tab ────────────────────────────────────────────────────────────────
function GoalsTab({ userId, goals }: { userId: string; goals: Goal[] }) {
  const [transferring, setTransferring] = useState<{ goal: Goal; mode: TransferMode } | null>(null);
  const [adding, setAdding] = useState(false);
  const [celebrating, setCelebrating] = useState<Goal | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const available = getWalletBalance(userId);

  const transfer = (goal: Goal, mode: TransferMode, amount: number) => {
    const result = mode === 'contribute'
      ? contributeToGoal(userId, goal.id, amount)
      : withdrawFromGoal(userId, goal.id, amount);

    if (!result.ok) {
      setProblem(result.reason ?? 'That transfer could not be completed.');
      return;
    }

    setProblem(null);
    setTransferring(null);
    if (mode === 'contribute' && goal.current < goal.target && goal.current + amount >= goal.target) {
      setCelebrating(goal);
      celebrate(confetti, { particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#00a94f', '#ffca28', '#1565c0', '#ec4899'] });
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="rounded-2xl bg-secondary p-3 text-xs text-muted-foreground">
        Money you add to a goal moves out of your spendable balance and is held
        against that goal. You have <span className="font-bold text-foreground">{money2(available)}</span> available.
      </div>

      <p className="sr-only" role="status" aria-live="polite">{problem ?? ''}</p>
      {problem && (
        <div className="rounded-2xl bg-destructive/10 p-3 text-xs font-bold text-destructive">{problem}</div>
      )}

      <button onClick={() => setAdding(true)}
        className="w-full p-3.5 rounded-2xl border-2 border-dashed border-primary/40 flex items-center justify-center gap-2 text-primary font-bold text-sm">
        <Plus size={17} /> New Savings Goal
      </button>

      {goals.map((g) => {
        const pct = Math.min(Math.round((g.current / g.target) * 100), 100);
        const reached = g.current >= g.target;
        return (
          <div key={g.id} className={`bg-white rounded-2xl border-2 p-4 ${reached ? 'border-success' : 'border-border'}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{g.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-foreground font-bold text-sm truncate">{g.name}</div>
                <div className="text-muted-foreground text-xs">{money2(g.current)} of {money2(g.target)}{g.deadline ? ` · ${g.deadline}` : ''}</div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                {reached && (
                  <span className="px-2.5 py-1.5 rounded-lg bg-success/10 text-success text-xs font-bold">Reached</span>
                )}
                {g.current > 0 && (
                  <button
                    onClick={() => { setProblem(null); setTransferring({ goal: g, mode: 'withdraw' }); }}
                    className="min-h-11 px-3 rounded-lg bg-secondary text-foreground text-xs font-bold"
                  >
                    Withdraw
                  </button>
                )}
                {!reached && (
                  <button
                    onClick={() => { setProblem(null); setTransferring({ goal: g, mode: 'contribute' }); }}
                    className="min-h-11 px-3 rounded-lg bg-primary text-white text-xs font-bold"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: g.color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }} />
            </div>
            {reached ? (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="mt-2 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success">
                <PartyPopper size={14} /> 🎉 Yay! You've reached your savings goal!
              </motion.div>
            ) : (
              <div className="text-right text-xs font-bold mt-1" style={{ color: g.color }}>{pct}%</div>
            )}
          </div>
        );
      })}

      {transferring && (
        <TransferModal
          goal={transferring.goal}
          mode={transferring.mode}
          available={available}
          onClose={() => { setTransferring(null); setProblem(null); }}
          onConfirm={(amount) => transfer(transferring.goal, transferring.mode, amount)}
        />
      )}
      {adding && <AddGoalModal onClose={() => setAdding(false)}
        onAdd={(g) => { addGoal(userId, g); setAdding(false); }} />}
      {celebrating && <GoalReachedModal goal={celebrating} onClose={() => setCelebrating(null)} />}
    </div>
  );
}

function GoalReachedModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-6" style={{ maxWidth: 390, margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full rounded-3xl bg-white p-6 text-center shadow-2xl"
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
        <motion.div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-success/10 text-3xl"
          animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.12, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
          {goal.icon}
        </motion.div>
        <h2 className="text-xl font-black text-foreground">🎉 Yay! You've reached your savings goal!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Congratulations — <span className="font-bold text-foreground">{goal.name}</span> is fully funded at {money2(goal.target)}.
        </p>
        <button onClick={onClose} className="mt-5 w-full rounded-2xl bg-primary py-3.5 text-sm font-black text-white">Nice!</button>
      </motion.div>
    </div>
  );
}

type TransferMode = 'contribute' | 'withdraw';

function TransferModal({ goal, mode, available, onClose, onConfirm }: {
  goal: Goal;
  mode: TransferMode;
  available: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const isContribute = mode === 'contribute';
  const room = goal.target - goal.current;
  // The most that can move in this direction: the wallet and the goal's
  // remaining room when paying in, the goal's balance when taking out.
  const ceiling = isContribute ? Math.min(available, room) : goal.current;
  const quick = [50, 100, 200, 500].filter(option => option <= ceiling);

  const value = Number(amount);
  const error =
    amount === '' ? null
    : !Number.isFinite(value) || value <= 0 ? 'Enter an amount greater than zero.'
    : isContribute && value > available ? `You only have ${money2(available)} available in your wallet.`
    : isContribute && value > room ? `Only ${money2(room)} left to reach this goal.`
    : !isContribute && value > goal.current ? `This goal only holds ${money2(goal.current)}.`
    : null;
  const canSubmit = value > 0 && error === null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end" style={{ maxWidth: 390, margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full bg-white rounded-t-3xl p-5 pb-8" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">{goal.icon}</span>
            <div>
              <div className="font-bold text-foreground">{goal.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {isContribute ? 'Move money into this goal' : 'Return money to your wallet'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={isContribute ? 'Cancel contribution' : 'Cancel withdrawal'}
            className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="text-muted-foreground text-xs mb-3">
          {isContribute
            ? `${money2(room)} left to reach your goal · ${money2(available)} available in your wallet`
            : `${money2(goal.current)} saved in this goal`}
        </div>

        {quick.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {quick.map((option) => (
              <button key={option} onClick={() => setAmount(String(option))}
                className={`min-h-11 rounded-xl text-sm font-bold ${amount === String(option) ? 'bg-primary text-white' : 'bg-secondary text-foreground'}`}>
                ${option}
              </button>
            ))}
          </div>
        )}

        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Custom amount"
          aria-label="Amount" aria-invalid={error !== null}
          className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none" />

        <p role="alert" className="mt-1 min-h-4 text-[11px] font-bold text-destructive">{error ?? ''}</p>

        <button onClick={() => { if (canSubmit) onConfirm(value); }} disabled={!canSubmit}
          className="mt-2 w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-30">
          {isContribute ? 'Contribute' : 'Withdraw'} {value > 0 ? money2(value) : ''}
        </button>
      </motion.div>
    </div>
  );
}

function AddGoalModal({ onClose, onAdd }: { onClose: () => void; onAdd: (g: Omit<Goal, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [icon, setIcon] = useState('🎯');
  const icons = ['🎯', '🛡️', '✈️', '🏠', '🚗', '💻', '🎓', '💍'];
  const colors = ['#00a94f', '#1565c0', '#8b5cf6', '#f59e0b', '#d32f2f'];
  const canAdd = !!name && Number(target) > 0;
  return (
    <div className="fixed inset-0 z-[60] flex items-end" style={{ maxWidth: 390, margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full bg-white rounded-t-3xl p-5 pb-8" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-foreground">New Savings Goal</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><X size={16} /></button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name (e.g. New Laptop)" className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none mb-3" />
        <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="Target amount (SGD)" className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none mb-3" />
        <div className="flex gap-2 mb-4 flex-wrap">
          {icons.map((ic) => (
            <button key={ic} onClick={() => setIcon(ic)} className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center ${icon === ic ? 'bg-primary/15 ring-2 ring-primary' : 'bg-secondary'}`}>{ic}</button>
          ))}
        </div>
        <button onClick={() => onAdd({ name, target: Number(target), current: 0, icon, color: colors[Math.floor(Math.random() * colors.length)], deadline: '' })}
          disabled={!canAdd} className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-30">Create Goal</button>
      </motion.div>
    </div>
  );
}

// ─── Budgets tab ──────────────────────────────────────────────────────────────
function BudgetsTab({ userId, budgets, categories }: { userId: string; budgets: { id: number; category: string; monthlyLimit: number }[]; categories: { name: SpendCategory; amount: number }[] }) {
  const [adding, setAdding] = useState(false);
  const spentByCat: Record<string, number> = {};
  categories.forEach((c) => { spentByCat[c.name] = c.amount; });

  return (
    <div className="p-4 space-y-3">
      <button onClick={() => setAdding(true)}
        className="w-full p-3.5 rounded-2xl border-2 border-dashed border-primary/40 flex items-center justify-center gap-2 text-primary font-bold text-sm">
        <Plus size={17} /> Set a Budget
      </button>

      {budgets.length === 0 && <div className="text-center text-muted-foreground text-xs py-8">No budgets yet. Set a monthly limit for a category to track it.</div>}

      {budgets.map((b) => {
        const spent = spentByCat[b.category] || 0;
        const pct = Math.min(Math.round((spent / b.monthlyLimit) * 100), 100);
        const over = spent > b.monthlyLimit;
        const near = pct >= 80 && !over;
        const barColor = over ? '#d32f2f' : near ? '#f59e0b' : '#00a94f';
        return (
          <div key={b.id} className="bg-white rounded-2xl border-2 border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-foreground font-bold text-sm">{b.category}</div>
              <button onClick={() => deleteBudget(b.id)} className="text-muted-foreground text-xs">Remove</button>
            </div>
            <div className="text-xs text-muted-foreground mb-2">{money2(spent)} of {money2(b.monthlyLimit)}{over ? ' · over budget!' : near ? ' · almost there' : ''}</div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: barColor }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
            </div>
            {over && <div className="flex items-center gap-1 text-xs text-red-500 mt-1.5 font-medium"><AlertCircle size={12} /> {money2(spent - b.monthlyLimit)} over your limit</div>}
          </div>
        );
      })}

      {adding && <AddBudgetModal onClose={() => setAdding(false)}
        onAdd={(cat, limit) => { setBudget(userId, cat, limit); setAdding(false); }} />}
    </div>
  );
}

function AddBudgetModal({ onClose, onAdd }: { onClose: () => void; onAdd: (cat: string, limit: number) => void }) {
  const cats: SpendCategory[] = ['Food & Dining', 'Groceries', 'Transport', 'Shopping', 'Healthcare', 'Entertainment', 'Bills & Utilities'];
  const [cat, setCat] = useState<SpendCategory>('Food & Dining');
  const [limit, setLimit] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-end" style={{ maxWidth: 390, margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full bg-white rounded-t-3xl p-5 pb-8" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-foreground">Set a Budget</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="text-xs text-muted-foreground mb-2">Category</div>
        <div className="flex gap-2 flex-wrap mb-4">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${cat === c ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>{c}</button>
          ))}
        </div>
        <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" placeholder="Monthly limit (SGD)" className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none mb-3" />
        <button onClick={() => { const l = Number(limit); if (l > 0) onAdd(cat, l); }} disabled={!(Number(limit) > 0)}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-30">Save Budget</button>
      </motion.div>
    </div>
  );
}
