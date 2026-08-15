import { query, queryOne, run } from './db';

export type ReminderFrequency =
  | 'hourly' | '3hours' | '5hours' | '12hours' | 'daily' | '48hours' | 'weekly' | 'custom';

export interface User {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  email?: string;
  password?: string;
  isAdmin?: boolean;
  reminderFrequency?: ReminderFrequency;
  autoRemindersEnabled?: boolean;
  lastAutoReminderSent?: string;
  customReminderHours?: number;
  customReminderMinutes?: number;
}

const CURRENT_USER_KEY = 'nets-current-user-id';

const DEFAULT_USERS: User[] = [
  { id: '1', name: 'Alex Chen', avatar: '👨‍💼', phone: '+65 9123 4567', password: '111111' },
  { id: '2', name: 'Sarah Tan', avatar: '👩', phone: '+65 9234 5678', password: '222222' },
  { id: '3', name: 'Mike Wong', avatar: '👨', phone: '+65 9345 6789', password: '333333' },
  { id: '4', name: 'Jenny Lim', avatar: '👩‍🦰', phone: '+65 9456 7890', password: '444444' },
  { id: 'admin', name: 'Admin (Management)', avatar: '🛡️', phone: 'Management Portal', isAdmin: true, password: '888888' },
];

function rowToUser(r: Record<string, any>): User {
  return {
    id: String(r.id),
    name: r.name,
    avatar: r.avatar,
    phone: r.phone,
    email: r.email ?? undefined,
    password: r.password ?? undefined,
    isAdmin: r.is_admin === 1,
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
      run('INSERT INTO users (id, name, avatar, phone, email, password, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [u.id, u.name, u.avatar, u.phone, u.email ?? null, u.password ?? null, u.isAdmin ? 1 : 0]);
    }
    return;
  }

  // Existing DB (created before the Admin account) — make sure Admin exists.
  const admin = queryOne('SELECT id FROM users WHERE id = ?', ['admin']);
  if (!admin) {
    const a = DEFAULT_USERS.find(u => u.id === 'admin')!;
    run('INSERT INTO users (id, name, avatar, phone, email, password, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [a.id, a.name, a.avatar, a.phone, a.email ?? null, a.password ?? null, 1]);
  }

  // Keep each default user's PIN in sync with the current defaults (so changing
  // a PIN here updates existing databases too).
  for (const u of DEFAULT_USERS) {
    const row = queryOne('SELECT password FROM users WHERE id = ?', [u.id]);
    if (row && u.password && row.password !== u.password) {
      run('UPDATE users SET password = ? WHERE id = ?', [u.password, u.id]);
    }
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
  window.dispatchEvent(new CustomEvent('userSwitched'));
}

export function addUser(user: Omit<User, 'id'>): void {
  run('INSERT INTO users (id, name, avatar, phone) VALUES (?, ?, ?, ?)',
    [Date.now().toString(), user.name, user.avatar, user.phone]);
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
  return u.isAdmin === true || u.id === 'admin';
}

// Only non-admin accounts should appear as payable/selectable contacts.
export function getPayableUsers(): User[] {
  return getAllUsers().filter(u => !u.isAdmin);
}
