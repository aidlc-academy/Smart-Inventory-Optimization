import { Router, Request, Response } from 'express';
import { query, queryOne, getClient } from '../db/database';
import { requireAuth } from '../middleware/auth';
import { requireShop, ShopRequest } from '../middleware/shopContext';
import type { PurchaseOrder, ApiError } from '../types';

const router = Router();
router.use(requireAuth as any, requireShop as any);

const sr = (req: Request): ShopRequest => req as unknown as ShopRequest;

interface OrderWithProduct extends PurchaseOrder { product_name: string; product_sku: string; }

router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await query<OrderWithProduct>(
      `SELECT po.*, p.name as product_name, p.sku as product_sku
       FROM purchase_orders po JOIN products p ON po.product_id=p.id
       WHERE po.shop_id=$1 ORDER BY po.created_at DESC`,
      [sr(req).shop.shopId]
    ));
  } catch { res.status(500).json({ message: 'Failed to fetch orders', statusCode: 500 } as ApiError); }
});

router.post('/', async (req: Request, res: Response) => {
  const { shopId } = sr(req).shop;
  const { product_id, quantity, note } = req.body as { product_id: number; quantity: number; note?: string };

  if (typeof product_id !== 'number' || product_id <= 0)
    return res.status(400).json({ message: 'Invalid product_id', field: 'product_id', statusCode: 400 } as ApiError);
  if (typeof quantity !== 'number' || quantity <= 0)
    return res.status(400).json({ message: 'Quantity must be a positive integer', field: 'quantity', statusCode: 400 } as ApiError);

  const product = await queryOne('SELECT id FROM products WHERE id=$1 AND shop_id=$2', [product_id, shopId]);
  if (!product) return res.status(404).json({ message: 'Product not found', statusCode: 404 } as ApiError);

  const now = new Date().toISOString();
  try {
    const result = await queryOne<{ id: number }>(
      `INSERT INTO purchase_orders(product_id,quantity,status,created_at,note,shop_id) VALUES($1,$2,'Pending',$3,$4,$5) RETURNING id`,
      [product_id, quantity, now, note || null, shopId]
    );
    return res.status(201).json(await queryOne<OrderWithProduct>(
      `SELECT po.*, p.name as product_name, p.sku as product_sku FROM purchase_orders po JOIN products p ON po.product_id=p.id WHERE po.id=$1`,
      [result!.id]
    ));
  } catch { return res.status(500).json({ message: 'Failed to create order', statusCode: 500 } as ApiError); }
});

router.post('/:id/receive', async (req: Request, res: Response) => {
  const { shopId } = sr(req).shop;
  const orderId = Number(req.params.id);
  const { note } = req.body as { note?: string };

  if (!orderId || orderId <= 0)
    return res.status(400).json({ message: 'Invalid order ID', statusCode: 400 } as ApiError);

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query<PurchaseOrder & { current_stock: number }>(
      `SELECT po.*, p.current_stock FROM purchase_orders po JOIN products p ON po.product_id=p.id WHERE po.id=$1 AND po.shop_id=$2 FOR UPDATE`,
      [orderId, shopId]
    );
    if (orderResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found', statusCode: 404 } as ApiError); }
    const order = orderResult.rows[0];
    if (order.status === 'Received') { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Order already received', statusCode: 409 } as ApiError); }

    const now = new Date().toISOString();
    await client.query(`UPDATE purchase_orders SET status='Received',received_at=$1,note=COALESCE($2,note) WHERE id=$3`, [now, note || null, orderId]);
    await client.query('UPDATE products SET current_stock=current_stock+$1,updated_at=$2 WHERE id=$3', [order.quantity, now, order.product_id]);
    await client.query(
      `INSERT INTO stock_movements(product_id,movement_date,quantity,type,note,created_at,shop_id) VALUES($1,$2,$3,'restock',$4,$5,$6)`,
      [order.product_id, now, order.quantity, `Purchase order #${orderId} received`, now, shopId]
    );
    await client.query('COMMIT');
    return res.json(await queryOne<OrderWithProduct>(
      `SELECT po.*, p.name as product_name, p.sku as product_sku FROM purchase_orders po JOIN products p ON po.product_id=p.id WHERE po.id=$1`,
      [orderId]
    ));
  } catch { await client.query('ROLLBACK'); return res.status(500).json({ message: 'Failed to mark order received', statusCode: 500 } as ApiError); }
  finally { client.release(); }
});

export default router;
