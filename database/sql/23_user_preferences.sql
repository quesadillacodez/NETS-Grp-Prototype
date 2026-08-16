-- ============================================================
--  Table: user_preferences
--  Schema only — NO hard-coded rows. Real data is written by the
--  running app (add / edit / delete all sync automatically into
--  database/nets.sqlite while `npm run dev` is running).
--
--  Per-account app preferences that do not have a settings screen of
--  their own. One key so far: `quick-actions`, holding the JSON list of
--  shortcut ids the customer chose for the Home screen.
--
--  Run this file to (re)create the empty table and view it:
--    * DB Browser for SQLite: open nets.sqlite -> Execute SQL -> paste -> Run
--    * VS Code "SQLite" extension: Ctrl+Shift+P -> SQLite: Run Query
--    * Command line: sqlite3 demo.db < 23_user_preferences.sql
-- ============================================================
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id    TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT,
  updated_at INTEGER,
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- View the table (rows appear once the app adds data):
SELECT * FROM user_preferences;
