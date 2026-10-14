import { Router, Request, Response } from 'express';
import { getClient } from '../db/database';
import { seedDemoData } from '../seed/demo-data';
import { requireAuth } from '../middleware/auth';
import { requireShop, ShopRequest } from '../middleware/shopContext';

const router = Router();
router.use(requireAuth as any, requireShop as any);

const sr = (req: Request): ShopRequest => req as unknown as ShopRequest;

router.post('/', async (req: Request, res: Response) => {
  try {
    const client = await getClient();
    try {
      await seedDemoData(client, sr(req).shop.shopId);
      res.json({ message: 'Demo data loaded successfully. All sample records are labelled is_sample=1.' });
    } finally { client.release(); }
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message || 'Failed to seed demo data' });
  }
});

router.delete('/', async (req: Request, res: Response) => {
  try {
    const client = await getClient();
    try {
      await client.query('DELETE FROM products WHERE is_sample=1 AND shop_id=$1', [sr(req).shop.shopId]);
      res.json({ message: 'Sample data removed.' });
    } finally { client.release(); }
  } catch { res.status(500).json({ error: 'Failed to remove sample data' }); }
});

router.post('/onboard', async (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

export default router;
