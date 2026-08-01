import { ChevronLeft, Send, CheckCircle2, Clock, Eye } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { DarkHeader } from '../components/DarkHeader';

export function ReminderTrackingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { contact, contactData, date, time, message, sendOption } = location.state || {};
  const avatar = contactData?.avatar || '👨';
  const amount = contactData?.amount || 0;
  const isScheduled = sendOption === 'later';

  const timeline = isScheduled
    ? [
        { status: 'scheduled', label: 'Reminder Scheduled', time: `Will be sent on ${date} at ${time}`, icon: Clock, completed: true },
        { status: 'pending-send', label: 'Waiting to Send', time: 'Scheduled', icon: Send, completed: false },
        { status: 'pending', label: 'Awaiting Payment', time: 'After reminder is sent', icon: Eye, completed: false },
        { status: 'paid', label: 'Payment Received', time: 'Not yet', icon: CheckCircle2, completed: false },
      ]
    : [
        { status: 'sent', label: 'Reminder Sent', time: `${date} at ${time}`, icon: Send, completed: true },
        { status: 'pending', label: 'Awaiting Payment', time: 'In progress...', icon: Clock, completed: false },
        { status: 'paid', label: 'Payment Received', time: 'Not yet', icon: CheckCircle2, completed: false },
      ];

  const cardStyle = (item: typeof timeline[0]) => {
    if (item.completed) return 'bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/20';
    if (item.status === 'pending') return 'bg-warning/10 border-2 border-warning/20';
    return 'bg-secondary border-2 border-border';
  };

  const iconStyle = (item: typeof timeline[0]) => {
    if (item.completed) return 'bg-gradient-to-br from-primary to-accent';
    if (item.status === 'pending') return 'bg-warning';
    return 'bg-muted';
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <DarkHeader title={isScheduled ? 'Reminder Scheduled' : 'Reminder Tracking'} onBack={() => navigate('/reminders')}>
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-white/20 to-white/10 flex items-center justify-center text-3xl">
              {avatar}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{contact || 'Mike Tan'}</h2>
              <p className="text-white/70 text-sm">
                {isScheduled ? 'Reminder scheduled' : 'Reminder sent'} {amount > 0 && `• $${amount.toFixed(2)}`}
              </p>
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3">
            <p className="text-white/90 text-sm">{message || 'Payment reminder sent'}</p>
          </div>
        </div>
      </DarkHeader>

      <div className="flex-1 px-6 py-8 overflow-y-auto">
        <h3 className="text-sm text-muted-foreground uppercase tracking-wide mb-6">Payment Timeline</h3>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {timeline.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.status} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="relative flex gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center z-10 shadow-lg ${iconStyle(item)}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  <div className="flex-1 pb-6">
                    <div className={`p-4 rounded-2xl ${cardStyle(item)}`}>
                      <p className="font-semibold text-foreground mb-1">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.time}</p>

                      {item.completed && (
                        <div className="mt-2 flex items-center gap-1 text-success">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-semibold">Completed</span>
                        </div>
                      )}

                      {item.status === 'pending' && (
                        <div className="mt-3 h-1 bg-warning/20 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-warning rounded-full" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 p-4 bg-primary/5 rounded-2xl border border-primary/20">
          <p className="text-sm text-foreground mb-3">
            <span className="font-semibold">{isScheduled ? 'Scheduled:' : 'Next steps:'}</span>{' '}
            {isScheduled
              ? `Your reminder will be sent to ${contact || 'Mike'} on ${date} at ${time}.`
              : `Once ${contact || 'Mike'} completes the payment, you'll receive a notification and the status will update automatically.`}
          </p>
          <button
            onClick={() => navigate('/reminders')}
            className="w-full py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold text-sm"
          >
            {isScheduled ? 'Back to Reminders' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
