import { useState, useEffect } from 'react';
import { Check, Clock, AlertCircle, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { getAllReminders, billKeyFor } from '../utils/reminderStorage';
import { getCurrentUser, getAllUsers } from '../utils/userStorage';
import { DarkHeader } from '../components/DarkHeader';

function StatusIcon({ status }: { status: string }) {
  if (status === 'paid') return <div className="flex items-center gap-1 text-success"><Check className="w-4 h-4" /><span className="text-xs font-bold">Paid</span></div>;
  if (status === 'pending') return <div className="flex items-center gap-1 text-warning"><Clock className="w-4 h-4" /><span className="text-xs font-bold">Pending</span></div>;
  return <div className="flex items-center gap-1 text-destructive"><AlertCircle className="w-4 h-4" /><span className="text-xs font-bold">Overdue</span></div>;
}

export function SharedBillPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { billId, merchantName, payerId } = location.state || {};
  const currentUser = getCurrentUser();

  const [billData, setBillData] = useState<any>(null);

  useEffect(() => {
    if (!merchantName) {
      navigate('/reminders', { replace: true, state: { tab: 'shared-bills' } });
      return;
    }

    const allUsers = getAllUsers();
    // Show ONLY the one split that was tapped, matched on the same key the
    // dashboard grouped by, so two bills at the same merchant never combine.
    // Falls back to merchant + payer if no key came in.
    const reminders = getAllReminders().filter((r: any) => (
      billId ? billKeyFor(r) === billId : r.category === merchantName && r.fromUserId === payerId
    ));

    if (reminders.length === 0) {
      navigate('/reminders', { replace: true, state: { tab: 'shared-bills' } });
      return;
    }

    const creditor = reminders[0];
    const creditorUser = allUsers.find((u: any) => u.id === creditor.fromUserId);

    // One split = one bill, so the total is that split's bill amount taken once
    // (not summed across splits, which double-counted when bills combined).
    const totalAmount = reminders.find((r: any) => r.totalBillAmount)?.totalBillAmount
      ?? reminders.reduce((sum: number, r: any) => sum + r.amount, 0);

    const participantMap = new Map<string, any>();
    reminders.forEach((r: any) => {
      const debtor = allUsers.find((u: any) => u.id === r.toUserId);
      if (participantMap.has(r.toUserId)) {
        const existing = participantMap.get(r.toUserId);
        existing.amount += r.amount;
        if (r.status === 'overdue' || (r.status === 'pending' && existing.status !== 'overdue')) existing.status = r.status;
      } else {
        participantMap.set(r.toUserId, { name: r.toUserName, avatar: debtor?.avatar || r.avatar, amount: r.amount, status: r.status, isPayer: false });
      }
    });

    // Prefer the payer's own share as recorded at payment time. Fall back to
    // (total − others) only for legacy rows that never stored it, and clamp at
    // 0 so a bad split can never render the payer a negative share.
    const othersTotal = Array.from(participantMap.values()).reduce((sum, p) => sum + p.amount, 0);
    const storedShare = creditor.payerShare;
    const payerShare = Math.max(0, storedShare != null ? storedShare : totalAmount - othersTotal);

    const participants = [
      { name: creditor.fromUserName, avatar: creditorUser?.avatar || '👤', amount: payerShare, status: 'paid', isPayer: true },
      ...Array.from(participantMap.values()),
    ];

    setBillData({
      merchantName: creditor.category,
      totalAmount,
      participants,
      paidCount: participants.filter((p: any) => p.status === 'paid').length,
      date: creditor.date || 'Recently',
    });
  }, [merchantName, payerId, billId, navigate]);

  if (!merchantName || !billData) return null;

  const allPaid = billData.paidCount === billData.participants.length;

  const cardStyle = (status: string) => {
    if (status === 'paid') return 'bg-gradient-to-r from-success/10 to-green-400/10 border-success';
    if (status === 'pending') return 'bg-warning/5 border-warning/30';
    return 'bg-secondary border-border';
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <DarkHeader title="Shared Bill" onBack={() => navigate('/reminders', { state: { tab: 'shared-bills' } })} bottomGap="mb-4" padding="pt-12 pb-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-[11px]">Shared Bill • {billData.date}</p>
              <h2 className="text-base font-bold text-white leading-tight">{billData.merchantName}</h2>
            </div>
          </div>

          <div className="border-t border-white/20 pt-2.5 mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/70 text-xs">Total Amount</span>
              <span className="text-lg font-bold text-white">${billData.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-xs">Payment Status</span>
              <span className={`text-xs font-semibold ${allPaid ? 'text-success' : 'text-warning'}`}>
                {billData.paidCount} / {billData.participants.length} paid
              </span>
            </div>
          </div>

          <div className="mt-2.5">
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-success rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(billData.paidCount / billData.participants.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      </DarkHeader>

      <div className="flex-1 px-6 py-4 overflow-y-auto">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          All Participants ({billData.participants.length})
        </h3>

        <div className="space-y-2">
          {billData.participants.map((p: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-3 rounded-xl border-2 transition-all ${cardStyle(p.status)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl">
                    {p.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{p.name}</p>
                      {p.isPayer && <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full">PAID BILL</span>}
                      {p.name === currentUser.name && <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded-full">YOU</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.isPayer
                        ? `Paid full bill • Own share: $${p.amount.toFixed(2)}`
                        : `Share: $${p.amount.toFixed(2)}`}
                    </p>
                  </div>
                </div>
                <StatusIcon status={p.status} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-2 mt-4">
          <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
            <p className="text-xs text-foreground">
              <span className="font-semibold">Summary:</span> {billData.participants[0].name} paid a total of ${billData.totalAmount.toFixed(2)} at {billData.merchantName}.{' '}
              {billData.participants.length - 1} {billData.participants.length - 1 === 1 ? 'person' : 'people'} owe their combined shares.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-white rounded-xl border border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Total Split</p>
              <p className="text-lg font-bold text-foreground">{billData.participants.length}</p>
              <p className="text-xs text-muted-foreground">People</p>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Per Person</p>
              <p className="text-lg font-bold text-foreground">${(billData.totalAmount / billData.participants.length).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Average</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
