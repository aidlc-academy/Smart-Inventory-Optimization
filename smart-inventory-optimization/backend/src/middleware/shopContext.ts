import { Response, NextFunction } from 'express';
import { queryOne } from '../db/database';
import type { AuthRequest } from './auth';

export interface ShopContext {
  shopId: number;
  ownerId: number;
  authUserId: string;
}

/** Extends AuthRequest with resolved shop context. */
export interface ShopRequest extends AuthRequest {
  shop: ShopContext;
}

/**
 * Resolves the authenticated user's shop from the database.
 * Must be placed AFTER requireAuth.
 * Returns 403 if the user has not completed onboarding (no owner/shop row).
 * Never trusts a shop_id from the request body or query string.
 */
export async function requireShop(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authUserId = req.auth.sub;

  try {
    const row = await queryOne<{ shop_id: number; owner_id: number }>(
      `SELECT s.id AS shop_id, o.id AS owner_id
       FROM owners o
       JOIN shops s ON s.owner_id = o.id
       WHERE o.auth_user_id = $1`,
      [authUserId]
    );

    if (!row) {
      res.status(403).json({
        error: 'Onboarding not complete. POST /api/v1/onboard first.',
      });
      return;
    }

    (req as unknown as ShopRequest).shop = {
      shopId: row.shop_id,
      ownerId: row.owner_id,
      authUserId,
    };
    next();
  } catch (err) {
    console.error('Error resolving shop context:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
