import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Use a test database URL or fall back to a local test database
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_inventory_test';

let pool: Pool;
let app: express.Application;

// Import routes after setting up the mock
import productsRouter from './products';
import salesRouter from './sales';
import { runMigrations } from '../db/migrations';

// Mock the database module
jest.mock('../db/database', () => {
  const { Pool } = require('pg');
  const testPool = new Pool({
    connectionString: TEST_DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: true } : false,
  });
  
  return {
    pool: testPool,
    query: (sql: string, params?: any[]) => testPool.query(sql, params).then((r: any) => r.rows),
    queryOne: (sql: string, params?: any[]) => testPool.query(sql, params).then((r: any) => r.rows[0] ?? null),
    execute: (sql: string, params?: any[]) => testPool.query(sql, params).then((r: any) => ({ rowCount: r.rowCount ?? 0 })),
    getClient: () => testPool.connect(),
    closePool: () => testPool.end(),
    default: testPool,
  };
});

beforeAll(async () => {
  const { pool: testPool } = require('../db/database');
  pool = testPool;
  
  // Run migrations
  await runMigrations(pool);

  // Build test app
  app = express();
  app.use(express.json());
  app.use('/api/v1/products', productsRouter);
  app.use('/api/v1/products/:id', salesRouter);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  // Clean up between tests
  await pool.query('DELETE FROM stock_movements');
  await pool.query('DELETE FROM sales_records');
  await pool.query('DELETE FROM purchase_orders');
  await pool.query('DELETE FROM products');
  
  // Reset sequences
  await pool.query("SELECT setval('products_id_seq', 1, false)");
  await pool.query("SELECT setval('sales_records_id_seq', 1, false)");
  await pool.query("SELECT setval('stock_movements_id_seq', 1, false)");
  await pool.query("SELECT setval('purchase_orders_id_seq', 1, false)");
});

function createTestProduct(overrides: Record<string, unknown> = {}) {
  const defaults = {
    name: 'Test Product',
    sku: `SKU-${Date.now()}-${Math.random()}`,
    current_stock: 100,
    supplier_lead_time_days: 5,
    safety_stock: 10,
    target_coverage_days: 14,
  };
  return { ...defaults, ...overrides };
}

describe('POST /api/v1/products/:id/sales', () => {
  test('records a sale and decrements stock by the sold quantity', async () => {
    // Create a product with stock=100
    const createRes = await request(app)
      .post('/api/v1/products')
      .send(createTestProduct({ current_stock: 100 }));
    expect(createRes.status).toBe(201);
    const productId = createRes.body.id;

    // Record a sale of 10 units
    const saleDate = new Date().toISOString().slice(0, 10);
    const saleRes = await request(app)
      .post(`/api/v1/products/${productId}/sales`)
      .send({ sale_date: saleDate, units_sold: 10 });
    expect(saleRes.status).toBe(200);

    // Verify stock decreased by 10
    const productRes = await request(app).get(`/api/v1/products/${productId}`);
    expect(productRes.body.current_stock).toBe(90);
  });

  test('rejects a sale that would reduce stock below zero (400)', async () => {
    // Create a product with stock=5
    const createRes = await request(app)
      .post('/api/v1/products')
      .send(createTestProduct({ current_stock: 5 }));
    expect(createRes.status).toBe(201);
    const productId = createRes.body.id;

    // Try to sell 10 units when only 5 in stock
    const saleDate = new Date().toISOString().slice(0, 10);
    const saleRes = await request(app)
      .post(`/api/v1/products/${productId}/sales`)
      .send({ sale_date: saleDate, units_sold: 10 });

    expect(saleRes.status).toBe(400);
    expect(saleRes.body.error).toContain('would reduce stock below zero');
    expect(saleRes.body.error).toContain('current: 5');
    expect(saleRes.body.error).toContain('requested: 10');
  });

  test('posting the same product+date twice results in one row and only delta stock adjustment', async () => {
    // Create a product with stock=100
    const createRes = await request(app)
      .post('/api/v1/products')
      .send(createTestProduct({ current_stock: 100 }));
    expect(createRes.status).toBe(201);
    const productId = createRes.body.id;
    const saleDate = new Date().toISOString().slice(0, 10);

    // First sale: 5 units (stock becomes 95)
    const first = await request(app)
      .post(`/api/v1/products/${productId}/sales`)
      .send({ sale_date: saleDate, units_sold: 5 });
    expect(first.status).toBe(200);
    const afterFirst = await request(app).get(`/api/v1/products/${productId}`);
    expect(afterFirst.body.current_stock).toBe(95);

    // Update same date: change to 8 units (delta = 8-5=3, stock becomes 92)
    const second = await request(app)
      .post(`/api/v1/products/${productId}/sales`)
      .send({ sale_date: saleDate, units_sold: 8 });
    expect(second.status).toBe(200);
    const afterSecond = await request(app).get(`/api/v1/products/${productId}`);
    expect(afterSecond.body.current_stock).toBe(92);

    // Confirm only one sales row for this product+date
    const salesResult = await pool.query(
      'SELECT * FROM sales_records WHERE product_id = $1 AND sale_date = $2',
      [productId, saleDate]
    );
    expect(salesResult.rows.length).toBe(1);
    expect(salesResult.rows[0].units_sold).toBe(8);
  });

  test('updating to fewer units than before increases stock (negative delta)', async () => {
    // Create a product with stock=100
    const createRes = await request(app)
      .post('/api/v1/products')
      .send(createTestProduct({ current_stock: 100 }));
    const productId = createRes.body.id;
    const saleDate = new Date().toISOString().slice(0, 10);

    // First sale: 10 units (stock becomes 90)
    await request(app)
      .post(`/api/v1/products/${productId}/sales`)
      .send({ sale_date: saleDate, units_sold: 10 });

    // Update to 3 units (delta = 3-10=-7, stock should increase by 7 → 97)
    await request(app)
      .post(`/api/v1/products/${productId}/sales`)
      .send({ sale_date: saleDate, units_sold: 3 });

    const productRes = await request(app).get(`/api/v1/products/${productId}`);
    expect(productRes.body.current_stock).toBe(97);
  });
});

