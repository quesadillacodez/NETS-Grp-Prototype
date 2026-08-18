import { query, queryOne, run } from './db';
import { recordLogin } from './questStorage';

export type ReminderFrequency =
  | 'hourly' | '3hours' | '5hours' | '12hours' | 'daily' | '48hours' | 'weekly' | 'custom';

export type UserRole = 'customer' | 'admin' | 'merchant';

export interface User {
  id: string;
  loginId?: string;
  name: string;
  avatar: string;
  phone: string;
  email?: string;
  isAdmin?: boolean;
  role?: UserRole;
  /** Set on a merchant account: the merchant whose stall this user runs. */
  merchantId?: string;
  reminderFrequency?: ReminderFrequency;
  autoRemindersEnabled?: boolean;
  lastAutoReminderSent?: string;
  customReminderHours?: number;
  customReminderMinutes?: number;
}

const CURRENT_USER_KEY = 'nets-current-user-id';

const DEFAULT_USERS: User[] = [
  { id: '1', loginId: 'alexchen140896', name: 'Alex Chen', avatar: '👨‍💼', phone: '+65 9123 4567' },
  { id: '2', loginId: 'sarahtan230394', name: 'Sarah Tan', avatar: '👩', phone: '+65 9234 5678' },
  { id: '3', loginId: 'mikewong081192', name: 'Mike Wong', avatar: '👨', phone: '+65 9345 6789' },
  { id: '4', loginId: 'jennylim170797', name: 'Jenny Lim', avatar: '👩‍🦰', phone: '+65 9456 7890' },
  { id: 'admin', loginId: 'admin010180', name: 'Admin (Management)', avatar: '🛡️', phone: 'Management Portal', isAdmin: true, role: 'admin' },
  // Merchant accounts. Each is tied to one merchant and sees only that stall's
  // takings — the same portal, scoped to whoever signed in. A second stall
  // exists so the isolation between them is something the app can demonstrate
  // rather than assert. PINs live on the server, never here.
  { id: 'merchant-kopi', loginId: 'kopitiammerchant', name: 'Kopitiam', avatar: '☕', phone: 'Merchant · Toa Payoh', role: 'merchant', merchantId: 'kopi' },
  { id: 'merchant-bubble', loginId: 'bubbletea070707', name: 'Bubble Tea Bar', avatar: '🧋', phone: 'Merchant · Orchard', role: 'merchant', merchantId: 'bubble' },
];

function rowToUser(r: Record<string, any>): User {
  return {
    id: String(r.id),
    loginId: r.login_id ?? undefined,
    name: r.name,
    avatar: r.avatar,
    phone: r.phone,
    email: r.email ?? undefined,
    isAdmin: r.is_admin === 1,
    role: (r.role as UserRole | null) ?? (r.is_admin === 1 ? 'admin' : 'customer'),
    merchantId: r.merchant_id == null ? undefined : String(r.merchant_id),
    reminderFrequency: r.reminder_frequency ?? undefined,
    autoRemindersEnabled: r.auto_reminders_enabled == null ? undefined : r.auto_reminders_enabled === 1,
    lastAutoReminderSent: r.last_auto_reminder_sent ?? undefined,
    customReminderHours: r.custom_reminder_hours ?? undefined,
    customReminderMinutes: r.custom_reminder_minutes ?? undefined,
  };
}

