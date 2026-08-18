import { useState } from 'react';
import { Plus, Clock, CheckCircle2, AlertCircle, ArrowDownLeft, ArrowUpRight, Users, BarChart3, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router';
import { BottomNav } from '../components/BottomNav';
import { NETSLogo } from '../components/NETSLogo';
import { NotificationPopup } from '../components/NotificationPopup';
import { getRemindersToReceive, getRemindersToPay, markReminderAsPaid, getAllReminders, getUserInsights } from '../utils/reminderStorage';
import { addTransaction, formatDateForTransaction } from '../utils/transactionStorage';
import { categorizeMerchant } from '../utils/spendingInsights';
import { getCurrentUser, getAllUsers } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';

type Tab = 'to-receive' | 'to-pay' | 'shared-bills' | 'insights';

function formatDays(days: number): string {
  if (days === null || days === undefined || isNaN(days) || days < 0) return 'N/A';
  const d = Math.max(1, Math.round(days));
  return `${d} ${d === 1 ? 'day' : 'days'}`;
}

function formatDate(dateString?: string): string {
  if (!dateString || dateString === 'Just now') return dateString || '';
  try {
    const d = new Date(dateString);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } catch { return dateString; }
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-10">
      <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ReminderCard({ reminder, tab, insights, onPay, onViewStatus }: {
  reminder: any; tab: Tab; insights: any[]; onPay: (r: any) => void; onViewStatus: (r: any) => void;
}) {
  const navigate = useNavigate();
  const allUsers = getAllUsers();
  const avatar = tab === 'to-receive' ? reminder.avatar : (allUsers.find((u) => u.id === reminder.fromUserId)?.avatar || '👤');
  const personName = tab === 'to-receive' ? reminder.toUserName : reminder.fromUserName;
  const personInsight = tab === 'to-receive' ? insights.find((i) => i.userId === reminder.toUserId) : null;

  const statusBadge = () => {
    if (reminder.status === 'overdue') return <div className="flex items-center gap-1 text-destructive"><AlertCircle className="w-3 h-3" /><span className="text-xs font-semibold">Overdue</span></div>;
    if (reminder.status === 'pending') return <div className="flex items-center gap-1 text-warning"><Clock className="w-3 h-3" /><span className="text-xs font-semibold">Pending</span></div>;
    if (reminder.status === 'sent') return <div className="flex items-center gap-1 text-blue-600"><CheckCircle2 className="w-3 h-3" /><span className="text-xs font-semibold">Sent</span></div>;
    return null;
  };

  const actionButtons = () => {
    if (tab === 'to-pay') {
      return <button onClick={() => onPay(reminder)} className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold">Pay ${reminder.amount.toFixed(2)}</button>;
    }
    if (reminder.status === 'sent') return (
      <>
        <button onClick={() => onViewStatus(reminder)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-semibold">View Status</button>
        <button onClick={() => onPay(reminder)} className="flex-1 py-2 bg-success/10 text-success rounded-xl text-xs font-semibold">Mark Paid</button>
      </>
    );
    if (reminder.scheduledDate && reminder.scheduledTime) return (
      <>
        <button onClick={() => navigate('/schedule-reminder', { state: { contact: reminder } })} className="flex-1 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-semibold">Edit Schedule</button>
        <button onClick={() => onPay(reminder)} className="flex-1 py-2 bg-success/10 text-success rounded-xl text-xs font-semibold">Mark Paid</button>
      </>
    );
    return (
      <>
        <button onClick={() => navigate('/schedule-reminder', { state: { contact: reminder } })} className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold">Send Reminder</button>
        <button onClick={() => onPay(reminder)} className="flex-1 py-2 bg-success/10 text-success rounded-xl text-xs font-semibold">Mark Paid</button>
      </>
    );
  };

  return (
    <div className="bg-white rounded-xl p-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-base">{avatar}</div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{personName}</p>
            <p className="text-xs text-muted-foreground">{reminder.category}</p>
            {reminder.reminderSent && tab === 'to-receive' && (
              <p className="text-xs text-blue-600 mt-0.5">Sent {formatDate(reminder.lastReminderDate)}</p>
            )}
            {reminder.scheduledDate && reminder.scheduledTime && tab === 'to-receive' && (
              <p className="text-xs text-orange-600 mt-0.5">📅 {reminder.scheduledDate} at {reminder.scheduledTime}</p>
            )}
            {personInsight && personInsight.paidReminders > 0 && tab === 'to-receive' && (() => {
              const d = personInsight.averagePaymentTime;
              const label = d < 1 ? 'Usually pays same day' : d < 1.5 ? 'Usually pays in ~1 day' : `Usually pays in ~${Math.round(d)} days`;
              return (
                <p className={`text-xs mt-0.5 font-medium ${d <= 2 ? 'text-success' : 'text-muted-foreground'}`}>
                  🕐 {label}
                </p>
              );
            })()}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">${reminder.amount.toFixed(2)}</p>
          {statusBadge()}
        </div>
      </div>

      {reminder.status !== 'paid' && (
        <div className="flex gap-2">{actionButtons()}</div>
      )}

      {reminder.status === 'paid' && reminder.thankYou && (
        <div className="mt-2 bg-success/10 border border-success/20 rounded-xl px-3 py-2">
          <p className="text-xs text-success font-medium">{reminder.thankYou}</p>
        </div>
      )}
    </div>
  );
}

function SharedBillsTab({ sharedBillsMap, currentUser }: { sharedBillsMap: Map<string, any[]>; currentUser: any }) {
  const navigate = useNavigate();
  if (sharedBillsMap.size === 0) return <EmptyState icon={Users} title="No Shared Bills" subtitle="Split a bill to see shared payments here" />;

  return (
    <div className="space-y-2">
      {Array.from(sharedBillsMap.entries()).map(([key, reminders]) => {
        const first = reminders[0];
        const uniqueParticipants = new Set(reminders.map((r) => r.toUserId));
        const billsByDate = new Map<string, number>();
        reminders.forEach((r) => { if (r.totalBillAmount && !billsByDate.has(r.date)) billsByDate.set(r.date, r.totalBillAmount); });
        const totalAmount = Array.from(billsByDate.values()).reduce((sum, v) => sum + v, 0);
        const participantTotals = new Map<string, { allPaid: boolean }>();
        reminders.forEach((r) => {
          if (participantTotals.has(r.toUserId)) participantTotals.get(r.toUserId)!.allPaid = participantTotals.get(r.toUserId)!.allPaid && r.status === 'paid';
          else participantTotals.set(r.toUserId, { allPaid: r.status === 'paid' });
        });
        const totalPeople = uniqueParticipants.size + 1;
        const paidCount = Array.from(participantTotals.values()).filter((p) => p.allPaid).length + 1;
        const isPayer = first.fromUserId === currentUser.id;

        return (
          <button
            key={key}
            onClick={() => navigate('/shared-bill', { state: { merchantName: first.category, payerId: first.fromUserId, billId: key } })}
            className="w-full bg-white rounded-xl p-3 border border-border"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-foreground">{first.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {isPayer ? 'You paid' : `${first.fromUserName} paid`} · {totalPeople} people
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm text-foreground">${totalAmount.toFixed(2)}</p>
                <p className={`text-xs font-semibold ${paidCount === totalPeople ? 'text-success' : 'text-warning'}`}>
                  {paidCount}/{totalPeople} paid
                </p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-success" style={{ width: `${(paidCount / totalPeople) * 100}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function InsightsTab({ insights }: { insights: any[] }) {
  if (insights.length === 0) return <EmptyState icon={BarChart3} title="No Insights Yet" subtitle="Split bills and track payments to see insights" />;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl p-3 border border-border flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <div>
          <p className="font-bold text-sm text-foreground">Payment Analytics</p>
          <p className="text-xs text-muted-foreground">Track how your friends pay back over time</p>
        </div>
      </div>

      {insights.map((insight, i) => (
        <InsightCard key={i} insight={insight} />
      ))}
    </div>
  );
}

function ReliabilityBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const isReliable = score >= 70;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
        isReliable ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
      }`}
    >
      {score}% reliable
    </span>
  );
}

function InsightCard({ insight }: { insight: any }) {
  const [expanded, setExpanded] = useState<'paid' | 'pending' | null>(null);
  const currentUser = getCurrentUser();

  const personReminders = getAllReminders(currentUser.id).filter(
    (r) => r.fromUserId === currentUser.id && r.toUserId === insight.userId
  );
  const paidBills = personReminders.filter((r) => r.status === 'paid');
  const pendingBills = personReminders.filter((r) => r.status !== 'paid');

  const toggle = (which: 'paid' | 'pending') =>
    setExpanded((cur) => (cur === which ? null : which));

  const shownBills = expanded === 'paid' ? paidBills : expanded === 'pending' ? pendingBills : [];

  return (
    <div className="bg-white rounded-xl p-3 border border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-xl">{insight.avatar}</div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-foreground">{insight.userName}</p>
            <ReliabilityBadge score={insight.reliabilityScore} />
          </div>
          <p className="text-xs text-muted-foreground">{insight.totalReminders} reminder{insight.totalReminders !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={() => toggle('paid')}
          className={`bg-success/10 rounded-lg p-2 text-left transition-all ${expanded === 'paid' ? 'ring-2 ring-success/40' : ''}`}
        >
          <p className="text-xs text-success font-medium">Paid</p>
          <p className="text-lg font-bold text-success">{insight.paidReminders}</p>
        </button>
        <button
          onClick={() => toggle('pending')}
          className={`bg-warning/10 rounded-lg p-2 text-left transition-all ${expanded === 'pending' ? 'ring-2 ring-warning/40' : ''}`}
        >
          <p className="text-xs text-warning font-medium">Pending</p>
          <p className="text-lg font-bold text-warning">{insight.pendingReminders}</p>
        </button>
      </div>

      {expanded && (
        <div className="mb-2 space-y-1">
          {shownBills.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-2">
              No {expanded} bills for {insight.userName}.
            </p>
          ) : (
            shownBills.map((bill) => (
              <div
                key={bill.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${expanded === 'paid' ? 'bg-success/5' : 'bg-warning/5'}`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{bill.category || bill.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(bill.date)}</p>
                </div>
                <p className={`text-xs font-bold ml-2 shrink-0 ${expanded === 'paid' ? 'text-success' : 'text-warning'}`}>
                  ${bill.amount.toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      <div className="space-y-1">
        <StatRow label="Avg. Reminders" value={`${insight.averageReminderCount}x`} />
        {insight.paidReminders > 0 && (
          <>
            <StatRow label="Avg. Pay Time" value={formatDays(insight.averagePaymentTime)} />
            <StatRow label="Fastest" value={formatDays(insight.fastestPayment)} valueClass="text-success" />
            <StatRow label="Slowest" value={formatDays(insight.slowestPayment)} valueClass="text-destructive" />
          </>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, valueClass = 'text-foreground' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-t border-border">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}

export function ReminderDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('to-receive');
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [remindersToReceive, setRemindersToReceive] = useState<any[]>([]);
  const [remindersToPay, setRemindersToPay] = useState<any[]>([]);

  useAppEvents(['storage', 'focus', 'remindersUpdated', 'userSwitched'], () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setRemindersToReceive(getRemindersToReceive(user.id));
    setRemindersToPay(getRemindersToPay(user.id));
  });

  const pendingToReceive = remindersToReceive.filter((r) => r.status !== 'paid');
  const pendingToPay = remindersToPay.filter((r) => r.status !== 'paid');
  const totalToReceive = pendingToReceive.reduce((sum, r) => sum + r.amount, 0);
  const totalToPay = pendingToPay.reduce((sum, r) => sum + r.amount, 0);
  const insights = getUserInsights(currentUser.id);

  const allReminders = getAllReminders();
  const allBillsMap = new Map<string, any[]>();
  allReminders.forEach((r: any) => {
    const key = `${r.category}-${r.fromUserId}`;
    if (!allBillsMap.has(key)) allBillsMap.set(key, []);
    allBillsMap.get(key)!.push(r);
  });
  const sharedBillsMap = new Map<string, any[]>();
  allBillsMap.forEach((reminders, key) => {
    if (reminders.some((r) => r.fromUserId === currentUser.id || r.toUserId === currentUser.id))
      sharedBillsMap.set(key, reminders);
  });

  const tabs = [
    { id: 'to-receive' as Tab, label: 'To Receive', count: pendingToReceive.length,  icon: ArrowDownLeft },
    { id: 'to-pay' as Tab,     label: 'To Pay',     count: pendingToPay.length,      icon: ArrowUpRight },
    { id: 'shared-bills' as Tab, label: 'Shared',   count: sharedBillsMap.size,      icon: Users },
    { id: 'insights' as Tab,   label: 'Insights',   count: insights.length,          icon: BarChart3 },
  ];

  const handlePay = (reminder: any) => {
    if (activeTab === 'to-pay') {
      navigate('/payment-authorization', { state: { reminder, amount: reminder.amount, recipientName: reminder.fromUserName, category: reminder.category } });
    } else {
      const paid = markReminderAsPaid(reminder.id);
      if (paid) {
        addTransaction({ name: paid.toUserName, amount: paid.amount, date: formatDateForTransaction(), category: categorizeMerchant(paid.category), status: 'received', kind: 'repayment_received' }, currentUser.id);
        toast.success(`Payment received from ${paid.toUserName}`);
        setRemindersToReceive(getRemindersToReceive(currentUser.id));
        setRemindersToPay(getRemindersToPay(currentUser.id));
      }
    }
  };

  const handleViewStatus = (reminder: any) => {
    navigate('/reminder-tracking', {
      state: { contact: reminder.toUserName, contactData: reminder, date: '2026-05-26', time: '10:00', message: `Hey ${reminder.toUserName}, reminder about the $${reminder.amount.toFixed(2)} payment` },
    });
  };

  const activeReminders = activeTab === 'to-receive' ? pendingToReceive : pendingToPay;

  return (
    <div className="flex flex-col h-full bg-background">

      <div className="px-4 pt-8 pb-3 bg-white">
        <div className="flex items-center justify-between mb-3">
          <NETSLogo />
          <button onClick={() => navigate('/schedule-reminder')} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-success rounded-xl p-3">
            <p className="text-white text-xs font-medium">To Receive</p>
            <p className="text-xl font-bold text-white">${totalToReceive.toFixed(2)}</p>
            <p className="text-white/80 text-xs">{pendingToReceive.length} pending</p>
          </div>
          <div className="bg-red-600 rounded-xl p-3">
            <p className="text-white text-xs font-medium">To Pay</p>
            <p className="text-xl font-bold text-white">${totalToPay.toFixed(2)}</p>
            <p className="text-white/80 text-xs">{pendingToPay.length} pending</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 bg-white border-b border-border">
        <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {tabs.map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs whitespace-nowrap ${
                activeTab === id ? 'bg-primary text-white' : 'bg-secondary text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto pb-20">
        {activeTab === 'to-receive' && (
          <button
            onClick={() => navigate('/schedule-reminder')}
            className="w-full mb-3 p-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Send Reminder
          </button>
        )}

        {activeTab === 'shared-bills' ? (
          <SharedBillsTab sharedBillsMap={sharedBillsMap} currentUser={currentUser} />
        ) : activeTab === 'insights' ? (
          <InsightsTab insights={insights} />
        ) : activeReminders.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={activeTab === 'to-receive' ? 'No money to receive' : 'No payments due'}
            subtitle={activeTab === 'to-receive' ? 'All payments received!' : 'All caught up!'}
          />
        ) : (
          <div className="space-y-2">
            {activeReminders.map((r) => (
              <ReminderCard key={r.id} reminder={r} tab={activeTab} insights={insights} onPay={handlePay} onViewStatus={handleViewStatus} />
            ))}
          </div>
        )}
      </div>

      <NotificationPopup />
      <BottomNav />
      <Toaster position="top-center" />
    </div>
  );
}