describe('POST /api/v1/products/:id/restock', () => {
  test('increments stock by the restock quantity', async () => {
    // Create a product with stock=50
    const createRes = await request(app)
      .post('/api/v1/products')
      .send(createTestProduct({ current_stock: 50 }));
    expect(createRes.status).toBe(201);
    const productId = createRes.body.id;

    // Restock 30 units
    const restockRes = await request(app)
      .post(`/api/v1/products/${productId}/restock`)
      .send({ quantity: 30 });
    expect(restockRes.status).toBe(200);
    expect(restockRes.body.current_stock).toBe(80);

    // Confirm via GET as well
    const productRes = await request(app).get(`/api/v1/products/${productId}`);
    expect(productRes.body.current_stock).toBe(80);
  });

  test('restock creates a stock movement with positive quantity and type restock', async () => {
    const createRes = await request(app)
      .post('/api/v1/products')
      .send(createTestProduct({ current_stock: 20 }));
    const productId = createRes.body.id;

    await request(app)
      .post(`/api/v1/products/${productId}/restock`)
      .send({ quantity: 15, note: 'Weekly delivery' });

    const movementsResult = await pool.query(
      "SELECT * FROM stock_movements WHERE product_id = $1 AND type = 'restock'",
      [productId]
    );
    expect(movementsResult.rows.length).toBe(1);
    expect(movementsResult.rows[0].quantity).toBe(15);
    expect(movementsResult.rows[0].type).toBe('restock');
    expect(movementsResult.rows[0].note).toBe('Weekly delivery');
  });
});

describe('GET /api/v1/products/:id/movements', () => {
  test('returns correct movement entries with correct types and signed quantities', async () => {
    // Create a product
    const createRes = await request(app)
      .post('/api/v1/products')
      .send(createTestProduct({ current_stock: 100 }));
    const productId = createRes.body.id;
    const today = new Date().toISOString().slice(0, 10);

    // Record a sale
    await request(app)
      .post(`/api/v1/products/${productId}/sales`)
      .send({ sale_date: today, units_sold: 10 });

    // Record a restock
    await request(app)
      .post(`/api/v1/products/${productId}/restock`)
      .send({ quantity: 20 });

    // Fetch movements
    const movRes = await request(app).get(`/api/v1/products/${productId}/movements`);
    expect(movRes.status).toBe(200);

    const movements: Array<{ type: string; quantity: number }> = movRes.body;
    expect(movements.length).toBe(2);

    const restock = movements.find((m) => m.type === 'restock');
    const sale = movements.find((m) => m.type === 'sale');

    expect(restock).toBeDefined();
    expect(restock!.quantity).toBe(20); // positive for restock

    expect(sale).toBeDefined();
    expect(sale!.quantity).toBe(-10); // negative for sale
  });
});
