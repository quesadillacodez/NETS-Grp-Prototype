import { type ReactNode, useState } from 'react';
import {
  Award, Check, ChevronRight, Clock3, Gift, History, LockKeyhole, Search,
  ShoppingBag, Sparkles, Store, TicketCheck, Trophy, WalletCards, X, Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { BottomNav } from '../components/BottomNav';
import { NETSLogo } from '../components/NETSLogo';
import {
  getRewardsCatalog,
  getRewardRedemptions,
  getTier,
  getTierProgress,
  getXPHistory,
  getXPLedger,
  getXPStats,
  markRewardUsed,
  redeemReward,
  TIERS,
  tierMultiplier,
  type Reward,
  type RewardCategory,
  type RewardRedemption,
} from '../utils/rewardStorage';
import { currentStreak, dayKey, evaluateDay, getQuestSignals } from '../utils/questStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

type RewardsTab = 'overview' | 'store' | 'wallet' | 'ledger' | 'history';

function isCashbackRedemption(redemption: RewardRedemption): boolean {
  return redemption.merchant === 'NETS Wallet' && /cashback/i.test(redemption.title);
}

function OverlaySheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-50 flex items-end bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="max-h-[92%] w-full overflow-y-auto rounded-t-[28px] bg-white" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 280 }} onClick={event => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex justify-center bg-white py-3"><div className="h-1 w-10 rounded-full bg-gray-300" /></div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function RewardDetail({ reward, currentXP, onRedeem, onClose }: {
  reward: Reward;
  currentXP: number;
  onRedeem: () => void;
  onClose: () => void;
}) {
  const canRedeem = currentXP >= reward.xpCost;
  return (
    <OverlaySheet onClose={onClose}>
      <div className="px-5 pb-8">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-sm font-black text-primary">{reward.icon}</div><div><p className="text-xs font-bold text-muted-foreground">{reward.merchant}</p><h2 className="max-w-[245px] text-xl font-black leading-tight">{reward.title}</h2></div></div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><X size={18} /></button>
        </div>
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#1e2a4a] p-4 text-white"><div><p className="text-xs text-white/65">Reward cost</p><p className="text-2xl font-black">{reward.xpCost.toLocaleString()} XP</p></div><Gift size={30} className="text-[#ffca28]" /></div>
        <p className="text-sm leading-relaxed text-muted-foreground">{reward.description}</p>
        <div className="my-4 space-y-2 rounded-2xl border border-border p-3 text-xs text-foreground">
          <p className="flex items-center gap-2"><TicketCheck size={15} className="text-primary" />One redemption per voucher code</p>
          <p className="flex items-center gap-2"><Clock3 size={15} className="text-primary" />{reward.validityDays ? `Valid for ${reward.validityDays} days` : 'Cashback is applied instantly'}</p>
        </div>
        <div className={`mb-4 rounded-xl p-3 text-xs ${canRedeem ? 'bg-success/10 text-success' : 'bg-red-50 text-red-700'}`}>
          {canRedeem ? `After redemption: ${(currentXP - reward.xpCost).toLocaleString()} XP` : `You need ${(reward.xpCost - currentXP).toLocaleString()} more XP.`}
        </div>
        <button disabled={!canRedeem} onClick={onRedeem} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{canRedeem ? <><Gift size={17} /> Confirm redemption</> : <><LockKeyhole size={17} /> Not enough XP</>}</button>
      </div>
    </OverlaySheet>
  );
}

