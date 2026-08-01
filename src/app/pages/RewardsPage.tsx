import { type ReactNode, useState } from 'react';
import {
  Award, Check, ChevronRight, Clock3, Gift, History, LockKeyhole, Search,
  ShoppingBag, Sparkles, Store, TicketCheck, Trophy, WalletCards, X, Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { BottomNav } from '../components/BottomNav';
import { NETSLogo } from '../components/NETSLogo';
import {
  getRewardsCatalog,
  getRewardRedemptions,
  getTier,
  getXPHistory,
  getXPStats,
  markRewardUsed,
  redeemReward,
  type Reward,
  type RewardCategory,
  type RewardRedemption,
} from '../utils/rewardStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

type RewardsTab = 'overview' | 'store' | 'wallet' | 'history';

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

function Overview({ userId, onTab }: { userId: string; onTab: (tab: RewardsTab) => void }) {
  const stats = getXPStats(userId);
  const tier = getTier(stats.lifetimeXP);
  const progress = tier.next ? Math.min(100, Math.max(0, ((stats.lifetimeXP - tier.start) / (tier.next - tier.start)) * 100)) : 100;
  const questProgress = Math.min(3, stats.transactionCount);
  return (
    <div className="space-y-3">
      <motion.section initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#126c55] via-[#0e7a5f] to-[#1e2a4a] p-5 text-white shadow-lg">
        <div className="flex items-start justify-between"><div><p className="text-xs font-bold text-white/65">Available balance</p><h1 className="mt-1 text-4xl font-black tracking-tight">{stats.currentXP.toLocaleString()} <span className="text-lg">XP</span></h1></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Award size={24} /></div></div>
        <div className="mt-5 flex items-center justify-between text-xs font-bold"><span>{tier.name}</span><span className="text-white/65">Lifetime {stats.lifetimeXP.toLocaleString()} XP</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full rounded-full bg-[#ffca28]" /></div>
        <p className="mt-2 text-[10px] text-white/70">{tier.next ? `${(tier.next - stats.lifetimeXP).toLocaleString()} XP to the next tier` : 'Highest tier unlocked'}</p>
      </motion.section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-white p-3"><div className="flex items-center gap-2 text-primary"><Zap size={16} /><span className="text-xs font-black">This month</span></div><p className="mt-2 text-2xl font-black">+{stats.earnedThisMonth.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">XP from real NETS payments</p></div>
        <div className="rounded-2xl border border-border bg-white p-3"><div className="flex items-center gap-2 text-[#f59e0b]"><Trophy size={16} /><span className="text-xs font-black">Weekly quest</span></div><p className="mt-2 text-2xl font-black">{questProgress}/3</p><p className="text-[10px] text-muted-foreground">Make 3 NETS payments</p></div>
      </section>

      <section className="rounded-2xl bg-[#fff8df] p-4">
        <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffca28]"><Sparkles size={19} /></div><div><h2 className="text-sm font-black">Earn more at heartland merchants</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Standard payments earn 10 XP per $1. Hawker centres, kopitiams and selected local merchants earn 2x XP automatically.</p></div></div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-black">Your rewards journey</h2>
        <div className="space-y-2">
          {[
            { tab: 'store' as const, icon: Store, title: 'Rewards Store', text: 'Spend XP on cashback and vouchers' },
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
  const catalog = getRewardsCatalog();
  const term = search.trim().toLowerCase();
  const filtered = catalog.filter(reward =>
    (category === 'All' || reward.category === category) &&
    (!term || `${reward.title} ${reward.merchant} ${reward.tags.join(' ')}`.toLowerCase().includes(term)),
  );
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Spend with purpose</p><h1 className="text-xl font-black">Rewards Store</h1></div><div className="rounded-xl bg-[#fff2bd] px-3 py-2 text-xs font-black text-[#7a5a00]">{currentXP.toLocaleString()} XP</div></div>
      <div className="mb-2 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5"><Search size={16} className="text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search rewards" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{(['All', 'Cashback', 'Vouchers', 'Partner Deals'] as const).map(item => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${category === item ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>{item}</button>)}</div>
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

export function RewardsPage() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [tab, setTab] = useState<RewardsTab>('overview');
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<RewardRedemption | null>(null);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
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
        <div className="flex items-center justify-between"><div><NETSLogo /><p className="mt-0.5 text-xs text-muted-foreground">Hadi's XP loyalty experience</p></div><button onClick={() => setShowAccountSwitcher(true)} className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-base">{currentUser.avatar}</button></div>
        <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1">
          {([
            { key: 'overview', label: 'XP Home', icon: Award },
            { key: 'store', label: 'Store', icon: ShoppingBag },
            { key: 'wallet', label: 'Wallet', icon: WalletCards },
            { key: 'history', label: 'History', icon: History },
          ] as const).map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`flex min-w-max flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-[10px] font-black ${tab === item.key ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}><item.icon size={13} />{item.label}</button>)}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28">
        {tab === 'overview' && <Overview userId={currentUser.id} onTab={setTab} />}
        {tab === 'store' && <StoreView currentXP={stats.currentXP} onSelect={setSelectedReward} />}
        {tab === 'wallet' && <WalletView userId={currentUser.id} onOpen={setSelectedVoucher} />}
        {tab === 'history' && <HistoryView userId={currentUser.id} />}
      </main>
      <BottomNav />
      <AccountSwitcher isOpen={showAccountSwitcher} onClose={() => setShowAccountSwitcher(false)} />
      <AnimatePresence>{selectedReward && <RewardDetail reward={selectedReward} currentXP={stats.currentXP} onClose={() => setSelectedReward(null)} onRedeem={confirmRedemption} />}</AnimatePresence>
      <AnimatePresence>{selectedVoucher && <VoucherDetail redemption={selectedVoucher} onClose={() => setSelectedVoucher(null)} onUse={useVoucher} />}</AnimatePresence>
    </div>
  );
}
