import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';
import {
  X, Shield, Users, TrendingUp, TrendingDown, DollarSign, UsersRound,
  RefreshCw, ArrowLeft, Lock, ChevronRight, ChevronLeft, Store, Plus, Pencil, Trash2, Vote, Zap, LogOut,
} from 'lucide-react';
import { getCurrentUser, getAllUsers, isAdminUser } from '../utils/userStorage';
import { logout } from '../utils/authStorage';
import { describeTransaction, getAllTransactions, walletBalanceFrom, type Transaction } from '../utils/transactionStorage';
import { getRedemptions } from '../utils/redemptionStorage';
import {
  getMerchants, saveMerchant, deleteMerchant,
  DEFAULT_XP_BONUS, DEFAULT_XP_RATE, type Merchant,
} from '../utils/merchantStorage';
import {
  getActivities, addActivity, updateActivity, deleteActivity,
  getAllHangouts, getActivity, getHangoutVotes, getParticipantIds,
  type Activity, type ActivityCategory, type Hangout,
} from '../utils/hangoutStorage';
import { getAdminStats, getUserActivity, type AdminStats, type UserActivity } from '../utils/adminStats';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { useAppEvents } from '../utils/useAppEvents';

const ACTIVITY_CATEGORIES: ActivityCategory[] = ['food', 'attraction', 'creative', 'active'];

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// The portal reads its labels from the same shared model as the customer app,
// so a repayment can never appear here as a "Top-up".
function toAdminTxn(tx: Transaction, userName: string) {
  const described = describeTransaction(tx);
  return {
    id: described.reference,
    user: userName,
    type: described.meta.label,
    amount: described.signedAmount,
    time: tx.date,
    isTopup: described.isIncoming,
  };
}

