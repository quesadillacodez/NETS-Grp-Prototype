-- ============================================================
--  Table: activities
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 06_activities.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

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

-- View the table (rows appear once the app adds data):
SELECT * FROM activities;
