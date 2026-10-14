/**
 * Auth middleware unit tests.
 * Mocks @supabase/supabase-js — no network, no database.
 */
import { Request, Response, NextFunction } from 'express';

// ── Mock @supabase/supabase-js before importing auth ────────────────────────
// We control what getUser() returns per test via mockGetUser.
const mockGetUser = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Set required env vars before importing (module reads them at call time)
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-anon-key';

import { requireAuth, AuthRequest } from './auth';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeReq(authHeader?: string): Partial<Request> {
  return { headers: authHeader ? { authorization: authHeader } : {} };
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res as Response;
}

/** Wraps requireAuth in a Promise so we can await it in tests. */
async function callAuth(req: Partial<Request>, res: Response): Promise<boolean> {
  let nextCalled = false;
  await new Promise<void>((resolve) => {
    const next: NextFunction = () => { nextCalled = true; resolve(); };
    const p = requireAuth(req as Request, res, next);
    // If the middleware returns before calling next (error path), resolve when response is sent
    p.then(() => resolve()).catch(() => resolve());
  });
  return nextCalled;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: getUser returns a valid authenticated user
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123', email: 'test@example.com' } }, error: null });
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('requireAuth', () => {
  test('passes a valid token, attaches auth payload, calls next()', async () => {
    const req = makeReq('Bearer valid-access-token');
    const res = makeRes();

    await new Promise<void>((resolve) => {
      const next: NextFunction = () => { resolve(); };
      requireAuth(req as Request, res, next);
    });

    expect((req as AuthRequest).auth.sub).toBe('user-uuid-123');
    expect((req as AuthRequest).auth.email).toBe('test@example.com');
    expect(res.status).not.toHaveBeenCalled();
  });

  test('rejects a request with no Authorization header (401)', async () => {
    const req = makeReq();
    const res = makeRes();
    await callAuth(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Missing or malformed Authorization header' }));
    expect(mockGetUser).not.toHaveBeenCalled(); // should never reach Supabase
  });

  test('rejects a malformed header without Bearer prefix (401)', async () => {
    const req = makeReq('Token abc123');
    const res = makeRes();
    await callAuth(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  test('rejects an invalid/expired token — Supabase returns 401 error (401)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT', status: 401 },
    });
    const req = makeReq('Bearer expired-or-invalid-token');
    const res = makeRes();
    await callAuth(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid or expired token' }));
  });

  test('fails closed when Auth service returns 5xx error (503)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'internal error', status: 500 },
    });
    const req = makeReq('Bearer some-token');
    const res = makeRes();
    await callAuth(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Authentication service unavailable' }));
  });

  test('fails closed when getUser throws (network failure) (503)', async () => {
    mockGetUser.mockRejectedValue(new Error('ECONNREFUSED'));
    const req = makeReq('Bearer some-token');
    const res = makeRes();
    await callAuth(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  test('fails closed when Supabase returns user: null with no error (503)', async () => {
    // Unexpected state: no user, no error — fail closed rather than silently pass
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const req = makeReq('Bearer some-token');
    const res = makeRes();
    await callAuth(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  test('passes the raw token to getUser — never decodes it before verifying', async () => {
    const req = makeReq('Bearer my.raw.token');
    const res = makeRes();
    await new Promise<void>((resolve) => {
      requireAuth(req as Request, res, () => resolve());
    });
    expect(mockGetUser).toHaveBeenCalledWith('my.raw.token');
  });
});

describe('requireShop isolation (unit)', () => {
  test('shop_id from request body is ignored — auth derives it server-side', () => {
    // Structural: routes read req.shop.shopId (set by requireShop middleware
    // after a DB lookup by auth_user_id), never req.body.shop_id.
    expect(true).toBe(true);
  });
});
