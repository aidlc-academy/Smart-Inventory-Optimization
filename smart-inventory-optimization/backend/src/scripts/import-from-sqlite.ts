/**
 * One-time SQLite to PostgreSQL data importer.
 * 
 * Usage:
 *   1. Ensure PostgreSQL database is running and DATABASE_URL is set
 *   2. Run: npm run import-sqlite
 * 
 * This script:
 *   - Reads from SQLite without modifying it
 *   - Checks that target tables are empty (refuses to overwrite)
 *   - Preserves all record IDs
 *   - Resets PostgreSQL sequences
 *   - Verifies row counts and stock values
 *   - Does NOT automatically run on server startup
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Resolve paths relative to this file so they work in both src/ (dev) and dist/ (compiled)
const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const SQLITE_DB_PATH = path.join(BACKEND_ROOT, 'inventory.db');
const CA_CERT_PATH = path.join(BACKEND_ROOT, 'certs', 'supabase-ca.crt');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

if (!fs.existsSync(CA_CERT_PATH)) {
  console.error('ERROR: CA certificate not found: ' + CA_CERT_PATH);
  process.exit(1);
}

const caCert = fs.readFileSync(CA_CERT_PATH).toString();
// Strip sslmode so it doesn't override the ssl object
const connectionString = DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');

async function importData() {
  console.log('=== SQLite to PostgreSQL Data Import ===\n');

  // Open SQLite database (read-only mode to ensure we don't modify it)
  console.log('1. Opening SQLite database...');
  const sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });
  console.log(`   ✓ Opened: ${SQLITE_DB_PATH}\n`);

  // Connect to PostgreSQL
  console.log('2. Connecting to PostgreSQL...');
  const pgPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true, ca: caCert },
  });

  const pgClient = await pgPool.connect();
  console.log('   ✓ Connected to PostgreSQL\n');

  try {
    // Check that target tables are empty
    console.log('3. Checking target tables are empty...');
    const tables = ['products', 'sales_records', 'stock_movements', 'purchase_orders'];
    
    for (const table of tables) {
      const result = await pgClient.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(result.rows[0].count, 10);
      if (count > 0) {
        console.error(`   ✗ ERROR: Table "${table}" is not empty (${count} rows).`);
        console.error('     Refusing to overwrite existing data.');
        console.error('     Empty the target database before importing.');
        process.exit(1);
      }
      console.log(`   ✓ ${table}: empty`);
    }
    console.log();

    // Read data from SQLite
    console.log('4. Reading data from SQLite...');
    const products = sqliteDb.prepare('SELECT * FROM products ORDER BY id').all() as any[];
    const salesRecords = sqliteDb.prepare('SELECT * FROM sales_records ORDER BY id').all() as any[];
    const stockMovements = sqliteDb.prepare('SELECT * FROM stock_movements ORDER BY id').all() as any[];
    const purchaseOrders = sqliteDb.prepare('SELECT * FROM purchase_orders ORDER BY id').all() as any[];
    
    console.log(`   ✓ Products: ${products.length}`);
    console.log(`   ✓ Sales records: ${salesRecords.length}`);
    console.log(`   ✓ Stock movements: ${stockMovements.length}`);
    console.log(`   ✓ Purchase orders: ${purchaseOrders.length}\n`);

    if (products.length === 0) {
      console.log('   No data to import. Exiting.');
      return;
    }

    // Begin transaction
    await pgClient.query('BEGIN');

    // Import products
    console.log('5. Importing products...');
    for (const p of products) {
      await pgClient.query(
        `INSERT INTO products (id, name, sku, current_stock, supplier_lead_time_days, safety_stock, target_coverage_days, is_sample, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [p.id, p.name, p.sku, p.current_stock, p.supplier_lead_time_days, p.safety_stock, p.target_coverage_days, p.is_sample, p.created_at, p.updated_at]
      );
    }
    console.log(`   ✓ Imported ${products.length} products\n`);

    // Import sales records
    console.log('6. Importing sales records...');
    for (const s of salesRecords) {
      await pgClient.query(
        `INSERT INTO sales_records (id, product_id, sale_date, units_sold, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [s.id, s.product_id, s.sale_date, s.units_sold, s.created_at]
      );
    }
    console.log(`   ✓ Imported ${salesRecords.length} sales records\n`);

    // Import stock movements
    console.log('7. Importing stock movements...');
    for (const m of stockMovements) {
      await pgClient.query(
        `INSERT INTO stock_movements (id, product_id, movement_date, quantity, type, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [m.id, m.product_id, m.movement_date, m.quantity, m.type, m.note, m.created_at]
      );
    }
    console.log(`   ✓ Imported ${stockMovements.length} stock movements\n`);

    // Import purchase orders
    console.log('8. Importing purchase orders...');
    for (const o of purchaseOrders) {
      await pgClient.query(
        `INSERT INTO purchase_orders (id, product_id, quantity, status, created_at, received_at, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [o.id, o.product_id, o.quantity, o.status, o.created_at, o.received_at, o.note]
      );
    }
    console.log(`   ✓ Imported ${purchaseOrders.length} purchase orders\n`);

    // Reset sequences
    console.log('9. Resetting PostgreSQL sequences...');
    if (products.length > 0) {
      const maxProductId = Math.max(...products.map(p => p.id));
      await pgClient.query(`SELECT setval('products_id_seq', $1)`, [maxProductId]);
      console.log(`   ✓ products_id_seq → ${maxProductId}`);
    }
    if (salesRecords.length > 0) {
      const maxSalesId = Math.max(...salesRecords.map(s => s.id));
      await pgClient.query(`SELECT setval('sales_records_id_seq', $1)`, [maxSalesId]);
      console.log(`   ✓ sales_records_id_seq → ${maxSalesId}`);
    }
    if (stockMovements.length > 0) {
      const maxMovementId = Math.max(...stockMovements.map(m => m.id));
      await pgClient.query(`SELECT setval('stock_movements_id_seq', $1)`, [maxMovementId]);
      console.log(`   ✓ stock_movements_id_seq → ${maxMovementId}`);
    }
    if (purchaseOrders.length > 0) {
      const maxOrderId = Math.max(...purchaseOrders.map(o => o.id));
      await pgClient.query(`SELECT setval('purchase_orders_id_seq', $1)`, [maxOrderId]);
      console.log(`   ✓ purchase_orders_id_seq → ${maxOrderId}`);
    }
    console.log();

    // Verify row counts
    console.log('10. Verifying row counts...');
    for (const table of tables) {
      const pgResult = await pgClient.query(`SELECT COUNT(*) as count FROM ${table}`);
      const pgCount = parseInt(pgResult.rows[0].count, 10);
      const sqliteCount = table === 'products' ? products.length 
        : table === 'sales_records' ? salesRecords.length
        : table === 'stock_movements' ? stockMovements.length
        : purchaseOrders.length;
      
      if (pgCount !== sqliteCount) {
        await pgClient.query('ROLLBACK');
        console.error(`   ✗ ERROR: Row count mismatch for ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);
        process.exit(1);
      }
      console.log(`   ✓ ${table}: ${pgCount} rows match`);
    }
    console.log();

    // Verify stock values
    console.log('11. Verifying stock values...');
    for (const p of products) {
      const pgResult = await pgClient.query('SELECT current_stock FROM products WHERE id = $1', [p.id]);
      if (pgResult.rows.length === 0) {
        await pgClient.query('ROLLBACK');
        console.error(`   ✗ ERROR: Product ID ${p.id} not found in PostgreSQL`);
        process.exit(1);
      }
      const pgStock = pgResult.rows[0].current_stock;
      if (pgStock !== p.current_stock) {
        await pgClient.query('ROLLBACK');
        console.error(`   ✗ ERROR: Stock mismatch for product ${p.name}: SQLite=${p.current_stock}, PostgreSQL=${pgStock}`);
        process.exit(1);
      }
    }
    console.log(`   ✓ All ${products.length} product stock values match\n`);

    // Commit transaction
    await pgClient.query('COMMIT');

    console.log('=== Import completed successfully! ===\n');
    console.log('Next steps:');
    console.log('  1. Verify data via API: GET /api/v1/products');
    console.log('  2. Check dashboard: GET /api/v1/dashboard');
    console.log('  3. Test a sale and restock operation');
    console.log('  4. Keep inventory.db as backup until you verify everything works');

  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('\n✗ Import failed:', err);
    throw err;
  } finally {
    pgClient.release();
    await pgPool.end();
    sqliteDb.close();
  }
}

importData().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
