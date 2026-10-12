import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router({ mergeParams: true });

// GET /api/v1/products/:id/sales — last 30 days of sales for a product
router.get('/sales', (req: Request, res: Response) => {
  const productId = Number(req.params.id);
  try {
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const sales = db
      .prepare(
        `SELECT * FROM sales_records
         WHERE product_id = ? AND sale_date >= date('now', '-29 days')
         ORDER BY sale_date DESC`
      )
      .all(productId);
    return res.json(sales);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/products/:id/sales — record or update a daily sales entry (transactional stock update)
router.post('/sales', (req: Request, res: Response) => {
  const productId = Number(req.params.id);
  const { sale_date, units_sold } = req.body as Record<string, unknown>;

  // Validation
  if (!sale_date || typeof sale_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sale_date)) {
    return res.status(400).json({ error: 'sale_date must be a valid YYYY-MM-DD date', field: 'sale_date' });
  }
  if (units_sold === undefined || units_sold === null || !Number.isInteger(Number(units_sold)) || Number(units_sold) < 0) {
    return res.status(400).json({ error: 'units_sold must be a non-negative integer', field: 'units_sold' });
  }

  const newQty = Number(units_sold);
  const now = new Date().toISOString();

  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as
      | { id: number; current_stock: number }
      | undefined;
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    type SaleRow = { units_sold: number };

    const recordSale = db.transaction(() => {
      // Step 1: Get existing units_sold for this product+date if any
      const existing = db
        .prepare('SELECT units_sold FROM sales_records WHERE product_id = ? AND sale_date = ?')
        .get(productId, sale_date) as SaleRow | undefined;
      const oldQty = existing ? existing.units_sold : 0;

      // Step 2: Calculate delta (positive = more sales than before, negative = fewer)
      const delta = newQty - oldQty;

      // Step 3: Check if new stock would go negative
      const currentStock = (
        db.prepare('SELECT current_stock FROM products WHERE id = ?').get(productId) as {
          current_stock: number;
        }
      ).current_stock;

      if (currentStock - delta < 0) {
        throw new Error(
          `Cannot record sale: would reduce stock below zero (current: ${currentStock}, requested: ${newQty})`
        );
      }

      // Step 4: Upsert the sales record
      db.prepare(
        `INSERT OR REPLACE INTO sales_records (product_id, sale_date, units_sold, created_at)
         VALUES (?, ?, ?, ?)`
      ).run(productId, sale_date, newQty, now);

      // Step 5: Update product stock
      db.prepare(
        'UPDATE products SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?'
      ).run(delta, now, productId);

      // Step 6: Insert stock movement (quantity = -delta to represent stock change)
      db.prepare(
        `INSERT INTO stock_movements (product_id, movement_date, quantity, type, note, created_at)
         VALUES (?, ?, ?, 'sale', null, ?)`
      ).run(productId, sale_date, -delta, now);

      // Return the updated product and the sales record
      const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      const salesRecord = db
        .prepare('SELECT * FROM sales_records WHERE product_id = ? AND sale_date = ?')
        .get(productId, sale_date);

      return { product: updatedProduct, salesRecord };
    });

    const result = recordSale();
    return res.json(result);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message && error.message.startsWith('Cannot record sale:')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/products/:id/restock — record a restock (transactional stock increment)
router.post('/restock', (req: Request, res: Response) => {
  const productId = Number(req.params.id);
  const { quantity, note, restock_date } = req.body as Record<string, unknown>;

  // Validation
  if (!quantity || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
    return res.status(400).json({ error: 'quantity must be an integer >= 1', field: 'quantity' });
  }

  const restockQty = Number(quantity);
  const movementDate =
    typeof restock_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(restock_date)
      ? restock_date
      : new Date().toISOString().slice(0, 10);
  const noteText = typeof note === 'string' ? note.trim() || null : null;
  const now = new Date().toISOString();

  try {
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const recordRestock = db.transaction(() => {
      // Step 1: Update product stock
      db.prepare(
        'UPDATE products SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?'
      ).run(restockQty, now, productId);

      // Step 2: Insert stock movement
      db.prepare(
        `INSERT INTO stock_movements (product_id, movement_date, quantity, type, note, created_at)
         VALUES (?, ?, ?, 'restock', ?, ?)`
      ).run(productId, movementDate, restockQty, noteText, now);

      return db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    });

    const updatedProduct = recordRestock();
    return res.json(updatedProduct);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/products/:id/movements — last 60 days of stock movements
router.get('/movements', (req: Request, res: Response) => {
  const productId = Number(req.params.id);
  try {
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const movements = db
      .prepare(
        `SELECT * FROM stock_movements
         WHERE product_id = ? AND movement_date >= date('now', '-59 days')
         ORDER BY movement_date DESC, id DESC`
      )
      .all(productId);
    return res.json(movements);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
