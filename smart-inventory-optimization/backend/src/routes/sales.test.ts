import request from 'supertest';
import path from 'path';
import fs from 'fs';
import express from 'express';

// Use a separate test database file to avoid touching the real inventory.db
const TEST_DB_PATH = path.join(__dirname, '../../test-inventory.db');

// Mock the database module before importing routes
jest.mock('../db/database', () => {
  const Database = require('better-sqlite3');
  const path = require('path');
  const testDbPath = path.join(__dirname, '../../test-inventory.db');
  const testDb = new Database(testDbPath);
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  return testDb;
});

// Import routes AFTER mocking the db
import productsRouter from './products';
import salesRouter from './sales';
import { runMigrations as migrate } from '../db/migrations';

// Get the mocked db
const db = require('../db/database');

// Build test app mirroring the production mount structure
const app = express();
app.use(express.json());
app.use('/api/v1/products', productsRouter);
// salesRouter is mounted at /:id level — its routes are /sales, /restock, /movements
app.use('/api/v1/products/:id', salesRouter);

beforeAll(() => {
  migrate(db);
});

afterAll(() => {
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

beforeEach(() => {
  // Clean up between tests
  db.exec('DELETE FROM stock_movements');
  db.exec('DELETE FROM sales_records');
  db.exec('DELETE FROM products');
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
    const salesRows = db
      .prepare('SELECT * FROM sales_records WHERE product_id = ? AND sale_date = ?')
      .all(productId, saleDate);
    expect(salesRows.length).toBe(1);
    expect(salesRows[0].units_sold).toBe(8);
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

    const movements = db
      .prepare("SELECT * FROM stock_movements WHERE product_id = ? AND type = 'restock'")
      .all(productId);
    expect(movements.length).toBe(1);
    expect(movements[0].quantity).toBe(15);
    expect(movements[0].type).toBe('restock');
    expect(movements[0].note).toBe('Weekly delivery');
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
