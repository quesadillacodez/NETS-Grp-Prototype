import { useState, useEffect } from 'react';
import { Calendar, Clock, Send, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { getRemindersToReceive, updateReminderStatus, incrementReminderCount } from '../utils/reminderStorage';
import { getCurrentUser } from '../utils/userStorage';
import { addNotification } from '../utils/notificationStorage';
import { DarkHeader } from '../components/DarkHeader';

export function ScheduleReminderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedContact = location.state?.contact;
  const currentUser = getCurrentUser();

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);

  const [pendingReminders] = useState(() => getRemindersToReceive(currentUser.id).filter((r) => r.status !== 'paid'));
  const [selectedContact, setSelectedContact] = useState(preselectedContact?.name || '');
  const [sendOption, setSendOption] = useState<'now' | 'later'>('now');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTime, setSelectedTime] = useState(currentTime);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (preselectedContact) setSelectedContact(preselectedContact.name);
  }, [preselectedContact]);

  useEffect(() => {
    const contactData = pendingReminders.find((r) => r.toUserName === selectedContact);
    if (contactData) {
      setMessage(`Hey ${contactData.toUserName}, reminder about the $${contactData.amount.toFixed(2)} payment for ${contactData.category}. Thanks!`);
    } else if (selectedContact) {
      setMessage(`Hey ${selectedContact}, reminder about your payment. Thanks!`);
    } else {
      setMessage("Hey, did you forget to pay for dinner last night?");
    }
  }, [selectedContact, pendingReminders]);

  const handleSend = () => {
    const contactData = pendingReminders.find((r) => r.toUserName === selectedContact);
    const actualDate = sendOption === 'now' ? today : selectedDate;
    const actualTime = sendOption === 'now' ? currentTime : selectedTime;

    if (contactData) {
      // Persist the status change to the database (was writing to localStorage
      // before, which bypassed the DB and didn't sync with the rest of the app).
      updateReminderStatus(contactData.id, sendOption === 'now' ? 'sent' : 'pending');
      window.dispatchEvent(new CustomEvent('remindersUpdated'));

      if (sendOption === 'now') {
        incrementReminderCount(contactData.id);
        addNotification({
          userId: contactData.toUserId,
          fromUserId: currentUser.id,
          fromUserName: currentUser.name,
          fromUserAvatar: currentUser.avatar,
          message,
          amount: contactData.amount,
          category: contactData.category,
          timestamp: new Date().toISOString(),
          read: false,
          reminderId: contactData.id,
        });
      }
    }

    navigate('/reminder-tracking', { state: { contact: selectedContact, contactData, date: actualDate, time: actualTime, message, sendOption } });
  };

  const canSend = !!selectedContact && !!message;

  return (
    <div className="flex flex-col h-full bg-white">
      <DarkHeader title="Send Reminder" onBack={() => navigate('/reminders')} bottomGap="mb-6" />

      <div className="flex-1 px-6 py-6 overflow-y-auto">
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3 p-1 bg-secondary rounded-2xl">
            {(['now', 'later'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSendOption(opt)}
                className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                  sendOption === opt ? 'bg-gradient-to-r from-primary to-accent text-white shadow-md' : 'text-muted-foreground'
                }`}
              >
                {opt === 'now' ? 'Send Now' : 'Schedule for Later'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <User className="w-4 h-4" />
            Select Recipient
          </label>

          {pendingReminders.length === 0 ? (
            <div className="p-6 bg-secondary rounded-2xl text-center">
              <p className="text-muted-foreground text-sm">No pending payments</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {pendingReminders.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedContact(r.toUserName)}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    selectedContact === r.toUserName
                      ? 'bg-gradient-to-r from-primary/10 to-accent/10 border-primary'
                      : 'bg-secondary border-border'
                  }`}
                >
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{r.avatar}</span>
                      <span className="text-sm font-semibold text-foreground">{r.toUserName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-1">${r.amount.toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {sendOption === 'later' && (
          <>
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Calendar className="w-4 h-4" />
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={today}
                className="w-full px-4 py-3.5 bg-white rounded-2xl border-2 border-primary/30 focus:border-primary outline-none text-foreground font-medium cursor-pointer hover:border-primary/50 hover:shadow-md transition-all text-base"
                style={{ colorScheme: 'light' }}
              />
              <p className="text-xs text-muted-foreground mt-2">📅 Click to open calendar picker</p>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Clock className="w-4 h-4" />
                Select Time
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-4 py-3.5 bg-white rounded-2xl border-2 border-primary/30 focus:border-primary outline-none text-foreground font-medium cursor-pointer hover:border-primary/50 hover:shadow-md transition-all text-base"
                style={{ colorScheme: 'light' }}
              />
              <p className="text-xs text-muted-foreground mt-2">🕐 Click to select time</p>
            </div>
          </>
        )}

        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <Send className="w-4 h-4" />
            Reminder Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-secondary rounded-2xl border-2 border-border focus:border-primary outline-none resize-none"
            placeholder="Type your reminder message..."
          />
          <p className="text-xs text-muted-foreground mt-2">
            {sendOption === 'now' ? 'This message will be sent immediately.' : 'This message will be sent at the scheduled time.'}
          </p>
        </div>

        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-sm text-foreground">{message}</p>
          </div>
        </div>
      </div>

      <div className="p-6 bg-white border-t border-border">
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`w-full py-4 rounded-2xl font-semibold shadow-lg transition-all ${
            canSend ? 'bg-gradient-to-r from-primary to-accent text-white' : 'bg-secondary text-muted-foreground cursor-not-allowed'
          }`}
        >
          {sendOption === 'now' ? 'Send Reminder Now' : 'Schedule Reminder'}
        </button>
      </div>
    </div>
  );
}
