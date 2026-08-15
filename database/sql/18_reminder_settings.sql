-- ============================================================
--  Table: reminder_settings
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 18_reminder_settings.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS reminder_settings (
  user_id                 TEXT PRIMARY KEY,
  reminder_frequency      TEXT,
  auto_reminders_enabled  INTEGER,
  custom_reminder_hours   INTEGER,
  custom_reminder_minutes INTEGER,
  updated_at              INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- View the table (rows appear once the app adds data):
SELECT * FROM reminder_settings;
