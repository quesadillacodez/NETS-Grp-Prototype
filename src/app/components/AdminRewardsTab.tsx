import { useMemo, useState } from 'react';
import {
  BarChart3, Clock3, Flame, Megaphone, Plus, Repeat, Store, TrendingUp, Trophy, UserPlus, X, Zap,
} from 'lucide-react';
import {
  getCategoryFavourites, getMerchantLeaderboard, getPopularRewards, type MerchantInsight,
} from '../utils/merchantInsights';
import {
  MAX_LIVE_PROMOTIONS, PLACEMENT_DESCRIPTIONS, PLACEMENT_LABELS, PLACEMENT_RATES,
  bookPromotion, endPromotion, getPlacementRevenue, getPromotableRewards, getPromotionReports,
  type Placement, type PromotionReport, type PromotionStatus,
} from '../utils/promotionStorage';
import { useAppEvents } from '../utils/useAppEvents';

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const percent = (n: number) => `${Math.round(n * 100)}%`;

const STATUS_STYLES: Record<PromotionStatus, string> = {
  live: 'bg-success/10 text-success',
  scheduled: 'bg-primary/10 text-primary',
  ended: 'bg-secondary text-muted-foreground',
};

const DURATIONS = [7, 14, 30];

/**
 * The rewards side of the management portal: what merchants learn from
 * accepting NETS, and the paid placements they can buy in the store.
 *
 * Every number here is derived from the transaction and redemption ledgers when
 * it is read, so the portal cannot show a merchant a figure the customer app
 * would contradict.
 */
