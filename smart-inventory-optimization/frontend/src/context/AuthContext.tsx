import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { onboard } from '../api/client';

export interface ShopInfo {
  owner_name: string;
  shop_name: string;
  owner_id: number;
  shop_id: number;
}

type OnboardStatus = 'pending' | 'complete' | 'failed';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  shop: ShopInfo | null;
  onboardStatus: OnboardStatus;
  loading: boolean;            // initial session restore in progress
  retryOnboard: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]           = useState<Session | null>(null);
  const [user, setUser]                 = useState<User | null>(null);
  const [shop, setShop]                 = useState<ShopInfo | null>(null);
  const [onboardStatus, setOnboardStatus] = useState<OnboardStatus>('pending');
  const [loading, setLoading]           = useState(true);

  /** Calls onboarding endpoint; swallows failures and surfaces them via status. */
  const runOnboard = useCallback(async (accessToken: string) => {
    // Read persisted signup details (owner/shop name from Register page)
    const pendingOwner = sessionStorage.getItem('pending_owner_name') ?? '';
    const pendingShop  = sessionStorage.getItem('pending_shop_name') ?? '';

    // If no names, can't complete onboarding — wait for user to retry with form
    if (!pendingOwner.trim() || !pendingShop.trim()) {
      setOnboardStatus('failed');
      return;
    }

    try {
      const result = await onboard(
        { owner_name: pendingOwner.trim(), shop_name: pendingShop.trim() },
        accessToken
      );
      setShop({
        owner_id:   result.owner_id,
        shop_id:    result.shop_id,
        owner_name: result.owner_name,
        shop_name:  result.shop_name,
      });
      // Clean up persisted details now onboarding succeeded
      sessionStorage.removeItem('pending_owner_name');
      sessionStorage.removeItem('pending_shop_name');
      setOnboardStatus('complete');
    } catch {
      setOnboardStatus('failed');
    }
  }, []);

  /** Initialise session and set up listener. */
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s) {
        runOnboard(s.access_token).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (!s) {
        // Logged out — clear shop state
        setShop(null);
        setOnboardStatus('pending');
      } else if (s && onboardStatus !== 'complete') {
        runOnboard(s.access_token);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryOnboard = useCallback(() => {
    if (session) {
      setOnboardStatus('pending');
      runOnboard(session.access_token);
    }
  }, [session, runOnboard]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setShop(null);
    setOnboardStatus('pending');
    sessionStorage.removeItem('pending_owner_name');
    sessionStorage.removeItem('pending_shop_name');
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, shop, onboardStatus, loading, retryOnboard, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
