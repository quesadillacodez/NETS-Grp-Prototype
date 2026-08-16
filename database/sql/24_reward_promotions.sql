-- ============================================================
--  Table: reward_promotions
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  A merchant's paid placement in the rewards store: which reward,
--  which slot, the weekly rate and the window it runs for.
--
--  Note what is NOT stored here. The fee owed is derived from the
--  window and the rate, and the redemptions a placement drove are
--  counted from reward_redemptions inside that window — so a
--  merchant's report can never disagree with the booking or with
--  the redemption ledger.
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 24_reward_promotions.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS reward_promotions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reward_id   INTEGER NOT NULL,
  title       TEXT NOT NULL,
  merchant    TEXT NOT NULL,
  placement   TEXT NOT NULL DEFAULT 'featured',
  weekly_fee  REAL NOT NULL DEFAULT 0,
  starts_at   INTEGER NOT NULL,
  ends_at     INTEGER NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_promotions_window ON reward_promotions(starts_at, ends_at);

-- View the table (rows appear once the app adds data):
SELECT * FROM reward_promotions;
