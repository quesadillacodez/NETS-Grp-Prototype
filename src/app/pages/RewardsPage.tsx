import { type ReactNode, useEffect, useState } from 'react';
import {
  AlertTriangle, Award, Check, ChevronDown, ChevronRight, Clock3, Flame, Gift, History, LockKeyhole,
  MapPin, Megaphone, Navigation, Search, ShoppingBag, Sparkles, Store, Target, TicketCheck, Trophy, WalletCards, X, Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { BottomNav } from '../components/BottomNav';
import { NETSLogo } from '../components/NETSLogo';
import {
  REDEMPTION_STATUS_LABELS,
  daysUntilExpiry,
  formatExpiry,
  getRedemptionStatus,
  getRewardsCatalog,
  getRewardRedemptions,
  getRewardTerms,
  getTier,
  getTierProgress,
  getXPLedger,
  tierMultiplier,
  TIERS,
  getXPHistory,
  getXPStats,
  getGoalProgress,
  getGoalRewardId,
  setGoalReward,
  compareRewards,
  REWARD_SORT_LABELS,
  type RewardSort,
  isCashbackRedemption,
  markRewardUsed,
  redeemReward,
  syncVoucherIndex,
  type RedemptionStatus,
  type Reward,
  type RewardCategory,
  type RewardRedemption,
} from '../utils/rewardStorage';
import { currentStreak, dayKey, evaluateDay, getQuestSignals } from '../utils/questStorage';
import { QRCode } from '../components/QRCode';
import { voucherScanUrl } from '../utils/voucherLink';
import { getCurrentUser } from '../utils/userStorage';
import {
  DEFAULT_NEARBY_RADIUS_KM, byDistance, getUserArea, isWithinRadius, proximityTo,
} from '../utils/geo';
import { useAppEvents } from '../utils/useAppEvents';
import { LocationSheet } from '../components/LocationPicker';
import { getLivePromotions, localisePromotions, recordImpressions } from '../utils/promotionStorage';
import { getRedemptionCounts } from '../utils/merchantInsights';

type RewardsTab = 'overview' | 'store' | 'wallet' | 'ledger' | 'history';

const STATUS_STYLES: Record<RedemptionStatus, string> = {
  applied: 'bg-success/10 text-success',
  active: 'bg-success/10 text-success',
  used: 'bg-secondary text-muted-foreground',
  expired: 'bg-destructive/10 text-destructive',
};

/**
 * Terms come from the catalogue entry the voucher was issued against. If that
 * entry has since been removed (an admin deleted the partner deal), the
 * validity is reconstructed from the voucher's own dates so the terms shown
 * still describe the voucher the user actually holds.
 */
function termsForRedemption(redemption: RewardRedemption): string[] {
  const catalogueEntry = getRewardsCatalog().find(reward => reward.id === redemption.rewardId);
  if (catalogueEntry) return getRewardTerms(catalogueEntry);

  const validityDays = redemption.expiresAt > 0
    ? Math.round((redemption.expiresAt - redemption.redeemedAt) / (24 * 60 * 60 * 1000))
    : 0;
  return getRewardTerms({
    merchant: redemption.merchant,
    validityDays,
    category: validityDays > 0 ? 'Vouchers' : 'Cashback',
  });
}

function TermsAndConditions({ terms }: { terms: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-border text-left">
      <button
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-left"
      >
        <span className="flex-1 text-xs font-black text-foreground">Terms &amp; conditions</span>
        <ChevronDown
          size={15}
          className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul className="space-y-1.5 border-t border-border px-3 py-2.5">
          {terms.map((term, index) => (
            <li key={index} className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <span aria-hidden="true">·</span>{term}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function directionsUrl(merchant: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${merchant} Singapore`)}`;
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

function RewardDetail({ reward, userId, currentXP, isGoal, onToggleGoal, onRedeem, onClose }: {
  reward: Reward;
  userId: string;
  currentXP: number;
  isGoal: boolean;
  onToggleGoal: () => void;
  onRedeem: () => void;
  onClose: () => void;
}) {
  const canRedeem = currentXP >= reward.xpCost;
  const proximity = proximityTo(userId, reward.area);
  return (
    <OverlaySheet onClose={onClose}>
      <div className="px-5 pb-8">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-3xl" aria-hidden="true">{reward.icon}</div><div><p className="text-xs font-bold text-muted-foreground">{reward.merchant}</p><h2 className="max-w-[245px] text-xl font-black leading-tight">{reward.title}</h2></div></div>
          <button onClick={onClose} aria-label="Close reward details" className="grid h-11 w-11 place-items-center rounded-full bg-secondary"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#1e2a4a] p-4 text-white"><div><p className="text-xs text-white/65">Reward cost</p><p className="text-2xl font-black">{reward.xpCost.toLocaleString()} XP</p></div><Gift size={30} className="text-[#ffca28]" /></div>
        <p className="text-sm leading-relaxed text-muted-foreground">{reward.description}</p>
        <div className="my-4 space-y-2 rounded-2xl border border-border p-3 text-xs text-foreground">
          <p className="flex items-center gap-2"><TicketCheck size={15} className="text-primary" aria-hidden="true" />One redemption per voucher code</p>
          <p className="flex items-center gap-2">
            <Clock3 size={15} className="text-primary" aria-hidden="true" />
            {reward.validityDays
              ? `Valid for ${reward.validityDays} days — until ${formatExpiry(Date.now() + reward.validityDays * 24 * 60 * 60 * 1000)}`
              : 'Cashback is applied to your wallet instantly'}
          </p>
          {reward.area && (
            <p className="flex items-center gap-2">
              <MapPin size={15} className="text-primary" aria-hidden="true" />
              {reward.area}{proximity.label && !proximity.islandwide ? ` · ${proximity.label}` : ''}
            </p>
          )}
        </div>
        <div className="mb-4">
          <TermsAndConditions terms={getRewardTerms(reward)} />
        </div>
        <div className={`mb-4 rounded-xl p-3 text-xs ${canRedeem ? 'bg-success/10 text-success' : 'bg-red-50 text-red-700'}`}>
          {canRedeem ? `After redemption: ${(currentXP - reward.xpCost).toLocaleString()} XP` : `You need ${(reward.xpCost - currentXP).toLocaleString()} more XP.`}
        </div>

        {!canRedeem && (
          // Only offered while it is out of reach: setting a goal you can
          // already afford would be a button that does nothing for you.
          <button
            onClick={onToggleGoal}
            aria-pressed={isGoal}
            className={`mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-black ${
              isGoal ? 'bg-primary/10 text-primary' : 'border-2 border-primary/40 text-primary'
            }`}
          >
            <Target size={16} aria-hidden="true" />
            {isGoal ? 'Tracking this reward' : 'Save as my goal'}
          </button>
        )}
        <button disabled={!canRedeem} onClick={onRedeem} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{canRedeem ? <><Gift size={17} /> Confirm redemption</> : <><LockKeyhole size={17} /> Not enough XP</>}</button>
      </div>
    </OverlaySheet>
  );
}

function VoucherCode({ redemption, muted }: { redemption: RewardRedemption; muted?: boolean }) {
  if (isCashbackRedemption(redemption)) {
    return (
      <div className="mx-auto my-5 grid h-28 w-28 place-items-center rounded-full bg-success/10 text-3xl font-black text-success">
        S$
      </div>
    );
  }
  return (
    <div className={`mx-auto my-5 grid h-44 w-44 place-items-center rounded-3xl border-8 border-[#1e2a4a] bg-white ${muted ? 'opacity-40 grayscale' : ''}`}>
      <QRCode
        value={voucherScanUrl(redemption.refCode)}
        size={140}
        label={`Scannable voucher code ${redemption.refCode}`}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: RedemptionStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${STATUS_STYLES[status]}`}>
      {REDEMPTION_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Shown immediately after a successful redemption. Deliberately separate from
 * the voucher itself: it confirms what was spent and what happens next, and it
 * closes on an explicit Done rather than leaving the user in a sheet with no
 * obvious way out.
 */
function RedemptionReceipt({ redemption, remainingXP, onViewVoucher, onDone }: {
  redemption: RewardRedemption;
  remainingXP: number;
  onViewVoucher: () => void;
  onDone: () => void;
}) {
  const instantCashback = isCashbackRedemption(redemption);
  return (
    <OverlaySheet onClose={onDone}>
      <div className="px-5 pb-8">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success text-white"
          >
            <Check size={32} strokeWidth={3} aria-hidden="true" />
          </motion.div>
          {/* The announcement is a separate element: putting role="status" on the
              heading itself would replace its heading role for screen readers. */}
          <p role="status" aria-live="polite" className="sr-only">
            Redemption confirmed. {instantCashback
              ? 'Your cashback has been credited to your NETS wallet.'
              : 'Your voucher is ready in your rewards wallet.'}
          </p>
          <h2 className="mt-3 text-xl font-black">Redemption confirmed</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {instantCashback
              ? 'Your cashback has been credited to your NETS wallet.'
              : 'Your voucher is ready in your rewards wallet.'}
          </p>
        </div>

        <div className="mt-5 rounded-2xl border-2 border-border p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground">{redemption.merchant}</p>
              <p className="truncate text-sm font-black text-foreground">{redemption.title}</p>
            </div>
            <StatusBadge status={getRedemptionStatus(redemption)} />
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Reference code</span>
              <span className="font-mono text-xs font-black text-primary">{redemption.refCode}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">XP spent</span>
              <span className="text-xs font-black text-foreground">-{redemption.xpCost.toLocaleString()} XP</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">XP remaining</span>
              <span className="text-xs font-black text-foreground">{remainingXP.toLocaleString()} XP</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Redeemed on</span>
              <span className="text-xs font-black text-foreground">{formatExpiry(redemption.redeemedAt)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Valid until</span>
              <span className={`text-xs font-black ${redemption.expiresAt > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                {formatExpiry(redemption.expiresAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <TermsAndConditions terms={termsForRedemption(redemption)} />
        </div>

        <div className="mt-4 space-y-2">
          {!instantCashback && (
            <button
              onClick={onViewVoucher}
              className="w-full rounded-xl border-2 border-primary py-3.5 text-sm font-black text-primary"
            >
              View voucher
            </button>
          )}
          <button onClick={onDone} className="w-full rounded-xl bg-primary py-3.5 text-sm font-black text-white">
            Done
          </button>
        </div>
      </div>
    </OverlaySheet>
  );
}

function VoucherDetail({ redemption, error, onUse, onClose }: {
  redemption: RewardRedemption;
  error: string | null;
  onUse: () => void;
  onClose: () => void;
}) {
  const status = getRedemptionStatus(redemption);
  const instantCashback = status === 'applied';
  const daysLeft = daysUntilExpiry(redemption.expiresAt);
  const expiringSoon = status === 'active' && daysLeft !== null && daysLeft <= 7;

  return (
    <OverlaySheet onClose={onClose}>
      <div className="px-5 pb-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <TicketCheck size={28} aria-hidden="true" />
        </div>
        <p className="mt-3 text-xs font-bold text-muted-foreground">{redemption.merchant}</p>
        <h2 className="text-xl font-black">{redemption.title}</h2>
        <div className="mt-2"><StatusBadge status={status} /></div>

        <VoucherCode redemption={redemption} muted={status === 'used' || status === 'expired'} />

        <p className="font-mono text-sm font-black tracking-wider text-primary">{redemption.refCode}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {instantCashback
            ? 'Cashback has been credited directly to your wallet.'
            : 'Present this prototype voucher code to the merchant.'}
        </p>

        <div className="mt-4 divide-y divide-border rounded-2xl border border-border px-3 text-left">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-xs text-muted-foreground">Redeemed on</span>
            <span className="text-xs font-bold text-foreground">{formatExpiry(redemption.redeemedAt)}</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-xs text-muted-foreground">Expires</span>
            <span className={`text-xs font-bold ${status === 'expired' ? 'text-destructive' : 'text-foreground'}`}>
              {formatExpiry(redemption.expiresAt)}
            </span>
          </div>
          {redemption.usedAt && !instantCashback && (
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-muted-foreground">Used on</span>
              <span className="text-xs font-bold text-foreground">{formatExpiry(redemption.usedAt)}</span>
            </div>
          )}
        </div>

        {expiringSoon && (
          <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 p-2.5 text-[11px] font-bold text-amber-800">
            <AlertTriangle size={13} aria-hidden="true" />
            {daysLeft === 0 ? 'Expires today — use it now.'
              : `Expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.`}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-2.5 text-[11px] font-bold text-destructive">
            {error}
          </p>
        )}

        <div className="mt-4"><TermsAndConditions terms={termsForRedemption(redemption)} /></div>

        <div className="mt-4 space-y-2">
          {instantCashback ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 py-3 text-sm font-black text-success">
              <Check size={17} aria-hidden="true" /> Cashback applied
            </div>
          ) : status === 'used' ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-black text-muted-foreground">
              <Check size={17} aria-hidden="true" /> Voucher already used
            </div>
          ) : status === 'expired' ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 py-3 text-sm font-black text-destructive">
              <AlertTriangle size={17} aria-hidden="true" /> Voucher expired
            </div>
          ) : (
            <button
              onClick={onUse}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white"
            >
              <Check size={17} aria-hidden="true" /> Use now — mark as used
            </button>
          )}

          {!instantCashback && (
            <a
              href={directionsUrl(redemption.merchant)}
              target="_blank"
              rel="noreferrer noopener"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-border text-sm font-black text-foreground"
            >
              <MapPin size={16} aria-hidden="true" /> Find {redemption.merchant}
            </a>
          )}

          <button onClick={onClose} className="min-h-11 w-full text-xs font-black text-muted-foreground">
            Close
          </button>
        </div>
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
  const goal = getGoalProgress(userId);
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

      {goal && (
        <button
          type="button"
          onClick={() => onTab('store')}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-2xl" aria-hidden="true">
            {goal.reward.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs font-black">{goal.reward.title}</p>
              <span className={`shrink-0 text-[10px] font-black ${goal.reached ? 'text-success' : 'text-muted-foreground'}`}>
                {goal.reached ? 'Ready' : `${goal.remaining.toLocaleString()} to go`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${goal.percent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`h-full rounded-full ${goal.reached ? 'bg-success' : 'bg-primary'}`}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {goal.reached
                ? `You can redeem this now at ${goal.reward.merchant}.`
                : `${goal.currentXP.toLocaleString()} of ${goal.reward.xpCost.toLocaleString()} XP · ${goal.reward.merchant}`}
            </p>
          </div>
        </button>
      )}

      {stats.expiringSoon > 0 && (
        <button type="button" onClick={() => onTab('ledger')} className="flex w-full items-center gap-3 rounded-2xl bg-[#fff4e5] p-3 text-left">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f59e0b] text-white"><Clock3 size={17} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-[#7a4a00]">{stats.expiringSoon.toLocaleString()} XP expiring soon</p>
            <p className="text-[10px] text-[#94601a]">Use it before {stats.expiringSoonAt ? new Date(stats.expiringSoonAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : 'it lapses'}</p>
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
            { tab: 'wallet' as const, icon: WalletCards, title: 'My Wallet', text: 'Open active voucher codes' },
            { tab: 'ledger' as const, icon: Clock3, title: 'XP Ledger', text: 'See what expires and when' },
            { tab: 'history' as const, icon: History, title: 'XP History', text: 'Trace every point earned and spent' },
          ].map(item => <button key={item.tab} onClick={() => onTab(item.tab)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><item.icon size={19} /></div><div className="flex-1"><p className="text-xs font-black">{item.title}</p><p className="text-[10px] text-muted-foreground">{item.text}</p></div><ChevronRight size={16} className="text-muted-foreground" /></button>)}
        </div>
      </section>
    </div>
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
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><X size={18} /></button>
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
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
                    style={{ backgroundColor: unlocked ? item.color : '#cbd5e1' }}>
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
          Tiers are based on lifetime XP earned, so redeeming rewards - or letting XP expire - never costs you a tier.
        </p>
      </div>
    </OverlaySheet>
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
            const permanent = !Number.isFinite(lot.expiresAt);
            const days = permanent ? Infinity : Math.ceil((lot.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
            const soon = !permanent && days <= 14;
            return (
              <div key={lot.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black">{lot.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {permanent
                      ? 'Never expires'
                      : `Expires ${new Date(lot.expiresAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}${soon ? ` - ${days} day${days === 1 ? '' : 's'} left` : ''}`}
                  </p>
                </div>
                <p className={`shrink-0 text-sm font-black ${soon ? 'text-[#b7791f]' : 'text-foreground'}`}>
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

function StoreView({ userId, currentXP, onSelect, onChangeLocation }: {
  userId: string;
  currentXP: number;
  onSelect: (reward: Reward) => void;
  onChangeLocation: () => void;
}) {
  const [category, setCategory] = useState<RewardCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [nearMeOnly, setNearMeOnly] = useState(false);
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [sort, setSort] = useState<RewardSort>('recommended');
  const userArea = getUserArea(userId);
  const term = search.trim().toLowerCase();

  // Paid placements and redemption counts are read once per render of the
  // store. A promoted reward is pinned above the listing and labelled; it keeps
  // its real XP price, its real distance and its real lock state, because a
  // merchant is buying position, not a different set of facts.
  //
  // Placements are localised first: a stall buys the customers near its outlet,
  // so changing area changes which sponsored cards appear.
  const live = localisePromotions(getLivePromotions(), userArea);
  const promotedIds = new Set(live.map(promotion => promotion.rewardId));
  // One banner per lane, so a hawker and a chain can both be spotlighted.
  const spotlights = live.filter(promotion => promotion.placement === 'spotlight');
  const spotlight = spotlights[0] ?? null;
  const redemptionCounts = getRedemptionCounts();

  useEffect(() => {
    recordImpressions(live.map(promotion => promotion.id));
    // Counted once per visit to the store, keyed on which placements are live,
    // so re-rendering the list does not inflate a merchant's report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.map(promotion => promotion.id).join(',')]);

  // Distance is attached once, then used for both the filter and the labels.
  const catalog = getRewardsCatalog()
    .map(reward => ({ reward, proximity: proximityTo(userId, reward.area) }));

  const matching = catalog
    .filter(({ reward, proximity }) =>
      (category === 'All' || reward.category === category) &&
      (!term || `${reward.title} ${reward.merchant} ${reward.tags.join(' ')}`.toLowerCase().includes(term)) &&
      // Wallet cashback has no outlet, so it is not a "near me" result.
      (!nearMeOnly || isWithinRadius(proximity, DEFAULT_NEARBY_RADIUS_KM)) &&
      (!affordableOnly || reward.xpCost <= currentXP))
    .sort((a, b) => compareRewards(
      { xpCost: a.reward.xpCost, distanceKm: a.proximity.km, redemptions: redemptionCounts.get(a.reward.id) ?? 0 },
      { xpCost: b.reward.xpCost, distanceKm: b.proximity.km, redemptions: redemptionCounts.get(b.reward.id) ?? 0 },
      // Turning on "Near me" is itself a request to order by distance.
      nearMeOnly && sort === 'recommended' ? 'nearest' : sort,
      currentXP,
    ));

  // Promoted rewards lead the list, in the order NETS sold the slots. They are
  // filtered like everything else — a paid slot cannot force a reward into a
  // search or a radius it does not belong in.
  const promotedOrder = live.map(promotion => promotion.rewardId);
  const filtered = [...matching].sort((a, b) => {
    const rankA = promotedOrder.indexOf(a.reward.id);
    const rankB = promotedOrder.indexOf(b.reward.id);
    if (rankA === -1 && rankB === -1) return 0;
    if (rankA === -1) return 1;
    if (rankB === -1) return -1;
    return rankA - rankB;
  });

  const spotlightEntry = spotlight
    ? matching.find(entry => entry.reward.id === spotlight.rewardId) ?? null
    : null;

  const nearbyCount = catalog.filter(entry => isWithinRadius(entry.proximity, DEFAULT_NEARBY_RADIUS_KM)).length;
  // Counted before the affordability filter so the toggle can say what turning
  // it on would leave behind.
  const affordableCount = catalog.filter(({ reward, proximity }) =>
    (category === 'All' || reward.category === category) &&
    (!term || `${reward.title} ${reward.merchant} ${reward.tags.join(' ')}`.toLowerCase().includes(term)) &&
    (!nearMeOnly || isWithinRadius(proximity, DEFAULT_NEARBY_RADIUS_KM)) &&
    reward.xpCost <= currentXP).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Spend with purpose</p><h1 className="text-xl font-black">Rewards Store</h1></div><div className="rounded-xl bg-[#fff2bd] px-3 py-2 text-xs font-black text-[#7a5a00]">{currentXP.toLocaleString()} XP</div></div>

      <div className="mb-2 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5"><Search size={16} className="text-muted-foreground" aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search rewards" aria-label="Search rewards" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div>

      <button
        onClick={() => setNearMeOnly(current => !current)}
        aria-pressed={nearMeOnly}
        className={`mb-2 flex w-full items-center gap-2 rounded-xl border-2 p-2.5 text-left ${nearMeOnly ? 'border-primary bg-primary/5' : 'border-border bg-white'}`}
      >
        <div className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${nearMeOnly ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
          <Navigation size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-foreground">Near me</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {nearbyCount} outlets within {DEFAULT_NEARBY_RADIUS_KM} km of {userArea}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${nearMeOnly ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
          {nearMeOnly ? 'On' : 'Off'}
        </span>
      </button>

      <button
        onClick={() => setAffordableOnly(current => !current)}
        aria-pressed={affordableOnly}
        className={`mb-2 flex w-full items-center gap-2 rounded-xl border-2 p-2.5 text-left ${affordableOnly ? 'border-success bg-success/5' : 'border-border bg-white'}`}
      >
        <div className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${affordableOnly ? 'bg-success text-white' : 'bg-secondary text-muted-foreground'}`}>
          <Zap size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-foreground">I can afford this now</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {affordableCount} within your {currentXP.toLocaleString()} XP balance
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${affordableOnly ? 'bg-success text-white' : 'bg-secondary text-muted-foreground'}`}>
          {affordableOnly ? 'On' : 'Off'}
        </span>
      </button>

      <button
        onClick={onChangeLocation}
        aria-label={`Change your location — currently ${userArea}`}
        className="mb-2 flex min-h-11 w-full items-center justify-center gap-1 text-[11px] font-bold text-primary"
      >
        <MapPin size={12} aria-hidden="true" /> You're in {userArea} · Change
      </button>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">{(['All', 'Cashback', 'Vouchers', 'Partner Deals'] as const).map(item => <button key={item} onClick={() => setCategory(item)} aria-pressed={category === item} className={`min-h-11 whitespace-nowrap rounded-full px-3 text-xs font-bold ${category === item ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>{item}</button>)}</div>

      <div className="no-scrollbar mb-3 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-muted-foreground">Sort</span>
        {(Object.keys(REWARD_SORT_LABELS) as RewardSort[]).map(option => (
          <button
            key={option}
            onClick={() => setSort(option)}
            aria-pressed={sort === option}
            className={`min-h-9 whitespace-nowrap rounded-full px-3 text-[11px] font-bold ${
              sort === option ? 'bg-[#1e2a4a] text-white' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {REWARD_SORT_LABELS[option]}
          </button>
        ))}
      </div>

      {spotlightEntry && (
        <button
          onClick={() => onSelect(spotlightEntry.reward)}
          // Named explicitly: the same reward also appears in the listing
          // below, and a screen reader should be able to tell the banner and
          // the card apart rather than hearing the reward announced twice.
          aria-label={`Sponsored spotlight: ${spotlightEntry.reward.title} from ${spotlightEntry.reward.merchant}, ${spotlightEntry.reward.xpCost} XP`}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-3 text-left"
        >
          <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-white text-3xl" aria-hidden="true">
            {spotlightEntry.reward.icon}
          </div>
          <div className="min-w-0 flex-1">
            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
              <Megaphone size={9} aria-hidden="true" /> Sponsored
            </span>
            <p className="truncate text-xs font-black text-foreground">{spotlightEntry.reward.title}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {spotlightEntry.reward.merchant}
              {spotlightEntry.proximity.label ? ` · ${spotlightEntry.proximity.label}` : ''}
            </p>
          </div>
          <span className="flex-shrink-0 text-xs font-black text-primary">{spotlightEntry.reward.xpCost} XP</span>
        </button>
      )}

      <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'reward' : 'rewards'}
        {nearMeOnly ? ` near ${userArea}` : ''}
      </p>

      <div className="grid grid-cols-2 gap-3">{filtered.map(({ reward, proximity }) => {
        const locked = currentXP < reward.xpCost;
        const promoted = promotedIds.has(reward.id);
        const redeemed = redemptionCounts.get(reward.id) ?? 0;
        return (
          <button key={reward.id} onClick={() => onSelect(reward)} className={`rounded-2xl border bg-white p-3 text-left shadow-sm ${promoted ? 'border-primary' : 'border-border'}`}>
            <div className="mb-3 flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-xl" aria-hidden="true">{reward.icon}</div>
              {locked && <LockKeyhole size={14} className="text-muted-foreground" aria-hidden="true" />}
            </div>
            {promoted && (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-primary">
                <Megaphone size={8} aria-hidden="true" /> Sponsored
              </span>
            )}
            <p className="text-[10px] font-bold text-muted-foreground">{reward.merchant}</p>
            <h3 className="mt-0.5 min-h-8 text-xs font-black leading-tight">{reward.title}</h3>
            {proximity.label && (
              <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-bold text-primary">
                <Navigation size={9} aria-hidden="true" /> {proximity.label}
              </p>
            )}
            {redeemed > 0 && (
              <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-bold text-[#a86400]">
                <Flame size={9} aria-hidden="true" /> Redeemed {redeemed}×
              </p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-black text-primary">{reward.xpCost} XP</span>
              <span className={`rounded-lg px-2 py-1 text-[9px] font-black ${locked ? 'bg-secondary text-muted-foreground' : 'bg-primary text-white'}`}>{locked ? 'View' : 'Redeem'}</span>
            </div>
            {locked && (
              // A locked card that only says "View" is a dead end; the gap is
              // what turns it into something to aim at.
              <p className="mt-1 text-[9px] font-bold text-muted-foreground">
                {(reward.xpCost - currentXP).toLocaleString()} XP to go
              </p>
            )}
          </button>
        );
      })}</div>

      {live.length > 0 && (
        <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
          Sponsored rewards are paid placements by the merchant. Their XP price, distance and
          availability are exactly the same as every other reward.
        </p>
      )}

      {filtered.length === 0 && (
        <div className="mt-14 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Search size={28} aria-hidden="true" /></div>
          <h2 className="mt-3 text-base font-black">No results</h2>
          <p className="mx-auto mt-1 max-w-[260px] text-xs text-muted-foreground">
            {affordableOnly
              ? 'Nothing is within your XP balance yet. Keep earning, or turn off "I can afford this now" to browse everything.'
              : nearMeOnly
              ? `No reward outlets within ${DEFAULT_NEARBY_RADIUS_KM} km of ${userArea} match this filter. Turn off "Near me" to see the rest.`
              : term
                ? `Nothing matches "${search.trim()}". Try another keyword or category.`
                : 'No rewards in this category right now — check back soon.'}
          </p>
        </div>
      )}
    </div>
  );
}

function RedemptionRow({ redemption, onOpen }: {
  redemption: RewardRedemption;
  onOpen: (redemption: RewardRedemption) => void;
}) {
  const status = getRedemptionStatus(redemption);
  const daysLeft = daysUntilExpiry(redemption.expiresAt);
  const dimmed = status === 'used' || status === 'expired';

  return (
    <button
      onClick={() => onOpen(redemption)}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left ${dimmed ? 'border-border opacity-70' : 'border-primary/20 shadow-sm'}`}
    >
      <div className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl ${status === 'expired' ? 'bg-secondary text-muted-foreground' : 'bg-[#fff2bd] text-[#7a5a00]'}`}>
        <TicketCheck size={22} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black">{redemption.title}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {redemption.merchant} · {redemption.xpCost} XP
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {status === 'applied' ? `Credited ${formatExpiry(redemption.redeemedAt)}`
            : status === 'used' ? `Used ${redemption.usedAt ? formatExpiry(redemption.usedAt) : ''}`.trim()
            : status === 'expired' ? `Expired ${formatExpiry(redemption.expiresAt)}`
            : daysLeft !== null && daysLeft <= 7
              ? `Expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`
              : `Valid until ${formatExpiry(redemption.expiresAt)}`}
        </p>
      </div>
      <StatusBadge status={status} />
    </button>
  );
}

function WalletView({ userId, onOpen }: { userId: string; onOpen: (redemption: RewardRedemption) => void }) {
  const redemptions = getRewardRedemptions(userId);
  const active = redemptions.filter(item => getRedemptionStatus(item) === 'active');
  const rest = redemptions.filter(item => getRedemptionStatus(item) !== 'active');

  return (
    <div>
      <p className="text-xs text-muted-foreground">Ready when you are</p>
      <h1 className="text-xl font-black">My Rewards Wallet</h1>

      {redemptions.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <WalletCards size={28} aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-base font-black">No vouchers yet</h2>
          <p className="mt-1 text-xs text-muted-foreground">Redeem a reward and its code will appear here.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mt-4">
              <h2 className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Active vouchers ({active.length})
              </h2>
              <div className="space-y-3">
                {active.map(item => <RedemptionRow key={item.id} redemption={item} onOpen={onOpen} />)}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Applied, used &amp; expired ({rest.length})
              </h2>
              <div className="space-y-3">
                {rest.map(item => <RedemptionRow key={item.id} redemption={item} onOpen={onOpen} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function HistoryView({ userId, onOpen }: { userId: string; onOpen: (redemption: RewardRedemption) => void }) {
  const history = getXPHistory(userId);
  const redemptions = getRewardRedemptions(userId);
  const earned = history.filter(item => item.type === 'earn').reduce((sum, item) => sum + item.xp, 0);
  const spent = history.filter(item => item.type === 'spend').reduce((sum, item) => sum + item.xp, 0);

  return (
    <div>
      <p className="text-xs text-muted-foreground">Fully traceable</p>
      <h1 className="text-xl font-black">XP &amp; Redemption History</h1>

      <div className="my-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-success/10 p-3">
          <p className="text-[10px] font-bold text-success">Total earned</p>
          <p className="text-xl font-black text-success">+{earned.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-red-50 p-3">
          <p className="text-[10px] font-bold text-red-700">Total spent</p>
          <p className="text-xl font-black text-red-700">-{spent.toLocaleString()}</p>
        </div>
      </div>

      <section className="mb-5">
        <h2 className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Redemption history ({redemptions.length})
        </h2>
        {redemptions.length === 0 ? (
          <p className="rounded-2xl bg-secondary p-3 text-[11px] text-muted-foreground">
            Nothing redeemed yet. Every reward you redeem is listed here with its reference code,
            expiry date and current status.
          </p>
        ) : (
          <div className="space-y-2">
            {redemptions.map(item => <RedemptionRow key={item.id} redemption={item} onOpen={onOpen} />)}
          </div>
        )}
      </section>

      <h2 className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        XP movements
      </h2>
      <div className="space-y-2">
        {history.map(item => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
            <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${item.type === 'earn' ? 'bg-success/10 text-success' : 'bg-red-50 text-red-600'}`}>
              {item.type === 'earn' ? <Zap size={18} aria-hidden="true" /> : <Gift size={18} aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black">{item.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">{item.subtitle}</p>
              {item.bonus && (
                <span className="mt-1 inline-block rounded-full bg-[#fff2bd] px-2 py-0.5 text-[9px] font-black text-[#7a5a00]">
                  {item.bonus}
                </span>
              )}
            </div>
            <p className={`text-sm font-black ${item.type === 'earn' ? 'text-success' : 'text-red-600'}`}>
              {item.type === 'earn' ? '+' : '-'}{item.xp}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RewardsPage() {
  const [searchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [tab, setTab] = useState<RewardsTab>(() => {
    const requested = searchParams.get('tab');
    const deepLinkable: RewardsTab[] = ['store', 'wallet', 'ledger', 'history'];
    return deepLinkable.find(candidate => candidate === requested) ?? 'overview';
  });
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<RewardRedemption | null>(null);
  const [receipt, setReceipt] = useState<RewardRedemption | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showTiers, setShowTiers] = useState(false);
  const [goalRewardId, setGoalRewardId] = useState<number | null>(() => getGoalRewardId(getCurrentUser().id));
  const navigate = useNavigate();
  const [, setVersion] = useState(0);
  const refresh = () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    // The goal belongs to the account, so it has to follow a switch rather than
    // carrying the previous customer's target across.
    setGoalRewardId(getGoalRewardId(user.id));
    setVersion(version => version + 1);
  };
  useAppEvents(['transactionsUpdated', 'rewardRedemptionsUpdated', 'dealsUpdated', 'userSwitched', 'databaseReady', 'focus', 'locationChanged'], refresh);
  const stats = getXPStats(currentUser.id);

  // This screen is where a voucher QR is shown, so it is the last moment the
  // code can be published before someone points a camera at it. Covers a wallet
  // opened after a demo reset, after switching accounts, or on a device whose
  // startup sweep ran while the network was down.
  useEffect(() => { void syncVoucherIndex(currentUser.id); }, [currentUser.id]);

  const confirmRedemption = () => {
    if (!selectedReward) return;
    const result = redeemReward(currentUser.id, selectedReward);
    const redeemedGoal = goalRewardId === selectedReward.id;
    setSelectedReward(null);
    if (result) {
      // A goal you have already redeemed is no longer something to work toward.
      if (redeemedGoal) setGoalReward(currentUser.id, null);
      refresh();
      setTab('wallet');
      // The confirmation receipt comes first; the voucher itself is one tap away.
      setReceipt(result);
    }
  };

  const openVoucher = (redemption: RewardRedemption) => {
    setVoucherError(null);
    setSelectedVoucher(redemption);
  };

  const useVoucher = () => {
    if (!selectedVoucher) return;
    const result = markRewardUsed(selectedVoucher.id, currentUser.id);
    if (!result.ok) {
      setVoucherError(result.reason ?? 'That voucher can no longer be used.');
      return;
    }
    setVoucherError(null);
    setSelectedVoucher({ ...selectedVoucher, used: true, usedAt: Date.now() });
    refresh();
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border bg-white px-4 pb-3 pt-8">
        <div className="flex items-center justify-between"><div><NETSLogo /><p className="mt-0.5 text-xs text-muted-foreground">NETS Rewards · earn and spend XP</p></div><button onClick={() => navigate('/profile')} aria-label={`Profile and settings for ${currentUser.name}`} className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-base"><span aria-hidden="true">{currentUser.avatar}</span></button></div>
        <div className="no-scrollbar mt-4 flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1">
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
        {tab === 'store' && (
          <StoreView
            userId={currentUser.id}
            currentXP={stats.currentXP}
            onSelect={setSelectedReward}
            onChangeLocation={() => setShowLocationPicker(true)}
          />
        )}
        {tab === 'wallet' && <WalletView userId={currentUser.id} onOpen={openVoucher} />}
        {tab === 'ledger' && <LedgerView userId={currentUser.id} />}
        {tab === 'history' && <HistoryView userId={currentUser.id} onOpen={openVoucher} />}
      </main>
      <BottomNav />
      <AccountSwitcher isOpen={showAccountSwitcher} onClose={() => setShowAccountSwitcher(false)} />
      <AnimatePresence>
        {showLocationPicker && (
          <LocationSheet userId={currentUser.id} onClose={() => setShowLocationPicker(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>{showTiers && <TierSheet lifetimeXP={stats.lifetimeXP} onClose={() => setShowTiers(false)} />}</AnimatePresence>
      <AnimatePresence>
        {selectedReward && (
          <RewardDetail
            reward={selectedReward}
            userId={currentUser.id}
            currentXP={stats.currentXP}
            isGoal={goalRewardId === selectedReward.id}
            onToggleGoal={() => {
              const next = goalRewardId === selectedReward.id ? null : selectedReward.id;
              setGoalReward(currentUser.id, next);
              setGoalRewardId(next);
            }}
            onClose={() => setSelectedReward(null)}
            onRedeem={confirmRedemption}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {receipt && (
          <RedemptionReceipt
            redemption={receipt}
            remainingXP={stats.currentXP}
            onViewVoucher={() => { const item = receipt; setReceipt(null); openVoucher(item); }}
            onDone={() => setReceipt(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedVoucher && (
          <VoucherDetail
            redemption={selectedVoucher}
            error={voucherError}
            onClose={() => { setSelectedVoucher(null); setVoucherError(null); }}
            onUse={useVoucher}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
