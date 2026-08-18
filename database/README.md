# database/ — the SQL tables (live, not hard-coded)

The app runs SQLite in the browser (sql.js + IndexedDB). While `npm run dev` is
running, the app writes its **real, current** data to this folder after every
change — so anything you add, edit, or delete in the app shows up here. No rows
are hard-coded.

## Files

| File | What it is |
| --- | --- |
| `nets.sqlite` | The real SQLite database. Ships empty (schema only); fills with live data as you use the app. Open it in DB Browser for SQLite or the VS Code SQLite extension. |
| `snapshot.md` | Every table as a readable grid (columns + current rows). Appears after the app runs. |
| `tables/<name>.csv` | One CSV per table, refreshed on every change. |
| `sql/NN_<table>.sql` | Schema-only definition of each table (no data). Run any one to (re)create that table. `run_all.sql` builds the whole schema. |

## See the data updating

1. Run `npm run dev` and use the app (log in, add a reminder, create a Hangout,
   make a payment).
2. Open `nets.sqlite` in DB Browser for SQLite (sqlitebrowser.org) or the VS Code
   "SQLite" / "SQLite Viewer" extension.
3. After you change something in the app, hit refresh in the viewer — the row is
   added / updated / removed automatically.

## Run a single table's SQL

Each `sql/NN_<table>.sql` is schema-only and runnable on its own (DB Browser →
Execute SQL, or the VS Code SQLite extension → Run Query). It creates the empty
table and SELECTs it; rows appear once the app has data.

Tables are connected by foreign keys (e.g. `reminders.to_user_id` → `users.id`,
`hangout_votes.hangout_id` → `hangouts.id`).
