-- ============================================================
--  Table: hangout_votes
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 15_hangout_votes.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS hangout_votes (
  hangout_id  INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  activity_id INTEGER NOT NULL,
  PRIMARY KEY (hangout_id, user_id),
  FOREIGN KEY (hangout_id) REFERENCES hangouts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- View the table (rows appear once the app adds data):
SELECT * FROM hangout_votes;
