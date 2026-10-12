import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

// GET /api/v1/products — list all products ordered by name
router.get('/', (_req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM products ORDER BY name ASC');
    const products = stmt.all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/products — create a product
router.post('/', (req: Request, res: Response) => {
  const { name, sku, current_stock, supplier_lead_time_days, safety_stock, target_coverage_days } =
    req.body as Record<string, unknown>;

  // Validation
  const errors: string[] = [];
  if (!name || typeof name !== 'string' || (name as string).trim().length === 0 || (name as string).length > 120) {
    errors.push('name is required and must be 1–120 characters');
  }
  if (!sku || typeof sku !== 'string' || (sku as string).trim().length === 0 || (sku as string).length > 50) {
    errors.push('sku is required and must be 1–50 characters');
  }
  if (current_stock === undefined || current_stock === null || !Number.isInteger(Number(current_stock)) || Number(current_stock) < 0) {
    errors.push('current_stock must be a non-negative integer');
  }
  if (!supplier_lead_time_days || !Number.isInteger(Number(supplier_lead_time_days)) || Number(supplier_lead_time_days) < 1) {
    errors.push('supplier_lead_time_days must be an integer >= 1');
  }
  if (safety_stock === undefined || safety_stock === null || !Number.isInteger(Number(safety_stock)) || Number(safety_stock) < 0) {
    errors.push('safety_stock must be a non-negative integer');
  }
  if (!target_coverage_days || !Number.isInteger(Number(target_coverage_days)) || Number(target_coverage_days) < 1) {
    errors.push('target_coverage_days must be an integer >= 1');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO products (name, sku, current_stock, supplier_lead_time_days, safety_stock, target_coverage_days, is_sample, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);
    const result = stmt.run(
      (name as string).trim(),
      (sku as string).trim(),
      Number(current_stock),
      Number(supplier_lead_time_days),
      Number(safety_stock),
      Number(target_coverage_days),
      now,
      now
    );
    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(created);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/products/:id — get a single product
router.get('/:id', (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
    const product = stmt.get(Number(req.params.id));
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json(product);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/products/:id — update a product
router.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const { name, sku, current_stock, supplier_lead_time_days, safety_stock, target_coverage_days } =
    req.body as Record<string, unknown>;

  // Validation
  const errors: string[] = [];
  if (!name || typeof name !== 'string' || (name as string).trim().length === 0 || (name as string).length > 120) {
    errors.push('name is required and must be 1–120 characters');
  }
  if (!sku || typeof sku !== 'string' || (sku as string).trim().length === 0 || (sku as string).length > 50) {
    errors.push('sku is required and must be 1–50 characters');
  }
  if (current_stock === undefined || current_stock === null || !Number.isInteger(Number(current_stock)) || Number(current_stock) < 0) {
    errors.push('current_stock must be a non-negative integer');
  }
  if (!supplier_lead_time_days || !Number.isInteger(Number(supplier_lead_time_days)) || Number(supplier_lead_time_days) < 1) {
    errors.push('supplier_lead_time_days must be an integer >= 1');
  }
  if (safety_stock === undefined || safety_stock === null || !Number.isInteger(Number(safety_stock)) || Number(safety_stock) < 0) {
    errors.push('safety_stock must be a non-negative integer');
  }
  if (!target_coverage_days || !Number.isInteger(Number(target_coverage_days)) || Number(target_coverage_days) < 1) {
    errors.push('target_coverage_days must be an integer >= 1');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const now = new Date().toISOString();

  try {
    db.prepare(`
      UPDATE products SET
        name = ?, sku = ?, current_stock = ?, supplier_lead_time_days = ?,
        safety_stock = ?, target_coverage_days = ?, updated_at = ?
      WHERE id = ?
    `).run(
      (name as string).trim(),
      (sku as string).trim(),
      Number(current_stock),
      Number(supplier_lead_time_days),
      Number(safety_stock),
      Number(target_coverage_days),
      now,
      id
    );
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return res.json(updated);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/products/:id — delete a product (cascades to sales_records and stock_movements)
router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
