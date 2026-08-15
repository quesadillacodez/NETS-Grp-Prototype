import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Award, CreditCard, Bell, History, Split, TrendingUp, Sparkles, UsersRound } from 'lucide-react';
import { NETSLogo } from '../components/NETSLogo';
import { BottomNav } from '../components/BottomNav';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { NotificationPopup } from '../components/NotificationPopup';
import { useNavigate } from 'react-router';
import { describeTransaction, getAllTransactions } from '../utils/transactionStorage';
import { getCurrentUser } from '../utils/userStorage';
import { getRemindersToReceive, getRemindersToPay } from '../utils/reminderStorage';
import { useAppEvents } from '../utils/useAppEvents';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';
import { getXPStats } from '../utils/rewardStorage';

const BASE_BALANCE = 2500.00;

const QUICK_ACTIONS = [
  { icon: CreditCard, label: 'Top-up',    path: '/top-up' },
  { icon: History,    label: 'History',   path: '/all-transactions' },
  { icon: Split,      label: 'Split Bill', path: '/scan' },
  { icon: Bell,       label: 'Reminders', path: '/reminders' },
];

export function HomePage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [transactions, setTransactions] = useState(getAllTransactions(currentUser.id));
  const [hasReminders, setHasReminders] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  useAppEvents(['transactionsUpdated', 'userSwitched', 'focus'], () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setTransactions(getAllTransactions(user.id));
  });

  useAppEvents(['remindersUpdated', 'userSwitched'], () => {
    const user = getCurrentUser();
    const hasPending =
      getRemindersToReceive(user.id).some((r) => r.status !== 'paid') ||
      getRemindersToPay(user.id).some((r) => r.status !== 'paid');
    setHasReminders(hasPending);
  });

  useEffect(() => {
    (window as any).showAutoReminderToast = (msg: string) =>
      toast.info('🔔 ' + msg, { description: 'Check your notifications', duration: 4000 });
    return () => { delete (window as any).showAutoReminderToast; };
  }, []);

  const balance = BASE_BALANCE + transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const xp = getXPStats(currentUser.id);

  return (
    <div className="flex flex-col h-full bg-background">

      <div className="px-4 pt-8 pb-3 bg-white">

        <div className="flex items-center justify-between mb-3">
          <div>
            <NETSLogo />
            <p className="text-xs text-muted-foreground mt-0.5">
              Welcome back, {currentUser.name.split(' ')[0]}! 👋
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/reminders')}
              aria-label={hasReminders ? 'Reminders — you have pending bills' : 'Reminders'}
              className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center hover:scale-105 transition-transform relative"
            >
              <Bell className="w-4 h-4 text-foreground" aria-hidden="true" />
              {hasReminders && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
              )}
            </button>
            <button
              onClick={() => navigate('/profile')}
              aria-label={`Profile and settings for ${currentUser.name}`}
              className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center hover:scale-105 transition-transform"
            >
              <span className="text-base" aria-hidden="true">{currentUser.avatar}</span>
            </button>
          </div>
        </div>

        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-primary rounded-2xl p-4 shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <span className="text-sm">{currentUser.avatar}</span>
              </div>
              <div>
                <p className="text-white/80 text-xs leading-none mb-0.5">NETS vCashCard</p>
                <p className="text-white text-xs font-semibold">{currentUser.name}</p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-white/70" />
          </div>

          <div className="mb-3">
            <p className="text-white/80 text-xs mb-0.5">Available Balance</p>
            <h1 className="text-3xl font-black text-white tracking-tight">${balance.toFixed(2)}</h1>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
            </div>
            <div className="flex items-center gap-1 text-white/90 text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" />
              Active
            </div>
          </div>
        </motion.div>
      </div>

      <div className="px-4 py-3 bg-white">
        <h3 className="text-xs font-black text-foreground mb-2">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_ACTIONS.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => action.path && navigate(action.path)}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary shadow-md flex items-center justify-center">
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-foreground font-bold">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto pb-20 space-y-3">

        <div className="grid grid-cols-2 gap-3">
          <motion.button
            initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onClick={() => navigate('/hangouts')}
            className="rounded-2xl bg-[#eef7ff] p-3 text-left border border-[#d7eaff]"
          >
            <div className="w-9 h-9 rounded-xl bg-[#2563eb] text-white flex items-center justify-center mb-2"><UsersRound size={18} /></div>
            <p className="text-xs font-black text-foreground">Plan a Hangout</p>
            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">Favourite ideas and let friends vote</p>
          </motion.button>
          <motion.button
            initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.04 }}
            onClick={() => navigate('/rewards')}
            className="rounded-2xl bg-[#fff8df] p-3 text-left border border-[#f7e8a6]"
          >
            <div className="w-9 h-9 rounded-xl bg-[#f59e0b] text-white flex items-center justify-center mb-2"><Award size={18} /></div>
            <p className="text-xs font-black text-foreground">{xp.currentXP.toLocaleString()} XP available</p>
            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">Earn on payments, redeem in Rewards</p>
          </motion.button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-black text-foreground">Recent Activity</h2>
            {transactions.length > 0 && (
              <button
                onClick={() => navigate('/all-transactions')}
                className="text-xs text-primary font-black"
              >
                See all →
              </button>
            )}
          </div>

          {transactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 mx-auto mb-2 flex items-center justify-center">
                <History className="w-6 h-6 text-primary" />
              </div>
              <p className="text-xs font-bold text-foreground">No transactions yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Start splitting bills to see your activity</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 5).map((tx, i) => {
                const described = describeTransaction(tx);
                return (
                  <motion.button
                    key={tx.id}
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/transaction/${tx.id}`)}
                    className="w-full text-left bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${described.isIncoming ? 'bg-success' : 'bg-destructive'}`}>
                        {described.isIncoming
                          ? <ArrowDownLeft className="w-4 h-4 text-white" />
                          : <ArrowUpRight className="w-4 h-4 text-white" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground leading-tight">{tx.name}</p>
                        <p className="text-xs text-muted-foreground">{described.meta.activity} · {tx.date}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-black ${described.isIncoming ? 'text-success' : 'text-destructive'}`}>
                      {described.signedAmount}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <NotificationPopup />
      <BottomNav />
      <AccountSwitcher isOpen={showAccountSwitcher} onClose={() => setShowAccountSwitcher(false)} />
      <Toaster position="top-center" />
    </div>
  );
}
