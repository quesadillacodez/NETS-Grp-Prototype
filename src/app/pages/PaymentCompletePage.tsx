import { useEffect, useMemo } from 'react';
import { Check, Home, Bell, CheckCircle2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';

export function PaymentCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { amount, recipientName, category, authRef } = location.state || { amount: 0, recipientName: 'Friend', category: 'Payment' };

  // Falls back to a locally-generated ID only if this page is somehow reached
  // without an authRef (e.g. a stale bookmark) — normally it's the real
  // simulated authorization ref set during approval. useMemo keeps it stable
  // across re-renders instead of regenerating on every render.
  const displayRef = useMemo(
    () => authRef || `SIM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    [authRef]
  );

  useEffect(() => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#1e2a4a', '#4f5d7a', '#10b981'] });
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-success/10 to-white overflow-y-auto">
      <div className="flex flex-col items-center justify-start px-6 py-8 min-h-full">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.6 }} className="w-24 h-24 rounded-full bg-gradient-to-br from-success to-green-400 flex items-center justify-center mb-6 shadow-2xl">
          <Check className="w-12 h-12 text-white" strokeWidth={3} />
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-3xl font-bold text-foreground mb-3 text-center">
          Payment Sent!
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-muted-foreground text-center mb-8">
          You paid ${amount.toFixed(2)} to {recipientName}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl border border-border mb-8">
          <div className="border-b border-border pb-4 mb-4 space-y-2">
            <Row label="Paid to" value={recipientName} />
            <Row label="You Paid" value={`-$${amount.toFixed(2)}`} valueClass="font-bold text-destructive text-xl" />
            <Row label="Category" value={category} />
          </div>

          <p className="text-sm text-muted-foreground uppercase tracking-wide mb-3">Payment Status</p>
          <div className="space-y-3">
            <ParticipantRow avatar="👤" name="You" status="Payment Sent" />
            <ParticipantRow avatar="👨‍💼" name={recipientName} status="Received" />
          </div>

          <div className="mt-6 p-3 bg-success/10 rounded-2xl">
            <p className="text-xs text-success text-center">Authorization ref: {displayRef}</p>
            <p className="text-[10px] text-success/70 text-center mt-0.5">Simulated for prototype purposes</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="w-full max-w-sm mb-4 p-4 bg-green-50 border-2 border-green-200 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-900">Debt Cleared</p>
              <p className="text-xs text-green-700">This payment has been removed from your reminders</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="w-full max-w-sm space-y-3">
          <button onClick={() => navigate('/reminders')} className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-semibold shadow-lg flex items-center justify-center gap-2">
            <Bell className="w-5 h-5" />
            View Reminders
          </button>
          <button onClick={() => navigate('/')} className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white rounded-2xl font-semibold shadow-lg flex items-center justify-center gap-2">
            <Home className="w-5 h-5" />
            Back to Home
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = 'font-semibold text-foreground' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function ParticipantRow({ avatar, name, status }: { avatar: string; name: string; status: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm">{avatar}</div>
        <span className="text-foreground">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Check className="w-4 h-4 text-success" />
        <span className="text-success text-sm font-semibold">{status}</span>
      </div>
    </div>
  );
}
