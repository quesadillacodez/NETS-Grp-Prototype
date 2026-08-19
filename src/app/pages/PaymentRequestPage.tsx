import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, LoaderCircle, ShieldCheck, Store, Wallet, Zap } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { DarkHeader } from '../components/DarkHeader';
import { flushSave } from '../utils/db';
import { recordMerchantSale } from '../utils/merchantInsightStorage';
import { recordItemSale } from '../utils/menuStorage';
import { confirmPaymentIntent, getPaymentIntent, type PaymentIntent } from '../utils/qrApi';
import { calculateTransactionXP, getTier, getXPStats, tierMultiplier } from '../utils/rewardStorage';
import {
  addTransaction, formatDateForTransaction, getWalletBalance, hasProcessedPayment, markPaymentProcessed,
} from '../utils/transactionStorage';
import { getCurrentUser } from '../utils/userStorage';
import { resolvePaymentCategory } from '../utils/paymentFlow';

function messageFor(intent: PaymentIntent): string {
  if (intent.status === 'paid') return 'This payment request has already been completed.';
  if (intent.status === 'expired') return 'This payment request has expired. Ask the merchant for a new QR.';
  if (intent.status === 'cancelled') return 'The merchant cancelled this payment request.';
  return '';
}

export function PaymentRequestPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    void getPaymentIntent(token).then(result => {
      if (active) setIntent(result);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'This payment QR could not be opened.');
    });
    return () => { active = false; };
  }, [token]);

  const xp = useMemo(() => {
    if (!intent) return null;
    const beforeTier = calculateTransactionXP(intent.merchantName, -intent.amount);
    const tier = getTier(getXPStats(user.id).lifetimeXP);
    const multiplier = tierMultiplier(tier.level);
    return { beforeTier, tier, multiplier, total: Math.max(1, Math.round(beforeTier.xp * multiplier)) };
  }, [intent, user.id]);

  const pay = async () => {
    if (!intent || intent.status !== 'created') return;
    if (getWalletBalance(user.id) < intent.amount) {
      setError('Your wallet balance is too low for this payment.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const confirmed = await confirmPaymentIntent(token);
      if (!hasProcessedPayment(confirmed.paymentId)) {
        const now = confirmed.paidAt ?? Date.now();
        addTransaction({
          name: confirmed.merchantName,
          amount: -confirmed.amount,
          date: formatDateForTransaction(),
          category: resolvePaymentCategory(confirmed.merchantName),
          kind: 'purchase',
          paymentId: confirmed.paymentId,
          createdAt: now,
        }, user.id);
        if (confirmed.itemId != null && confirmed.itemName) {
          recordItemSale({
            paymentId: confirmed.paymentId,
            merchantId: confirmed.merchantId,
            item: { id: confirmed.itemId, name: confirmed.itemName, price: confirmed.amount },
            userId: user.id,
            createdAt: now,
          });
        } else {
          recordMerchantSale({
            merchantName: confirmed.merchantName,
            itemName: confirmed.reference,
            amount: confirmed.amount,
            userId: user.id,
            paymentId: confirmed.paymentId,
            createdAt: now,
          });
        }
        markPaymentProcessed(confirmed.paymentId);
        await flushSave();
      }
      setIntent(confirmed);
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The payment could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <DarkHeader title="QR Payment" onBack={() => navigate('/')} bottomGap="mb-5" padding="pt-12 pb-6">
        <div className="flex items-center gap-2 text-xs text-white/75">
          <ShieldCheck size={15} aria-hidden="true" /> Secure payment request from a verified NETS merchant
        </div>
      </DarkHeader>

      <main className="flex-1 overflow-y-auto px-4 pb-10">
        {!intent && !error && (
          <div className="mt-24 text-center"><LoaderCircle size={34} className="mx-auto animate-spin text-primary" /><p className="mt-3 text-sm font-bold">Opening payment request…</p></div>
        )}

        {error && !intent && (
          <div className="mt-20 rounded-3xl border-2 border-destructive/20 bg-white p-6 text-center">
            <p role="alert" className="text-sm font-black text-destructive">{error}</p>
            <button onClick={() => navigate('/')} className="mt-4 min-h-11 rounded-xl bg-primary px-5 text-xs font-black text-white">Return home</button>
          </div>
        )}

        {intent && (
          <div className="space-y-4">
            <section className="rounded-3xl border-2 border-border bg-white p-5 text-center shadow-sm">
              <div className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${complete ? 'bg-success text-white' : 'bg-primary/10 text-primary'}`}>
                {complete ? <Check size={30} aria-hidden="true" /> : <Store size={28} aria-hidden="true" />}
              </div>
              <p className="mt-3 text-xs font-bold text-muted-foreground">{complete ? 'Paid successfully' : 'Paying'}</p>
              <h1 className="text-xl font-black">{intent.merchantName}</h1>
              {(intent.itemName || intent.reference) && <p className="mt-1 text-xs text-muted-foreground">{intent.itemName || intent.reference}</p>}
              <p className="mt-4 text-4xl font-black text-primary">${intent.amount.toFixed(2)}</p>
            </section>

            {intent.status === 'created' && xp && (
              <section className="rounded-2xl bg-[#fff8df] p-4">
                <div className="flex items-center gap-2 text-[#7a5a00]"><Zap size={16} aria-hidden="true" /><h2 className="text-sm font-black">Earn {xp.total.toLocaleString()} XP</h2></div>
                <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="flex justify-between"><span>Merchant payment XP</span><b className="text-foreground">{xp.beforeTier.xp}</b></div>
                  <div className="flex justify-between"><span>{xp.tier.name} tier</span><b className="text-foreground">{xp.multiplier}×</b></div>
                  {xp.beforeTier.bonus && <p className="font-bold text-[#7a5a00]">Includes {xp.beforeTier.bonus}</p>}
                </div>
              </section>
            )}

            {intent.status === 'created' ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-white p-3 text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground"><Wallet size={15} aria-hidden="true" /> Available wallet balance</span>
                  <b>${getWalletBalance(user.id).toFixed(2)}</b>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-secondary p-3 text-[11px] text-muted-foreground">
                  <Clock3 size={15} className="shrink-0" aria-hidden="true" /> Expires {new Date(intent.expiresAt).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })}
                </div>
                {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">{error}</p>}
                <button onClick={pay} disabled={busy} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-black text-white disabled:opacity-60">
                  {busy ? <><LoaderCircle size={18} className="animate-spin" /> Processing…</> : <><ShieldCheck size={18} /> Confirm NETS payment</>}
                </button>
              </section>
            ) : complete || intent.status === 'paid' ? (
              <section className="rounded-2xl bg-success/10 p-4 text-center">
                <p role="status" className="text-sm font-black text-success">Payment complete</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{intent.paymentId}</p>
                <button onClick={() => navigate('/')} className="mt-4 min-h-11 w-full rounded-xl bg-primary text-xs font-black text-white">Done</button>
              </section>
            ) : (
              <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-center text-xs font-bold text-destructive">{messageFor(intent)}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
