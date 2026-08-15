-- ============================================================
--  Table: users
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 01_users.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

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

-- View the table (rows appear once the app adds data):
SELECT * FROM users;
