-- ============================================================
--  Table: savings_goals
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 08_savings_goals.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

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

-- View the table (rows appear once the app adds data):
SELECT * FROM savings_goals;
