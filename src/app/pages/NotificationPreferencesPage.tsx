import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, ChevronRight, Gift, Inbox, UsersRound, Wallet } from 'lucide-react';
import { DarkHeader } from '../components/DarkHeader';
import {
  CHANNEL_DESCRIPTIONS, CHANNEL_LABELS, NOTIFICATION_CHANNELS, getNotificationPreferences,
  getUnreadCount, setNotificationPreference, type NotificationChannel, type NotificationPreferences,
} from '../utils/notificationStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

const CHANNEL_ICONS: Record<NotificationChannel, typeof Wallet> = {
  payments: Wallet,
  reminders: Bell,
  rewards: Gift,
  hangouts: UsersRound,
};

export function NotificationPreferencesPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    () => getNotificationPreferences(currentUser.id),
  );
  const [unread, setUnread] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  useAppEvents(['userSwitched', 'notificationsUpdated', 'notificationPreferencesUpdated', 'databaseReady'], () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setPreferences(getNotificationPreferences(user.id));
    setUnread(getUnreadCount(user.id));
  });

  const toggle = (channel: NotificationChannel) => {
    const next = !preferences[channel];
    setNotificationPreference(currentUser.id, channel, next);
    setPreferences(current => ({ ...current, [channel]: next }));
    setAnnouncement(`${CHANNEL_LABELS[channel]} push notifications ${next ? 'on' : 'off'}`);
  };

  const enabledCount = NOTIFICATION_CHANNELS.filter(channel => preferences[channel]).length;

  return (
    <div className="flex h-full flex-col bg-white">
      <DarkHeader title="Notification Settings" onBack={() => navigate('/profile')} bottomGap="mb-5">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
          <p className="text-xs text-white/70">Push notifications</p>
          <p className="text-3xl font-black text-white">{enabledCount} of {NOTIFICATION_CHANNELS.length} on</p>
          <p className="mt-1 text-[11px] text-white/70">
            Turning a channel off stops the banner — the message is still saved to your history.
          </p>
        </div>
      </DarkHeader>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-8">
        <p className="sr-only" aria-live="polite">{announcement}</p>

        <button
          onClick={() => navigate('/notifications')}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border-2 border-border p-4 text-left"
        >
          <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Inbox size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-foreground">Notification Centre</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} unread` : 'Your full notification history'}
            </p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
        </button>

        <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">Channels</h2>
        <div className="space-y-3">
          {NOTIFICATION_CHANNELS.map(channel => {
            const Icon = CHANNEL_ICONS[channel];
            const enabled = preferences[channel];
            return (
              <div key={channel} className="flex items-center gap-3 rounded-2xl border-2 border-border p-4">
                <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <label htmlFor={`push-${channel}`} className="text-sm font-black text-foreground">
                    {CHANNEL_LABELS[channel]}
                  </label>
                  <p className="text-xs text-muted-foreground">{CHANNEL_DESCRIPTIONS[channel]}</p>
                </div>
                <button
                  id={`push-${channel}`}
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${CHANNEL_LABELS[channel]} push notifications`}
                  onClick={() => toggle(channel)}
                  className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-slate-300'}`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <section className="mt-5 rounded-2xl bg-secondary p-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">How this works</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Every notification is written to your Notification Centre so nothing is lost when a banner
            disappears. These switches only control the in-app banner. On a real device the same
            preference would gate the operating-system push notification.
          </p>
        </section>
      </div>
    </div>
  );
}
