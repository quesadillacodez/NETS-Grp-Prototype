import { useEffect } from 'react';
import { Check, Home, Bell } from 'lucide-react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { addTransaction, formatDateForTransaction, hasProcessedPayment, markPaymentProcessed } from '../utils/transactionStorage';
import { addReminders, getAllReminders } from '../utils/reminderStorage';
import { getCurrentUser, getAllUsers } from '../utils/userStorage';
import { addNotification } from '../utils/notificationStorage';
import { payHangout } from '../utils/hangoutStorage';
import { useRequiredState } from '../utils/useRequiredState';
import { resolvePaymentCategory, type PaymentFlowContext, type SplitParticipant } from '../utils/paymentFlow';
import { celebrate } from '../utils/motionPreference';

interface PaymentSuccessState extends Record<string, unknown>, PaymentFlowContext {
  participants: SplitParticipant[];
  amount: number;
  merchantName: string;
}

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const state = useRequiredState<PaymentSuccessState>(['participants', 'amount', 'merchantName', 'paymentId'], '/');
  const { participants, amount, merchantName } = state ?? {
    participants: [],
    amount: 0,
    merchantName: '',
    paymentId: '',
  };
  const paymentId = state?.paymentId ?? '';

  const friends = participants.filter(participant => participant.status !== 'host');
  const yourShare = participants.find(participant => participant.status === 'host')?.amount || (amount / participants.length);

  useEffect(() => {
    const currentUser = getCurrentUser();
    celebrate(confetti, { particleCount: 80, spread: 60, origin: { y: 0.5 }, colors: ['#1e2a4a', '#4f5d7a', '#047857'] });

    if (!paymentId || hasProcessedPayment(paymentId)) return;

    addTransaction({
      name: merchantName,
      amount: -amount,
      date: formatDateForTransaction(),
      category: resolvePaymentCategory(merchantName, state ?? undefined),
      kind: 'purchase',
      paymentId,
    }, currentUser.id);

    if (friends.length === 0) {
      markPaymentProcessed(paymentId);
      return;
    }

    const allUsers = getAllUsers();
    const newReminders = friends
      .map((participant) => {
        const friendUser = allUsers.find(user => user.id === participant.userId)
          ?? allUsers.find(user => user.name === participant.name);
        if (friendUser?.id === currentUser.id) return null;
        if (!friendUser) return null;
        const payerShare = participants.find(item => item.status === 'host')?.amount || 0;
        return {
          name: participant.name, amount: participant.amount, status: 'pending' as const,
          date: 'Just now', category: merchantName,
          avatar: friendUser.avatar,
          fromUserId: currentUser.id, toUserId: friendUser.id,
          fromUserName: currentUser.name, toUserName: participant.name,
          totalBillAmount: amount, payerShare,
        };
      })
      .filter((reminder): reminder is NonNullable<typeof reminder> => reminder !== null);

    if (newReminders.length > 0) {
      const reminderIds = new Set(addReminders(newReminders));
      const latest = getAllReminders().filter(reminder => reminderIds.has(reminder.id));
      latest.forEach((reminder) => {
        addNotification({
          userId: reminder.toUserId, fromUserId: currentUser.id,
          fromUserName: currentUser.name, fromUserAvatar: currentUser.avatar,
          message: `Hey! Remember to pay ${currentUser.name} $${reminder.amount.toFixed(2)} for ${merchantName}. Total bill was $${amount.toFixed(2)}`,
          amount: reminder.amount, category: reminder.category,
          timestamp: new Date().toISOString(), read: false, reminderId: reminder.id,
          channel: 'reminders', link: '/reminders',
        });
      });
    }
    markPaymentProcessed(paymentId);
    // If this split was for a hangout activity, mark it paid (once) so the
    // hangout shows its ticket and the Pay button never returns.
    if (state?.hangoutId != null) payHangout(state.hangoutId);
  }, []);

  if (!state) return null;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-success/10 to-white">
      <div className="flex flex-col items-center justify-center flex-1 px-5 py-4">

        {/* Announced to screen readers the moment the page renders, so the
            outcome of a payment is never conveyed by colour and icon alone. */}
        <p role="status" aria-live="assertive" className="sr-only">
          Payment successful. You paid ${amount.toFixed(2)} to {merchantName}.
          {friends.length > 0 && ` ${friends.length} ${friends.length === 1 ? 'friend has' : 'friends have'} been added to reminders.`}
        </p>

        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.5 }} className="w-16 h-16 rounded-full bg-gradient-to-br from-success to-green-400 flex items-center justify-center mb-3 shadow-xl">
          <Check className="w-8 h-8 text-white" strokeWidth={3} aria-hidden="true" />
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="text-2xl font-bold text-foreground mb-1">
          Bill Paid!
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-sm text-muted-foreground mb-4">
          You paid ${amount.toFixed(2)} to {merchantName}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="w-full bg-white rounded-2xl p-4 shadow-lg border border-border mb-3">
          <div className="grid grid-cols-3 divide-x divide-border mb-3">
            <div className="text-center pr-3">
              <p className="text-xs text-muted-foreground">You Paid</p>
              <p className="font-bold text-destructive text-sm">-${amount.toFixed(2)}</p>
            </div>
            <div className="text-center px-3">
              <p className="text-xs text-muted-foreground">Your Share</p>
              <p className="font-bold text-foreground text-sm">${yourShare.toFixed(2)}</p>
            </div>
            <div className="text-center pl-3">
              <p className="text-xs text-muted-foreground">Split</p>
              <p className="font-bold text-foreground text-sm">{participants.length} pax</p>
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            {participants.map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs">{p.avatar}</div>
                  <span className="text-sm text-foreground">{p.name}</span>
                </div>
                {p.name === 'You' ? (
                  <span className="text-success text-xs font-semibold flex items-center gap-1"><Check className="w-3 h-3" />Paid Bill</span>
                ) : (
                  <span className="text-warning text-xs font-semibold">Owes ${p.amount.toFixed(2)}</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-success text-center">
              Txn #{paymentId.replace(/-/g, '').slice(0, 9).toUpperCase()}
            </p>
          </div>
        </motion.div>

        {friends.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="w-full mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs text-blue-900">
              <span className="font-bold">{friends.length} {friends.length === 1 ? 'friend' : 'friends'}</span> added to Reminders — track payments there
            </p>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="w-full space-y-2">
          {friends.length > 0 && (
            <button onClick={() => navigate('/reminders')} className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2">
              <Bell className="w-4 h-4" />
              View Pending ({friends.length})
            </button>
          )}
          <button onClick={() => navigate('/')} className="w-full py-3 bg-gradient-to-r from-primary to-accent text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2">
            <Home className="w-4 h-4" />
            Back to Home
          </button>
        </motion.div>
      </div>
    </div>
  );
}