export function AdminRewardsTab() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(n => n + 1);
  useAppEvents(['promotionsUpdated', 'rewardRedemptionsUpdated', 'transactionsUpdated'], refresh);

  const [showForm, setShowForm] = useState(false);
  const [openMerchant, setOpenMerchant] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const promotable = useMemo(getPromotableRewards, [tick]);
  const [rewardId, setRewardId] = useState<number | null>(null);
  const [placement, setPlacement] = useState<Placement>('featured');
  const [days, setDays] = useState(7);

  const reports = useMemo(() => getPromotionReports(), [tick]);
  const revenue = useMemo(() => getPlacementRevenue(), [tick]);
  const leaderboard = useMemo(() => getMerchantLeaderboard(), [tick]);
  const popular = useMemo(() => getPopularRewards(5), [tick]);
  const favourites = useMemo(() => getCategoryFavourites(), [tick]);

  const liveCount = reports.filter(report => report.status === 'live').length;
  const totalRedemptions = leaderboard.reduce((sum, m) => sum + m.redemptions, 0);
  const chosen = promotable.find(reward => reward.id === rewardId) ?? null;
  const fee = (days / 7) * PLACEMENT_RATES[placement];

  const book = () => {
    if (!chosen) { setError('Pick a reward to promote.'); return; }
    const result = bookPromotion({ reward: chosen, placement, days });
    if (!result.ok) { setError(result.reason ?? 'That placement could not be booked.'); setDone(null); return; }
    setError(null);
    setDone(`${chosen.title} is now ${PLACEMENT_LABELS[placement].toLowerCase()} for ${days} days.`);
    setShowForm(false);
    setRewardId(null);
    refresh();
  };

  return (
    <div className="p-4 space-y-4">

      {/* ── Headline ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Megaphone} label="Placement revenue" value={money(revenue.earned)}
          note={`${money(revenue.committed)} booked`} />
        <Stat icon={Zap} label="Paid slots in use" value={`${liveCount} / ${MAX_LIVE_PROMOTIONS}`}
          note={liveCount >= MAX_LIVE_PROMOTIONS ? 'Sold out' : 'Slots available'} />
        <Stat icon={Trophy} label="Rewards redeemed" value={totalRedemptions.toLocaleString()}
          note="All merchants" />
        <Stat icon={Store} label="Merchants tracked" value={leaderboard.length.toLocaleString()}
          note="Paying and partner" />
      </div>

      {/* ── Paid placements ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-foreground">Paid placements</h3>
            <p className="text-[11px] text-muted-foreground">
              Merchants pay to be shown first. Promoted rewards are labelled in the store.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setError(null); setDone(null); }}
              className="flex min-h-11 flex-shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-black text-white"
            >
              <Plus size={14} aria-hidden="true" /> Promote
            </button>
          )}
        </div>

        {done && (
          <p role="status" className="mb-2 rounded-xl bg-success/10 p-2.5 text-[11px] font-bold text-success">{done}</p>
        )}
        {error && (
          <p role="alert" className="mb-2 rounded-xl bg-destructive/10 p-2.5 text-[11px] font-bold text-destructive">{error}</p>
        )}

        {showForm && (
          <div className="mb-3 rounded-2xl border-2 border-primary bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground">Sell a placement</h4>
              <button onClick={() => setShowForm(false)} aria-label="Close placement form" className="text-muted-foreground">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <label htmlFor="promo-reward" className="mb-1 block text-xs text-muted-foreground">Reward</label>
            <select
              id="promo-reward"
              value={rewardId ?? ''}
              onChange={event => { setRewardId(Number(event.target.value) || null); setError(null); }}
              className="mb-3 min-h-11 w-full rounded-xl bg-secondary px-3 text-xs text-foreground outline-none"
            >
              <option value="">Choose a reward…</option>
              {promotable.map(reward => (
                <option key={reward.id} value={reward.id}>{reward.merchant} — {reward.title}</option>
              ))}
            </select>

            <p className="mb-1 text-xs text-muted-foreground">Placement</p>
            <div className="mb-2 grid grid-cols-2 gap-2">
              {(Object.keys(PLACEMENT_RATES) as Placement[]).map(option => (
                <button
                  key={option}
                  onClick={() => setPlacement(option)}
                  aria-pressed={placement === option}
                  className={`min-h-11 rounded-xl px-2 text-xs font-black ${placement === option ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
                >
                  {PLACEMENT_LABELS[option]} · {money(PLACEMENT_RATES[option])}/wk
                </button>
              ))}
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">{PLACEMENT_DESCRIPTIONS[placement]}</p>

            <p className="mb-1 text-xs text-muted-foreground">Duration</p>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {DURATIONS.map(option => (
                <button
                  key={option}
                  onClick={() => setDays(option)}
                  aria-pressed={days === option}
                  className={`min-h-11 rounded-xl text-xs font-black ${days === option ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
                >
                  {option} days
                </button>
              ))}
            </div>

            <p className="mb-3 rounded-xl bg-secondary p-2.5 text-[11px] text-muted-foreground">
              {chosen ? <><b className="text-foreground">{chosen.merchant}</b> pays </> : 'Merchant pays '}
              <b className="text-foreground">{money(fee)}</b> for {days} days of {PLACEMENT_LABELS[placement].toLowerCase()} placement.
            </p>

            <button onClick={book} className="min-h-11 w-full rounded-xl bg-primary text-xs font-black text-white">
              Book placement
            </button>
          </div>
        )}

        {reports.length === 0 ? (
          <Empty icon={Megaphone} title="No placements sold yet"
            text="Promote a reward to put it at the top of the store and start billing the merchant." />
        ) : (
          <ul className="space-y-2">
            {reports.map(report => (
              <PromotionRow key={report.id} report={report} onEnd={() => { endPromotion(report.id); refresh(); }} />
            ))}
          </ul>
        )}
      </section>

      {/* ── What customers like ──────────────────────────────────────────── */}
      <section className="grid gap-3">
        <div className="rounded-2xl border-2 border-border bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <Flame size={16} className="text-primary" aria-hidden="true" />
            <h3 className="text-sm font-black text-foreground">Most redeemed rewards</h3>
          </div>
          {popular.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Nothing redeemed yet — the ranking appears once customers start spending XP.</p>
          ) : (
            <ol className="space-y-1.5">
              {popular.map((item, index) => (
                <li key={item.rewardId} className="flex items-center gap-2.5">
                  <span className="w-4 flex-shrink-0 text-[11px] font-black text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-foreground">{item.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{item.merchant}</span>
                  </span>
                  <span className="flex-shrink-0 text-right">
                    <span className="block text-xs font-black text-primary">{item.redemptions}×</span>
                    {item.recent > 0 && <span className="block text-[9px] font-bold text-success">{item.recent} this week</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-2xl border-2 border-border bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" aria-hidden="true" />
            <h3 className="text-sm font-black text-foreground">What customers spend on</h3>
          </div>
          {favourites.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No purchases recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {favourites.map(item => (
                <li key={item.label}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-bold text-foreground">{item.label}</span>
                    <span className="flex-shrink-0 text-muted-foreground">{item.count} · {percent(item.share)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, item.share * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Merchant performance ─────────────────────────────────────────── */}
      <section>
        <h3 className="mb-1 text-sm font-black text-foreground">Merchant performance</h3>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Tap a merchant for the report NETS can hand back to them.
        </p>

        {leaderboard.length === 0 ? (
          <Empty icon={Store} title="No merchants yet" text="Add a merchant to start collecting insights." />
        ) : (
          <ul className="space-y-2">
            {leaderboard.map(insight => (
              <MerchantRow
                key={insight.merchant}
                insight={insight}
                open={openMerchant === insight.merchant}
                onToggle={() => setOpenMerchant(current => current === insight.merchant ? null : insight.merchant)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, note }: {
  icon: typeof Store; label: string; value: string; note: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-white p-3">
      <Icon size={16} className="mb-1 text-primary" aria-hidden="true" />
      <p className="text-lg font-black leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </div>
  );
}

function Empty({ icon: Icon, title, text }: { icon: typeof Store; title: string; text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
      <Icon size={26} className="mx-auto mb-2 text-muted-foreground opacity-40" aria-hidden="true" />
      <p className="text-xs font-bold text-foreground">{title}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{text}</p>
    </div>
  );
}

function PromotionRow({ report, onEnd }: { report: PromotionReport; onEnd: () => void }) {
  return (
    <li className="rounded-2xl border-2 border-border bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-foreground">{report.title}</p>
          <p className="truncate text-[10px] text-muted-foreground">{report.merchant}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-black uppercase text-muted-foreground">
            {PLACEMENT_LABELS[report.placement]}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${STATUS_STYLES[report.status]}`}>
            {report.status}
          </span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1 text-center">
        <Figure value={report.impressions.toLocaleString()} label="Shown" />
        <Figure value={report.redemptions.toLocaleString()} label="Redeemed" />
        <Figure value={money(report.fee)} label="Billed" />
        <Figure
          value={report.costPerRedemption === null ? '—' : money(report.costPerRedemption)}
          label="Per redemption"
        />
      </div>

      {report.status !== 'ended' && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground">
            {report.status === 'scheduled' ? 'Starts soon' : `${report.daysRemaining} day${report.daysRemaining === 1 ? '' : 's'} left`}
          </p>
          <button
            onClick={onEnd}
            className="min-h-11 rounded-xl border-2 border-border px-3 text-[11px] font-black text-muted-foreground"
          >
            End placement
          </button>
        </div>
      )}
    </li>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-secondary py-1.5">
      <p className="text-[11px] font-black text-foreground">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

function MerchantRow({ insight, open, onToggle }: {
  insight: MerchantInsight; open: boolean; onToggle: () => void;
}) {
  return (
    <li className="overflow-hidden rounded-2xl border-2 border-border bg-white">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 p-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-foreground">{insight.merchant}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {insight.sales} sale{insight.sales === 1 ? '' : 's'} · {insight.redemptions} redemption{insight.redemptions === 1 ? '' : 's'}
          </p>
        </div>
        <span className="flex-shrink-0 text-xs font-black text-primary">{money(insight.revenue)}</span>
      </button>

      {open && (
        <div className="border-t border-border p-3 pt-3">
          {insight.sales === 0 && insight.redemptions === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No activity yet. Insights appear once customers pay or redeem here.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Detail icon={TrendingUp} label="Average sale" value={money(insight.averageSpend)} />
                <Detail icon={Clock3} label="Busiest time"
                  value={insight.peakHour ? `${insight.peakHour}, ${insight.peakDay}` : '—'} />
                {/* Deliberately worded apart from the return-rate card below:
                    this counts customers who bought here more than once, that
                    one counts customers who came back after redeeming. */}
                <Detail icon={Repeat} label="Bought more than once"
                  value={`${insight.repeatCustomers} of ${insight.customers}`} />
                <Detail icon={UserPlus} label="First visit was a reward" value={insight.wonOver.toLocaleString()} />
              </div>

              {insight.redeemers > 0 && (
                <div className="rounded-xl bg-primary/5 p-2.5">
                  <p className="text-[11px] font-black text-foreground">
                    {insight.returned} of {insight.redeemers} customers who redeemed came back and paid here
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {percent(insight.returnRate)} return rate · {insight.xpSpent.toLocaleString()} XP spent on this merchant's rewards
                  </p>
                </div>
              )}

              {insight.popularRewards.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">Most redeemed here</p>
                  <ul className="space-y-1">
                    {insight.popularRewards.map(item => (
                      <li key={item.label} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate text-foreground">{item.label}</span>
                        <span className="flex-shrink-0 font-black text-primary">{item.count}×</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insight.categories.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">Sales by category</p>
                  <div className="flex flex-wrap gap-1">
                    {insight.categories.map(item => (
                      <span key={item.label} className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-muted-foreground">
                        {item.label} · {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary p-2.5">
      <div className="mb-0.5 flex items-center gap-1">
        <Icon size={11} className="text-muted-foreground" aria-hidden="true" />
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
      <p className="text-xs font-black text-foreground">{value}</p>
    </div>
  );
}