function VoucherDetail({ redemption, onUse, onClose }: { redemption: RewardRedemption; onUse: () => void; onClose: () => void }) {
  const instantCashback = isCashbackRedemption(redemption);
  return (
    <OverlaySheet onClose={onClose}>
      <div className="px-5 pb-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><TicketCheck size={28} /></div>
        <p className="mt-3 text-xs font-bold text-muted-foreground">{redemption.merchant}</p>
        <h2 className="text-xl font-black">{redemption.title}</h2>
        {instantCashback ? (
          <div className="mx-auto my-5 grid h-28 w-28 place-items-center rounded-full bg-success/10 text-3xl font-black text-success">S$</div>
        ) : (
          <div className="mx-auto my-5 grid h-44 w-44 place-items-center rounded-3xl border-8 border-[#1e2a4a] bg-white p-3">
            <div className="grid grid-cols-7 gap-1">{Array.from({ length: 49 }).map((_, index) => <div key={index} className={`h-3 w-3 ${((index * 7 + redemption.id * 3) % 5) < 2 ? 'bg-[#1e2a4a]' : 'bg-white'}`} />)}</div>
          </div>
        )}
        <p className="font-mono text-sm font-black tracking-wider text-primary">{redemption.refCode}</p>
        <p className="mt-1 text-xs text-muted-foreground">{instantCashback ? 'Cashback has been credited directly to your wallet.' : 'Present this prototype voucher code to the merchant.'}</p>
        {instantCashback ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-success/10 py-3 text-sm font-black text-success"><Check size={17} /> Cashback applied</div>
        ) : redemption.used ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-black text-muted-foreground"><Check size={17} /> Voucher marked as used</div>
        ) : (
          <button onClick={onUse} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white"><Check size={17} /> Mark as used</button>
        )}
      </div>
    </OverlaySheet>
  );
}

