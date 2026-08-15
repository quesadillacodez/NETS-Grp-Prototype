import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Copy, LifeBuoy } from 'lucide-react';
import { DarkHeader } from '../components/DarkHeader';
import { describeTransaction, getTransactionById } from '../utils/transactionStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

function formatTimestamp(createdAt?: number, fallback?: string): string {
  if (!createdAt) return fallback ?? 'Just now';
  return new Date(createdAt).toLocaleString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-right text-xs font-bold text-foreground ${mono ? 'font-mono tracking-wide' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export function TransactionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [transaction, setTransaction] = useState(() => getTransactionById(Number(id), currentUser.id));
  const [copied, setCopied] = useState(false);

  useAppEvents(['transactionsUpdated', 'userSwitched'], () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setTransaction(getTransactionById(Number(id), user.id));
  });

  if (!transaction) {
    return (
      <div className="flex h-full flex-col bg-white">
        <DarkHeader title="Receipt" onBack={() => navigate('/all-transactions')} />
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="font-bold text-foreground">Transaction not found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            It may belong to another account, or the data was reset.
          </p>
          <button
            onClick={() => navigate('/all-transactions')}
            className="mt-5 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
          >
            Back to history
          </button>
        </div>
      </div>
    );
  }

  const described = describeTransaction(transaction);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(described.reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the reference is on screen to copy manually.
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <DarkHeader title="Receipt" onBack={() => navigate('/all-transactions')} bottomGap="mb-5">
        <div className="rounded-3xl border border-white/20 bg-white/10 p-5 text-center backdrop-blur-md">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white/20">
            {described.isIncoming
              ? <ArrowDownLeft className="h-6 w-6 text-white" aria-hidden="true" />
              : <ArrowUpRight className="h-6 w-6 text-white" aria-hidden="true" />}
          </div>
          <p className="text-white/70 text-xs">{described.meta.label}</p>
          <p className="text-4xl font-black text-white">{described.signedAmount}</p>
          <p className="mt-1 text-sm text-white/80">{transaction.name}</p>
        </div>
      </DarkHeader>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-8">
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-success/10 p-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="text-xs font-black text-success">Completed</p>
            <p className="text-[11px] text-muted-foreground">
              {described.isIncoming ? 'Credited to your NETS wallet' : 'Deducted from your NETS wallet'}
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-border p-4">
          <h2 className="mb-1 text-xs font-black uppercase tracking-wider text-muted-foreground">Details</h2>
          <div className="divide-y divide-border">
            <Row label={described.isIncoming ? 'Received from' : 'Paid to'} value={transaction.name} />
            <Row label="Transaction type" value={described.meta.label} />
            <Row label="Category" value={described.categoryLabel} />
            <Row label="Date & time" value={formatTimestamp(transaction.createdAt, transaction.date)} />
            <Row label="Account" value={`${currentUser.name} · NETS vCashCard`} />
            <Row label="Reference number" value={described.reference} mono />
            {transaction.paymentId && (
              <Row label="Payment ID" value={transaction.paymentId.replace(/-/g, '').slice(0, 12).toUpperCase()} mono />
            )}
          </div>
        </section>

        <button
          onClick={copyReference}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border py-3.5 text-sm font-black text-foreground"
        >
          <Copy size={16} aria-hidden="true" />
          {copied ? 'Reference copied' : 'Copy reference number'}
        </button>

        <button
          onClick={() => navigate('/profile/help', { state: { reference: described.reference } })}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3.5 text-sm font-black text-foreground"
        >
          <LifeBuoy size={16} aria-hidden="true" />
          Report an issue with this payment
        </button>

        <button
          onClick={() => navigate('/all-transactions')}
          className="mt-2 w-full rounded-2xl bg-primary py-3.5 text-sm font-black text-white"
        >
          Done
        </button>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
          This receipt is generated from the prototype's local database. In production it would be
          issued and countersigned by the NETS payment switch.
        </p>
      </div>
    </div>
  );
}
