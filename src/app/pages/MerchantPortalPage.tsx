import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  BarChart3, Clock3, Download, Flame, Lightbulb, LogOut, Megaphone, Plus, Repeat, ShieldCheck,
  Sparkles, Store, TicketCheck, Trash2, TrendingDown, TrendingUp, UserPlus, Users, Utensils, X, Zap,
} from 'lucide-react';
import { getCurrentUser } from '../utils/userStorage';
import { logout } from '../utils/authStorage';
import { getMerchants, saveMerchant, type Merchant } from '../utils/merchantStorage';
import { getMerchantInsight } from '../utils/merchantInsights';
import { getMerchantDashboard, type MerchantDashboardData } from '../utils/merchantInsightStorage';
import {
  MENU_CATEGORIES, addMenuItem, getHourlyPattern, getItemPerformance, getMenu, getSlowMovers,
  removeMenuItem, setMenuItemActive, type ItemPerformance, type MenuItem,
} from '../utils/menuStorage';
import {
  PLACEMENT_DESCRIPTIONS, PLACEMENT_LABELS, PLACEMENT_RATES, bookPromotion, endPromotion,
  getPromotableRewards, getPromotionReports, type Placement,
} from '../utils/promotionStorage';
import { useAppEvents } from '../utils/useAppEvents';

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const percent = (n: number) => `${Math.round(n * 100)}%`;

type MerchantTab = 'today' | 'menu' | 'rewards';

/**
 * The merchant's own view of the app.
 *
 * Everything here is scoped to the stall of whoever signed in — the merchant id
 * comes from the session, never from the page — so one stallholder cannot see
 * another's takings.
 */
