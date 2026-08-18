-- ============================================================
--  Table: transactions
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 02_transactions.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

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

-- View the table (rows appear once the app adds data):
SELECT * FROM transactions;
