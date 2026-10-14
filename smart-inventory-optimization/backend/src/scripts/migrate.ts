/**
 * Explicit schema migration runner.
 * Run manually with: npm run migrate
 *
 * Never runs automatically on server startup.
 * Uses the same verified TLS pool as the application.
 */
import 'dotenv/config';
import pool, { closePool } from '../db/database';
import { runMigrations } from '../db/migrations';

async function main() {
  console.log('Running schema migrations...');
  try {
    await runMigrations(pool);
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
