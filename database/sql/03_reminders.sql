-- ============================================================
--  Table: reminders
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 03_reminders.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

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

-- View the table (rows appear once the app adds data):
SELECT * FROM reminders;
