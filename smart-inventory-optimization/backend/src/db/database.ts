import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  console.error('Copy .env.example to .env and set your Supabase connection string.');
  process.exit(1);
}

// Resolve CA cert path relative to this file's location.
// In development:  src/db/database.ts  → __dirname = .../backend/src/db
// In compiled code: dist/db/database.js → __dirname = .../backend/dist/db
// Both cases: go up two levels from __dirname to reach backend/, then certs/.
const CA_CERT_PATH = path.resolve(__dirname, '..', '..', 'certs', 'supabase-ca.crt');

if (!fs.existsSync(CA_CERT_PATH)) {
  console.error('ERROR: Supabase CA certificate not found at: ' + CA_CERT_PATH);
  console.error('Download it from Supabase Dashboard → Project Settings → Database → SSL Configuration.');
  process.exit(1);
}

const caCert = fs.readFileSync(CA_CERT_PATH).toString();

// Strip any ?sslmode=... parameter from the connection string so the
// pg driver does not override the ssl object we pass below.
const connectionString = DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: true, // full chain + hostname verification
    ca: caCert,
  },
  connectionTimeoutMillis: 10000, // fail fast if Supabase pooler is unreachable
  idleTimeoutMillis: 30000,       // release idle connections before the pooler drops them
  max: 10,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected pg pool error:', err.message);
  process.exit(-1);
});

/** Execute a query and return all rows. */
export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

/** Execute a query and return the first row, or null. */
export async function queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
  const result = await pool.query(sql, params);
  return (result.rows[0] as T) ?? null;
}

/** Execute a statement and return the affected row count. */
export async function execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }> {
  const result = await pool.query(sql, params);
  return { rowCount: result.rowCount ?? 0 };
}

/** Check out a client for a manual transaction. MUST be released in a finally block. */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/** Drain and close the pool (used in tests and graceful shutdown). */
export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;
