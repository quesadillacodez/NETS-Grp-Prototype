-- ============================================================
--  run_all.sql — creates the full schema (all tables), no data.
--  Data is populated by the app at runtime, never hard-coded.
-- ============================================================
PRAGMA foreign_keys = OFF;

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS users (
  id                        TEXT PRIMARY KEY,
  login_id                  TEXT UNIQUE,
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

-- ---------- transactions ----------
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

-- ---------- reminders ----------
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

-- ---------- notifications ----------
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
  banner_dismissed INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- merchants ----------
CREATE TABLE IF NOT EXISTS merchants (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  amount     REAL NOT NULL,
  reference  TEXT,
  active     INTEGER DEFAULT 1,
  xp_rate    REAL DEFAULT 10,
  xp_bonus   REAL DEFAULT 1
);

-- ---------- activities ----------
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

-- ---------- app_meta ----------
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ---------- savings_goals ----------
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

-- ---------- budgets ----------
CREATE TABLE IF NOT EXISTS budgets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,
  category       TEXT NOT NULL,
  monthly_limit  REAL NOT NULL
);

-- ---------- deals ----------
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

-- ---------- redemptions ----------
CREATE TABLE IF NOT EXISTS redemptions (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  TEXT NOT NULL,
  deal_id  INTEGER NOT NULL,
  ref_code TEXT NOT NULL,
  date     TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- saved_deals ----------
CREATE TABLE IF NOT EXISTS saved_deals (
  user_id  TEXT NOT NULL,
  deal_id  INTEGER NOT NULL,
  PRIMARY KEY (user_id, deal_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- saved_activities ----------
CREATE TABLE IF NOT EXISTS saved_activities (
  user_id     TEXT NOT NULL,
  activity_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, activity_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- hangouts ----------
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

-- ---------- hangout_votes ----------
CREATE TABLE IF NOT EXISTS hangout_votes (
  hangout_id  INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  activity_id INTEGER NOT NULL,
  PRIMARY KEY (hangout_id, user_id),
  FOREIGN KEY (hangout_id) REFERENCES hangouts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- reward_redemptions ----------
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

-- ---------- processed_payments ----------
CREATE TABLE IF NOT EXISTS processed_payments (
  payment_id   TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL
);

-- ---------- reminder_settings ----------
CREATE TABLE IF NOT EXISTS reminder_settings (
  user_id                 TEXT PRIMARY KEY,
  reminder_frequency      TEXT,
  auto_reminders_enabled  INTEGER,
  custom_reminder_hours   INTEGER,
  custom_reminder_minutes INTEGER,
  updated_at              INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- insights ----------
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
  reliability_score      REAL,
  updated_at             INTEGER,
  PRIMARY KEY (owner_user_id, person_user_id)
);

-- ---------- contact_groups ----------
CREATE TABLE IF NOT EXISTS contact_groups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- contact_group_members ----------
CREATE TABLE IF NOT EXISTS contact_group_members (
  group_id INTEGER NOT NULL,
  user_id  TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- cards ----------
CREATE TABLE IF NOT EXISTS cards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  last_four  TEXT NOT NULL,
  balance    REAL NOT NULL DEFAULT 0,
  frozen     INTEGER NOT NULL DEFAULT 0,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- user_preferences ----------
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id    TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT,
  updated_at INTEGER,
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
