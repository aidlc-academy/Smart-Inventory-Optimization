import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../db/database';
import { requireAuth } from '../middleware/auth';
import { requireShop, ShopRequest } from '../middleware/shopContext';

const router = Router();
router.use(requireAuth as any, requireShop as any);

const sr = (req: Request): ShopRequest => req as unknown as ShopRequest;

router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await query('SELECT * FROM products WHERE shop_id=$1 ORDER BY name ASC', [sr(req).shop.shopId]));
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', async (req: Request, res: Response) => {
  const shopId = sr(req).shop.shopId;
  const { name, sku, current_stock, supplier_lead_time_days, safety_stock, target_coverage_days } =
    req.body as Record<string, unknown>;

  const errors: string[] = [];
  if (!name || typeof name !== 'string' || (name as string).trim().length === 0 || (name as string).length > 120)
    errors.push('name is required and must be 1–120 characters');
  if (!sku || typeof sku !== 'string' || (sku as string).trim().length === 0 || (sku as string).length > 50)
    errors.push('sku is required and must be 1–50 characters');
  if (current_stock === undefined || current_stock === null || !Number.isInteger(Number(current_stock)) || Number(current_stock) < 0)
    errors.push('current_stock must be a non-negative integer');
  if (!supplier_lead_time_days || !Number.isInteger(Number(supplier_lead_time_days)) || Number(supplier_lead_time_days) < 1)
    errors.push('supplier_lead_time_days must be an integer >= 1');
  if (safety_stock === undefined || safety_stock === null || !Number.isInteger(Number(safety_stock)) || Number(safety_stock) < 0)
    errors.push('safety_stock must be a non-negative integer');
  if (!target_coverage_days || !Number.isInteger(Number(target_coverage_days)) || Number(target_coverage_days) < 1)
    errors.push('target_coverage_days must be an integer >= 1');
  if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });

  const now = new Date().toISOString();
  try {
    const result = await queryOne<{ id: number }>(
      `INSERT INTO products (name,sku,current_stock,supplier_lead_time_days,safety_stock,target_coverage_days,is_sample,created_at,updated_at,shop_id)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9) RETURNING id`,
      [(name as string).trim(), (sku as string).trim(), Number(current_stock),
       Number(supplier_lead_time_days), Number(safety_stock), Number(target_coverage_days), now, now, shopId]
    );
    return res.status(201).json(await queryOne('SELECT * FROM products WHERE id=$1', [result!.id]));
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') return res.status(409).json({ error: 'SKU already exists' });
    console.error('Error creating product:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const shopId = sr(req).shop.shopId;
  try {
    const product = await queryOne('SELECT * FROM products WHERE id=$1 AND shop_id=$2', [Number(req.params.id), shopId]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json(product);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', async (req: Request, res: Response) => {
  const shopId = sr(req).shop.shopId;
  const id = Number(req.params.id);
  const existing = await queryOne('SELECT id FROM products WHERE id=$1 AND shop_id=$2', [id, shopId]);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const { name, sku, current_stock, supplier_lead_time_days, safety_stock, target_coverage_days } =
    req.body as Record<string, unknown>;

  const errors: string[] = [];
  if (!name || typeof name !== 'string' || (name as string).trim().length === 0 || (name as string).length > 120)
    errors.push('name is required and must be 1–120 characters');
  if (!sku || typeof sku !== 'string' || (sku as string).trim().length === 0 || (sku as string).length > 50)
    errors.push('sku is required and must be 1–50 characters');
  if (current_stock === undefined || current_stock === null || !Number.isInteger(Number(current_stock)) || Number(current_stock) < 0)
    errors.push('current_stock must be a non-negative integer');
  if (!supplier_lead_time_days || !Number.isInteger(Number(supplier_lead_time_days)) || Number(supplier_lead_time_days) < 1)
    errors.push('supplier_lead_time_days must be an integer >= 1');
  if (safety_stock === undefined || safety_stock === null || !Number.isInteger(Number(safety_stock)) || Number(safety_stock) < 0)
    errors.push('safety_stock must be a non-negative integer');
  if (!target_coverage_days || !Number.isInteger(Number(target_coverage_days)) || Number(target_coverage_days) < 1)
    errors.push('target_coverage_days must be an integer >= 1');
  if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });

  const now = new Date().toISOString();
  try {
    await execute(
      `UPDATE products SET name=$1,sku=$2,current_stock=$3,supplier_lead_time_days=$4,safety_stock=$5,target_coverage_days=$6,updated_at=$7 WHERE id=$8 AND shop_id=$9`,
      [(name as string).trim(), (sku as string).trim(), Number(current_stock),
       Number(supplier_lead_time_days), Number(safety_stock), Number(target_coverage_days), now, id, shopId]
    );
    return res.json(await queryOne('SELECT * FROM products WHERE id=$1', [id]));
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') return res.status(409).json({ error: 'SKU already exists' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const shopId = sr(req).shop.shopId;
  const id = Number(req.params.id);
  try {
    const existing = await queryOne('SELECT id FROM products WHERE id=$1 AND shop_id=$2', [id, shopId]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    await execute('DELETE FROM products WHERE id=$1 AND shop_id=$2', [id, shopId]);
    return res.status(204).send();
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
