import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import { classifyTransaction } from './transactionModel';

const IDB_NAME = 'nets-db';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'database';

let db: Database | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadBytes(): Promise<Uint8Array | null> {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
    req.onerror = () => reject(req.error);
  });
}

async function saveBytes(bytes: Uint8Array): Promise<void> {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                        TEXT PRIMARY KEY,
  login_id                  TEXT,
  name                      TEXT NOT NULL,
  avatar                    TEXT NOT NULL,
  phone                     TEXT NOT NULL,
  email                     TEXT,
  password                  TEXT,
  is_admin                  INTEGER DEFAULT 0,
  reminder_frequency        TEXT DEFAULT 'daily',
  auto_reminders_enabled    INTEGER DEFAULT 1,
  last_auto_reminder_sent   TEXT,
  custom_reminder_hours     INTEGER,
  custom_reminder_minutes   INTEGER
);

CREATE TABLE IF NOT EXISTS transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  amount     REAL NOT NULL,
  date       TEXT NOT NULL,
  category   TEXT NOT NULL,
  status     TEXT,
  kind       TEXT,
  payment_id TEXT,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

CREATE TABLE IF NOT EXISTS reminders (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id       TEXT NOT NULL,
  to_user_id         TEXT NOT NULL,
  from_user_name     TEXT NOT NULL,
  to_user_name       TEXT NOT NULL,
  name               TEXT NOT NULL,
  amount             REAL NOT NULL,
  status             TEXT NOT NULL,
  date               TEXT NOT NULL,
  category           TEXT NOT NULL,
  avatar             TEXT NOT NULL,
  reminder_sent      INTEGER DEFAULT 0,
  last_reminder_date TEXT,
  total_bill_amount  REAL,
  payer_share        REAL,
  reminder_count     INTEGER DEFAULT 0,
  created_date       TEXT,
  paid_date          TEXT,
  thank_you          TEXT,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id)   REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reminders_from ON reminders(from_user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_to   ON reminders(to_user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT NOT NULL,
  from_user_id     TEXT NOT NULL,
  from_user_name   TEXT NOT NULL,
  from_user_avatar TEXT NOT NULL,
  message          TEXT NOT NULL,
  amount           REAL NOT NULL,
  category         TEXT NOT NULL,
  timestamp        TEXT NOT NULL,
  read             INTEGER DEFAULT 0,
  reminder_id      INTEGER,
  channel          TEXT,
  link             TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- Per-channel push preferences. A notification is always recorded in the
-- Notification Centre; this only controls whether the user is interrupted.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id      TEXT NOT NULL,
  channel      TEXT NOT NULL,
  push_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at   INTEGER,
  PRIMARY KEY (user_id, channel),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL,
  label      TEXT NOT NULL,
  detail     TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  frozen     INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);

CREATE TABLE IF NOT EXISTS merchants (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  amount     REAL NOT NULL,
  reference  TEXT,
  active     INTEGER DEFAULT 1,
  xp_rate    REAL DEFAULT 10,
  xp_bonus   REAL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS activities (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  category         TEXT NOT NULL,
  title            TEXT NOT NULL,
  venue            TEXT NOT NULL,
  location         TEXT NOT NULL,
  price_per_person REAL NOT NULL,
  duration         TEXT NOT NULL,
  group_size       TEXT NOT NULL,
  rating           REAL DEFAULT 4.5,
  image            TEXT NOT NULL,
  description      TEXT NOT NULL,
  active           INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,
  name           TEXT NOT NULL,
  target         REAL NOT NULL,
  current        REAL NOT NULL DEFAULT 0,
  icon           TEXT DEFAULT '🎯',
  color          TEXT DEFAULT '#00a94f',
  deadline       TEXT
);

CREATE TABLE IF NOT EXISTS budgets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,
  category       TEXT NOT NULL,
  monthly_limit  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS deals (
  id             INTEGER PRIMARY KEY,
  category       TEXT NOT NULL,
  title          TEXT NOT NULL,
  merchant       TEXT NOT NULL,
  location       TEXT NOT NULL,
  discount       REAL NOT NULL,
  original_price REAL NOT NULL,
  deal_price     REAL NOT NULL,
  savings        REAL NOT NULL,
  expiry         TEXT NOT NULL,
  rating         REAL DEFAULT 5.0,
  image          TEXT NOT NULL,
  featured       INTEGER DEFAULT 0,
  terms          TEXT,
  description     TEXT,
  redeemed_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS redemptions (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  TEXT NOT NULL,
  deal_id  INTEGER NOT NULL,
  ref_code TEXT NOT NULL,
  date     TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON redemptions(user_id);

CREATE TABLE IF NOT EXISTS saved_deals (
  user_id  TEXT NOT NULL,
  deal_id  INTEGER NOT NULL,
  PRIMARY KEY (user_id, deal_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_activities (
  user_id     TEXT NOT NULL,
  activity_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, activity_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hangouts (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id         TEXT NOT NULL,
  name                  TEXT NOT NULL,
  activity_ids          TEXT NOT NULL,
  invited_user_ids      TEXT NOT NULL,
  preferred_date        TEXT NOT NULL,
  budget_per_person     REAL NOT NULL,
  status                TEXT NOT NULL DEFAULT 'voting',
  confirmed_activity_id INTEGER,
  created_at            INTEGER NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hangouts_owner ON hangouts(owner_user_id);

CREATE TABLE IF NOT EXISTS hangout_votes (
  hangout_id  INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  activity_id INTEGER NOT NULL,
  PRIMARY KEY (hangout_id, user_id),
  FOREIGN KEY (hangout_id) REFERENCES hangouts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hangout_votes_hangout ON hangout_votes(hangout_id);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  reward_id   INTEGER NOT NULL,
  title       TEXT NOT NULL,
  merchant    TEXT NOT NULL,
  xp_cost     INTEGER NOT NULL,
  ref_code    TEXT NOT NULL,
  redeemed_at INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  -- Epoch ms the voucher lapses; 0 means it never expires (instant cashback).
  expires_at  INTEGER NOT NULL DEFAULT 0,
  used_at     INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user
ON reward_redemptions(user_id);

CREATE TABLE IF NOT EXISTS processed_payments (
  payment_id   TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL
);

-- A per-user view of the Reminder Settings screen. Mirrors the settings columns
-- on the users table so they're easy to see as their own table. Kept in sync:
-- written on save and backfilled at startup.
CREATE TABLE IF NOT EXISTS reminder_settings (
  user_id                 TEXT PRIMARY KEY,
  reminder_frequency      TEXT,
  auto_reminders_enabled  INTEGER,
  custom_reminder_hours   INTEGER,
  custom_reminder_minutes INTEGER,
  updated_at              INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- A materialised copy of the Insights screen (who owes whom, how reliably they
-- pay). Recomputed from the reminders table whenever Insights is viewed, so it
-- always reflects the current data rather than being hard-coded.
CREATE TABLE IF NOT EXISTS insights (
  owner_user_id          TEXT NOT NULL,
  person_user_id         TEXT NOT NULL,
  person_name            TEXT,
  avatar                 TEXT,
  total_reminders        INTEGER,
  paid_reminders         INTEGER,
  pending_reminders      INTEGER,
  average_reminder_count REAL,
  average_payment_time   REAL,
  fastest_payment        REAL,
  slowest_payment        REAL,
  updated_at             INTEGER,
  PRIMARY KEY (owner_user_id, person_user_id)
);
`;

export async function initDatabase(): Promise<void> {
  if (db) return;

  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });

  const bytes = await loadBytes();
  db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  db.run(SCHEMA);

  // Best-effort flush of any pending debounced save when the tab is closing or
  // reloading, so writes made in the last 150ms aren't lost.
  if (typeof window !== 'undefined' && !(window as any).__dbUnloadHooked) {
    (window as any).__dbUnloadHooked = true;
    const flush = () => {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      if (db) saveBytes(db.export()).catch(() => {});
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }

  // ── Migrations for databases created before these columns/tables existed ──
  try {
    const cols = db.exec("PRAGMA table_info(users)");
    const names = cols.length ? cols[0].values.map(v => String(v[1])) : [];
    if (!names.includes('is_admin')) {
      db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
    }
  } catch (e) {
    console.warn('users.is_admin migration skipped:', e);
  }

  try {
    const cols = db.exec("PRAGMA table_info(transactions)");
    const names = cols.length ? cols[0].values.map(v => String(v[1])) : [];
    if (!names.includes('created_at')) {
      db.run('ALTER TABLE transactions ADD COLUMN created_at INTEGER');
      // Backfill: spread existing rows across the last 7 days by id order so the
      // dashboard's real time-series has history instead of everything "today".
      const now = Date.now();
      const week = 7 * 24 * 60 * 60 * 1000;
      const res = db.exec('SELECT id FROM transactions ORDER BY id');
      if (res.length) {
        const ids = res[0].values.map(v => Number(v[0]));
        const n = ids.length;
        ids.forEach((id, i) => {
          // oldest id -> ~7 days ago, newest -> now
          const ts = Math.round(now - week + ((i + 1) / n) * week);
          db!.run('UPDATE transactions SET created_at = ? WHERE id = ?', [ts, id]);
        });
      }
    }
    if (!names.includes('kind')) {
      db.run('ALTER TABLE transactions ADD COLUMN kind TEXT');
    }
    if (!names.includes('payment_id')) {
      db.run('ALTER TABLE transactions ADD COLUMN payment_id TEXT');
    }
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_payment
      ON transactions(user_id, payment_id) WHERE payment_id IS NOT NULL`);
  } catch (e) {
    console.warn('transactions.created_at migration skipped:', e);
  }

  // Reward redemptions gained an expiry and a "used at" timestamp when voucher
  // status was added. Existing vouchers get 30 days from their redemption date,
  // matching the default validity of the catalogue they came from.
  try {
    const cols = db.exec('PRAGMA table_info(reward_redemptions)');
    const names = cols.length ? cols[0].values.map(v => String(v[1])) : [];
    if (!names.includes('expires_at')) {
      db.run('ALTER TABLE reward_redemptions ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0');
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      db.run(
        `UPDATE reward_redemptions SET expires_at = redeemed_at + ?
          WHERE expires_at = 0 AND NOT (merchant = 'NETS Wallet' AND title LIKE '%Cashback%')`,
        [thirtyDays],
      );
    }
    if (!names.includes('used_at')) {
      db.run('ALTER TABLE reward_redemptions ADD COLUMN used_at INTEGER');
    }
  } catch (e) {
    console.warn('reward_redemptions expiry migration skipped:', e);
  }

  // Notifications gained a channel (payments / reminders / rewards / hangouts)
  // and a deep link when the Notification Centre was added. Existing rows are
  // left NULL and classified on read by `inferNotificationChannel`.
  try {
    const cols = db.exec('PRAGMA table_info(notifications)');
    const names = cols.length ? cols[0].values.map(v => String(v[1])) : [];
    if (!names.includes('channel')) db.run('ALTER TABLE notifications ADD COLUMN channel TEXT');
    if (!names.includes('link')) db.run('ALTER TABLE notifications ADD COLUMN link TEXT');
  } catch (e) {
    console.warn('notifications channel migration skipped:', e);
  }

  // Normalise every transaction onto the canonical model. Databases created by
  // earlier builds stored repayments as `transfer`, cashback under category
  // `reward` and left `kind` NULL on seeded rows, which is why the same row
  // could read as "Top-up" in one screen and "Paid you back" in another.
  try {
    const res = db.exec('SELECT id, name, amount, category, status, kind FROM transactions');
    if (res.length) {
      const columns = res[0].columns;
      for (const values of res[0].values) {
        const row: Record<string, SqlValue> = {};
        columns.forEach((column, index) => { row[column] = values[index]; });
        const type = classifyTransaction(row);
        if (row.kind !== type) {
          db.run('UPDATE transactions SET kind = ? WHERE id = ?', [type, row.id as SqlValue]);
        }
      }
    }
  } catch (e) {
    console.warn('transaction kind normalisation skipped:', e);
  }

  try {
    const cols = db.exec('PRAGMA table_info(merchants)');
    const names = cols.length ? cols[0].values.map(v => String(v[1])) : [];
    if (!names.includes('xp_rate')) {
      db.run('ALTER TABLE merchants ADD COLUMN xp_rate REAL DEFAULT 10');
    }
    if (!names.includes('xp_bonus')) {
      db.run('ALTER TABLE merchants ADD COLUMN xp_bonus REAL DEFAULT 1');
    }
  } catch (e) {
    console.warn('merchants XP migration skipped:', e);
  }

  try {
    const cols = db.exec('PRAGMA table_info(reminders)');
    const names = cols.length ? cols[0].values.map(v => String(v[1])) : [];
    if (!names.includes('thank_you')) {
      db.run('ALTER TABLE reminders ADD COLUMN thank_you TEXT');
    }
  } catch (e) {
    console.warn('reminders.thank_you migration skipped:', e);
  }

  try {
    const cols = db.exec('PRAGMA table_info(users)');
    const names = cols.length ? cols[0].values.map(v => String(v[1])) : [];
    if (!names.includes('login_id')) {
      db.run('ALTER TABLE users ADD COLUMN login_id TEXT');
    }
    if (!names.includes('password')) {
      db.run('ALTER TABLE users ADD COLUMN password TEXT');
    }
    if (!names.includes('email')) {
      db.run('ALTER TABLE users ADD COLUMN email TEXT');
    }
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_id
      ON users(login_id) WHERE login_id IS NOT NULL`);
  } catch (e) {
    console.warn('users login migration skipped:', e);
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!db) return;
    saveBytes(db.export()).catch(err => console.error('DB save failed:', err));
    void syncDatabaseToDisk();
  }, 150);
}

// Writes the database to storage IMMEDIATELY and waits for it to finish.
// Use before a page reload/navigation so pending changes aren't lost to the
// 150ms debounce in scheduleSave().
export async function flushSave(): Promise<void> {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!db) return;
  await saveBytes(db.export());
  void syncDatabaseToDisk();
}

function requireDb(): Database {
  if (!db) throw new Error('Database not ready. Call initDatabase() before use.');
  return db;
}

export function isDatabaseReady(): boolean {
  return db !== null;
}

type Row = Record<string, SqlValue>;

export function query(sql: string, params: SqlValue[] = []): Row[] {
  if (!db) {
    console.warn('query() called before database was ready — returning [].');
    return [];
  }
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Row[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function queryOne(sql: string, params: SqlValue[] = []): Row | null {
  const rows = query(sql, params);
  return rows.length ? rows[0] : null;
}

export function run(sql: string, params: SqlValue[] = []): void {
  requireDb().run(sql, params);
  scheduleSave();
}

export function lastInsertId(): number {
  const row = queryOne('SELECT last_insert_rowid() AS id');
  return row ? Number(row.id) : 0;
}

// ── Live sync: mirror the real database to files on disk while `npm run dev` ──
// runs (handled by the dev-server endpoint in vite.config.ts). Nothing here is
// hard-coded: it exports whatever the app actually has right now, so anything
// added/edited/deleted in the app is reflected in database/nets.sqlite (and the
// readable per-table files). No-op outside dev or if the endpoint is absent.

export function listTables(): string[] {
  return query(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  ).map(row => String(row.name));
}

function tableColumnNames(table: string): string[] {
  if (!listTables().includes(table)) return [];
  return query(`PRAGMA table_info(${table})`).map(row => String(row.name));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

let diskSyncInFlight = false;
async function syncDatabaseToDisk(): Promise<void> {
  const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;
  if (!isDev || !db || typeof fetch === 'undefined' || diskSyncInFlight) return;
  diskSyncInFlight = true;
  try {
    const snapshot = listTables().map(name => {
      const columns = tableColumnNames(name);
      const rows = query(`SELECT * FROM ${name}`).map(row => columns.map(col => row[col] ?? null));
      return { name, columns, rows };
    });
    await fetch('/__db/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sqlite: bytesToBase64(db.export()), snapshot }),
    });
  } catch {
    // dev convenience only — ignore (endpoint absent, offline, production build)
  } finally {
    diskSyncInFlight = false;
  }
}

// Force an immediate write of the on-disk files (e.g. right after seeding).
export function syncDatabaseFilesNow(): void {
  void syncDatabaseToDisk();
}

export function resetDatabase(): void {
  const d = requireDb();
  d.run(`
    DELETE FROM notifications;
    DELETE FROM notification_preferences;
    DELETE FROM payment_methods;
    DELETE FROM reminders;
    DELETE FROM transactions;
    DELETE FROM redemptions;
    DELETE FROM saved_deals;
    DELETE FROM hangout_votes;
    DELETE FROM hangouts;
    DELETE FROM saved_activities;
    DELETE FROM reward_redemptions;
    DELETE FROM savings_goals;
    DELETE FROM budgets;
    DELETE FROM processed_payments;
    DELETE FROM deals;
    DELETE FROM merchants;
    DELETE FROM activities;
    UPDATE users SET
      reminder_frequency = 'daily',
      auto_reminders_enabled = 1,
      last_auto_reminder_sent = NULL,
      custom_reminder_hours = NULL,
      custom_reminder_minutes = NULL;
    DELETE FROM app_meta;
  `);
  scheduleSave();
}

// After a manual "Clear All Data", set a flag so the automatic transaction seed
// does NOT re-populate on reload — the user asked for a genuine fresh start.
export function markUserClearedFresh(): void {
  const d = requireDb();
  d.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('user-cleared-fresh', 'true')");
  d.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('has-seeded-txns', 'true')");
  d.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('has-seeded', 'true')");
  d.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('deal-counts-reconciled', 'true')");
  scheduleSave();
}
