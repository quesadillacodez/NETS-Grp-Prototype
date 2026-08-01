import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';
import {
  X, Shield, Users, TrendingUp, TrendingDown, ShoppingBag, DollarSign,
  RefreshCw, ArrowLeft, Lock, ChevronRight, ChevronLeft, Store, Plus, Pencil, Trash2,
} from 'lucide-react';
import { getCurrentUser, getAllUsers, isAdminUser } from '../utils/userStorage';
import { getAllTransactions, type Transaction } from '../utils/transactionStorage';
import { getDeals, addDeal, updateDeal, deleteDeal, type Deal } from '../utils/dealStorage';
import { getRedemptions } from '../utils/redemptionStorage';
import { getMerchants, saveMerchant, deactivateMerchant, type Merchant } from '../utils/merchantStorage';
import { getAdminStats, getUserActivity, type AdminStats, type UserActivity } from '../utils/adminStats';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { useAppEvents } from '../utils/useAppEvents';

type DealRecord = Deal;

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toAdminTxn(tx: Transaction, userName: string) {
  const isTopup = tx.amount >= 0;
  return {
    id: `TXN-${tx.id}`,
    user: userName,
    type: /redeem/i.test(tx.name) ? 'Redemption' : isTopup ? 'Top-up' : 'Payment',
    amount: `${isTopup ? '+' : '-'}$${Math.abs(tx.amount).toFixed(2)}`,
    time: tx.date,
    isTopup,
  };
}

