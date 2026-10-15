import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getMyShop } from '../api/client';

export interface ShopInfo {
  owner_name: string;
  shop_name: string;
  owner_id: number;
  shop_id: number;
}

/**
 * pending   — initial state; loading session or shop
 * complete  — session exists AND shop resolved from backend
 * needs_setup — backend confirmed 404: user has no shop yet
 * failed    — network/server error (not 404); show Retry, not onboarding form
 */
type OnboardStatus = 'pending' | 'complete' | 'needs_setup' | 'failed';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  shop: ShopInfo | null;
  onboardStatus: OnboardStatus;
  loading: boolean;
  retryOnboard: () => void;
  /** Called by OnboardingPage after a successful POST /onboard */
  completeOnboard: (result: ShopInfo) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Attempt to restore the shop from the backend using the session token.
 *
 * Strategy:
 *  1. GET /api/v1/onboard — returns existing shop (200) or 404 (not onboarded).
 *  2. 200  → set shop, mark complete.
 *  3. 404  → user exists but has no shop yet → needs_setup.
 *  4. Any other error (5xx, network) → failed; show Retry, not onboarding form.
 *
 * We do NOT read sessionStorage here — that was the bug.
 * sessionStorage is only used by RegisterPage to carry names across email-confirmation.
 */
async function fetchShopForSession(
  accessToken: string
): Promise<{ status: 'complete'; shop: ShopInfo } | { status: 'needs_setup' } | { status: 'failed' }> {
  try {
    const result = await getMyShop(accessToken);
    return {
      status: 'complete',
      shop: {
        owner_id:   result.owner_id,
        shop_id:    result.shop_id,
        owner_name: result.owner_name,
        shop_name:  result.shop_name,
      },
    };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404) return { status: 'needs_setup' };
    // 401/403 → session invalid — treat as failed so RequireAuth redirects to login
    if (statusCode === 401 || statusCode === 403) return { status: 'failed' };
    // 5xx / network → transient; show Retry
    return { status: 'failed' };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]               = useState<Session | null>(null);
  const [user, setUser]                     = useState<User | null>(null);
  const [shop, setShop]                     = useState<ShopInfo | null>(null);
  const [onboardStatus, setOnboardStatus]   = useState<OnboardStatus>('pending');
  const [loading, setLoading]               = useState(true);

  const resolveShop = useCallback(async (s: Session) => {
    setOnboardStatus('pending');
    const result = await fetchShopForSession(s.access_token);
    if (result.status === 'complete') {
      setShop(result.shop);
      setOnboardStatus('complete');
    } else if (result.status === 'needs_setup') {
      setShop(null);
      setOnboardStatus('needs_setup');
    } else {
      setShop(null);
      setOnboardStatus('failed');
    }
  }, []);

  // Initial session restore
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s) {
        await resolveShop(s);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (!s) {
        setShop(null);
        setOnboardStatus('pending');
        // loading stays false after initial resolve
      } else {
        await resolveShop(s);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [resolveShop]);

  const retryOnboard = useCallback(() => {
    if (session) resolveShop(session);
  }, [session, resolveShop]);

  /** Called by OnboardingPage immediately after a successful POST /onboard */
  const completeOnboard = useCallback((result: ShopInfo) => {
    setShop(result);
    setOnboardStatus('complete');
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setShop(null);
    setOnboardStatus('pending');
    // Clear any leftover signup details from Register page
    sessionStorage.removeItem('pending_owner_name');
    sessionStorage.removeItem('pending_shop_name');
  }, []);

  return (
    <AuthContext.Provider value={{
      session, user, shop, onboardStatus, loading,
      retryOnboard, completeOnboard, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
