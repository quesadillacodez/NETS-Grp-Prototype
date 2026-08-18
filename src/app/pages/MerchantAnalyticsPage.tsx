import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles, Store, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { DarkHeader } from '../components/DarkHeader';
import { getMerchantXPStats, getMerchantXPTotals } from '../utils/merchantAnalytics';
import { useAppEvents } from '../utils/useAppEvents';

function Uplift({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
        <Minus size={11} /> No comparison
      </span>
    );
  }
  const percent = Math.round((value - 1) * 100);
  const positive = percent >= 0;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-black ${positive ? 'text-success' : 'text-red-600'}`}>
      {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {positive ? '+' : ''}{percent}% daily spend
    </span>
  );
}

export function MerchantAnalyticsPage() {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  useAppEvents(['transactionsUpdated', 'merchantsUpdated', 'databaseReady', 'focus'], () => setVersion(v => v + 1));

  const stats = useMemo(() => getMerchantXPStats(), [version]);
  const totals = useMemo(() => getMerchantXPTotals(stats), [stats]);
  const maxXP = stats.reduce((max, item) => Math.max(max, item.xpIssued), 0);

  return (
    <div className="flex h-full flex-col bg-background">
      <DarkHeader title="Merchant XP" onBack={() => navigate('/admin')} bottomGap="mb-5" padding="pt-12 pb-6">
        <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-md">
          <p className="text-xs text-white/75">Total XP issued</p>
          <h2 className="mt-1 text-4xl font-black text-white">{totals.xpIssued.toLocaleString()}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/75">
            <span>{totals.transactionCount} payments</span>
            <span>${totals.totalSpend.toFixed(2)} spend</span>
            <span>{totals.bonusXP.toLocaleString()} XP from bonuses</span>
          </div>
        </div>
      </DarkHeader>

      <main className="flex-1 overflow-y-auto px-4 pb-10">
        {totals.activeCampaigns > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#fff8df] p-3">
            <Sparkles size={16} className="shrink-0 text-[#b7791f]" />
            <p className="text-xs text-foreground">
              {totals.activeCampaigns} campaign{totals.activeCampaigns === 1 ? '' : 's'} running right now.
            </p>
          </div>
        )}

        {stats.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Store size={28} />
            </div>
            <h2 className="mt-3 text-base font-black">No merchants configured</h2>
            <p className="mt-1 text-xs text-muted-foreground">Add merchants in the admin portal first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.map((item, index) => (
              <motion.div
                key={item.merchant.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.3) }}
                className="rounded-2xl border border-border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black">{item.merchant.name}</p>
                      {!item.merchant.active && (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[9px] font-black text-muted-foreground">
                          Hidden
                        </span>
                      )}
                      {item.campaignActive && (
                        <span className="shrink-0 rounded-full bg-[#fff2bd] px-2 py-0.5 text-[9px] font-black text-[#7a5a00]">
                          {item.merchant.xpBonus}x live
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {item.transactionCount} payment{item.transactionCount === 1 ? '' : 's'} · ${item.totalSpend.toFixed(2)} ·
                      avg ${item.averageSpend.toFixed(2)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="flex items-center justify-end gap-1 text-sm font-black text-primary">
                      <Zap size={13} />{item.xpIssued.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-muted-foreground">XP issued</p>
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${maxXP > 0 ? (item.xpIssued / maxXP) * 100 : 0}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground">Baseline XP</p>
                    <p className="text-xs font-black">{item.baselineXP.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground">Bonus cost</p>
                    <p className="text-xs font-black text-[#b7791f]">
                      {item.bonusXP > 0 ? `+${item.bonusXP.toLocaleString()}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground">Campaign uplift</p>
                    <Uplift value={item.uplift} />
                  </div>
                </div>

                {item.bonusXP > 0 && (
                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                    {Math.round(item.campaignShare * 100)}% of spend happened during a campaign.
                    {item.uplift === null && ' Not enough activity outside the campaign to measure uplift yet.'}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
          Uplift compares average daily spend while a campaign was running against days it was not.
          It needs activity on both sides to be meaningful.
        </p>
      </main>
    </div>
  );
}
