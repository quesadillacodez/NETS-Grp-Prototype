import { queryOne, run } from './db';
import { addNotification } from './notificationStorage';
import { daysUntilExpiry, getRedemptionStatus, getRewardRedemptions } from './rewardStorage';
import { getCurrentUser, isAdminUser, isMerchantUser } from './userStorage';

const DAY_MS = 24 * 60 * 60 * 1000;

function reminderTier(days: number): 7 | 3 | 1 | 0 | null {
  if (days < 0) return null;
  if (days <= 0) return 0;
  if (days <= 1) return 1;
  if (days <= 3) return 3;
  if (days <= 7) return 7;
  return null;
}

export function checkVoucherExpiryReminders(now = Date.now()): number {
  try {
    const user = getCurrentUser();
    if (isAdminUser(user) || isMerchantUser(user)) return 0;
    let created = 0;

    for (const redemption of getRewardRedemptions(user.id)) {
      if (getRedemptionStatus(redemption, now) !== 'active') continue;
      const days = daysUntilExpiry(redemption.expiresAt, now);
      if (days == null || redemption.expiresAt - now > 7 * DAY_MS) continue;
      const tier = reminderTier(days);
      if (tier == null) continue;
      const metaKey = `voucher-expiry:${user.id}:${redemption.id}:${tier}`;
      if (queryOne('SELECT value FROM app_meta WHERE key = ?', [metaKey])) continue;

      const timing = tier === 0 ? 'expires today' : `expires in ${days} day${days === 1 ? '' : 's'}`;
      addNotification({
        userId: user.id,
        fromUserId: 'nets-rewards',
        fromUserName: 'NETS Rewards',
        fromUserAvatar: '🎟️',
        message: `${redemption.title} ${timing}. Use it at ${redemption.merchant} before it is gone.`,
        amount: 0,
        category: 'Voucher expiry',
        timestamp: new Date(now).toISOString(),
        read: false,
        channel: 'rewards',
        link: '/rewards?tab=wallet',
      });
      run('INSERT INTO app_meta (key, value) VALUES (?, ?)', [metaKey, new Date(now).toISOString()]);
      created += 1;
    }
    return created;
  } catch {
    // The module is loaded before SQLite finishes booting. The databaseReady
    // event below performs the first real check.
    return 0;
  }
}

const check = () => checkVoucherExpiryReminders();
window.addEventListener('databaseReady', check);
window.addEventListener('userSwitched', check);
window.addEventListener('rewardRedemptionsUpdated', check);
window.addEventListener('focus', check);
window.setInterval(check, 15 * 60 * 1000);
