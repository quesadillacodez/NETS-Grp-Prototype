import { useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CHANNEL_LABELS, getNotificationPreferences, getUnreadNotifications, type Notification,
} from '../utils/notificationStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useNavigate } from 'react-router';
import { useAppEvents } from '../utils/useAppEvents';

const EVENTS_THAT_CHANGE_NOTIFICATIONS = [
  'notificationsUpdated', 'userSwitched', 'remindersUpdated', 'notificationPreferencesUpdated',
];

/**
 * The transient banner for notifications that just arrived. Dismissing it only
 * hides the banner — nothing is marked as read, because the full history now
 * lives in the Notification Centre and dismissing a popup should not silently
 * clear it.
 */
export function NotificationPopup() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  // Ids already shown in a banner this session, so a dismissed banner does not
  // pop straight back up on the next unrelated update.
  const dismissed = useRef<Set<number>>(new Set());

  useAppEvents(EVENTS_THAT_CHANGE_NOTIFICATIONS, () => {
    const user = getCurrentUser();
    const preferences = getNotificationPreferences(user.id);
    const pushable = getUnreadNotifications(user.id)
      .filter(item => preferences[item.channel])
      .filter(item => !dismissed.current.has(item.id));

    setNotifications(pushable);
    setIsVisible(pushable.length > 0);
  });

  const dismiss = () => {
    notifications.forEach(item => dismissed.current.add(item.id));
    setIsVisible(false);
  };

  const viewAll = () => {
    notifications.forEach(item => dismissed.current.add(item.id));
    setIsVisible(false);
    navigate('/notifications');
  };

  if (notifications.length === 0 || !isVisible) return null;

  const channels = [...new Set(notifications.map(item => item.channel))];
  const heading = channels.length === 1
    ? `${notifications.length} new ${CHANNEL_LABELS[channels[0]].toLowerCase()} ${notifications.length === 1 ? 'alert' : 'alerts'}`
    : `${notifications.length} new notifications`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        role="status"
        aria-live="polite"
        className="absolute top-4 left-3 right-3 z-50"
      >
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-xl p-3 border border-blue-400">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm mb-1">{heading}</h3>
              {notifications.slice(0, 2).map((notif) => (
                <div key={notif.id} className="mb-1 last:mb-0">
                  <p className="text-white/90 text-xs">
                    {notif.message || (
                      <>
                        <span className="font-semibold">{notif.fromUserName}</span> reminded you to pay ${notif.amount.toFixed(2)}
                      </>
                    )}
                  </p>
                  {!notif.message && <p className="text-white/70 text-xs">{notif.category}</p>}
                </div>
              ))}
              {notifications.length > 2 && (
                <p className="text-white/80 text-xs mt-1">+{notifications.length - 2} more</p>
              )}
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss notification banner"
              className="w-11 h-11 -m-1.5 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20">
                <X className="w-4 h-4 text-white" aria-hidden="true" />
              </span>
            </button>
          </div>
          <button
            onClick={viewAll}
            className="w-full mt-2 min-h-11 bg-white/20 hover:bg-white/30 rounded-lg text-white font-semibold text-xs transition-colors"
          >
            Open Notification Centre
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
