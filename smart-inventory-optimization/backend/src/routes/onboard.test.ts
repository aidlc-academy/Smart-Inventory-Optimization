/**
 * Onboarding + shop isolation integration tests.
 *
 * Requires TEST_DATABASE_URL pointing to an isolated test PostgreSQL database.
 * These tests are SKIPPED (not failed) if TEST_DATABASE_URL is not set,
 * so CI without a test DB does not break.
 *
 * Never runs against the live Supabase database.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const TEST_DB = process.env.TEST_DATABASE_URL;
const TEST_SECRET = 'test-jwt-secret-for-unit-tests-only';
process.env.SUPABASE_JWT_SECRET = TEST_SECRET;

const describeIfDb = TEST_DB ? describe : describe.skip;

function makeToken(sub: string) {
  return jwt.sign({ sub, role: 'authenticated', aud: 'authenticated' }, TEST_SECRET, {
    algorithm: 'HS256', expiresIn: '1h',
  });
}

// We mock the database module to use the test pool
jest.mock('../db/database', () => {
  const testPool = new (require('pg').Pool)({
    connectionString: process.env.TEST_DATABASE_URL || '',
    ssl: false,
    max: 5,
  });
  return {
    pool: testPool,
    query:    (sql: string, p?: any[]) => testPool.query(sql, p).then((r: any) => r.rows),
    queryOne: (sql: string, p?: any[]) => testPool.query(sql, p).then((r: any) => r.rows[0] ?? null),
    execute:  (sql: string, p?: any[]) => testPool.query(sql, p).then((r: any) => ({ rowCount: r.rowCount ?? 0 })),
    getClient: () => testPool.connect(),
    closePool: () => testPool.end(),
    default: testPool,
  };
});

import onboardRouter from './onboard';
import productsRouter from './products';
import { runMigrations } from '../db/migrations';

let pool: Pool;
let app: express.Application;

beforeAll(async () => {
  if (!TEST_DB) return;
  pool = (require('../db/database') as any).pool as Pool;
  await runMigrations(pool);

  app = express();
  app.use(express.json());
  app.use('/api/v1/onboard', onboardRouter);
  app.use('/api/v1/products', productsRouter);
});

afterAll(async () => {
  if (!TEST_DB) return;
  await pool.end();
});

beforeEach(async () => {
  if (!TEST_DB) return;
  // Clean between tests
  await pool.query('DELETE FROM purchase_orders');
  await pool.query('DELETE FROM stock_movements');
  await pool.query('DELETE FROM sales_records');
  await pool.query('DELETE FROM products');
  await pool.query('DELETE FROM shops');
  await pool.query('DELETE FROM owners');
  await pool.query("SELECT setval('owners_id_seq',1,false)");
  await pool.query("SELECT setval('shops_id_seq',1,false)");
  await pool.query("SELECT setval('products_id_seq',1,false)");
});

describeIfDb('POST /api/v1/onboard', () => {
  test('creates owner and shop for a new user (201)', async () => {
    const token = makeToken('user-a');
    const res = await request(app).post('/api/v1/onboard')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner_name: 'Alice', shop_name: 'Alice Store' });
    expect(res.status).toBe(201);
    expect(res.body.owner_name).toBe('Alice');
    expect(res.body.shop_name).toBe('Alice Store');
    expect(res.body.shop_id).toBeGreaterThan(0);
  });

  test('repeated onboarding returns 200 with the same IDs (idempotent)', async () => {
    const token = makeToken('user-b');
    const first  = await request(app).post('/api/v1/onboard').set('Authorization', `Bearer ${token}`)
      .send({ owner_name: 'Bob', shop_name: 'Bob Store' });
    const second = await request(app).post('/api/v1/onboard').set('Authorization', `Bearer ${token}`)
      .send({ owner_name: 'Bob Changed', shop_name: 'Other Name' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.shop_id).toBe(first.body.shop_id);
    expect(second.body.owner_name).toBe('Bob'); // original name preserved
  });

  test('rejects missing owner_name (400)', async () => {
    const res = await request(app).post('/api/v1/onboard')
      .set('Authorization', `Bearer ${makeToken('user-c')}`)
      .send({ shop_name: 'Shop C' });
    expect(res.status).toBe(400);
  });

  test('rejects missing Authorization header (401)', async () => {
    const res = await request(app).post('/api/v1/onboard').send({ owner_name: 'X', shop_name: 'Y' });
    expect(res.status).toBe(401);
  });
});

describeIfDb('Cross-shop product isolation', () => {
  test('owner A cannot read owner B products', async () => {
    // Onboard A and B
    const tokenA = makeToken('user-iso-a');
    const tokenB = makeToken('user-iso-b');
    await request(app).post('/api/v1/onboard').set('Authorization', `Bearer ${tokenA}`).send({ owner_name: 'A', shop_name: 'Shop A' });
    await request(app).post('/api/v1/onboard').set('Authorization', `Bearer ${tokenB}`).send({ owner_name: 'B', shop_name: 'Shop B' });

    // A creates a product
    await request(app).post('/api/v1/products').set('Authorization', `Bearer ${tokenA}`).send({
      name: 'A Product', sku: 'SKU-A-1', current_stock: 50,
      supplier_lead_time_days: 3, safety_stock: 5, target_coverage_days: 14,
    });

    // B lists products — should see 0
    const res = await request(app).get('/api/v1/products').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('owner A cannot GET a product belonging to owner B by ID', async () => {
    const tokenA = makeToken('user-xget-a');
    const tokenB = makeToken('user-xget-b');
    await request(app).post('/api/v1/onboard').set('Authorization', `Bearer ${tokenA}`).send({ owner_name: 'A2', shop_name: 'Shop A2' });
    await request(app).post('/api/v1/onboard').set('Authorization', `Bearer ${tokenB}`).send({ owner_name: 'B2', shop_name: 'Shop B2' });

    // B creates a product
    const createRes = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${tokenB}`).send({
      name: 'B Product', sku: 'SKU-B-2', current_stock: 10,
      supplier_lead_time_days: 2, safety_stock: 2, target_coverage_days: 7,
    });
    const bProductId = createRes.body.id;

    // A tries to GET B's product by ID — must 404
    const res = await request(app).get(`/api/v1/products/${bProductId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  test('unauthenticated product list returns 401', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(401);
  });

  test('authenticated but not onboarded returns 403', async () => {
    const res = await request(app).get('/api/v1/products')
      .set('Authorization', `Bearer ${makeToken('user-no-shop')}`);
    expect(res.status).toBe(403);
  });
});
