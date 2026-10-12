import { Router, Request, Response } from 'express';
import db from '../db/database';
import { seedDemoData } from '../seed/demo-data';

const router = Router();

// POST /api/v1/seed — load demo data
router.post('/', (_req: Request, res: Response) => {
  try {
    seedDemoData(db);
    res.json({ message: 'Demo data loaded successfully. All sample records are labelled is_sample=1.' });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message || 'Failed to seed demo data' });
  }
});

// DELETE /api/v1/seed — remove all sample data
router.delete('/', (_req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM products WHERE is_sample = 1').run();
    res.json({ message: 'Sample data removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove sample data' });
  }
});

export default router;
