import { Pool } from 'pg';

/**
 * PostgreSQL schema migration.
 * Idempotent — safe to run on every server startup.
 *
 * v1: products, sales_records, stock_movements, purchase_orders
 * v2: owners, shops; shop_id FK added to all inventory tables (nullable for legacy rows)
 */
export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── v1: core inventory tables ─────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        current_stock INTEGER NOT NULL DEFAULT 0,
        supplier_lead_time_days INTEGER NOT NULL,
        safety_stock INTEGER NOT NULL DEFAULT 0,
        target_coverage_days INTEGER NOT NULL,
        is_sample INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_records (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sale_date TEXT NOT NULL,
        units_sold INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        CONSTRAINT sales_records_product_date_unique UNIQUE (product_id, sale_date)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        movement_date TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        type TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        created_at TEXT NOT NULL,
        received_at TEXT,
        note TEXT
      )
    `);

    // ── v1 indexes ────────────────────────────────────────────────────────────

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_records_product_date
      ON sales_records(product_id, sale_date)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_movements_product_date
      ON stock_movements(product_id, movement_date)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_orders_status
      ON purchase_orders(status)
    `);

    // ── v2: owners and shops ──────────────────────────────────────────────────

    // owners: one row per Supabase Auth user who has completed onboarding.
    // auth_user_id is the Supabase JWT `sub` claim (UUID).
    await client.query(`
      CREATE TABLE IF NOT EXISTS owners (
        id          SERIAL PRIMARY KEY,
        auth_user_id TEXT NOT NULL UNIQUE,  -- Supabase auth UUID (JWT sub)
        owner_name  TEXT NOT NULL,
        created_at  TEXT NOT NULL
      )
    `);

    // shops: one shop per owner for this version.
    await client.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id         SERIAL PRIMARY KEY,
        owner_id   INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
        shop_name  TEXT NOT NULL,
        created_at TEXT NOT NULL,
        CONSTRAINT shops_owner_unique UNIQUE (owner_id)  -- one shop per owner
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_owners_auth_user_id ON owners(auth_user_id)
    `);

    // ── v2: add shop_id to inventory tables (nullable = legacy rows unassigned) ─

    // products.shop_id
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE products ADD COLUMN shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);

    // sales_records.shop_id (denormalised for fast scoping; kept consistent by app logic)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE sales_records ADD COLUMN shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);

    // stock_movements.shop_id
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE stock_movements ADD COLUMN shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);

    // purchase_orders.shop_id
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE purchase_orders ADD COLUMN shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);

    // Indexes for shop-scoped queries
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_shop_id        ON products(shop_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_records_shop_id   ON sales_records(shop_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_id ON stock_movements(shop_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_purchase_orders_shop_id ON purchase_orders(shop_id)`);

    await client.query('COMMIT');
    console.log('Database migrations completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
