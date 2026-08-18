-- ============================================================
--  Table: reward_redemptions
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 16_reward_redemptions.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  reward_id   INTEGER NOT NULL,
  title       TEXT NOT NULL,
  merchant    TEXT NOT NULL,
  xp_cost     INTEGER NOT NULL,
  ref_code    TEXT NOT NULL,
  redeemed_at INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- View the table (rows appear once the app adds data):
SELECT * FROM reward_redemptions;
