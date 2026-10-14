import { Router, Request, Response } from 'express';
import { getClient, queryOne } from '../db/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const ar = (req: Request): AuthRequest => req as unknown as AuthRequest;

/**
 * POST /api/v1/onboard
 * Idempotent. Identity derived from verified token — never from request body.
 * Body: { owner_name: string, shop_name: string }
 *
 * Robust idempotency strategy:
 *   1. Check BEFORE beginning a transaction (avoids hiding existing rows inside BEGIN).
 *   2. If not found, INSERT with ON CONFLICT DO NOTHING, then SELECT again.
 *   3. Catch any residual 23505 unique-violation and resolve to the existing record.
 *   4. All connection-acquisition errors are caught and return 503.
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

  const EXISTING_SQL = `
    SELECT o.id AS owner_id, s.id AS shop_id, o.owner_name, s.shop_name
    FROM owners o JOIN shops s ON s.owner_id = o.id
    WHERE o.auth_user_id = $1`;

  // ── Step 1: check outside any transaction so committed rows are visible ──
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

  // ── Step 2: insert inside a transaction ──────────────────────────────────
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
    const check = await client.query<{ owner_id: number; shop_id: number; owner_name: string; shop_name: string }>(
      EXISTING_SQL, [authUserId]
    );
    if (check.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(200).json({ message: 'Already onboarded', ...check.rows[0] });
    }

    // Create owner — use ON CONFLICT DO NOTHING to be safe
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
      // Row already existed (race), fetch it
      const existing2 = await client.query<{ id: number }>(
        'SELECT id FROM owners WHERE auth_user_id = $1', [authUserId]
      );
      ownerId = existing2.rows[0].id;
    }

    // Create shop — use ON CONFLICT DO NOTHING (unique: one shop per owner)
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
      const existing3 = await client.query<{ id: number }>(
        'SELECT id FROM shops WHERE owner_id = $1', [ownerId]
      );
      shopId = existing3.rows[0].id;
    }

    await client.query('COMMIT');
    return res.status(201).json({
      message: 'Onboarding complete',
      owner_id: ownerId, shop_id: shopId,
      owner_name: ownerName, shop_name: shopName,
    });

  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    // If somehow a duplicate slips through, resolve to the existing record
    if (err?.code === '23505') {
      console.warn('Onboarding race condition resolved:', err.constraint);
      try {
        const resolved = await queryOne<{ owner_id: number; shop_id: number; owner_name: string; shop_name: string }>(
          EXISTING_SQL, [authUserId]
        );
        if (resolved) return res.status(200).json({ message: 'Already onboarded', ...resolved });
      } catch { /* fall through to 500 */ }
    }
    console.error('Onboarding error:', err?.code, err?.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;
