import { useState } from 'react';
import {
  BadgeDollarSign, BarChart3, ChevronRight, Clock3, Download, Lightbulb,
  LogOut, ReceiptText, Repeat2, ShieldCheck, Sparkles, Store, TrendingUp,
  Users, UtensilsCrossed, Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { logout } from '../utils/authStorage';
import { getMerchantDashboard } from '../utils/merchantInsightStorage';
import { getMerchants, saveMerchant, type Merchant } from '../utils/merchantStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

type MerchantTab = 'overview' | 'products' | 'growth';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value);
}

function MetricCard({ icon, label, value, detail }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-[#0053a0]">{icon}<span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span></div>
      <p className="mt-2 text-xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

function RevenueChart({ days }: { days: ReturnType<typeof getMerchantDashboard>['salesByDay'] }) {
  const maxRevenue = Math.max(...days.map(day => day.revenue), 1);
  return (
    <div className="mt-4 flex h-32 items-end justify-between gap-2" aria-label="Seven day sales chart">
      {days.map(day => (
        <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="text-[9px] font-bold text-slate-500">${day.revenue.toFixed(0)}</span>
          <div className="flex h-20 w-full items-end rounded-lg bg-blue-50 p-0.5">
            <motion.div
              className="w-full rounded-md bg-gradient-to-t from-[#0053a0] to-[#31a8ff]"
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(8, (day.revenue / maxRevenue) * 100)}%` }}
              transition={{ duration: 0.45 }}
              title={`${day.label}: ${formatMoney(day.revenue)}, ${day.orders} orders`}
            />
          </div>
          <span className="text-[9px] font-bold text-slate-500">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({ merchant }: { merchant: Merchant }) {
  const data = getMerchantDashboard(merchant);
  const topProduct = data.topProducts[0];
  const peak = [...data.dayparts].sort((a, b) => b.orders - a.orders)[0];

  return (
    <div className="space-y-4 px-4 pb-28 pt-4">
      <section className="overflow-hidden rounded-3xl bg-[#061d42] p-5 text-white shadow-xl shadow-blue-950/15">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#70bcff]">Today’s clearest signal</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">{topProduct?.name ?? 'Sales are ready to track'}</h2>
            <p className="mt-2 max-w-[240px] text-xs leading-relaxed text-blue-100/75">
              {topProduct
                ? `Your #1 item accounts for ${Math.round(topProduct.share * 100)}% of recorded orders.`
                : 'The first customer payment will appear here automatically.'}
            </p>
          </div>
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10"><UtensilsCrossed className="size-6 text-[#70bcff]" /></div>
        </div>
        {topProduct && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3">
            <div className="grid size-9 place-items-center rounded-xl bg-[#0f7ae5] text-sm font-black">#1</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black">{topProduct.orders} orders · {formatMoney(topProduct.revenue)}</p>
              <p className="text-[10px] text-blue-100/60">Stock-up insight, calculated from NETS sales</p>
            </div>
            <ChevronRight className="size-4 text-blue-200/60" />
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<BadgeDollarSign className="size-4" />} label="Sales" value={formatMoney(data.grossSales)} detail={`${data.transactionCount} NETS orders`} />
        <MetricCard icon={<ReceiptText className="size-4" />} label="Avg. ticket" value={formatMoney(data.averageTicket)} detail="Per transaction" />
        <MetricCard icon={<Users className="size-4" />} label="Customers" value={String(data.uniqueCustomers)} detail="Anonymous unique buyers" />
        <MetricCard icon={<Repeat2 className="size-4" />} label="Return rate" value={`${data.repeatRate.toFixed(0)}%`} detail={`${data.repeatCustomers} repeat customers`} />
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sales pulse</p>
            <h3 className="mt-1 text-base font-black text-slate-950">Last 7 days</h3>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700"><TrendingUp className="size-3" /> Live</div>
        </div>
        <RevenueChart days={data.salesByDay} />
      </section>

      <section className="rounded-3xl bg-[#edf7ff] p-4">
        <div className="flex items-center gap-2"><Sparkles className="size-4 text-[#0066c4]" /><h3 className="text-sm font-black text-[#052a50]">Customer & rewards impact</h3></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/80 p-3"><p className="text-lg font-black text-[#0053a0]">{data.xpAwarded.toLocaleString()}</p><p className="text-[10px] font-bold text-slate-500">XP awarded to buyers</p></div>
          <div className="rounded-2xl bg-white/80 p-3"><p className="text-lg font-black text-[#0053a0]">{data.voucherRedemptions}</p><p className="text-[10px] font-bold text-slate-500">Vouchers used here</p></div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-[#31506e]"><Clock3 className="size-3" /> Peak demand: {peak?.label ?? 'Waiting for data'}</p>
      </section>
    </div>
  );
}

function ProductsTab({ merchant }: { merchant: Merchant }) {
  const data = getMerchantDashboard(merchant);
  const maxOrders = Math.max(...data.topProducts.map(product => product.orders), 1);
  return (
    <div className="space-y-4 px-4 pb-28 pt-4">
      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Menu intelligence</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">What customers choose</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">Ranked from NETS payment references—not guesses or manual surveys.</p>
        <div className="mt-5 space-y-4">
          {data.topProducts.map((product, index) => (
            <div key={product.name}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="truncate text-xs font-black text-slate-800"><span className="mr-2 text-[#0070d8]">{index + 1}</span>{product.name}</p>
                <p className="shrink-0 text-[10px] font-bold text-slate-500">{product.orders} · {formatMoney(product.revenue)}</p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#0053a0] to-[#39a9ff]" style={{ width: `${(product.orders / maxOrders) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2"><Clock3 className="size-4 text-[#0053a0]" /><h3 className="text-sm font-black">When customers buy</h3></div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {data.dayparts.map(daypart => (
            <div key={daypart.label} className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="text-base font-black text-slate-950">{daypart.orders}</p>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">{daypart.label}</p>
              <p className="mt-1 text-[9px] text-slate-400">{formatMoney(daypart.revenue)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" /><div><h3 className="text-sm font-black text-emerald-950">Useful without exposing customers</h3><p className="mt-1 text-xs leading-relaxed text-emerald-800/75">You see product demand, visit patterns and anonymous repeat rates. Names, card details and individual spending histories stay private.</p></div></div>
      </section>
    </div>
  );
}

function GrowthTab({ merchant, onMerchantChange }: { merchant: Merchant; onMerchantChange: (merchant: Merchant) => void }) {
  const data = getMerchantDashboard(merchant);
  const setBonus = (xpBonus: number) => {
    const updated = { ...merchant, xpBonus };
    saveMerchant(updated);
    onMerchantChange(updated);
  };
  const exportReport = () => {
    const rows = [
      ['Date', 'Item', 'Amount (SGD)', 'XP awarded', 'Source'],
      ...data.sales.map(sale => [new Date(sale.createdAt).toLocaleString('en-SG'), sale.itemName, sale.amount.toFixed(2), String(sale.xpEarned), sale.source]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${merchant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sales-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 px-4 pb-28 pt-4">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0053a0] to-[#0087df] p-5 text-white shadow-lg">
        <div className="flex items-center gap-2"><Zap className="size-5 text-yellow-300" /><p className="text-xs font-black uppercase tracking-wider text-blue-100">XP campaign studio</p></div>
        <h2 className="mt-3 text-xl font-black">Turn quiet hours into return visits.</h2>
        <p className="mt-2 text-xs leading-relaxed text-blue-100/80">Choose the multiplier customers earn on future purchases. Their XP Store gets more valuable while your campaign remains measurable here.</p>
        <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="XP multiplier">
          {[1, 1.5, 2].map(multiplier => (
            <button
              key={multiplier}
              onClick={() => setBonus(multiplier)}
              aria-pressed={merchant.xpBonus === multiplier}
              className={`rounded-2xl border px-2 py-3 text-sm font-black transition ${merchant.xpBonus === multiplier ? 'border-white bg-white text-[#0053a0]' : 'border-white/20 bg-white/10 text-white'}`}
            >
              {multiplier}x
            </button>
          ))}
        </div>
        <p role="status" className="mt-3 text-[10px] font-bold text-blue-100">Future $5 orders award {Math.round(5 * merchant.xpRate * merchant.xpBonus)} XP.</p>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2"><Lightbulb className="size-4 text-amber-500" /><h3 className="text-sm font-black">Next best actions</h3></div>
        <div className="mt-3 space-y-3">
          {data.recommendations.map((recommendation, index) => (
            <div key={recommendation} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[#0053a0] text-[10px] font-black text-white">{index + 1}</div>
              <p className="text-xs font-semibold leading-relaxed text-slate-700">{recommendation}</p>
            </div>
          ))}
        </div>
      </section>

      <button onClick={exportReport} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#0053a0] bg-white text-sm font-black text-[#0053a0]">
        <Download className="size-4" /> Export my sales report
      </button>
      <p className="px-3 text-center text-[10px] leading-relaxed text-slate-400">The report contains aggregated merchant sales facts only. It excludes customer names and payment credentials.</p>
    </div>
  );
}

export function MerchantDashboardPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [merchant, setMerchant] = useState(() => getMerchants().find(candidate => candidate.id === user.merchantId) ?? null);
  const [tab, setTab] = useState<MerchantTab>('overview');
  const [, setVersion] = useState(0);
  useAppEvents(['merchantSalesUpdated', 'merchantsUpdated', 'databaseReady'], () => setVersion(version => version + 1));

  if (!merchant) {
    return <div className="grid h-full place-items-center bg-slate-50 p-8 text-center"><div><Store className="mx-auto size-10 text-slate-300" /><h1 className="mt-3 text-lg font-black">Merchant profile unavailable</h1><p className="mt-1 text-sm text-slate-500">Ask an administrator to link this account to a merchant.</p></div></div>;
  }
  const dashboard = getMerchantDashboard(merchant);

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f5f8fc] text-slate-950">
      <header className="sticky top-0 z-20 bg-[#061d42] px-4 pb-4 pt-4 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-white text-xl shadow-sm">🏪</div>
          <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#70bcff]">NETS Merchant</p><h1 className="truncate text-base font-black">{merchant.name}</h1></div>
          <button onClick={signOut} aria-label="Sign out" className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/10"><LogOut className="size-4" /></button>
        </div>
        <div className="mt-4 flex rounded-2xl bg-white/[0.08] p-1" role="tablist" aria-label="Merchant dashboard sections">
          {([
            ['overview', 'Overview', BarChart3],
            ['products', 'Products', UtensilsCrossed],
            ['growth', 'Growth', Sparkles],
          ] as const).map(([value, label, Icon]) => (
            <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[10px] font-black transition ${tab === value ? 'bg-white text-[#0053a0] shadow-sm' : 'text-blue-100/65'}`}><Icon className="size-3.5" />{label}</button>
          ))}
        </div>
      </header>

      {dashboard.hasDemoData && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-900"><span>Demo history + live payments</span><span className="rounded-full bg-amber-200/60 px-2 py-0.5 font-black">SAMPLE</span></div>
      )}
      {tab === 'overview' && <OverviewTab merchant={merchant} />}
      {tab === 'products' && <ProductsTab merchant={merchant} />}
      {tab === 'growth' && <GrowthTab merchant={merchant} onMerchantChange={setMerchant} />}
    </div>
  );
}
