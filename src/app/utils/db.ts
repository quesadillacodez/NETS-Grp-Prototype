import initSqlJs, { type Database, type SqlValue } from 'sql.js';

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
  name                      TEXT NOT NULL,
  avatar                    TEXT NOT NULL,
  phone                     TEXT NOT NULL,
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS merchants (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  amount         REAL NOT NULL,
  reference      TEXT,
  active         INTEGER DEFAULT 1,
  xp_rate        REAL DEFAULT 10,
  xp_bonus       REAL DEFAULT 1,
  campaign_start INTEGER,
  campaign_end   INTEGER,
  aliases        TEXT
);

CREATE TABLE IF NOT EXISTS daily_logins (
  user_id TEXT NOT NULL,
  day     TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user
ON reward_redemptions(user_id);

CREATE TABLE IF NOT EXISTS processed_payments (
  payment_id   TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL
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

  try {
    const cols = db.exec('PRAGMA table_info(merchants)');
    const names = cols.length ? cols[0].values.map(v => String(v[1])) : [];
    if (!names.includes('xp_rate')) {
      db.run('ALTER TABLE merchants ADD COLUMN xp_rate REAL DEFAULT 10');
    }
    if (!names.includes('xp_bonus')) {
      db.run('ALTER TABLE merchants ADD COLUMN xp_bonus REAL DEFAULT 1');
    }
    if (!names.includes('campaign_start')) {
      db.run('ALTER TABLE merchants ADD COLUMN campaign_start INTEGER');
    }
    if (!names.includes('campaign_end')) {
      db.run('ALTER TABLE merchants ADD COLUMN campaign_end INTEGER');
    }
    if (!names.includes('aliases')) {
      db.run('ALTER TABLE merchants ADD COLUMN aliases TEXT');
      // Seed the aliases that the old substring matching used to cover, so XP
      // on existing transactions does not change under the stricter matching.
      db.run("UPDATE merchants SET aliases = 'Kopitiam Food Court' WHERE id = 'kopi'");
      db.run("UPDATE merchants SET aliases = 'FairPrice Xtra' WHERE id = 'grocer'");
    }
  } catch (e) {
    console.warn('merchants XP migration skipped:', e);
  }

  try {
    db.run(`CREATE TABLE IF NOT EXISTS daily_logins (
      user_id TEXT NOT NULL,
      day     TEXT NOT NULL,
      at      INTEGER NOT NULL,
      PRIMARY KEY (user_id, day)
    )`);
  } catch (e) {
    console.warn('daily_logins migration skipped:', e);
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!db) return;
    saveBytes(db.export()).catch(err => console.error('DB save failed:', err));
  }, 150);
}

// Writes the database to storage IMMEDIATELY and waits for it to finish.
// Use before a page reload/navigation so pending changes aren't lost to the
// 150ms debounce in scheduleSave().
export async function flushSave(): Promise<void> {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!db) return;
  await saveBytes(db.export());
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

export function resetDatabase(): void {
  const d = requireDb();
  d.run(`
    DELETE FROM notifications;
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
