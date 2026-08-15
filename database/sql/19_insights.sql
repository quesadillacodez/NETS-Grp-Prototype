-- ============================================================
--  Table: insights
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 19_insights.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

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

-- View the table (rows appear once the app adds data):
SELECT * FROM insights;
