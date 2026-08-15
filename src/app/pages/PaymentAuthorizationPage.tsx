import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Check, Shield, CreditCard, X, Fingerprint } from 'lucide-react';
import { markReminderAsPaid } from '../utils/reminderStorage';
import { addTransaction, formatDateForTransaction } from '../utils/transactionStorage';
import { getCurrentUser } from '../utils/userStorage';
import { deleteNotificationByReminder, addNotification } from '../utils/notificationStorage';
import { createSimulatedAuthorization } from '../utils/securePayment';
import { categorizeMerchant } from '../utils/spendingInsights';

type AuthStatus = 'pending' | 'authorizing' | 'approved';

export function PaymentAuthorizationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { reminder, amount, recipientName, category } = location.state || {};
  const currentUser = getCurrentUser();

  const [authStatus, setAuthStatus] = useState<AuthStatus>('pending');
  const [authRef, setAuthRef] = useState<string | null>(null);

  const handleApprove = () => {
    setAuthStatus('authorizing');

    setTimeout(() => {
      // Simulated authorization step: this app doesn't have a real payment
      // rail for peer-to-peer reminder repayment (that's a local DB write,
      // not a bank transfer), so we generate a mock authorization reference
      // to make that explicit and traceable rather than silently deducting
      // funds with no audit trail. See securePayment.ts for details.
      const authorization = createSimulatedAuthorization();
      setAuthRef(authorization.authRef);
      setAuthStatus('approved');

      if (reminder) {
        const THANK_YOU = '🙏 Thanks for covering!';
        const paid = markReminderAsPaid(reminder.id, THANK_YOU);
        if (paid) {
          deleteNotificationByReminder(reminder.id);
          // Settling a split bill is a real expense for the person paying it
          // back, so it carries the original bill's spending category and shows
          // up in their dashboard and budgets. It is a repayment rather than a
          // purchase because the payer already earned the XP at the merchant.
          addTransaction({ name: `${paid.category} (split with ${paid.fromUserName})`, amount: -paid.amount, date: formatDateForTransaction(), category: categorizeMerchant(paid.category), status: 'sent', kind: 'repayment_sent' }, currentUser.id);
          addTransaction({ name: currentUser.name, amount: paid.amount, date: formatDateForTransaction(), category: categorizeMerchant(paid.category), status: 'received', kind: 'repayment_received' }, paid.fromUserId);
          // Notify the payer (who is owed the money) that this person paid them
          // back, with the thank-you note — so they see it from their side.
          addNotification({
            userId: paid.fromUserId,
            fromUserId: currentUser.id,
            fromUserName: currentUser.name,
            fromUserAvatar: currentUser.avatar,
            message: `${currentUser.name} paid you back · ${THANK_YOU}`,
            amount: paid.amount,
            category: paid.category,
            timestamp: new Date().toISOString(),
            read: false,
            reminderId: paid.id,
            channel: 'payments',
            link: '/reminders',
          });
        }
      }

      setTimeout(() => navigate('/payment-complete', { state: { amount, recipientName, category, authRef: authorization.authRef } }), 1000);
    }, 1500);
  };

  const statusText = {
    pending:     { title: 'Confirm Payment',  subtitle: 'Review and authorize this payment' },
    authorizing: { title: 'Processing...',    subtitle: 'Verifying transaction' },
    approved:    { title: 'Authorized!',      subtitle: 'Payment approved' },
  }[authStatus];

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#1e2a4a] to-[#2d3f6a]">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.6 }} className="relative mb-8">
          <div className="w-32 h-32 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border-4 border-white/20">
            {authStatus === 'approved' ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                <Check className="w-16 h-16 text-success" strokeWidth={3} />
              </motion.div>
            ) : (
              <Shield className="w-16 h-16 text-white" />
            )}
          </div>

          {authStatus === 'authorizing' && (
            <motion.div className="absolute inset-0 rounded-full border-4 border-white/40" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          )}
        </motion.div>

        <motion.div key={authStatus} role="status" aria-live="assertive" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">{statusText.title}</h1>
          <p className="text-white/70 text-lg">{statusText.subtitle}</p>
          <span className="sr-only">
            {authStatus === 'approved'
              ? `Payment of $${amount?.toFixed(2)} to ${recipientName} was authorized.`
              : authStatus === 'authorizing' ? 'Processing your payment, please wait.' : ''}
          </span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-sm">Paying to</p>
              <p className="text-white font-bold text-lg">{recipientName}</p>
            </div>
          </div>

          <div className="border-t border-white/20 pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Amount</span>
              <span className="text-white font-bold text-2xl">${amount?.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-sm">Category</span>
              <span className="text-white text-sm">{category}</span>
            </div>
            {authStatus === 'pending' && (
              <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-3 mt-3">
                <p className="text-yellow-100 text-xs text-center">⚠️ This payment will be deducted from your account</p>
              </div>
            )}
            {authStatus === 'approved' && authRef && (
              <div className="bg-white/10 border border-white/20 rounded-xl p-3 mt-3">
                <p className="text-white/60 text-xs text-center">Authorization ref: {authRef}</p>
              </div>
            )}
          </div>
        </motion.div>

        {authStatus === 'pending' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="w-full max-w-sm space-y-3">
            <button onClick={handleApprove} className="w-full py-4 bg-gradient-to-r from-success to-green-400 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
              <Fingerprint className="w-6 h-6" />
              Approve Payment
            </button>
            <button onClick={() => navigate('/reminders')} className="w-full py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-all">
              <X className="w-5 h-5" />
              Cancel
            </button>
          </motion.div>
        )}

        {authStatus === 'authorizing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <motion.div className="w-16 h-16 rounded-full border-4 border-white/30 border-t-white" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
            <p className="text-white/80 text-sm">Processing payment...</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