function makeMerchantId(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'merchant'}-${Date.now().toString(36)}`;
}

// ─── Add Deal Modal (light) ──────────────────────────────────────────────────
function AddDealModal({ onClose, onSave, editDeal }: {
  onClose: () => void;
  onSave: (d: Omit<DealRecord, 'id' | 'redeemedCount'>, editId?: number) => void;
  editDeal?: DealRecord | null;
}) {
  const [title, setTitle] = useState(editDeal?.title ?? '');
  const [merchant, setMerchant] = useState(editDeal?.merchant ?? '');
  const [location, setLocation] = useState(editDeal?.location ?? '');
  const [category, setCategory] = useState<'food' | 'attractions'>(editDeal?.category ?? 'food');
  const [originalPrice, setOriginalPrice] = useState(editDeal ? String(editDeal.originalPrice) : '');
  const [discount, setDiscount] = useState(editDeal ? String(editDeal.discount) : '');
  const [expiry, setExpiry] = useState(editDeal?.expiry ?? '');
  const [image, setImage] = useState(editDeal?.image ?? '');

  const price = parseFloat(originalPrice) || 0;
  const disc = parseFloat(discount) || 0;
  const dealPrice = +(price * (1 - disc / 100)).toFixed(2);
  const savings = +(price - dealPrice).toFixed(2);
  const canSubmit = !!title && !!merchant && !!location && price > 0 && disc > 0 && !!expiry;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSave({
      category, title, merchant, location,
      discount: disc, originalPrice: price, dealPrice, savings, expiry,
      rating: editDeal?.rating ?? 5.0,
      image: image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop&auto=format',
      featured: editDeal?.featured ?? false,
      terms: editDeal?.terms ?? 'Terms and conditions apply.',
      description: editDeal?.description ?? `${disc}% off at ${merchant}.`,
    }, editDeal?.id);
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
          <h2 className="font-bold text-lg text-foreground">{editDeal ? 'Edit Partner Reward' : 'Add Partner Reward'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <X size={16} className="text-foreground" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex flex-col gap-3 pb-8">
          <input placeholder="Reward title" value={title} onChange={(e) => setTitle(e.target.value)}
            className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          <input placeholder="Merchant name" value={merchant} onChange={(e) => setMerchant(e.target.value)}
            className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)}
            className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          <div className="flex gap-2">
            <button onClick={() => setCategory('food')} className={`flex-1 py-3 rounded-xl text-sm font-bold ${category === 'food' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>Food</button>
            <button onClick={() => setCategory('attractions')} className={`flex-1 py-3 rounded-xl text-sm font-bold ${category === 'attractions' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>Attractions</button>
          </div>
          <div className="flex gap-2">
            <input type="number" placeholder="Original price (SGD)" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)}
              className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
            <input type="number" placeholder="Discount %" value={discount} onChange={(e) => setDiscount(e.target.value)}
              className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </div>
          {price > 0 && disc > 0 && (
            <div className="text-xs text-muted-foreground">
              Reward price: <span className="text-foreground font-bold">SGD {dealPrice.toFixed(2)}</span> &middot; Value: SGD {savings.toFixed(2)}
            </div>
          )}
          <input placeholder="Expiry (e.g. 31 Aug 2026)" value={expiry} onChange={(e) => setExpiry(e.target.value)}
            className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          <input placeholder="Image URL (optional)" value={image} onChange={(e) => setImage(e.target.value)}
            className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm mt-2 disabled:opacity-30">
            {editDeal ? 'Save Changes' : 'Add Reward'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── User detail drill-down (light) ──────────────────────────────────────────
function UserDetail({ user, onBack }: { user: UserActivity; onBack: () => void }) {
  const BASE_BALANCE = 2500;
  const txns = getAllTransactions(user.id);
  const redemptions = getRedemptions(user.id);
  const balance = BASE_BALANCE + txns.reduce((s, t) => s + t.amount, 0);

  return (
    <motion.div
      className="absolute inset-0 bg-white flex flex-col z-10"
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft size={16} className="text-foreground" />
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
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <X size={16} className="text-foreground" />
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
  const [adminTab, setAdminTab] = useState<'overview' | 'transactions' | 'deals' | 'merchants'>('overview');
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealRecord | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [chartMetric, setChartMetric] = useState<'count' | 'volume'>('count');
  const [refreshing, setRefreshing] = useState(false);

  const [deals, setDeals] = useState<DealRecord[]>(() => getDeals());
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

  const reload = () => {
    setCurrentUser(getCurrentUser());
    setDeals(getDeals());
    setTransactions(getAllTransactions());
    setUsers(getAllUsers());
    setStats(getAdminStats());
    setUserActivity(getUserActivity());
    setMerchants(getMerchants());
  };

  useAppEvents(
    ['dealsUpdated', 'rewardRedemptionsUpdated', 'transactionsUpdated', 'redemptionsUpdated', 'userSwitched', 'databaseReady', 'merchantsUpdated', 'focus'],
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
  const redeemRate = deals.length ? stats.dealsRedeemed / deals.length : 0;

  const statCards = [
    { key: 'users',  label: 'Total Users',        value: stats.totalUsers.toLocaleString(),        icon: Users,       color: '#1d6bf3', badge: null,      badgeUp: true, action: () => setShowUsers(true) },
    { key: 'txns',   label: 'Transactions Today',  value: stats.transactionsToday.toLocaleString(), icon: TrendingUp,  color: '#22c55e', badge: wowLabel, badgeUp: wowUp, action: () => setAdminTab('transactions') },
    { key: 'redeem', label: 'Rewards Redeemed',    value: stats.dealsRedeemed.toLocaleString(),     icon: ShoppingBag, color: '#f2763f', badge: deals.length ? `${redeemRate.toFixed(1)}/offer` : null, badgeUp: true, action: () => setAdminTab('deals') },
    { key: 'volume', label: 'Wallet Volume (SGD)', value: fmtMoney(stats.walletVolume),             icon: DollarSign,  color: '#8b5cf6', badge: null,      badgeUp: true, action: () => setAdminTab('transactions') },
  ];

  const series = stats.last7Days;
  const values = series.map(d => (chartMetric === 'count' ? d.count : d.volume));
  const maxVal = Math.max(1, ...values);
  const todayIdx = series.length - 1;

  const handleSaveDeal = (d: Omit<DealRecord, 'id' | 'redeemedCount'>, editId?: number) => {
    if (editId != null) {
      const existing = deals.find(x => x.id === editId);
      updateDeal({ ...d, id: editId, redeemedCount: existing?.redeemedCount ?? 0 });
    } else {
      addDeal(d);
    }
    reload();
    setShowAddDeal(false);
    setEditingDeal(null);
  };

  const handleDeleteDeal = (deal: DealRecord) => {
    if (!confirm(`Delete "${deal.title}"?\n\nThis removes the partner reward from the catalogue. This cannot be undone.`)) return;
    deleteDeal(deal.id);
    reload();
  };

  // Merchant handlers
  const openNewMerchant = () => { setMerchantIsNew(true); setMerchantEditing(null); setMName(''); setMAmount(''); setMRef(''); };
  const openEditMerchant = (m: Merchant) => { setMerchantIsNew(false); setMerchantEditing(m); setMName(m.name); setMAmount(m.amount.toFixed(2)); setMRef(m.reference ?? ''); };
  const closeMerchantForm = () => { setMerchantEditing(null); setMerchantIsNew(false); };
  const saveMerchantForm = () => {
    const trimmed = mName.trim();
    const parsed = parseFloat(mAmount);
    if (!trimmed) { toast.error('Please enter a merchant name'); return; }
    if (isNaN(parsed) || parsed <= 0) { toast.error('Please enter a valid amount greater than 0'); return; }
    saveMerchant({ id: merchantEditing ? merchantEditing.id : makeMerchantId(trimmed), name: trimmed, amount: parsed, reference: mRef.trim() || undefined });
    toast.success(merchantEditing ? 'Merchant updated' : 'Merchant added');
    closeMerchantForm();
    setMerchants(getMerchants());
  };
  const removeMerchant = (m: Merchant) => { deactivateMerchant(m.id); toast.success(`${m.name} removed`); setMerchants(getMerchants()); };
  const showMerchantForm = merchantIsNew || merchantEditing !== null;

  return (
    <div className="flex flex-col h-full bg-white" style={{ position: 'relative' }}>
      {/* Header — blue gradient, matches DarkHeader look, with profile switcher */}
      <div className="bg-gradient-to-b from-[#1e2a4a] to-[#2d3f6a] px-5 pt-12 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <ChevronLeft size={20} className="text-white" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Shield size={18} className="text-white" />
              </div>
              <div>
                <div className="text-white font-bold text-base">Management Portal</div>
                <div className="text-white/60 text-xs">NETS Pulse Dashboard</div>
              </div>
            </div>
          </div>
          {/* Profile switcher */}
          <button onClick={() => setShowAccountSwitcher(true)} className="flex items-center gap-2 bg-white/15 rounded-full pl-1 pr-3 py-1">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-base">{currentUser.avatar}</div>
            <ChevronRight size={14} className="text-white/70" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-3 bg-white border-b border-border flex-shrink-0 overflow-x-auto">
        {(['overview', 'transactions', 'deals', 'merchants'] as const).map((t) => (
          <button key={t} onClick={() => setAdminTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all whitespace-nowrap ${adminTab === t ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
            {t === 'deals' ? 'Rewards' : t}
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

        {adminTab === 'deals' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-foreground text-sm">Partner Reward Catalogue</div>
              <button className="text-primary text-xs font-bold" onClick={() => setShowAddDeal(true)}>+ Add Reward</button>
            </div>
            <div className="flex flex-col gap-3">
              {deals.map((deal) => (
                <div key={deal.id} className="bg-white rounded-2xl p-3 border-2 border-border flex items-center gap-3">
                  <img src={deal.image} alt={deal.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground text-xs font-bold truncate">{deal.title}</div>
                    <div className="text-muted-foreground text-xs">{deal.merchant}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#fde8dd', color: '#f2763f' }}>
                        {deal.discount}% off
                      </span>
                      <span className="text-muted-foreground text-xs">{deal.redeemedCount} redeemed</span>
                    </div>
                    <div className="text-muted-foreground text-xs mt-0.5">Expires {deal.expiry}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => { setEditingDeal(deal); setShowAddDeal(true); }}
                      className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center" aria-label="Edit reward">
                      <Pencil className="w-4 h-4 text-foreground" />
                    </button>
                    <button onClick={() => handleDeleteDeal(deal)}
                      className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center" aria-label="Delete reward">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
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
        {showAddDeal && (
          <AddDealModal
            key={editingDeal ? `edit-${editingDeal.id}` : 'add-deal'}
            editDeal={editingDeal}
            onClose={() => { setShowAddDeal(false); setEditingDeal(null); }}
            onSave={handleSaveDeal}
          />
        )}
        {showUsers && <UsersModal key="users" users={userActivity} onClose={() => setShowUsers(false)} />}
      </AnimatePresence>

      <AccountSwitcher isOpen={showAccountSwitcher} onClose={() => setShowAccountSwitcher(false)} />
      <Toaster />
    </div>
  );
}
