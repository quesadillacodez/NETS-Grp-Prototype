-- ============================================================
--  Tables: merchant_items, item_sales
--  Schema only — NO hard-coded rows.
--
--  A merchant's menu, and the line items of what actually sold.
--  This is what turns "$6.80 at Kopitiam" into "one Nasi Lemak"
--  on the stall's own dashboard.
--
--  item_sales copies the item's name and price in rather than
--  joining, so renaming a dish or changing its price never
--  rewrites the history of what was sold for how much. The unique
--  index on (payment_id, item_id) makes recording a sale
--  idempotent, matching the guard on the transaction ledger.
-- ============================================================
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS merchant_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  name        TEXT NOT NULL,
  price       REAL NOT NULL,
  category    TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_merchant_items ON merchant_items(merchant_id);

CREATE TABLE IF NOT EXISTS item_sales (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id  TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  item_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  unit_price  REAL NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  user_id     TEXT,
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_sales_payment ON item_sales(payment_id, item_id);
CREATE INDEX IF NOT EXISTS idx_item_sales_merchant ON item_sales(merchant_id, created_at);

SELECT * FROM merchant_items;
SELECT * FROM item_sales;