export function MerchantPortalPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<MerchantTab>('today');
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(n => n + 1);
  useAppEvents(
    ['menuUpdated', 'itemSalesUpdated', 'transactionsUpdated', 'promotionsUpdated', 'rewardRedemptionsUpdated', 'userSwitched'],
    refresh,
  );

  const user = getCurrentUser();
  const merchantId = user.merchantId ?? '';
  const merchant = useMemo(
    () => getMerchants().find(entry => entry.id === merchantId) ?? null,
    [merchantId, tick],
  );
  const merchantName = merchant?.name ?? user.name;

  const insight = useMemo(() => getMerchantInsight(merchantName), [merchantName, tick]);
  const items = useMemo(() => getItemPerformance(merchantId), [merchantId, tick]);
  const hours = useMemo(() => getHourlyPattern(merchantId), [merchantId, tick]);
  // The stall-level view — seven-day trend, dayparts and the suggestions that
  // come out of them — reads the same item_sales rows as the per-dish view.
  const dashboard = useMemo(
    () => (merchant ? getMerchantDashboard(merchant) : null),
    [merchant, tick],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex-shrink-0 bg-[#0f2c45] px-4 pb-4 pt-8 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-white/15 text-xl" aria-hidden="true">
            {user.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-white/70">NETS for Business</p>
            <h1 className="truncate text-base font-black">{merchantName}</h1>
          </div>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            aria-label="Sign out of the merchant portal"
            className="flex h-11 flex-shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-bold"
          >
            <LogOut size={14} aria-hidden="true" />
            <span className="hidden min-[360px]:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <nav aria-label="Merchant sections" className="grid flex-shrink-0 grid-cols-3 gap-1.5 border-b border-border bg-white px-4 py-3">
        {(['today', 'menu', 'rewards'] as const).map(key => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`min-h-11 rounded-full px-2 text-xs font-bold capitalize ${tab === key ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
          >
            {key}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto bg-white pb-6">
        {tab === 'today' && (
          <TodayView
            insight={insight} items={items} hours={hours}
            merchantId={merchantId} tick={tick} dashboard={dashboard}
          />
        )}
        {tab === 'menu' && <MenuView merchantId={merchantId} items={items} tick={tick} onChange={refresh} />}
        {tab === 'rewards' && (
          <RewardsView
            merchantName={merchantName} insight={insight} tick={tick}
            merchant={merchant} dashboard={dashboard} onChange={refresh}
          />
        )}
      </div>
    </div>
  );
}

// ─── Today ───────────────────────────────────────────────────────────────────

function TodayView({ insight, items, hours, merchantId, tick, dashboard }: {
  insight: ReturnType<typeof getMerchantInsight>;
  items: ItemPerformance[];
  hours: { hour: string; quantity: number }[];
  merchantId: string;
  tick: number;
  dashboard: MerchantDashboardData | null;
}) {
  const slow = useMemo(() => getSlowMovers(merchantId), [merchantId, tick]);
  const best = items[0] ?? null;
  const busiest = hours.reduce<{ hour: string; quantity: number } | null>(
    (top, bucket) => (!top || bucket.quantity > top.quantity ? bucket : top), null);
  const peakUnits = hours.reduce((max, bucket) => Math.max(max, bucket.quantity), 0);

  return (
    <div className="space-y-4 p-4">
      {best ? (
        <div className="rounded-2xl bg-primary p-4 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Your best seller</p>
          <p className="mt-1 text-2xl font-black leading-tight">{best.name}</p>
          <p className="mt-1 text-xs text-white/85">
            {best.quantity} sold · {money(best.revenue)} · {percent(best.share)} of everything you sell
          </p>
          {best.peakHour && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
              <Clock3 size={11} aria-hidden="true" /> Sells most around {best.peakHour}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
          <Utensils size={26} className="mx-auto mb-2 text-muted-foreground opacity-40" aria-hidden="true" />
          <p className="text-xs font-bold text-foreground">No item sales yet</p>
          <p className="mx-auto mt-1 max-w-[240px] text-[11px] text-muted-foreground">
            Add items to your menu, then customers paying by NETS can pick what they bought — and this
            becomes a list of what sells.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={TrendingUp} label="Takings" value={money(insight.revenue)} note={`${insight.sales} NETS sales`} />
        <Stat icon={Users} label="Customers" value={insight.customers.toLocaleString()}
          note={`${insight.repeatCustomers} came back`} />
        <Stat icon={Clock3} label="Busiest" value={busiest ? busiest.hour : insight.peakHour ?? '—'}
          note={insight.peakDay ?? 'No pattern yet'} />
        <Stat icon={Zap} label="Average sale" value={money(insight.averageSpend)} note="Per customer" />
        {dashboard && (
          <Stat icon={Sparkles} label="XP given out" value={dashboard.xpAwarded.toLocaleString()}
            note="Earned by your customers" />
        )}
        {dashboard && (
          <Stat icon={TicketCheck} label="Vouchers used" value={dashboard.voucherRedemptions.toLocaleString()}
            note="Redeemed at your stall" />
        )}
      </div>

      {dashboard && dashboard.salesByDay.some(day => day.orders > 0) && (
        <section>
          <h2 className="mb-2 text-sm font-black text-foreground">Last seven days</h2>
          <div className="flex items-end justify-between gap-1.5 rounded-2xl border-2 border-border bg-white p-3">
            {dashboard.salesByDay.map(day => {
              const peak = Math.max(...dashboard.salesByDay.map(entry => entry.revenue), 1);
              return (
                <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-muted-foreground">${day.revenue.toFixed(0)}</span>
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{ height: `${Math.max(6, (day.revenue / peak) * 60)}px` }}
                    role="img"
                    aria-label={`${day.label}: ${money(day.revenue)} from ${day.orders} orders`}
                  />
                  <span className="text-[9px] text-muted-foreground">{day.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {dashboard && dashboard.dayparts.some(part => part.orders > 0) && (
        <section>
          <h2 className="mb-2 text-sm font-black text-foreground">Breakfast, lunch or dinner stall?</h2>
          <div className="grid grid-cols-3 gap-2">
            {dashboard.dayparts.map(part => (
              <div key={part.label} className="rounded-2xl border-2 border-border bg-white p-3 text-center">
                <p className="text-base font-black text-foreground">{part.orders}</p>
                <p className="text-[10px] font-bold text-foreground">{part.label}</p>
                <p className="text-[10px] text-muted-foreground">{money(part.revenue)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-black text-foreground">What sells</h2>
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={item.itemId} className="rounded-2xl border-2 border-border bg-white p-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 flex-shrink-0 text-[11px] font-black text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-foreground">{item.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {item.quantity} sold · {money(item.revenue)}
                      {item.peakHour ? ` · peaks ${item.peakHour}` : ''}
                    </p>
                  </div>
                  {item.trend !== null && (
                    <span className={`flex flex-shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${item.trend >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {item.trend >= 0
                        ? <TrendingUp size={10} aria-hidden="true" />
                        : <TrendingDown size={10} aria-hidden="true" />}
                      {item.trend >= 0 ? '+' : ''}{Math.round(item.trend * 100)}%
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, item.share * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Trend compares the last seven days with the seven before them. Items with no earlier
            sales show no trend rather than a made-up rise.
          </p>
        </section>
      )}

      {hours.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-black text-foreground">When you are busy</h2>
          <div className="flex items-end gap-1 rounded-2xl border-2 border-border bg-white p-3">
            {hours.map(bucket => (
              <div key={bucket.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary"
                  style={{ height: `${Math.max(6, (bucket.quantity / peakUnits) * 70)}px` }}
                  role="img"
                  aria-label={`${bucket.hour}: ${bucket.quantity} sold`}
                />
                <span className="truncate text-[8px] text-muted-foreground">{bucket.hour}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {dashboard && dashboard.transactionCount > 0 && (
        <section className="rounded-2xl bg-primary/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Lightbulb size={14} className="text-primary" aria-hidden="true" />
            <h2 className="text-xs font-black text-foreground">What to try next</h2>
          </div>
          <ul className="space-y-1.5">
            {dashboard.recommendations.map(line => (
              <li key={line} className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <span aria-hidden="true" className="text-primary">·</span>{line}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Each suggestion comes from a figure on this screen, so you can check it against the
            evidence rather than taking it on faith.
          </p>
        </section>
      )}

      {slow.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Flame size={14} className="text-amber-700" aria-hidden="true" />
            <h2 className="text-xs font-black text-amber-900">Not selling</h2>
          </div>
          <p className="text-[11px] text-amber-900/80">
            {slow.map(item => item.name).join(', ')} — on your menu but never bought through NETS.
            Worth a promotion, a price change, or the chop.
          </p>
        </section>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, note }: {
  icon: typeof Store; label: string; value: string; note: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-white p-3">
      <Icon size={15} className="mb-1 text-primary" aria-hidden="true" />
      <p className="text-lg font-black leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </div>
  );
}

// ─── Menu ────────────────────────────────────────────────────────────────────

function MenuView({ merchantId, items, tick, onChange }: {
  merchantId: string; items: ItemPerformance[]; tick: number; onChange: () => void;
}) {
  const menu = useMemo(() => getMenu(merchantId), [merchantId, tick]);
  const sold = new Map(items.map(item => [item.itemId, item.quantity]));

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string>('Mains');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const result = addMenuItem({ merchantId, name, price: Number(price), category });
    if (!result.ok) { setError(result.reason ?? 'That item could not be added.'); return; }
    setError(null);
    setName('');
    setPrice('');
    setShowForm(false);
    onChange();
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-foreground">Your menu</h2>
          <p className="text-[11px] text-muted-foreground">
            What customers can pick when they pay you with NETS.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setError(null); }}
            className="flex min-h-11 flex-shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-black text-white"
          >
            <Plus size={14} aria-hidden="true" /> Add item
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-2.5 text-[11px] font-bold text-destructive">{error}</p>
      )}

      {showForm && (
        <div className="rounded-2xl border-2 border-primary bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">New item</h3>
            <button onClick={() => setShowForm(false)} aria-label="Close new item form" className="text-muted-foreground">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <label htmlFor="item-name" className="mb-1 block text-xs text-muted-foreground">Item name</label>
          <input
            id="item-name" value={name} onChange={event => setName(event.target.value)}
            placeholder="e.g. Nasi Lemak"
            className="mb-3 min-h-11 w-full rounded-xl bg-secondary px-3 text-xs outline-none"
          />

          <label htmlFor="item-price" className="mb-1 block text-xs text-muted-foreground">Price (SGD)</label>
          <input
            id="item-price" value={price} onChange={event => setPrice(event.target.value)}
            inputMode="decimal" placeholder="3.50"
            className="mb-3 min-h-11 w-full rounded-xl bg-secondary px-3 text-xs outline-none"
          />

          <p className="mb-1 text-xs text-muted-foreground">Category</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {MENU_CATEGORIES.map(option => (
              <button
                key={option} onClick={() => setCategory(option)} aria-pressed={category === option}
                className={`min-h-11 rounded-xl px-3 text-xs font-bold ${category === option ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
              >
                {option}
              </button>
            ))}
          </div>

          <button onClick={save} className="min-h-11 w-full rounded-xl bg-primary text-xs font-black text-white">
            Add to menu
          </button>
        </div>
      )}

      {menu.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
          <Utensils size={26} className="mx-auto mb-2 text-muted-foreground opacity-40" aria-hidden="true" />
          <p className="text-xs font-bold text-foreground">Your menu is empty</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Add what you sell to start seeing what moves.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {menu.map(item => (
            <MenuRow
              key={item.id} item={item} sold={sold.get(item.id) ?? 0}
              onToggle={() => { setMenuItemActive(merchantId, item.id, !item.active); onChange(); }}
              onRemove={() => { removeMenuItem(merchantId, item.id); onChange(); }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MenuRow({ item, sold, onToggle, onRemove }: {
  item: MenuItem; sold: number; onToggle: () => void; onRemove: () => void;
}) {
  return (
    <li className={`rounded-2xl border-2 bg-white p-3 ${item.active ? 'border-border' : 'border-dashed border-border opacity-70'}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-foreground">{item.name}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {money(item.price)} · {item.category} · {sold > 0 ? `${sold} sold` : 'not sold yet'}
          </p>
        </div>
        <button
          onClick={onToggle}
          aria-pressed={!item.active}
          className={`min-h-11 flex-shrink-0 rounded-xl px-3 text-[10px] font-black ${item.active ? 'bg-secondary text-muted-foreground' : 'bg-amber-100 text-amber-800'}`}
        >
          {item.active ? 'Available' : 'Sold out'}
        </button>
        <button
          onClick={onRemove}
          aria-label={`Remove ${item.name} from the menu`}
          className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-red-50"
        >
          <Trash2 size={15} className="text-red-500" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

function RewardsView({ merchantName, insight, tick, merchant, dashboard, onChange }: {
  merchantName: string;
  insight: ReturnType<typeof getMerchantInsight>;
  tick: number;
  merchant: Merchant | null;
  dashboard: MerchantDashboardData | null;
  onChange: () => void;
}) {
  // A merchant may only promote their own rewards. Scoped here rather than in
  // the picker's markup, so the list cannot be widened by the UI.
  const mine = useMemo(
    () => getPromotableRewards().filter(reward =>
      reward.merchant.toLowerCase().includes(merchantName.toLowerCase())
      || merchantName.toLowerCase().includes(reward.merchant.toLowerCase())),
    [merchantName, tick],
  );
  const myPromotions = useMemo(
    () => getPromotionReports().filter(report =>
      report.merchant.toLowerCase().includes(merchantName.toLowerCase())
      || merchantName.toLowerCase().includes(report.merchant.toLowerCase())),
    [merchantName, tick],
  );

  const [rewardId, setRewardId] = useState<number | null>(null);
  const [placement, setPlacement] = useState<Placement>('featured');
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const chosen = mine.find(reward => reward.id === rewardId) ?? null;
  const fee = (days / 7) * PLACEMENT_RATES[placement];

  const book = () => {
    if (!chosen) { setError('Pick one of your rewards.'); return; }
    const result = bookPromotion({ reward: chosen, placement, days });
    if (!result.ok) { setError(result.reason ?? 'That placement could not be booked.'); setDone(null); return; }
    setError(null);
    setDone(`${chosen.title} is now ${PLACEMENT_LABELS[placement].toLowerCase()} for ${days} days.`);
    setRewardId(null);
    onChange();
  };

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-2xl bg-primary/5 p-4">
        <h2 className="text-sm font-black text-foreground">Did your rewards bring people back?</h2>
        {insight.redeemers > 0 ? (
          <>
            <p className="mt-2 text-2xl font-black text-primary">
              {insight.returned} of {insight.redeemers}
            </p>
            <p className="text-[11px] text-muted-foreground">
              customers who redeemed one of your rewards then came back and paid you —
              a {percent(insight.returnRate)} return rate.
            </p>
            {insight.wonOver > 0 && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
                <UserPlus size={11} aria-hidden="true" />
                {insight.wonOver} had never bought from you before
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Nobody has redeemed one of your rewards yet. Once they do, this shows how many came
            back and paid you afterwards.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Megaphone} label="Redemptions" value={insight.redemptions.toLocaleString()} note="Your rewards" />
        <Stat icon={Repeat} label="XP spent" value={insight.xpSpent.toLocaleString()} note="On your rewards" />
      </div>

      {insight.popularRewards.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-black text-foreground">Your most redeemed</h2>
          <ul className="space-y-1.5">
            {insight.popularRewards.map(reward => (
              <li key={reward.label} className="flex items-center justify-between gap-2 rounded-xl bg-secondary p-2.5">
                <span className="truncate text-xs font-bold text-foreground">{reward.label}</span>
                <span className="flex-shrink-0 text-xs font-black text-primary">{reward.count}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-1 text-sm font-black text-foreground">Get seen first</h2>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Pay to put one of your rewards at the top of the NETS rewards store. Customers see it
          labelled as sponsored.
        </p>

        {done && <p role="status" className="mb-2 rounded-xl bg-success/10 p-2.5 text-[11px] font-bold text-success">{done}</p>}
        {error && <p role="alert" className="mb-2 rounded-xl bg-destructive/10 p-2.5 text-[11px] font-bold text-destructive">{error}</p>}

        {mine.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
            You have no rewards in the store yet. NETS adds these for you — ask your account
            manager to list one.
          </p>
        ) : (
          <div className="rounded-2xl border-2 border-border bg-white p-4">
            <label htmlFor="merchant-promo-reward" className="mb-1 block text-xs text-muted-foreground">Reward</label>
            <select
              id="merchant-promo-reward"
              value={rewardId ?? ''}
              onChange={event => { setRewardId(Number(event.target.value) || null); setError(null); }}
              className="mb-3 min-h-11 w-full rounded-xl bg-secondary px-3 text-xs outline-none"
            >
              <option value="">Choose one of your rewards…</option>
              {mine.map(reward => <option key={reward.id} value={reward.id}>{reward.title}</option>)}
            </select>

            <div className="mb-2 grid grid-cols-2 gap-2">
              {(Object.keys(PLACEMENT_RATES) as Placement[]).map(option => (
                <button
                  key={option} onClick={() => setPlacement(option)} aria-pressed={placement === option}
                  className={`min-h-11 rounded-xl px-2 text-xs font-black ${placement === option ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
                >
                  {PLACEMENT_LABELS[option]} · {money(PLACEMENT_RATES[option])}/wk
                </button>
              ))}
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">{PLACEMENT_DESCRIPTIONS[placement]}</p>

            <div className="mb-3 grid grid-cols-3 gap-2">
              {[7, 14, 30].map(option => (
                <button
                  key={option} onClick={() => setDays(option)} aria-pressed={days === option}
                  className={`min-h-11 rounded-xl text-xs font-black ${days === option ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
                >
                  {option} days
                </button>
              ))}
            </div>

            <p className="mb-3 rounded-xl bg-secondary p-2.5 text-[11px] text-muted-foreground">
              You pay <b className="text-foreground">{money(fee)}</b> for {days} days.
            </p>

            <button onClick={book} className="min-h-11 w-full rounded-xl bg-primary text-xs font-black text-white">
              Book placement
            </button>
          </div>
        )}
      </section>

      {myPromotions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-black text-foreground">Your placements</h2>
          <ul className="space-y-2">
            {myPromotions.map(report => (
              <li key={report.id} className="rounded-2xl border-2 border-border bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs font-black text-foreground">{report.title}</p>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${report.status === 'live' ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>
                    {report.status}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                  <Figure value={report.impressions.toLocaleString()} label="Shown" />
                  <Figure value={report.redemptions.toLocaleString()} label="Redeemed" />
                  <Figure value={money(report.fee)} label="You paid" />
                </div>
                {report.status !== 'ended' && (
                  <button
                    onClick={() => { endPromotion(report.id); onChange(); }}
                    className="mt-2 min-h-11 w-full rounded-xl border-2 border-border text-[11px] font-black text-muted-foreground"
                  >
                    End placement
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {merchant && (
        <section>
          <h2 className="mb-1 text-sm font-black text-foreground">Reward your regulars</h2>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Give extra XP on everything you sell. A higher multiplier costs you nothing directly —
            it makes paying at your stall worth more to the customer.
          </p>
          <div className="rounded-2xl border-2 border-border bg-white p-4">
            <div className="mb-2 grid grid-cols-3 gap-2">
              {[1, 1.5, 2].map(option => (
                <button
                  key={option}
                  onClick={() => { saveMerchant({ ...merchant, xpBonus: option }); onChange(); }}
                  aria-pressed={merchant.xpBonus === option}
                  className={`min-h-11 rounded-xl text-xs font-black ${merchant.xpBonus === option ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
                >
                  {option}x
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Future $5 orders award{' '}
              <b className="text-foreground">
                {Math.max(1, Math.round(5 * merchant.xpRate * merchant.xpBonus))} XP
              </b>.
            </p>
          </div>
        </section>
      )}

      {dashboard && dashboard.sales.length > 0 && (
        <section>
          <button
            onClick={() => exportSales(merchantName, dashboard)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-border text-xs font-black text-foreground"
          >
            <Download size={14} aria-hidden="true" /> Export my sales report
          </button>
          <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-relaxed text-muted-foreground">
            <ShieldCheck size={11} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
            Your report counts anonymous unique buyers — useful without exposing who your customers
            are. It never contains a name, a phone number or a card.
          </p>
        </section>
      )}

      <section className="rounded-2xl border-2 border-border p-3">
        <div className="mb-1 flex items-center gap-1.5">
          <BarChart3 size={14} className="text-primary" aria-hidden="true" />
          <h2 className="text-xs font-black text-foreground">What your customers buy</h2>
        </div>
        {insight.categories.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No sales recorded yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {insight.categories.map(category => (
              <span key={category.label} className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-muted-foreground">
                {category.label} · {category.count}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Hand the merchant their own numbers as a spreadsheet. Built from the rows
 * already on screen, and deliberately without any customer identity in it —
 * a stallholder needs what sold and when, not who bought it.
 */
function exportSales(merchantName: string, dashboard: MerchantDashboardData): void {
  const rows = [
    ['Item', 'Units', 'Revenue (SGD)', 'Share of orders'],
    ...dashboard.topProducts.map(product => [
      product.name,
      String(product.orders),
      product.revenue.toFixed(2),
      `${Math.round(product.share * 100)}%`,
    ]),
    [],
    ['Day', 'Orders', 'Revenue (SGD)'],
    ...dashboard.salesByDay.map(day => [day.label, String(day.orders), day.revenue.toFixed(2)]),
    [],
    ['Anonymous unique buyers', String(dashboard.uniqueCustomers)],
    ['Repeat buyers', String(dashboard.repeatCustomers)],
    ['XP awarded to customers', String(dashboard.xpAwarded)],
  ];

  const csv = rows
    .map(row => row.map(cell => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
    .join('\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sales.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-secondary py-1.5">
      <p className="text-[11px] font-black text-foreground">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
