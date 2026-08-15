-- ============================================================
--  Table: hangouts
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 14_hangouts.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

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

-- View the table (rows appear once the app adds data):
SELECT * FROM hangouts;