function TierSheet({ lifetimeXP, onClose }: { lifetimeXP: number; onClose: () => void }) {
  const tier = getTier(lifetimeXP);
  const progress = getTierProgress(lifetimeXP, tier);
  const remaining = tier.next === null ? 0 : tier.next - lifetimeXP;
  return (
    <OverlaySheet onClose={onClose}>
      <div className="px-5 pb-8">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground">Your tier</p>
            <h2 className="text-xl font-black leading-tight">{tier.name}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Lifetime {lifetimeXP.toLocaleString()} XP earned</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><X size={18} /></button>
        </div>

        <div className="rounded-2xl border border-border p-4">
          <div className="flex items-end justify-between text-xs font-black">
            <span style={{ color: tier.color }}>Level {tier.level}</span>
            <span className="text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
              className="h-full rounded-full"
              style={{ backgroundColor: tier.color }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
            <span>{tier.start.toLocaleString()} XP</span>
            <span>{tier.next === null ? 'Max' : `${tier.next.toLocaleString()} XP`}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {tier.next === null
              ? 'You have unlocked every tier. Keep earning XP to spend in the Rewards Store.'
              : `${remaining.toLocaleString()} XP to reach ${TIERS[tier.level].name}.`}
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2">
            <Sparkles size={14} className="shrink-0 text-primary" />
            <p className="text-[11px] text-foreground">
              Your tier earns <span className="font-black">{tierMultiplier(tier.level)}x XP</span> on every
              payment{tier.next === null ? '.' : `, rising to ${tierMultiplier(tier.level + 1)}x at the next tier.`}
            </p>
          </div>
        </div>

        <h3 className="mb-2 mt-5 text-sm font-black">All tiers</h3>
        <div className="space-y-2">
          {TIERS.map(item => {
            const unlocked = lifetimeXP >= item.start;
            const isCurrent = item.level === tier.level;
            return (
              <div
                key={item.level}
                className={`rounded-2xl border p-3 ${isCurrent ? 'border-2 bg-secondary/40' : 'border-border bg-white'}`}
                style={isCurrent ? { borderColor: item.color } : undefined}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
                    style={{ backgroundColor: unlocked ? item.color : '#cbd5e1' }}
                  >
                    {unlocked ? <Check size={18} /> : <LockKeyhole size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-black">{item.name}</p>
                      {isCurrent && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black text-white">You</span>}
                    </div>
                    <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">
                      {item.next === null
                        ? `${item.start.toLocaleString()} XP and above`
                        : `${item.start.toLocaleString()} - ${(item.next - 1).toLocaleString()} XP`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-black" style={{ color: unlocked ? item.color : undefined }}>
                      {tierMultiplier(item.level)}x
                    </p>
                    <p className="text-[9px] font-bold text-muted-foreground">earn rate</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{item.blurb}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
          Tiers are based on lifetime XP earned, so redeeming rewards never costs you a tier.
        </p>
      </div>
    </OverlaySheet>
  );
}

function Overview({ userId, onTab, onOpenTiers, onOpenMonth, onOpenQuests }: {
  userId: string;
  onTab: (tab: RewardsTab) => void;
  onOpenTiers: () => void;
  onOpenMonth: () => void;
  onOpenQuests: () => void;
}) {
  const stats = getXPStats(userId);
  const tier = getTier(stats.lifetimeXP);
  const progress = getTierProgress(stats.lifetimeXP, tier);
  const signals = getQuestSignals(userId);
  const today = evaluateDay(signals, dayKey(Date.now()));
  const streak = currentStreak(signals);
  return (
    <div className="space-y-3">
      <motion.button type="button" onClick={onOpenTiers} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#126c55] via-[#0e7a5f] to-[#1e2a4a] p-5 text-left text-white shadow-lg">
        <div className="flex items-start justify-between"><div><p className="text-xs font-bold text-white/65">Available balance</p><h1 className="mt-1 text-4xl font-black tracking-tight">{stats.currentXP.toLocaleString()} <span className="text-lg">XP</span></h1></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Award size={24} /></div></div>
        <div className="mt-5 flex items-center justify-between text-xs font-bold"><span>{tier.name}</span><span className="text-white/65">Lifetime {stats.lifetimeXP.toLocaleString()} XP</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full rounded-full bg-[#ffca28]" /></div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-white/70">{tier.next ? `${(tier.next - stats.lifetimeXP).toLocaleString()} XP to the next tier` : 'Highest tier unlocked'}</p>
          <span className="flex items-center gap-0.5 text-[10px] font-black text-white/85">View tiers <ChevronRight size={12} /></span>
        </div>
      </motion.button>

      <section className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onOpenMonth} className="rounded-2xl border border-border bg-white p-3 text-left"><div className="flex items-center justify-between text-primary"><div className="flex items-center gap-2"><Zap size={16} /><span className="text-xs font-black">This month</span></div><ChevronRight size={14} className="text-muted-foreground" /></div><p className="mt-2 text-2xl font-black">+{stats.earnedThisMonth.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">XP from real NETS payments</p></button>
        <button type="button" onClick={onOpenQuests} className="rounded-2xl border border-border bg-white p-3 text-left"><div className="flex items-center justify-between text-[#f59e0b]"><div className="flex items-center gap-2"><Trophy size={16} /><span className="text-xs font-black">Today's missions</span></div><ChevronRight size={14} className="text-muted-foreground" /></div><p className="mt-2 text-2xl font-black">{today.completedCount}/{today.missions.length}</p><p className="text-[10px] text-muted-foreground">{streak > 0 ? `${streak} day streak` : 'Start a streak today'}</p></button>
      </section>

      {stats.expiringSoon > 0 && (
        <button type="button" onClick={() => onTab('store')} className="flex w-full items-center gap-3 rounded-2xl bg-[#fff4e5] p-3 text-left">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f59e0b] text-white"><Clock3 size={17} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-[#7a4a00]">{stats.expiringSoon.toLocaleString()} XP expiring soon</p>
            <p className="text-[10px] text-[#94601a]">
              Use it before {stats.expiringSoonAt ? new Date(stats.expiringSoonAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : 'it lapses'}
            </p>
          </div>
          <ChevronRight size={15} className="shrink-0 text-[#94601a]" />
        </button>
      )}

      <section className="rounded-2xl bg-[#fff8df] p-4">
        <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffca28]"><Sparkles size={19} /></div><div><h2 className="text-sm font-black">Earn more at heartland merchants</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Standard payments earn 10 XP per $1. Hawker centres, kopitiams and selected local merchants earn 2x XP automatically.</p></div></div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-black">Your rewards journey</h2>
        <div className="space-y-2">
          {[
            { tab: 'store' as const, icon: Store, title: 'Rewards Store', text: 'Spend XP on cashback and vouchers' },
          { tab: 'ledger' as const, icon: Clock3, title: 'XP Ledger', text: 'See what expires and when' },
            { tab: 'wallet' as const, icon: WalletCards, title: 'My Wallet', text: 'Open active voucher codes' },
            { tab: 'history' as const, icon: History, title: 'XP History', text: 'Trace every point earned and spent' },
          ].map(item => <button key={item.tab} onClick={() => onTab(item.tab)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><item.icon size={19} /></div><div className="flex-1"><p className="text-xs font-black">{item.title}</p><p className="text-[10px] text-muted-foreground">{item.text}</p></div><ChevronRight size={16} className="text-muted-foreground" /></button>)}
        </div>
      </section>
    </div>
  );
}

function StoreView({ currentXP, onSelect }: { currentXP: number; onSelect: (reward: Reward) => void }) {
  const [category, setCategory] = useState<RewardCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [affordableOnly, setAffordableOnly] = useState(false);
  const catalog = getRewardsCatalog();
  const term = search.trim().toLowerCase();
  const matching = catalog.filter(reward =>
    (category === 'All' || reward.category === category) &&
    (!term || `${reward.title} ${reward.merchant} ${reward.tags.join(' ')}`.toLowerCase().includes(term)),
  );
  const affordableCount = matching.filter(reward => reward.xpCost <= currentXP).length;
  const filtered = affordableOnly ? matching.filter(reward => reward.xpCost <= currentXP) : matching;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Spend with purpose</p><h1 className="text-xl font-black">Rewards Store</h1></div><div className="rounded-xl bg-[#fff2bd] px-3 py-2 text-xs font-black text-[#7a5a00]">{currentXP.toLocaleString()} XP</div></div>
      <div className="mb-2 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5"><Search size={16} className="text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search rewards" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div>
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">{(['All', 'Cashback', 'Vouchers', 'Partner Deals'] as const).map(item => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${category === item ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>{item}</button>)}</div>
      <button
        onClick={() => setAffordableOnly(value => !value)}
        className={`mb-4 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left ${affordableOnly ? 'bg-success/10' : 'bg-secondary'}`}
      >
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${affordableOnly ? 'border-success bg-success text-white' : 'border-muted-foreground/40'}`}>
          {affordableOnly && <Check size={12} />}
        </span>
        <span className={`flex-1 text-xs font-bold ${affordableOnly ? 'text-success' : 'text-muted-foreground'}`}>
          I can afford this now
        </span>
        <span className="text-[10px] font-black text-muted-foreground">{affordableCount} of {matching.length}</span>
      </button>
      {filtered.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground"><LockKeyhole size={24} /></div>
          <h2 className="mt-3 text-sm font-black">{affordableOnly ? 'Nothing in reach yet' : 'No rewards match'}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {affordableOnly ? 'Keep earning XP, or clear the filter to browse everything.' : 'Try a different search or category.'}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">{filtered.map(reward => {
        const locked = currentXP < reward.xpCost;
        return <button key={reward.id} onClick={() => onSelect(reward)} className="rounded-2xl border border-border bg-white p-3 text-left shadow-sm"><div className="mb-3 flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-xs font-black text-primary">{reward.icon}</div>{locked && <LockKeyhole size={14} className="text-muted-foreground" />}</div><p className="text-[10px] font-bold text-muted-foreground">{reward.merchant}</p><h3 className="mt-0.5 min-h-8 text-xs font-black leading-tight">{reward.title}</h3><div className="mt-3 flex items-center justify-between"><span className="text-xs font-black text-primary">{reward.xpCost} XP</span><span className={`rounded-lg px-2 py-1 text-[9px] font-black ${locked ? 'bg-secondary text-muted-foreground' : 'bg-primary text-white'}`}>{locked ? 'View' : 'Redeem'}</span></div></button>;
      })}</div>
    </div>
  );
}

function WalletView({ userId, onOpen }: { userId: string; onOpen: (redemption: RewardRedemption) => void }) {
  const redemptions = getRewardRedemptions(userId);
  return (
    <div><p className="text-xs text-muted-foreground">Ready when you are</p><h1 className="text-xl font-black">My Rewards Wallet</h1>
      {redemptions.length === 0 ? <div className="mt-16 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary"><WalletCards size={28} /></div><h2 className="mt-3 text-base font-black">No vouchers yet</h2><p className="mt-1 text-xs text-muted-foreground">Redeem a reward and its code will appear here.</p></div> : <div className="mt-4 space-y-3">{redemptions.map(item => <button key={item.id} onClick={() => onOpen(item)} className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left ${item.used && !isCashbackRedemption(item) ? 'border-border opacity-60' : 'border-primary/20 shadow-sm'}`}><div className="grid h-12 w-12 place-items-center rounded-xl bg-[#fff2bd] text-[#7a5a00]"><TicketCheck size={22} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{item.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.merchant} - {item.xpCost} XP</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black ${isCashbackRedemption(item) ? 'bg-success/10 text-success' : item.used ? 'bg-secondary text-muted-foreground' : 'bg-success/10 text-success'}`}>{isCashbackRedemption(item) ? 'Applied' : item.used ? 'Used' : 'Active'}</span></button>)}</div>}
    </div>
  );
}

function HistoryView({ userId }: { userId: string }) {
  const history = getXPHistory(userId);
  const earned = history.filter(item => item.type === 'earn').reduce((sum, item) => sum + item.xp, 0);
  const spent = history.filter(item => item.type === 'spend').reduce((sum, item) => sum + item.xp, 0);
  return (
    <div><p className="text-xs text-muted-foreground">Fully traceable</p><h1 className="text-xl font-black">XP History</h1>
      <div className="my-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-success/10 p-3"><p className="text-[10px] font-bold text-success">Total earned</p><p className="text-xl font-black text-success">+{earned.toLocaleString()}</p></div><div className="rounded-2xl bg-red-50 p-3"><p className="text-[10px] font-bold text-red-700">Total spent</p><p className="text-xl font-black text-red-700">-{spent.toLocaleString()}</p></div></div>
      <div className="space-y-2">{history.map(item => <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3"><div className={`grid h-10 w-10 place-items-center rounded-xl ${item.type === 'earn' ? 'bg-success/10 text-success' : 'bg-red-50 text-red-600'}`}>{item.type === 'earn' ? <Zap size={18} /> : <Gift size={18} />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{item.title}</p><p className="truncate text-[10px] text-muted-foreground">{item.subtitle}</p>{item.bonus && <span className="mt-1 inline-block rounded-full bg-[#fff2bd] px-2 py-0.5 text-[9px] font-black text-[#7a5a00]">{item.bonus}</span>}</div><p className={`text-sm font-black ${item.type === 'earn' ? 'text-success' : 'text-red-600'}`}>{item.type === 'earn' ? '+' : '-'}{item.xp}</p></div>)}</div>
    </div>
  );
}

function LedgerView({ userId }: { userId: string }) {
  const ledger = getXPLedger(userId);
  const live = ledger.lots.filter(lot => lot.remaining > 0);
  return (
    <div>
      <p className="text-xs text-muted-foreground">Every point accounted for</p>
      <h1 className="text-xl font-black">XP Ledger</h1>

      <div className="my-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-primary/10 p-3">
          <p className="text-[10px] font-bold text-primary">Spendable now</p>
          <p className="text-xl font-black text-primary">{ledger.balance.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-[#fff4e5] p-3">
          <p className="text-[10px] font-bold text-[#7a4a00]">Expiring soon</p>
          <p className="text-xl font-black text-[#7a4a00]">{ledger.expiringSoon.toLocaleString()}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-border p-3 text-center">
        <div><p className="text-[9px] font-bold text-muted-foreground">Earned</p><p className="text-xs font-black text-success">+{ledger.totalEarned.toLocaleString()}</p></div>
        <div><p className="text-[9px] font-bold text-muted-foreground">Spent</p><p className="text-xs font-black text-red-600">-{ledger.totalSpent.toLocaleString()}</p></div>
        <div><p className="text-[9px] font-bold text-muted-foreground">Expired</p><p className="text-xs font-black text-muted-foreground">-{ledger.totalExpired.toLocaleString()}</p></div>
      </div>

      <p className="mb-2 rounded-xl bg-secondary p-3 text-[10px] leading-relaxed text-muted-foreground">
        XP expires at the end of the month after it was earned, and redemptions always spend your
        oldest points first so nothing lapses unnecessarily.
      </p>

      <h2 className="mb-2 mt-4 text-sm font-black">Active XP</h2>
      {live.length === 0 ? (
        <p className="rounded-2xl border border-border bg-white p-4 text-xs text-muted-foreground">
          No active XP. Pay with NETS to start earning again.
        </p>
      ) : (
        <div className="space-y-2">
          {live.map(lot => {
            const days = Math.ceil((lot.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
            return (
              <div key={lot.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black">{lot.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Expires {new Date(lot.expiresAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                    {days <= 14 ? ` - ${days} day${days === 1 ? '' : 's'} left` : ''}
                  </p>
                </div>
                <p className={`shrink-0 text-sm font-black ${days <= 14 ? 'text-[#b7791f]' : 'text-foreground'}`}>
                  {lot.remaining.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RewardsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [tab, setTab] = useState<RewardsTab>('overview');
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<RewardRedemption | null>(null);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showTiers, setShowTiers] = useState(false);
  const [, setVersion] = useState(0);
  const refresh = () => { setCurrentUser(getCurrentUser()); setVersion(version => version + 1); };
  useAppEvents(['transactionsUpdated', 'rewardRedemptionsUpdated', 'dealsUpdated', 'userSwitched', 'databaseReady', 'focus'], refresh);
  const stats = getXPStats(currentUser.id);

  const confirmRedemption = () => {
    if (!selectedReward) return;
    const result = redeemReward(currentUser.id, selectedReward);
    setSelectedReward(null);
    if (result) { refresh(); setTab('wallet'); setSelectedVoucher(result); }
  };
  const useVoucher = () => {
    if (!selectedVoucher) return;
    markRewardUsed(selectedVoucher.id, currentUser.id);
    setSelectedVoucher({ ...selectedVoucher, used: true });
    refresh();
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border bg-white px-4 pb-3 pt-8">
        <div className="flex items-center justify-between"><div><NETSLogo /><p className="mt-0.5 text-xs text-muted-foreground">NETS Rewards · earn and spend XP</p></div><button onClick={() => setShowAccountSwitcher(true)} className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-base">{currentUser.avatar}</button></div>
        <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1">
          {([
            { key: 'overview', label: 'XP Home', icon: Award },
            { key: 'store', label: 'Store', icon: ShoppingBag },
            { key: 'wallet', label: 'Wallet', icon: WalletCards },
            { key: 'ledger', label: 'Ledger', icon: Clock3 },
            { key: 'history', label: 'History', icon: History },
          ] as const).map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`flex min-w-max flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-[10px] font-black ${tab === item.key ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}><item.icon size={13} />{item.label}</button>)}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28">
        {tab === 'overview' && (
          <Overview
            userId={currentUser.id}
            onTab={setTab}
            onOpenTiers={() => setShowTiers(true)}
            onOpenMonth={() => navigate('/xp-breakdown')}
            onOpenQuests={() => navigate('/quests')}
          />
        )}
        {tab === 'store' && <StoreView currentXP={stats.currentXP} onSelect={setSelectedReward} />}
        {tab === 'wallet' && <WalletView userId={currentUser.id} onOpen={setSelectedVoucher} />}
        {tab === 'ledger' && <LedgerView userId={currentUser.id} />}
        {tab === 'history' && <HistoryView userId={currentUser.id} />}
      </main>
      <BottomNav />
      <AccountSwitcher isOpen={showAccountSwitcher} onClose={() => setShowAccountSwitcher(false)} />
      <AnimatePresence>{showTiers && <TierSheet lifetimeXP={stats.lifetimeXP} onClose={() => setShowTiers(false)} />}</AnimatePresence>
      <AnimatePresence>{selectedReward && <RewardDetail reward={selectedReward} currentXP={stats.currentXP} onClose={() => setSelectedReward(null)} onRedeem={confirmRedemption} />}</AnimatePresence>
      <AnimatePresence>{selectedVoucher && <VoucherDetail redemption={selectedVoucher} onClose={() => setSelectedVoucher(null)} onUse={useVoucher} />}</AnimatePresence>
    </div>
  );
}
