-- ============================================================
--  Table: cards
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  The NETS cards shown in the Home carousel. Each account is seeded
--  with a vCashCard, a NETS Prepaid Card and a Motoring CashCard the
--  first time the carousel is read.
--
--  The vCashCard is the wallet itself, so its `balance` is unused and
--  ignored on read: the wallet balance is the opening balance plus the
--  sum over `transactions`, and has exactly one definition. Only the
--  prepaid and motoring cards really hold their own float.
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 22_cards.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS cards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  last_four  TEXT NOT NULL,
  balance    REAL NOT NULL DEFAULT 0,
  frozen     INTEGER NOT NULL DEFAULT 0,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);

-- View the table (rows appear once the app adds data):
SELECT * FROM cards;
