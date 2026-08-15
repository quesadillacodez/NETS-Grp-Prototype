import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, BellOff, CheckCheck, ChevronRight, Gift, Settings, UsersRound, Wallet } from 'lucide-react';
import { DarkHeader } from '../components/DarkHeader';
import {
  CHANNEL_LABELS, NOTIFICATION_CHANNELS, getAllNotifications, getUnreadCountsByChannel,
  markAllNotificationsAsRead, markNotificationAsRead, markNotificationAsUnread,
  type Notification, type NotificationChannel,
} from '../utils/notificationStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

const CHANNEL_ICONS: Record<NotificationChannel, typeof Wallet> = {
  payments: Wallet,
  reminders: Bell,
  rewards: Gift,
  hangouts: UsersRound,
};

const CHANNEL_COLOURS: Record<NotificationChannel, string> = {
  payments: 'bg-primary/10 text-primary',
  reminders: 'bg-amber-100 text-amber-700',
  rewards: 'bg-[#fff2bd] text-[#7a5a00]',
  hangouts: 'bg-blue-100 text-blue-700',
};

function relativeTime(timestamp: string): string {
  const then = Date.parse(timestamp);
  if (Number.isNaN(then)) return timestamp;
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

export function NotificationCentrePage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState(() => getUnreadCountsByChannel(currentUser.id));
  const [channel, setChannel] = useState<NotificationChannel | 'all'>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  useAppEvents(['notificationsUpdated', 'remindersUpdated', 'userSwitched', 'databaseReady', 'focus'], () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setNotifications(getAllNotifications(user.id));
    setCounts(getUnreadCountsByChannel(user.id));
  });

  const visible = useMemo(() => notifications.filter(item =>
    (channel === 'all' || item.channel === channel) && (!unreadOnly || !item.read),
  ), [notifications, channel, unreadOnly]);

  const totalUnread = notifications.filter(item => !item.read).length;

  const open = (notification: Notification) => {
    if (!notification.read) markNotificationAsRead(notification.id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <DarkHeader title="Notifications" onBack={() => navigate('/profile')} bottomGap="mb-5">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
          <div>
            <p className="text-xs text-white/70">Unread</p>
            <p className="text-3xl font-black text-white">{totalUnread}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => markAllNotificationsAsRead(currentUser.id)}
              disabled={totalUnread === 0}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/20 px-3 text-xs font-black text-white disabled:opacity-40"
            >
              <CheckCheck size={15} aria-hidden="true" /> Mark all as read
            </button>
            <button
              onClick={() => navigate('/profile/notification-preferences')}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-black text-white"
            >
              <Settings size={15} aria-hidden="true" /> Push preferences
            </button>
          </div>
        </div>
      </DarkHeader>

      <div className="border-b border-border bg-white px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setChannel('all')}
            aria-pressed={channel === 'all'}
            className={`min-h-11 rounded-full px-3.5 text-xs font-bold ${channel === 'all' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
          >
            All {notifications.length > 0 && `(${notifications.length})`}
          </button>
          {NOTIFICATION_CHANNELS.map(key => (
            <button
              key={key}
              onClick={() => setChannel(key)}
              aria-pressed={channel === key}
              className={`min-h-11 rounded-full px-3.5 text-xs font-bold ${channel === key ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
            >
              {CHANNEL_LABELS[key]}
              {counts[key] > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${channel === key ? 'bg-white/25' : 'bg-primary text-white'}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <label className="mt-3 flex min-h-11 w-fit cursor-pointer items-center gap-2 text-xs font-bold text-muted-foreground">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={event => setUnreadOnly(event.target.checked)}
            className="h-4 w-4 accent-[#00a94f]"
          />
          Show unread only
        </label>
      </div>

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-gray-50 px-5 py-4">
        <p className="sr-only" aria-live="polite">{visible.length} notifications shown</p>

        {visible.length === 0 ? (
          <div className="mt-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-muted-foreground">
              <BellOff size={28} aria-hidden="true" />
            </div>
            <h2 className="mt-3 text-base font-black">
              {notifications.length === 0 ? 'No notifications yet' : 'Nothing here'}
            </h2>
            <p className="mx-auto mt-1 max-w-[260px] text-xs text-muted-foreground">
              {notifications.length === 0
                ? 'Split a bill, get repaid or redeem a reward and everything lands here — nothing disappears after a popup.'
                : 'Try another filter, or switch off "unread only" to see your full history.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(notification => {
              const Icon = CHANNEL_ICONS[notification.channel];
              return (
                <div
                  key={notification.id}
                  className={`rounded-2xl border p-3 ${notification.read ? 'border-border bg-white' : 'border-primary/25 bg-primary/5'}`}
                >
                  <button onClick={() => open(notification)} className="flex w-full items-start gap-3 text-left">
                    <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${CHANNEL_COLOURS[notification.channel]}`}>
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          {CHANNEL_LABELS[notification.channel]}
                        </span>
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {relativeTime(notification.timestamp)}
                        </span>
                      </div>
                      <p className={`mt-1 text-xs leading-relaxed ${notification.read ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>
                        {notification.message || `${notification.fromUserName} reminded you to pay $${notification.amount.toFixed(2)}`}
                      </p>
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-black text-primary">
                        Open {notification.channel === 'reminders' ? 'bill' : notification.channel === 'hangouts' ? 'plan' : 'details'}
                        <ChevronRight size={12} aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => notification.read
                      ? markNotificationAsUnread(notification.id)
                      : markNotificationAsRead(notification.id)}
                    className="mt-1 min-h-11 pl-13 text-[11px] font-bold text-muted-foreground underline"
                  >
                    {notification.read ? 'Mark as unread' : 'Mark as read'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
