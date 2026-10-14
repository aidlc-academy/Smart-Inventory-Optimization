import { Router, Request, Response } from 'express';
import { getClient, queryOne, query } from '../db/database';
import { requireAuth } from '../middleware/auth';
import { requireShop, ShopRequest } from '../middleware/shopContext';

const router = Router({ mergeParams: true });
router.use(requireAuth as any, requireShop as any);

const sr = (req: Request): ShopRequest => req as unknown as ShopRequest;

function dateDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}

router.get('/sales', async (req: Request, res: Response) => {
  const { shopId } = sr(req).shop;
  const productId = Number(req.params.id);
  const product = await queryOne('SELECT id FROM products WHERE id=$1 AND shop_id=$2', [productId, shopId]);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  // Optional ?date=YYYY-MM-DD: return only that single date's record (no window limit)
  const dateParam = req.query.date as string | undefined;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return res.json(await query(
      'SELECT * FROM sales_records WHERE product_id=$1 AND shop_id=$2 AND sale_date=$3',
      [productId, shopId, dateParam]
    ));
  }

  return res.json(await query(
    'SELECT * FROM sales_records WHERE product_id=$1 AND shop_id=$2 AND sale_date>=$3 ORDER BY sale_date DESC',
    [productId, shopId, dateDaysAgo(29)]
  ));
});

router.post('/sales', async (req: Request, res: Response) => {
  const { shopId } = sr(req).shop;
  const productId = Number(req.params.id);
  const { sale_date, units_sold } = req.body as Record<string, unknown>;

  if (!sale_date || typeof sale_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sale_date))
    return res.status(400).json({ error: 'sale_date must be a valid YYYY-MM-DD date', field: 'sale_date' });
  if (units_sold === undefined || units_sold === null || !Number.isInteger(Number(units_sold)) || Number(units_sold) < 0)
    return res.status(400).json({ error: 'units_sold must be a non-negative integer', field: 'units_sold' });

  const newQty = Number(units_sold);
  const now = new Date().toISOString();
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const pResult = await client.query<{ id: number; current_stock: number }>(
      'SELECT id,current_stock FROM products WHERE id=$1 AND shop_id=$2 FOR UPDATE', [productId, shopId]
    );
    if (pResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Product not found' }); }

    const existing = await client.query<{ units_sold: number }>(
      'SELECT units_sold FROM sales_records WHERE product_id=$1 AND sale_date=$2 AND shop_id=$3', [productId, sale_date, shopId]
    );
    const oldQty = existing.rows.length > 0 ? existing.rows[0].units_sold : 0;
    const delta  = newQty - oldQty;
    const currentStock = pResult.rows[0].current_stock;
    if (currentStock - delta < 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Cannot record sale: would reduce stock below zero (current: ${currentStock}, requested: ${newQty})` }); }

    await client.query(
      `INSERT INTO sales_records(product_id,sale_date,units_sold,created_at,shop_id) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(product_id,sale_date) DO UPDATE SET units_sold=EXCLUDED.units_sold,created_at=EXCLUDED.created_at`,
      [productId, sale_date, newQty, now, shopId]
    );
    await client.query('UPDATE products SET current_stock=current_stock-$1,updated_at=$2 WHERE id=$3', [delta, now, productId]);
    await client.query(
      `INSERT INTO stock_movements(product_id,movement_date,quantity,type,note,created_at,shop_id) VALUES($1,$2,$3,'sale',null,$4,$5)`,
      [productId, sale_date, -delta, now, shopId]
    );
    await client.query('COMMIT');
    return res.json({
      product: await queryOne('SELECT * FROM products WHERE id=$1', [productId]),
      salesRecord: await queryOne('SELECT * FROM sales_records WHERE product_id=$1 AND sale_date=$2', [productId, sale_date]),
    });
  } catch (err) { await client.query('ROLLBACK'); console.error(err); return res.status(500).json({ error: 'Internal server error' }); }
  finally { client.release(); }
});

router.post('/restock', async (req: Request, res: Response) => {
  const { shopId } = sr(req).shop;
  const productId = Number(req.params.id);
  const { quantity, note, restock_date } = req.body as Record<string, unknown>;
  if (!quantity || !Number.isInteger(Number(quantity)) || Number(quantity) < 1)
    return res.status(400).json({ error: 'quantity must be an integer >= 1', field: 'quantity' });

  const restockQty = Number(quantity);
  const movementDate = typeof restock_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(restock_date)
    ? restock_date : new Date().toISOString().slice(0, 10);
  const noteText = typeof note === 'string' ? note.trim() || null : null;
  const now = new Date().toISOString();
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const p = await client.query('SELECT id FROM products WHERE id=$1 AND shop_id=$2 FOR UPDATE', [productId, shopId]);
    if (p.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Product not found' }); }
    await client.query('UPDATE products SET current_stock=current_stock+$1,updated_at=$2 WHERE id=$3', [restockQty, now, productId]);
    await client.query(
      `INSERT INTO stock_movements(product_id,movement_date,quantity,type,note,created_at,shop_id) VALUES($1,$2,$3,'restock',$4,$5,$6)`,
      [productId, movementDate, restockQty, noteText, now, shopId]
    );
    await client.query('COMMIT');
    return res.json(await queryOne('SELECT * FROM products WHERE id=$1', [productId]));
  } catch (err) { await client.query('ROLLBACK'); return res.status(500).json({ error: 'Internal server error' }); }
  finally { client.release(); }
});

router.get('/movements', async (req: Request, res: Response) => {
  const { shopId } = sr(req).shop;
  const productId = Number(req.params.id);
  const product = await queryOne('SELECT id FROM products WHERE id=$1 AND shop_id=$2', [productId, shopId]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  return res.json(await query(
    'SELECT * FROM stock_movements WHERE product_id=$1 AND shop_id=$2 AND movement_date>=$3 ORDER BY movement_date DESC,id DESC',
    [productId, shopId, dateDaysAgo(59)]
  ));
});

export default router;
