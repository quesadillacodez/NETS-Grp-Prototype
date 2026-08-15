-- ============================================================
--  Table: processed_payments
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 17_processed_payments.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS processed_payments (
  payment_id   TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL
);

-- View the table (rows appear once the app adds data):
SELECT * FROM processed_payments;
