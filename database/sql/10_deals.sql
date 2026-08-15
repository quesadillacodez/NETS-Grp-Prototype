-- ============================================================
--  Table: deals
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 10_deals.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

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

-- View the table (rows appear once the app adds data):
SELECT * FROM deals;
