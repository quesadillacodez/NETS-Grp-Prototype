import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getUnreadNotifications, markAllNotificationsAsRead, type Notification } from '../utils/notificationStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useNavigate } from 'react-router';
import { useAppEvents } from '../utils/useAppEvents';

const EVENTS_THAT_CHANGE_NOTIFICATIONS = ['notificationsUpdated', 'userSwitched', 'remindersUpdated'];

export function NotificationPopup() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const currentUser = getCurrentUser();

  useAppEvents(EVENTS_THAT_CHANGE_NOTIFICATIONS, () => {
    const unread = getUnreadNotifications(getCurrentUser().id);
    setNotifications(unread);
    if (unread.length > 0) setIsVisible(true);
  });

  const dismiss = () => {
    markAllNotificationsAsRead(currentUser.id);
    setIsVisible(false);
  };

  const viewReminders = () => {
    markAllNotificationsAsRead(currentUser.id);
    setIsVisible(false);
    navigate('/reminders');
  };

  if (notifications.length === 0 || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="absolute top-4 left-3 right-3 z-50"
      >
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-xl p-3 border border-blue-400">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm mb-1">
                {notifications.length} New {notifications.length === 1 ? 'Reminder' : 'Reminders'}
              </h3>
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
              className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <button
            onClick={viewReminders}
            className="w-full mt-2 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-semibold text-xs transition-colors"
          >
            View All Reminders
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
