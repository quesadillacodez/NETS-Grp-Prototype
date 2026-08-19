import { useEffect, useState } from 'react';
import { Check, LoaderCircle, ShieldCheck, Store, TicketCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { DarkHeader } from '../components/DarkHeader';
import { flushSave } from '../utils/db';
import { consumeVoucherClaim, getVoucherClaim, type VoucherClaim } from '../utils/qrApi';
import { formatExpiry, markRewardUsed } from '../utils/rewardStorage';
import { getCurrentUser, roleOf } from '../utils/userStorage';

export function VoucherRedeemPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = roleOf(user);
  const [claim, setClaim] = useState<VoucherClaim | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getVoucherClaim(token).then(result => {
      if (active) setClaim(result);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'This voucher QR could not be opened.');
    });
    return () => { active = false; };
  }, [token]);

  const redeem = async () => {
    if (!claim || claim.status !== 'active') return;
    setBusy(true);
    setError('');
    try {
      const used = await consumeVoucherClaim(token);
      const local = markRewardUsed(used.redemptionId, used.ownerUserId);
      if (!local.ok && !/already been used/i.test(local.reason ?? '')) {
        throw new Error(local.reason || 'The customer voucher wallet could not be updated.');
      }
      await flushSave();
      setClaim(used);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This voucher could not be redeemed.');
    } finally {
      setBusy(false);
    }
  };

  const home = role === 'merchant' ? '/merchant' : role === 'admin' ? '/admin' : '/rewards?tab=wallet';

  return (
    <div className="flex h-full flex-col bg-background">
      <DarkHeader title="Voucher Verification" onBack={() => navigate(home)} bottomGap="mb-5" padding="pt-12 pb-6">
        <div className="flex items-center gap-2 text-xs text-white/75"><ShieldCheck size={15} aria-hidden="true" /> Live, single-use NETS XP voucher</div>
      </DarkHeader>
      <main className="flex-1 overflow-y-auto px-4 pb-10">
        {!claim && !error && <div className="mt-24 text-center"><LoaderCircle size={34} className="mx-auto animate-spin text-primary" /><p className="mt-3 text-sm font-bold">Verifying voucher…</p></div>}
        {error && !claim && <div className="mt-20 rounded-3xl border-2 border-destructive/20 bg-white p-6 text-center"><p role="alert" className="text-sm font-black text-destructive">{error}</p></div>}
        {claim && (
          <div className="space-y-4">
            <section className="rounded-3xl border-2 border-border bg-white p-5 text-center shadow-sm">
              <div className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${claim.status === 'used' ? 'bg-success text-white' : 'bg-primary/10 text-primary'}`}>
                {claim.status === 'used' ? <Check size={30} aria-hidden="true" /> : <TicketCheck size={30} aria-hidden="true" />}
              </div>
              <p className="mt-3 text-xs font-bold text-muted-foreground">{claim.merchant}</p>
              <h1 className="text-xl font-black">{claim.title}</h1>
              <p className="mt-3 font-mono text-base font-black tracking-wider text-primary">{claim.refCode}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Valid until {formatExpiry(claim.expiresAt)}</p>
            </section>

            {claim.status === 'active' && (role === 'merchant' || role === 'admin') && (
              <section className="space-y-3">
                <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4"><Store size={18} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-xs font-black">Merchant verification</p><p className="mt-1 text-[11px] text-muted-foreground">Confirm only after checking the customer's voucher and purchase.</p></div></div>
                {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">{error}</p>}
                <button onClick={redeem} disabled={busy} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-black text-white disabled:opacity-60">
                  {busy ? <><LoaderCircle size={18} className="animate-spin" /> Redeeming…</> : <><ShieldCheck size={18} /> Redeem voucher</>}
                </button>
              </section>
            )}

            {claim.status === 'active' && role === 'customer' && (
              <p className="rounded-2xl bg-[#fff8df] p-4 text-center text-xs font-bold text-[#7a5a00]">Show the QR to the participating merchant. Only their merchant account can redeem it.</p>
            )}

            {claim.status === 'used' && (
              <section className="rounded-2xl bg-success/10 p-4 text-center"><p role="status" className="text-sm font-black text-success">Voucher redeemed successfully</p>{claim.usedAt && <p className="mt-1 text-[11px] text-muted-foreground">Used {new Date(claim.usedAt).toLocaleString('en-SG')}</p>}<button onClick={() => navigate(home)} className="mt-4 min-h-11 w-full rounded-xl bg-primary text-xs font-black text-white">Done</button></section>
            )}

            {(claim.status === 'expired' || claim.status === 'superseded') && (
              <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-center text-xs font-bold text-destructive">This voucher QR is {claim.status}. Ask the customer to open the latest voucher in their wallet.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
