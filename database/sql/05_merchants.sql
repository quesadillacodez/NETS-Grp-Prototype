-- ============================================================
--  Table: merchants
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 05_merchants.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS merchants (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  amount     REAL NOT NULL,
  reference  TEXT,
  active     INTEGER DEFAULT 1,
  xp_rate    REAL DEFAULT 10,
  xp_bonus   REAL DEFAULT 1
);

-- View the table (rows appear once the app adds data):
SELECT * FROM merchants;
