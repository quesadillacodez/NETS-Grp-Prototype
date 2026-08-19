import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BadgeCheck, Store, TicketCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router';
import { NETSLogo } from '../components/NETSLogo';
import {
  formatExpiry,
  getRedemptionStatus,
  isCashbackRedemption,
  redeemByRefCode,
  REDEMPTION_STATUS_LABELS,
  type RewardRedemption,
} from '../utils/rewardStorage';
import { useAppEvents } from '../utils/useAppEvents';

interface ScanResult {
  ok: boolean;
  reason?: string;
  redemption: RewardRedemption | null;
}

function Row({ label, value, mono, strong }: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-right text-xs ${strong ? 'font-black text-foreground' : 'font-bold text-foreground'} ${mono ? 'font-mono tracking-wider' : ''}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * Where a scanned voucher QR lands.
 *
 * This is the merchant's side of a redemption: the code in the URL is looked up
 * against real rows, the voucher is marked used, and everything shown — the
 * reference, the XP it cost, the dates — comes from that record rather than
 * from anything encoded in the QR itself. A code that is unknown, already used
 * or expired says so plainly instead of showing a success screen.
 */
export function VoucherScanPage() {
  const navigate = useNavigate();
  const { refCode = '' } = useParams();
  const [result, setResult] = useState<ScanResult | null>(null);

  // The redemption runs once per scan. Re-running on every render would mark a
  // voucher used and then immediately report it as already used.
  useEffect(() => {
    setResult(redeemByRefCode(refCode));
  }, [refCode]);

  // The database may still be booting when the page opens from a cold scan.
  useAppEvents(['databaseReady'], () => {
    setResult(current => (current?.redemption ? current : redeemByRefCode(refCode)));
  });

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  const { ok, reason, redemption } = result;
  const status = redemption ? getRedemptionStatus(redemption) : null;
  const accepted = ok && redemption !== null;

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border bg-white px-5 pb-4 pt-8">
        <NETSLogo />
        <p className="mt-0.5 text-xs text-muted-foreground">Voucher verification</p>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 260 }}
          className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${
            accepted ? 'bg-success/12 text-success' : 'bg-[#fff4e5] text-[#b7791f]'
          }`}
        >
          {accepted
            ? <BadgeCheck size={40} aria-hidden="true" />
            : <AlertTriangle size={36} aria-hidden="true" />}
        </motion.div>

        <h1 className="mt-4 text-center text-2xl font-black">
          {accepted ? 'Voucher redeemed' : 'Not accepted'}
        </h1>
        <p className="mx-auto mt-1 max-w-[280px] text-center text-xs text-muted-foreground">
          {accepted
            ? 'Hand over the item. This code cannot be used again.'
            : reason ?? 'This voucher could not be verified.'}
        </p>

        {redemption ? (
          <>
            <section className="mt-6 rounded-2xl border border-border bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <TicketCheck size={22} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-muted-foreground">{redemption.merchant}</p>
                  <h2 className="text-base font-black leading-tight">{redemption.title}</h2>
                </div>
                {status && (
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                    accepted ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {accepted ? 'Redeemed' : REDEMPTION_STATUS_LABELS[status]}
                  </span>
                )}
              </div>

              <div className="mt-3 divide-y divide-border border-t border-border">
                <Row label="Reference code" value={redemption.refCode} mono strong />
                <Row label="Value" value={`${redemption.xpCost.toLocaleString()} XP`} strong />
                <Row label="Issued" value={formatExpiry(redemption.redeemedAt)} />
                {!isCashbackRedemption(redemption) && (
                  <Row label="Expires" value={formatExpiry(redemption.expiresAt)} />
                )}
                {redemption.usedAt && (
                  <Row label="Redeemed at" value={new Date(redemption.usedAt).toLocaleString('en-SG', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
                  })} />
                )}
              </div>
            </section>

            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-secondary p-3 text-[11px] leading-relaxed text-muted-foreground">
              <Store size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              Verified against the NETS rewards record for this reference code. Nothing on this
              screen is carried in the QR itself.
            </p>
          </>
        ) : (
          <section className="mt-6 rounded-2xl border border-border bg-white p-4 text-center">
            <p className="text-xs text-muted-foreground">Scanned code</p>
            <p className="mt-1 font-mono text-sm font-black tracking-wider text-foreground">
              {refCode || '—'}
            </p>
          </section>
        )}

        <button
          onClick={() => navigate('/rewards')}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white"
        >
          Open NETS Rewards <ArrowRight size={16} aria-hidden="true" />
        </button>
      </main>
    </div>
  );
}
