import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Building2, Check, ChevronLeft, ChevronRight, CreditCard, Home, Landmark, Wallet,
} from 'lucide-react';
import { addTransaction, formatDateForTransaction, getWalletBalance } from '../utils/transactionStorage';
import { getCurrentUser } from '../utils/userStorage';
import { celebrate } from '../utils/motionPreference';

const PRESETS = [10, 20, 50, 100, 200, 500];
const MIN_TOPUP = 10;
const MAX_TOPUP = 1000;

const SOURCES = [
  { id: 'paynow', label: 'PayNow', detail: 'Instant · no fee', icon: Landmark },
  { id: 'dbs',    label: 'DBS/POSB',  detail: 'Bank account ····4821', icon: Building2 },
  { id: 'visa',   label: 'Visa Debit', detail: 'Card ····9034', icon: CreditCard },
];

type Step = 'amount' | 'review' | 'done';

export function TopUpPage() {
  const navigate = useNavigate();
  const [user] = useState(() => getCurrentUser());
  const [balance, setBalance] = useState(() => getWalletBalance(getCurrentUser().id));

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [sourceId, setSourceId] = useState(SOURCES[0].id);

  const source = SOURCES.find(item => item.id === sourceId)!;
  const value = Number(amount);
  const error =
    amount === '' ? null
    : !Number.isFinite(value) ? 'Enter a valid amount.'
    : value < MIN_TOPUP ? `Minimum top-up is $${MIN_TOPUP}.`
    : value > MAX_TOPUP ? `Maximum top-up is $${MAX_TOPUP}.`
    : balance + value > 9999 ? 'This would exceed the $9,999 wallet limit.'
    : null;
  const canContinue = amount !== '' && !error;

  const confirm = () => {
    addTransaction({
      name: `Top-up via ${source.label}`,
      amount: value,
      date: formatDateForTransaction(),
      category: 'topup',
      kind: 'topup',
    }, user.id);
    setBalance(current => current + value);
    setStep('done');
    celebrate(confetti, { particleCount: 90, spread: 70, origin: { y: 0.5 }, colors: ['#0040ff', '#00a94f', '#ffca28'] });
  };

  if (step === 'done') {
    return (
      <div className="flex h-full flex-col bg-gradient-to-b from-success/10 to-white">
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.5 }}
            className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-success to-green-400 shadow-xl">
            <Check className="h-10 w-10 text-white" strokeWidth={3} />
          </motion.div>
          <h1 className="text-2xl font-black text-foreground">Top-up successful</h1>
          <p role="status" aria-live="assertive" className="mt-1 text-sm text-muted-foreground">
            ${value.toFixed(2)} added from {source.label}. New balance ${balance.toFixed(2)}.
          </p>

          <div className="mt-6 w-full rounded-2xl border border-border bg-white p-5 shadow-lg">
            <p className="text-xs text-muted-foreground">New wallet balance</p>
            <p className="text-3xl font-black text-foreground">${balance.toFixed(2)}</p>
            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <Row label="Amount" value={`$${value.toFixed(2)}`} />
              <Row label="From" value={source.label} />
              <Row label="Fee" value="$0.00" />
            </div>
          </div>

          <div className="mt-6 w-full space-y-2">
            <button onClick={() => { setStep('amount'); setAmount(''); }}
              className="w-full rounded-2xl border-2 border-primary py-3.5 text-sm font-black text-primary">
              Top up again
            </button>
            <button onClick={() => navigate('/')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-black text-white">
              <Home className="h-4 w-4" /> Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="bg-gradient-to-b from-[#1e2a4a] to-[#2d3f6a] px-5 pb-6 pt-12">
        <div className="flex items-center gap-3">
          <button
            onClick={() => step === 'review' ? setStep('amount') : navigate('/')}
            aria-label={step === 'review' ? 'Back to amount' : 'Back to home'}
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-white/20"
          >
            <ChevronLeft size={20} className="text-white" aria-hidden="true" />
          </button>
          <div>
            <p className="text-xs text-white/60">NETS vCashCard</p>
            <h1 className="text-base font-bold text-white">Top up wallet</h1>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
          <p className="text-xs text-white/70">Current balance</p>
          <p className="text-3xl font-black text-white">${balance.toFixed(2)}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'amount' ? (
          <motion.div key="amount" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
            className="flex-1 overflow-y-auto px-5 py-5">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">Amount</p>
            <div className="flex items-center gap-2 rounded-2xl border-2 border-border bg-white px-4 py-3.5 focus-within:border-primary">
              <span className="text-2xl font-black text-foreground">$</span>
              <input
                value={amount}
                onChange={event => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                placeholder="0.00"
                className="min-w-0 flex-1 text-2xl font-black text-foreground outline-none"
              />
            </div>
            <p role="alert" aria-live="assertive" className="mt-2 h-4 text-xs font-bold text-destructive">
              {error ?? ''}
            </p>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {PRESETS.map(preset => (
                <button key={preset} onClick={() => setAmount(String(preset))}
                  className={`rounded-xl py-3 text-sm font-black ${Number(amount) === preset ? 'bg-primary text-white' : 'bg-secondary text-foreground'}`}>
                  ${preset}
                </button>
              ))}
            </div>

            <p className="mb-2 mt-6 text-xs font-black uppercase tracking-wider text-muted-foreground">Top up from</p>
            <div className="space-y-2">
              {SOURCES.map(item => {
                const active = item.id === sourceId;
                return (
                  <button key={item.id} onClick={() => setSourceId(item.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-3.5 text-left ${active ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary"><item.icon size={20} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <div className={`grid h-6 w-6 place-items-center rounded-full ${active ? 'bg-primary text-white' : 'bg-secondary text-transparent'}`}>
                      <Check size={13} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl bg-secondary p-3 text-xs text-muted-foreground">
              Top-ups of ${MIN_TOPUP}–${MAX_TOPUP} are credited instantly with no fee.
            </div>

            <button disabled={!canContinue} onClick={() => setStep('review')}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-black text-white disabled:opacity-30">
              Continue <ChevronRight size={17} />
            </button>
          </motion.div>
        ) : (
          <motion.div key="review" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
            className="flex-1 overflow-y-auto px-5 py-5">
            <div className="rounded-3xl border-2 border-border bg-white p-5 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Wallet size={26} /></div>
              <p className="mt-3 text-xs text-muted-foreground">You're topping up</p>
              <p className="text-4xl font-black text-foreground">${value.toFixed(2)}</p>
              <div className="mt-5 space-y-2 border-t border-border pt-4 text-left text-sm">
                <Row label="From" value={source.label} />
                <Row label="To" value="NETS vCashCard" />
                <Row label="Fee" value="$0.00" />
                <Row label="Balance after" value={`$${(balance + value).toFixed(2)}`} />
              </div>
            </div>

            <button onClick={confirm}
              className="mt-5 w-full rounded-2xl bg-primary py-4 text-sm font-black text-white">
              Confirm top-up
            </button>
            <button onClick={() => setStep('amount')}
              className="mt-2 w-full rounded-2xl border-2 border-border py-3.5 text-sm font-black text-muted-foreground">
              Edit amount
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}
