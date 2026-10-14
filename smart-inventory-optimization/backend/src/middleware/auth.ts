import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

/** Shape of a verified Supabase user attached to the request. */
export interface SupabaseTokenPayload {
  sub: string;    // Supabase auth user UUID (user.id)
  email?: string;
}

/** Extends Express Request with the verified token payload. */
export interface AuthRequest extends Request {
  auth: SupabaseTokenPayload;
}

/**
 * Verifies the access token by calling supabase.auth.getUser(token).
 *
 * - Creates a one-shot, stateless Supabase client per request — no shared session.
 * - Token is passed directly to getUser(); Supabase validates it against the
 *   project's Auth service (expiry, signature, revocation).
 * - On any Auth service error the request fails closed (503, not 401),
 *   so an outage does not silently pass bad tokens.
 * - Requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (anon key).
 *   SUPABASE_JWT_SECRET is NOT used at runtime — only present for legacy reasons.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not configured');
    res.status(500).json({ error: 'Server authentication not configured' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  // One-shot stateless client — no shared session across requests
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  let user;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      // Distinguish an invalid/expired token from an Auth service failure
      const isAuthError = error?.status && error.status < 500;
      if (isAuthError) {
        res.status(401).json({ error: 'Invalid or expired token' });
      } else {
        console.error('Supabase Auth service error:', error?.message);
        res.status(503).json({ error: 'Authentication service unavailable' });
      }
      return;
    }
    user = data.user;
  } catch (err) {
    // Network or unexpected failure — fail closed
    console.error('requireAuth: unexpected error calling supabase.auth.getUser:', err);
    res.status(503).json({ error: 'Authentication service unavailable' });
    return;
  }

  // Attach verified identity; sub is the Supabase user UUID
  (req as AuthRequest).auth = { sub: user.id, email: user.email };
  next();
}
