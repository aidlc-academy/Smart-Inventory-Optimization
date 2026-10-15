import { Router, Request, Response } from 'express';
import { getClient, queryOne } from '../db/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const ar = (req: Request): AuthRequest => req as unknown as AuthRequest;

const EXISTING_SQL = `
  SELECT o.id AS owner_id, s.id AS shop_id, o.owner_name, s.shop_name
  FROM owners o JOIN shops s ON s.owner_id = o.id
  WHERE o.auth_user_id = $1`;

/**
 * GET /api/v1/onboard
 * Returns the existing shop for the authenticated user, or 404 if not onboarded.
 * Used by the frontend on session restore to avoid requiring re-entry of names.
 */
router.get('/', requireAuth as any, async (req: Request, res: Response) => {
  const authUserId = ar(req).auth.sub;
  try {
    const existing = await queryOne<{
      owner_id: number; shop_id: number; owner_name: string; shop_name: string;
    }>(EXISTING_SQL, [authUserId]);

    if (!existing) {
      return res.status(404).json({ error: 'Not onboarded' });
    }
    return res.status(200).json({ message: 'Already onboarded', ...existing });
  } catch (err) {
    console.error('GET onboard error:', (err as Error).message);
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
  }
});

/**
 * POST /api/v1/onboard
 * Idempotent. Identity derived from verified token — never from request body.
 * Body: { owner_name: string, shop_name: string }
 */
router.post('/', requireAuth as any, async (req: Request, res: Response) => {
  const authUserId = ar(req).auth.sub;
  const { owner_name, shop_name } = req.body as Record<string, unknown>;

  if (!owner_name || typeof owner_name !== 'string' || owner_name.trim().length === 0)
    return res.status(400).json({ error: 'owner_name is required' });
  if (!shop_name || typeof shop_name !== 'string' || shop_name.trim().length === 0)
    return res.status(400).json({ error: 'shop_name is required' });

  const ownerName = (owner_name as string).trim().slice(0, 120);
  const shopName  = (shop_name  as string).trim().slice(0, 120);
  const now = new Date().toISOString();

  // Step 1: check outside any transaction so committed rows are visible
  let existing: { owner_id: number; shop_id: number; owner_name: string; shop_name: string } | null;
  try {
    existing = await queryOne(EXISTING_SQL, [authUserId]);
  } catch (err) {
    console.error('Onboarding pre-check error:', err);
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
  }

  if (existing) {
    return res.status(200).json({ message: 'Already onboarded', ...existing });
  }

  // Step 2: insert inside a transaction
  let client;
  try {
    client = await getClient();
  } catch (err) {
    console.error('Onboarding connection error:', (err as Error).message);
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
  }

  try {
    await client.query('BEGIN');

    // Re-check inside the transaction (handles concurrent requests)
    const check = await client.query<{
      owner_id: number; shop_id: number; owner_name: string; shop_name: string;
    }>(EXISTING_SQL, [authUserId]);
    if (check.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(200).json({ message: 'Already onboarded', ...check.rows[0] });
    }

    const ownerResult = await client.query<{ id: number }>(
      `INSERT INTO owners(auth_user_id, owner_name, created_at)
       VALUES($1, $2, $3)
       ON CONFLICT (auth_user_id) DO NOTHING
       RETURNING id`,
      [authUserId, ownerName, now]
    );

    let ownerId: number;
    if (ownerResult.rows.length > 0) {
      ownerId = ownerResult.rows[0].id;
    } else {
      const r = await client.query<{ id: number }>(
        'SELECT id FROM owners WHERE auth_user_id = $1', [authUserId]
      );
      ownerId = r.rows[0].id;
    }

    const shopResult = await client.query<{ id: number }>(
      `INSERT INTO shops(owner_id, shop_name, created_at)
       VALUES($1, $2, $3)
       ON CONFLICT (owner_id) DO NOTHING
       RETURNING id`,
      [ownerId, shopName, now]
    );

    let shopId: number;
    if (shopResult.rows.length > 0) {
      shopId = shopResult.rows[0].id;
    } else {
      const r = await client.query<{ id: number }>(
        'SELECT id FROM shops WHERE owner_id = $1', [ownerId]
      );
      shopId = r.rows[0].id;
    }

    await client.query('COMMIT');
    return res.status(201).json({
      message: 'Onboarding complete',
      owner_id: ownerId, shop_id: shopId,
      owner_name: ownerName, shop_name: shopName,
    });

  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    if (err?.code === '23505') {
      console.warn('Onboarding race resolved:', err.constraint);
      try {
        const resolved = await queryOne<{
          owner_id: number; shop_id: number; owner_name: string; shop_name: string;
        }>(EXISTING_SQL, [authUserId]);
        if (resolved) return res.status(200).json({ message: 'Already onboarded', ...resolved });
      } catch { /* fall through */ }
    }
    console.error('Onboarding error:', err?.code, err?.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;
