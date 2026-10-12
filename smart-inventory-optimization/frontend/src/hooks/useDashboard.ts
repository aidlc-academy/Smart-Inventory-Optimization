import { useCallback, useEffect, useState } from 'react';
import { getDashboard } from '../api/client';
import type { ApiError, DashboardProduct } from '../types';

interface UseDashboardResult {
  data: DashboardProduct[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Fetches the dashboard data. Exposes loading and error states plus a refetch function. */
export function useDashboard(): UseDashboardResult {
  const [data, setData] = useState<DashboardProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDashboard()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: ApiError) => {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load dashboard.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { data, loading, error, refetch };
}