function seedDefaultUsersIfEmpty(): void {
  const row = queryOne('SELECT COUNT(*) AS n FROM users');
  const hasUsers = row && Number(row.n) > 0;

  if (!hasUsers) {
    for (const u of DEFAULT_USERS) {
      run('INSERT INTO users (id, login_id, name, avatar, phone, email, password, is_admin, role, merchant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [u.id, u.loginId ?? null, u.name, u.avatar, u.phone, u.email ?? null, null, u.isAdmin ? 1 : 0, u.role ?? 'customer', u.merchantId ?? null]);
    }
    return;
  }

  // Existing DB (created before the Admin account) — make sure Admin exists.
  // Keep public login IDs in sync and scrub credentials left by older builds.
  // Authentication secrets now live exclusively on the server.
  for (const u of DEFAULT_USERS) {
    const row = queryOne('SELECT login_id, password FROM users WHERE id = ?', [u.id]);
    if (!row) {
      run('INSERT INTO users (id, login_id, name, avatar, phone, email, password, is_admin, role, merchant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [u.id, u.loginId ?? null, u.name, u.avatar, u.phone, u.email ?? null, null, u.isAdmin ? 1 : 0, u.role ?? 'customer', u.merchantId ?? null]);
    } else if (row.login_id !== u.loginId) {
      run('UPDATE users SET login_id = ? WHERE id = ?', [u.loginId ?? null, u.id]);
    }
    run('UPDATE users SET role = ?, merchant_id = ? WHERE id = ?',
      [u.role ?? (u.isAdmin ? 'admin' : 'customer'), u.merchantId ?? null, u.id]);
    if (row?.password) run('UPDATE users SET password = NULL WHERE id = ?', [u.id]);
  }
}

export function getAllUsers(): User[] {
  seedDefaultUsersIfEmpty();
  return query('SELECT * FROM users ORDER BY id').map(rowToUser);
}

export function getCurrentUser(): User {
  const users = getAllUsers();
  const currentId = localStorage.getItem(CURRENT_USER_KEY);
  const found = currentId ? users.find(u => u.id === currentId) : undefined;
  const user = found ?? users[0];
  localStorage.setItem(CURRENT_USER_KEY, user.id);
  return user;
}

export function switchUser(userId: string): void {
  const user = getAllUsers().find(u => u.id === userId);
  if (!user) return;
  localStorage.setItem(CURRENT_USER_KEY, user.id);
  // Signing in counts as the day's check-in for the account being switched to.
  recordLogin(user.id);
  window.dispatchEvent(new CustomEvent('userSwitched'));
}

export function addUser(user: Omit<User, 'id'>): void {
  run('INSERT INTO users (id, login_id, name, avatar, phone, email, password, is_admin, role, merchant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [Date.now().toString(), user.loginId ?? null, user.name, user.avatar, user.phone,
      user.email ?? null, null, user.isAdmin ? 1 : 0, user.role ?? 'customer', user.merchantId ?? null]);
}

export interface ProfileUpdate {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export function updateUserProfile(userId: string, update: ProfileUpdate): void {
  run(
    `UPDATE users SET
       name   = COALESCE(?, name),
       email  = COALESCE(?, email),
       phone  = COALESCE(?, phone),
       avatar = COALESCE(?, avatar)
     WHERE id = ?`,
    [update.name ?? null, update.email ?? null, update.phone ?? null, update.avatar ?? null, userId],
  );
  window.dispatchEvent(new CustomEvent('userSwitched'));
}

/** A 6-digit PIN, matching the format issued at sign-up and by PIN recovery. */
export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function updateUserReminderSettings(
  userId: string,
  settings: {
    reminderFrequency?: ReminderFrequency;
    autoRemindersEnabled?: boolean;
    customReminderHours?: number;
    customReminderMinutes?: number;
  }
): void {
  run(
    `UPDATE users SET
       reminder_frequency      = COALESCE(?, reminder_frequency),
       auto_reminders_enabled  = COALESCE(?, auto_reminders_enabled),
       custom_reminder_hours   = COALESCE(?, custom_reminder_hours),
       custom_reminder_minutes = COALESCE(?, custom_reminder_minutes)
     WHERE id = ?`,
    [
      settings.reminderFrequency ?? null,
      settings.autoRemindersEnabled == null ? null : settings.autoRemindersEnabled ? 1 : 0,
      settings.customReminderHours ?? null,
      settings.customReminderMinutes ?? null,
      userId,
    ]
  );
  syncReminderSettingsRow(userId);
}

// Refresh one user's row in the reminder_settings table from the users table.
function syncReminderSettingsRow(userId: string): void {
  run(
    `INSERT OR REPLACE INTO reminder_settings
       (user_id, reminder_frequency, auto_reminders_enabled, custom_reminder_hours, custom_reminder_minutes, updated_at)
     SELECT id, reminder_frequency, auto_reminders_enabled, custom_reminder_hours, custom_reminder_minutes, ?
       FROM users WHERE id = ?`,
    [Date.now(), userId],
  );
}

// Backfill the reminder_settings table for every user (used once at startup so
// the table is populated even before anyone opens the settings screen).
export function syncAllReminderSettings(): void {
  run(
    `INSERT OR REPLACE INTO reminder_settings
       (user_id, reminder_frequency, auto_reminders_enabled, custom_reminder_hours, custom_reminder_minutes, updated_at)
     SELECT id, reminder_frequency, auto_reminders_enabled, custom_reminder_hours, custom_reminder_minutes, ?
       FROM users`,
    [Date.now()],
  );
}

export function updateLastAutoReminderSent(userId: string): void {
  run('UPDATE users SET last_auto_reminder_sent = ? WHERE id = ?',
    [new Date().toISOString(), userId]);
}

export function isAdminUser(user?: User): boolean {
  const u = user ?? getCurrentUser();
  return u.role === 'admin' || u.isAdmin === true || u.id === 'admin';
}

export function isMerchantUser(user?: User): boolean {
  const u = user ?? getCurrentUser();
  return u.role === 'merchant' && Boolean(u.merchantId);
}

export function getUserHomePath(user: User): string {
  if (isAdminUser(user)) return '/admin';
  if (isMerchantUser(user)) return '/merchant';
  return '/';
}

export type AccountRole = 'admin' | 'merchant' | 'customer';

/** One place that answers what kind of account is signed in. */
export function roleOf(user?: User): AccountRole {
  const u = user ?? getCurrentUser();
  if (isAdminUser(u)) return 'admin';
  if (isMerchantUser(u)) return 'merchant';
  return 'customer';
}

// Only customer accounts are people you can split a bill with. The management
// account and the merchant stalls are not contacts.
export function getPayableUsers(): User[] {
  return getAllUsers().filter(u => roleOf(u) === 'customer');
}
