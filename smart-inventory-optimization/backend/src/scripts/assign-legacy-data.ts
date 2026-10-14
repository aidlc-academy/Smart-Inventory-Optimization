/**
 * Admin-only one-time script: assign unscoped (legacy) inventory records to a verified owner.
 *
 * Usage:
 *   OWNER_UUID=<supabase-auth-uuid> npm run assign-legacy
 *
 * The OWNER_UUID must match an existing row in the `owners` table
 * (i.e. the target user must have completed onboarding first).
 *
 * This script NEVER runs automatically. It does NOT accept the UUID
 * from HTTP clients. It must be run by a human operator with .env access.
 *
 * Only unassigned rows (shop_id IS NULL) are touched — already-assigned
 * rows and the owner's shop rows are never overwritten.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const OWNER_UUID = process.env.OWNER_UUID;
if (!OWNER_UUID || !/^[0-9a-f-]{36}$/i.test(OWNER_UUID)) {
  console.error('ERROR: OWNER_UUID env var is required and must be a valid UUID.');
  console.error('Usage: OWNER_UUID=<uuid> npm run assign-legacy');
  process.exit(1);
}

const CA_PATH = path.resolve(__dirname, '../../certs/supabase-ca.crt');
const connStr = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_PATH).toString() } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve owner and shop — must already exist
    const ownerRow = await client.query<{ owner_id: number; shop_id: number; owner_name: string }>(
      `SELECT o.id AS owner_id, s.id AS shop_id, o.owner_name
       FROM owners o JOIN shops s ON s.owner_id = o.id WHERE o.auth_user_id = $1`,
      [OWNER_UUID]
    );
    if (ownerRow.rows.length === 0) {
      console.error(`No owner found for UUID ${OWNER_UUID}. The user must complete onboarding first.`);
      process.exit(1);
    }
    const { shop_id: shopId, owner_name: ownerName } = ownerRow.rows[0];
    console.log(`Assigning legacy data to: ${ownerName} (shop_id=${shopId})`);

    // Count unassigned rows
    const counts = await client.query<{ t: string; n: string }>(
      `SELECT 'products'        AS t, COUNT(*) AS n FROM products         WHERE shop_id IS NULL
       UNION ALL
       SELECT 'sales_records',          COUNT(*) FROM sales_records        WHERE shop_id IS NULL
       UNION ALL
       SELECT 'stock_movements',        COUNT(*) FROM stock_movements       WHERE shop_id IS NULL
       UNION ALL
       SELECT 'purchase_orders',        COUNT(*) FROM purchase_orders       WHERE shop_id IS NULL`
    );
    counts.rows.forEach(r => console.log(`  ${r.t}: ${r.n} unassigned rows`));

    const total = counts.rows.reduce((s, r) => s + parseInt(r.n, 10), 0);
    if (total === 0) { console.log('No unassigned data to assign.'); await client.query('ROLLBACK'); return; }

    // Assign all unassigned rows
    await client.query('UPDATE products         SET shop_id=$1 WHERE shop_id IS NULL', [shopId]);
    await client.query('UPDATE sales_records    SET shop_id=$1 WHERE shop_id IS NULL', [shopId]);
    await client.query('UPDATE stock_movements  SET shop_id=$1 WHERE shop_id IS NULL', [shopId]);
    await client.query('UPDATE purchase_orders  SET shop_id=$1 WHERE shop_id IS NULL', [shopId]);

    await client.query('COMMIT');
    console.log(`Done. ${total} rows assigned to shop_id=${shopId}.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Assignment failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
