import { useMemo, useState } from 'react';
import { Sparkles, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { DarkHeader } from '../components/DarkHeader';
import {
  currentMonthKey,
  getXPHistory,
  listXPMonths,
  summariseMonth,
} from '../utils/rewardStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

function formatDay(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

export function XPBreakdownPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [history, setHistory] = useState(() => getXPHistory(currentUser.id));
  // Null means "follow the newest month"; set once the user picks a tab so their
  // choice survives refreshes triggered by new transactions.
  const [pickedKey, setPickedKey] = useState<string | null>(null);

  useAppEvents(['transactionsUpdated', 'rewardRedemptionsUpdated', 'userSwitched', 'databaseReady', 'focus'], () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setHistory(getXPHistory(user.id));
  });

  // Always offer the current month, even with no activity yet, so the screen
  // never opens on an empty tab strip.
  const tabs = useMemo(() => listXPMonths(history, currentMonthKey()), [history]);

  const activeKey = pickedKey && tabs.some(month => month.key === pickedKey)
    ? pickedKey
    : tabs[0]?.key ?? currentMonthKey();
  const active = tabs.find(month => month.key === activeKey);
  const summary = useMemo(() => summariseMonth(history, activeKey), [history, activeKey]);

  // Scale each row's bar against the biggest earner so the month reads at a glance.
  const maxXP = summary.entries.reduce((max, entry) => Math.max(max, entry.xp), 0);

  return (
    <div className="flex h-full flex-col bg-background">
      <DarkHeader title="XP Breakdown" onBack={() => navigate('/rewards')} bottomGap="mb-5" padding="pt-12 pb-6">
        <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-md">
          <p className="text-xs text-white/75">{active?.longLabel ?? 'This month'}</p>
          <h2 className="mt-1 text-4xl font-black text-white">
            +{summary.earned.toLocaleString()} <span className="text-lg">XP</span>
          </h2>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-white/75">
            <span>{summary.transactionCount} payment{summary.transactionCount === 1 ? '' : 's'}</span>
            {summary.spent > 0 && <span>-{summary.spent.toLocaleString()} XP redeemed</span>}
          </div>
        </div>
      </DarkHeader>

      <div className="flex gap-2 overflow-x-auto border-b border-border bg-white px-4 pb-3">
        {tabs.map(month => (
          <button
            key={month.key}
            onClick={() => setPickedKey(month.key)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition-colors ${
              month.key === activeKey ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {month.label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        {summary.entries.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Zap size={28} />
            </div>
            <h2 className="mt-3 text-base font-black">No XP earned in {active?.label ?? 'this month'}</h2>
            <p className="mt-1 text-xs text-muted-foreground">Pay with NETS to start earning again.</p>
          </div>
        ) : (
          <>
            <section className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-white p-3">
                <div className="flex items-center gap-2 text-primary">
                  <TrendingUp size={15} />
                  <span className="text-[11px] font-black">Top source</span>
                </div>
                <p className="mt-2 truncate text-sm font-black">{summary.topSource?.title ?? '-'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {summary.topSource ? `${summary.topSource.xp.toLocaleString()} XP` : 'No payments yet'}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-white p-3">
                <div className="flex items-center gap-2 text-[#f59e0b]">
                  <Sparkles size={15} />
                  <span className="text-[11px] font-black">Bonus XP</span>
                </div>
                <p className="mt-2 text-sm font-black">{summary.bonusXP.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">From 2x and merchant bonuses</p>
              </div>
            </section>

            <h2 className="mb-2 text-sm font-black">Earned from transactions</h2>
            <div className="space-y-2">
              {summary.entries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="rounded-2xl border border-border bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black">{entry.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {entry.subtitle}
                        {entry.createdAt > 1 ? ` - ${formatDay(entry.createdAt)}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-success">+{entry.xp.toLocaleString()}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${maxXP > 0 ? (entry.xp / maxXP) * 100 : 0}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                  {entry.bonus && (
                    <span className="mt-2 inline-block rounded-full bg-[#fff2bd] px-2 py-0.5 text-[9px] font-black text-[#7a5a00]">
                      {entry.bonus}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
