import type { Database } from 'better-sqlite3';

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      name                   TEXT    NOT NULL,
      sku                    TEXT    NOT NULL UNIQUE,
      current_stock          INTEGER NOT NULL DEFAULT 0,
      supplier_lead_time_days INTEGER NOT NULL,
      safety_stock           INTEGER NOT NULL DEFAULT 0,
      target_coverage_days   INTEGER NOT NULL,
      is_sample              INTEGER NOT NULL DEFAULT 0,
      created_at             TEXT    NOT NULL,
      updated_at             TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sale_date   TEXT    NOT NULL,
      units_sold  INTEGER NOT NULL,
      created_at  TEXT    NOT NULL,
      UNIQUE(product_id, sale_date)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      movement_date TEXT    NOT NULL,
      quantity      INTEGER NOT NULL,
      type          TEXT    NOT NULL,
      note          TEXT,
      created_at    TEXT    NOT NULL
    );
  `);
}