function makeMerchantId(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'merchant'}-${Date.now().toString(36)}`;
}

// ─── Hangout activity editor ─────────────────────────────────────────────────
function ActivityModal({ onClose, onSave, editActivity }: {
  onClose: () => void;
  onSave: (activity: Omit<Activity, 'id'>, editId?: number) => void;
  editActivity?: Activity | null;
}) {
  const [title, setTitle] = useState(editActivity?.title ?? '');
  const [venue, setVenue] = useState(editActivity?.venue ?? '');
  const [location, setLocation] = useState(editActivity?.location ?? '');
  const [category, setCategory] = useState<ActivityCategory>(editActivity?.category ?? 'food');
  const [price, setPrice] = useState(editActivity ? String(editActivity.pricePerPerson) : '');
  const [duration, setDuration] = useState(editActivity?.duration ?? '');
  const [groupSize, setGroupSize] = useState(editActivity?.groupSize ?? '');
  const [rating, setRating] = useState(editActivity ? String(editActivity.rating) : '4.5');
  const [image, setImage] = useState(editActivity?.image ?? '');
  const [description, setDescription] = useState(editActivity?.description ?? '');

  const priceValue = parseFloat(price) || 0;
  const ratingValue = parseFloat(rating) || 0;
  const canSubmit = !!title.trim() && !!venue.trim() && !!location.trim()
    && priceValue > 0 && !!duration.trim() && !!groupSize.trim()
    && ratingValue > 0 && ratingValue <= 5;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSave({
      category,
      title: title.trim(),
      venue: venue.trim(),
      location: location.trim(),
      pricePerPerson: priceValue,
      duration: duration.trim(),
      groupSize: groupSize.trim(),
      rating: ratingValue,
      image: image.trim() || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=520&fit=crop&auto=format',
      description: description.trim() || `A group activity at ${venue.trim()}.`,
    }, editActivity?.id);
  };

  return (
    <motion.div className="fixed inset-0 z-[60] flex flex-col" style={{ maxWidth: 390, margin: '0 auto' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative mt-auto bg-white rounded-t-3xl max-h-[90vh] flex flex-col"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold text-lg text-foreground">{editActivity ? 'Edit Hangout Activity' : 'Add Hangout Activity'}</h2>
          <button onClick={onClose} aria-label="Close activity editor" className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center">
            <X size={16} className="text-foreground" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex flex-col gap-3 pb-8">
          <input placeholder="Activity title" value={title} onChange={(e) => setTitle(e.target.value)}
            className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          <input placeholder="Venue" value={venue} onChange={(e) => setVenue(e.target.value)}
            className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          <input placeholder="Area (e.g. Bugis)" value={location} onChange={(e) => setLocation(e.target.value)}
            className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          <div className="grid grid-cols-4 gap-2">
            {ACTIVITY_CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`py-3 rounded-xl text-xs font-bold capitalize ${category === c ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="number" placeholder="Price per person (SGD)" value={price} onChange={(e) => setPrice(e.target.value)}
              className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
            <input type="number" step="0.1" max="5" placeholder="Rating" value={rating} onChange={(e) => setRating(e.target.value)}
              className="w-24 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </div>
          <div className="flex gap-2">
            <input placeholder="Duration (e.g. 90 min)" value={duration} onChange={(e) => setDuration(e.target.value)}
              className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
            <input placeholder="Group size (e.g. 2-8)" value={groupSize} onChange={(e) => setGroupSize(e.target.value)}
              className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </div>
          <input placeholder="Image URL (optional)" value={image} onChange={(e) => setImage(e.target.value)}
            className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none resize-none" />
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm mt-2 disabled:opacity-30">
            {editActivity ? 'Save Changes' : 'Add Activity'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── User detail drill-down (light) ──────────────────────────────────────────
function UserDetail({ user, onBack }: { user: UserActivity; onBack: () => void }) {
  const txns = getAllTransactions(user.id);
  const redemptions = getRedemptions(user.id);
  const balance = walletBalanceFrom(txns);

  return (
    <motion.div
      className="absolute inset-0 bg-white flex flex-col z-10"
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <button onClick={onBack} aria-label="Back to user list" className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft size={16} className="text-foreground" aria-hidden="true" />
        </button>
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-lg">{user.avatar}</div>
        <div>
          <div className="text-foreground font-bold">{user.name}</div>
          <div className="text-muted-foreground text-xs">Balance {fmtMoney(balance)}</div>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-4 pb-8">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-secondary rounded-xl p-3 text-center">
            <div className="text-foreground font-bold text-lg">{user.transactions}</div>
            <div className="text-muted-foreground text-xs">Transactions</div>
          </div>
          <div className="bg-secondary rounded-xl p-3 text-center">
            <div className="text-foreground font-bold text-lg">{user.redemptions}</div>
            <div className="text-muted-foreground text-xs">Redemptions</div>
          </div>
          <div className="bg-secondary rounded-xl p-3 text-center">
            <div className="text-foreground font-bold text-lg">{fmtMoney(user.volume)}</div>
            <div className="text-muted-foreground text-xs">Volume</div>
          </div>
        </div>
        <div className="text-muted-foreground text-xs font-bold uppercase tracking-wide mb-2">Transactions</div>
        <div className="bg-white rounded-xl border-2 border-border overflow-hidden mb-4">
          {txns.length === 0 && <div className="p-4 text-center text-muted-foreground text-xs">No transactions</div>}
          {txns.slice(0, 15).map((t, i) => (
            <div key={t.id} className={`flex items-center justify-between p-3 ${i < Math.min(txns.length, 15) - 1 ? 'border-b border-border' : ''}`}>
              <div className="min-w-0">
                <div className="text-foreground text-xs font-bold truncate">{t.name}</div>
                <div className="text-muted-foreground text-xs">{t.date}</div>
              </div>
              <div className={`text-xs font-bold flex-shrink-0 ${t.amount >= 0 ? 'text-green-600' : 'text-foreground'}`}>
                {t.amount >= 0 ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="text-muted-foreground text-xs font-bold uppercase tracking-wide mb-2">Redemptions</div>
        <div className="bg-white rounded-xl border-2 border-border overflow-hidden">
          {redemptions.length === 0 && <div className="p-4 text-center text-muted-foreground text-xs">No redemptions</div>}
          {redemptions.map((r, i) => (
            <div key={r.id} className={`flex items-center justify-between p-3 ${i < redemptions.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="min-w-0">
                <div className="text-foreground text-xs font-bold truncate">{r.deal?.title ?? 'Deal'}</div>
                <div className="text-muted-foreground text-xs">Ref: {r.refCode}</div>
              </div>
              <div className="text-primary text-xs font-bold flex-shrink-0">
                {r.deal && r.deal.dealPrice > 0 ? `$${r.deal.dealPrice.toFixed(2)}` : 'Free'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Users modal (light) ─────────────────────────────────────────────────────
function UsersModal({ users, onClose }: { users: UserActivity[]; onClose: () => void }) {
  const [selected, setSelected] = useState<UserActivity | null>(null);
  return (
    <motion.div className="fixed inset-0 z-[60] flex flex-col" style={{ maxWidth: 390, margin: '0 auto' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative mt-auto bg-white rounded-t-3xl max-h-[85vh] h-[85vh] flex flex-col overflow-hidden"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold text-lg text-foreground">User Activity</h2>
          <button onClick={onClose} aria-label="Close user activity" className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center">
            <X size={16} className="text-foreground" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 pb-8">
          {users.length === 0 && <div className="text-center text-muted-foreground text-sm py-8">No users</div>}
          {users.map((u) => (
            <button key={u.id} onClick={() => setSelected(u)}
              className="w-full flex items-center gap-3 bg-white rounded-2xl p-3 mb-2 border-2 border-border text-left active:scale-[0.98] transition-transform">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-lg flex-shrink-0">{u.avatar}</div>
              <div className="flex-1 min-w-0">
                <div className="text-foreground text-sm font-bold truncate">{u.name}</div>
                <div className="text-muted-foreground text-xs">{u.transactions} txns &middot; {u.redemptions} redemptions</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-foreground font-bold text-sm">{fmtMoney(u.volume)}</div>
                <div className="text-muted-foreground text-xs">volume</div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
        <AnimatePresence>
          {selected && <UserDetail key="udetail" user={selected} onBack={() => setSelected(null)} />}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ─── Access denied ────────────────────────────────────────────────────────────
function AccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
        <Lock size={30} className="text-muted-foreground" />
      </div>
      <div className="text-foreground font-bold text-lg mb-1">Management Access Only</div>
      <div className="text-muted-foreground text-sm mb-6">
        Switch to the <span className="text-foreground font-semibold">Admin (Management)</span> account to open the portal.
      </div>
      <button onClick={onBack} className="px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm">
        Back to app
      </button>
    </div>
  );
}

// ─── Management dashboard (light) ─────────────────────────────────────────────
export function AdminAccessPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [adminTab, setAdminTab] = useState<'overview' | 'transactions' | 'hangouts' | 'merchants'>('overview');
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [chartMetric, setChartMetric] = useState<'count' | 'volume'>('count');
  const [refreshing, setRefreshing] = useState(false);

  const [activities, setActivities] = useState<Activity[]>(() => getActivities());
  const [hangouts, setHangouts] = useState<Hangout[]>(() => getAllHangouts());
  const [transactions, setTransactions] = useState<Transaction[]>(() => getAllTransactions());
  const [users, setUsers] = useState(() => getAllUsers());
  const [stats, setStats] = useState<AdminStats>(() => getAdminStats());
  const [userActivity, setUserActivity] = useState<UserActivity[]>(() => getUserActivity());
  const [merchants, setMerchants] = useState<Merchant[]>(() => getMerchants());

  // Merchant form state
  const [merchantEditing, setMerchantEditing] = useState<Merchant | null>(null);
  const [merchantIsNew, setMerchantIsNew] = useState(false);
  const [mName, setMName] = useState('');
  const [mAmount, setMAmount] = useState('');
  const [mRef, setMRef] = useState('');
  const [mXpRate, setMXpRate] = useState(String(DEFAULT_XP_RATE));
  const [mXpBonus, setMXpBonus] = useState(String(DEFAULT_XP_BONUS));

  const reload = () => {
    setCurrentUser(getCurrentUser());
    setActivities(getActivities());
    setHangouts(getAllHangouts());
    setTransactions(getAllTransactions());
    setUsers(getAllUsers());
    setStats(getAdminStats());
    setUserActivity(getUserActivity());
    setMerchants(getMerchants());
  };

  useAppEvents(
    ['activitiesUpdated', 'hangoutsUpdated', 'rewardRedemptionsUpdated', 'transactionsUpdated', 'redemptionsUpdated', 'userSwitched', 'databaseReady', 'merchantsUpdated', 'focus'],
    reload
  );

  if (!isAdminUser(currentUser)) {
    return <AccessDenied onBack={() => navigate('/')} />;
  }

  const handleRefresh = () => {
    setRefreshing(true);
    reload();
    setTimeout(() => setRefreshing(false), 500);
  };

  const userName = (id: string) => users.find(u => u.id === id)?.name ?? id;
  const adminTxns = transactions.slice(0, 20).map(t => toAdminTxn(t, userName(t.userId)));

  const wow = stats.weekOverWeekTxnChange;
  const wowLabel = wow == null ? null : `${wow >= 0 ? '+' : ''}${wow.toFixed(1)}%`;
  const wowUp = wow == null ? true : wow >= 0;

  const statCards = [
    { key: 'users',    label: 'Total Users',         value: stats.totalUsers.toLocaleString(),        icon: Users,      color: '#1d6bf3', badge: null,     badgeUp: true, action: () => setShowUsers(true) },
    { key: 'txns',     label: 'Transactions Today',  value: stats.transactionsToday.toLocaleString(), icon: TrendingUp, color: '#22c55e', badge: wowLabel, badgeUp: wowUp, action: () => setAdminTab('transactions') },
    { key: 'hangouts', label: 'Hangouts Planned',    value: stats.hangoutsPlanned.toLocaleString(),   icon: UsersRound, color: '#f2763f', badge: stats.hangoutsPlanned ? `${stats.hangoutsConfirmed} confirmed` : null, badgeUp: true, action: () => setAdminTab('hangouts') },
    { key: 'volume',   label: 'Wallet Volume (SGD)', value: fmtMoney(stats.walletVolume),             icon: DollarSign, color: '#8b5cf6', badge: null,     badgeUp: true, action: () => setAdminTab('transactions') },
  ];

  const series = stats.last7Days;
  const values = series.map(d => (chartMetric === 'count' ? d.count : d.volume));
  const maxVal = Math.max(1, ...values);
  const todayIdx = series.length - 1;

  const handleSaveActivity = (activity: Omit<Activity, 'id'>, editId?: number) => {
    if (editId != null) {
      updateActivity({ ...activity, id: editId });
      toast.success('Activity updated');
    } else {
      addActivity(activity);
      toast.success('Activity added');
    }
    reload();
    setShowAddActivity(false);
    setEditingActivity(null);
  };

  const handleDeleteActivity = (activity: Activity) => {
    if (!confirm(`Delete "${activity.title}"?\n\nThis permanently removes it from the database and the Hangouts catalogue.`)) return;
    deleteActivity(activity.id);
    reload();
  };

  // Merchant handlers
  const openNewMerchant = () => {
    setMerchantIsNew(true); setMerchantEditing(null);
    setMName(''); setMAmount(''); setMRef('');
    setMXpRate(String(DEFAULT_XP_RATE)); setMXpBonus(String(DEFAULT_XP_BONUS));
  };
  const openEditMerchant = (m: Merchant) => {
    setMerchantIsNew(false); setMerchantEditing(m);
    setMName(m.name); setMAmount(m.amount.toFixed(2)); setMRef(m.reference ?? '');
    setMXpRate(String(m.xpRate)); setMXpBonus(String(m.xpBonus));
  };
  const closeMerchantForm = () => { setMerchantEditing(null); setMerchantIsNew(false); };
  const saveMerchantForm = () => {
    const trimmed = mName.trim();
    const parsed = parseFloat(mAmount);
    const xpRate = parseFloat(mXpRate);
    const xpBonus = parseFloat(mXpBonus);
    if (!trimmed) { toast.error('Please enter a merchant name'); return; }
    if (isNaN(parsed) || parsed <= 0) { toast.error('Please enter a valid amount greater than 0'); return; }
    if (isNaN(xpRate) || xpRate < 0) { toast.error('XP per $1 must be 0 or more'); return; }
    if (isNaN(xpBonus) || xpBonus < 1) { toast.error('XP multiplier must be at least 1'); return; }
    saveMerchant({
      id: merchantEditing ? merchantEditing.id : makeMerchantId(trimmed),
      name: trimmed, amount: parsed, reference: mRef.trim() || undefined,
      xpRate, xpBonus,
    });
    toast.success(merchantEditing ? 'Merchant updated' : 'Merchant added');
    closeMerchantForm();
    setMerchants(getMerchants());
  };
  const removeMerchant = (m: Merchant) => {
    if (!confirm(`Remove "${m.name}"?\n\nIt will no longer be scannable on the pay screen.`)) return;
    deleteMerchant(m.id);
    toast.success(`${m.name} removed`);
    setMerchants(getMerchants());
  };
  const showMerchantForm = merchantIsNew || merchantEditing !== null;

  return (
    <div className="flex flex-col h-full bg-white" style={{ position: 'relative' }}>
      {/* Header — blue gradient, matches DarkHeader look. The title block shrinks
          and truncates, and the sign-out control collapses to an icon, so the
          row stays on one line down to a 320px-wide phone. */}
      <div data-dark-surface className="bg-gradient-to-b from-[#1e2a4a] to-[#2d3f6a] px-4 pt-12 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-white/20 flex items-center justify-center">
            <Shield size={18} className="text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-white font-bold text-sm min-[360px]:text-base">Management Portal</div>
            <div className="truncate text-white/60 text-xs">NETS Pulse Dashboard</div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            aria-label="Sign out of the management portal"
            className="flex h-11 flex-shrink-0 items-center gap-2 rounded-full bg-white/15 px-3 text-white text-xs font-bold"
          >
            <LogOut size={14} className="text-white/80" aria-hidden="true" />
            <span className="hidden min-[360px]:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Tabs — a two-by-two grid on the narrowest phones and a single row from
          360px up. Previously this was a horizontally scrolling flex row, which
          exposed a scrollbar and clipped the last tab at 320px. */}
      <div className="grid grid-cols-2 gap-1.5 px-4 py-3 bg-white border-b border-border flex-shrink-0 min-[360px]:grid-cols-4">
        {(['overview', 'transactions', 'hangouts', 'merchants'] as const).map((t) => (
          <button key={t} onClick={() => setAdminTab(t)}
            aria-pressed={adminTab === t}
            className={`min-h-11 rounded-full px-2 text-xs font-bold capitalize transition-all ${adminTab === t ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-6 bg-white">
        {adminTab === 'overview' && (
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 mb-5">
              {statCards.map((stat) => (
                <button key={stat.label} onClick={stat.action}
                  className="bg-white rounded-2xl p-4 border-2 border-border text-left active:scale-95 transition-transform">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}18` }}>
                      <stat.icon size={16} style={{ color: stat.color }} />
                    </div>
                    {stat.badge && (
                      <span className={`text-xs font-medium flex items-center gap-0.5 ${stat.badgeUp ? 'text-green-600' : 'text-red-500'}`}>
                        {stat.badgeUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{stat.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-foreground font-bold text-xl">{stat.value}</div>
                  <div className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">{stat.label}<ChevronRight size={11} className="text-muted-foreground/50" /></div>
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-4 border-2 border-border mb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-foreground text-sm">Transaction Volume</div>
                <div className="flex gap-1 bg-secondary rounded-full p-0.5">
                  {(['count', 'volume'] as const).map((m) => (
                    <button key={m} onClick={() => setChartMetric(m)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${chartMetric === m ? 'bg-primary text-white' : 'text-muted-foreground'}`}>
                      {m === 'count' ? '#' : '$'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-muted-foreground text-xs mb-4">Last 7 days &middot; real data</div>
              <div className="flex items-end gap-2 h-24">
                {series.map((d, i) => {
                  const val = chartMetric === 'count' ? d.count : d.volume;
                  const h = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                      <div className="text-muted-foreground text-[9px] mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {chartMetric === 'count' ? val : `$${Math.round(val)}`}
                      </div>
                      <div className="w-full rounded-t-md transition-all" style={{
                        height: `${Math.max(h, val > 0 ? 6 : 2)}%`,
                        background: i === todayIdx ? '#1d6bf3' : 'rgba(29,107,243,0.2)',
                      }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                {series.map((d, i) => (
                  <div key={i} className="flex-1 text-center text-muted-foreground text-xs">{d.label}</div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleRefresh} className="bg-white rounded-xl p-3 flex flex-col items-center gap-2 border-2 border-border active:scale-95 transition-transform">
                <RefreshCw size={18} className={`text-primary ${refreshing ? 'animate-spin' : ''}`} />
                <span className="text-muted-foreground text-xs font-semibold">{refreshing ? 'Refreshing' : 'Refresh'}</span>
              </button>
              <button onClick={() => setShowUsers(true)} className="bg-white rounded-xl p-3 flex flex-col items-center gap-2 border-2 border-border active:scale-95 transition-transform">
                <Users size={18} className="text-primary" />
                <span className="text-muted-foreground text-xs font-semibold">Users</span>
              </button>
            </div>
          </div>
        )}

        {adminTab === 'transactions' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-foreground text-sm">All Transactions ({transactions.length})</div>
              <span className="text-muted-foreground text-xs">Live from database</span>
            </div>
            <div className="bg-white rounded-2xl border-2 border-border overflow-hidden">
              {adminTxns.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">No transactions yet.</div>
              )}
              {adminTxns.map((txn, i) => (
                <div key={txn.id} className={`flex items-center gap-3 p-4 ${i < adminTxns.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={txn.isTopup ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#475569' }}>
                    {txn.user.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground text-xs font-bold truncate">{txn.user}</div>
                    <div className="text-muted-foreground text-xs">{txn.id} &middot; {txn.type}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs font-bold ${txn.isTopup ? 'text-green-600' : 'text-foreground'}`}>{txn.amount}</div>
                    <div className="text-muted-foreground text-xs">{txn.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminTab === 'hangouts' && (
          <div className="p-4">
            <div className="bg-secondary rounded-2xl p-4 mb-4 flex items-center gap-3">
              <UsersRound className="w-6 h-6 text-primary" />
              <div>
                <p className="text-foreground font-bold text-sm">Hangouts Catalogue</p>
                <p className="text-muted-foreground text-xs">
                  {activities.length} activit{activities.length === 1 ? 'y' : 'ies'} available · {hangouts.length} plan{hangouts.length === 1 ? '' : 's'} created
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-foreground text-sm">Activities</div>
              <button className="text-primary text-xs font-bold" onClick={() => { setEditingActivity(null); setShowAddActivity(true); }}>+ Add Activity</button>
            </div>
            <div className="flex flex-col gap-3 mb-6">
              {activities.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground border-2 border-border rounded-2xl">No activities in the catalogue.</div>
              )}
              {activities.map((activity) => (
                <div key={activity.id} className="bg-white rounded-2xl p-3 border-2 border-border flex items-center gap-3">
                  <img src={activity.image} alt={activity.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground text-xs font-bold truncate">{activity.title}</div>
                    <div className="text-muted-foreground text-xs truncate">{activity.venue} · {activity.location}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-bold capitalize" style={{ background: '#fde8dd', color: '#f2763f' }}>
                        {activity.category}
                      </span>
                      <span className="text-muted-foreground text-xs">${activity.pricePerPerson}/pax · {activity.duration}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => { setEditingActivity(activity); setShowAddActivity(true); }}
                      className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center" aria-label="Edit activity">
                      <Pencil className="w-4 h-4 text-foreground" />
                    </button>
                    <button onClick={() => handleDeleteActivity(activity)}
                      className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center" aria-label="Delete activity">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="font-bold text-foreground text-sm mb-3">Group plans</div>
            <div className="bg-white rounded-2xl border-2 border-border overflow-hidden">
              {hangouts.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">No group plans yet.</div>
              )}
              {hangouts.map((plan, i) => {
                const votes = getHangoutVotes(plan.id);
                const participants = getParticipantIds(plan).length;
                const confirmed = plan.confirmedActivityId ? getActivity(plan.confirmedActivityId) : null;
                return (
                  <div key={plan.id} className={`p-4 ${i < hangouts.length - 1 ? 'border-b border-border' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-foreground text-xs font-bold truncate">{plan.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {userName(plan.ownerUserId)} · {plan.preferredDate} · ${plan.budgetPerPerson}/pax
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold capitalize flex-shrink-0 ${plan.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {plan.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-muted-foreground text-xs">
                      <Vote size={12} />
                      {votes.length}/{participants} voted
                      {confirmed && <span className="text-foreground font-semibold truncate">· {confirmed.title}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {adminTab === 'merchants' && (
          <div className="p-4">
            <div className="bg-secondary rounded-2xl p-4 mb-4 flex items-center gap-3">
              <Store className="w-6 h-6 text-primary" />
              <div>
                <p className="text-foreground font-bold text-sm">Merchant List</p>
                <p className="text-muted-foreground text-xs">{merchants.length} merchant{merchants.length === 1 ? '' : 's'} available to scan</p>
              </div>
            </div>

            {!showMerchantForm && (
              <button onClick={openNewMerchant}
                className="w-full mb-4 p-4 rounded-2xl border-2 border-dashed border-primary/40 flex items-center justify-center gap-2 text-primary font-bold">
                <Plus className="w-5 h-5" /> Add Merchant
              </button>
            )}

            {showMerchantForm && (
              <div className="mb-4 bg-white rounded-2xl p-4 border-2 border-primary">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground">{merchantEditing ? 'Edit Merchant' : 'New Merchant'}</h3>
                  <button onClick={closeMerchantForm} className="text-muted-foreground"><X className="w-5 h-5" /></button>
                </div>
                <label className="text-xs text-muted-foreground mb-2 block">Merchant Name</label>
                <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="e.g. Kopitiam"
                  className="w-full mb-4 px-4 py-3 rounded-xl bg-secondary text-foreground outline-none" />
                <label className="text-xs text-muted-foreground mb-2 block">Amount (SGD)</label>
                <input value={mAmount} onChange={(e) => setMAmount(e.target.value)} inputMode="decimal" placeholder="0.00"
                  className="w-full mb-4 px-4 py-3 rounded-xl bg-secondary text-foreground outline-none" />
                <label className="text-xs text-muted-foreground mb-2 block">Reference (optional)</label>
                <input value={mRef} onChange={(e) => setMRef(e.target.value)} placeholder="e.g. Set A"
                  className="w-full mb-4 px-4 py-3 rounded-xl bg-secondary text-foreground outline-none" />

                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">XP earning</span>
                </div>
                <div className="flex gap-2 mb-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">XP per $1</label>
                    <input value={mXpRate} onChange={(e) => setMXpRate(e.target.value)} inputMode="decimal" placeholder="10"
                      className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Multiplier</label>
                    <input value={mXpBonus} onChange={(e) => setMXpBonus(e.target.value)} inputMode="decimal" placeholder="1"
                      className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground outline-none" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  A $10 payment here earns {Math.max(0, Math.round(10 * (parseFloat(mXpRate) || 0) * (parseFloat(mXpBonus) || 0)))} XP.
                </p>

                <button onClick={saveMerchantForm} className="w-full py-3 rounded-xl bg-primary text-white font-bold">
                  {merchantEditing ? 'Save Changes' : 'Add Merchant'}
                </button>
              </div>
            )}

            {merchants.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="font-bold text-foreground">No merchants yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add one above so it can be scanned on the pay screen.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {merchants.map((m) => (
                  <div key={m.id} className="p-4 rounded-2xl border-2 border-border bg-white flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">${m.amount.toFixed(2)}{m.reference ? ` · ${m.reference}` : ''}</p>
                      <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" />{m.xpRate} XP/$1{m.xpBonus > 1 ? ` · ${m.xpBonus}x bonus` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <button onClick={() => openEditMerchant(m)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                        <Pencil className="w-4 h-4 text-foreground" />
                      </button>
                      <button onClick={() => removeMerchant(m)} className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddActivity && (
          <ActivityModal
            key={editingActivity ? `edit-${editingActivity.id}` : 'add-activity'}
            editActivity={editingActivity}
            onClose={() => { setShowAddActivity(false); setEditingActivity(null); }}
            onSave={handleSaveActivity}
          />
        )}
        {showUsers && <UsersModal key="users" users={userActivity} onClose={() => setShowUsers(false)} />}
      </AnimatePresence>

      <AccountSwitcher isOpen={showAccountSwitcher} onClose={() => setShowAccountSwitcher(false)} />
      <Toaster />
    </div>
  );
}
