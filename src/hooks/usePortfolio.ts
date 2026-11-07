import { useEffect, useState } from 'react';
import type { PaginatedResult, PortfolioQuery } from '../../shared/types';
import { getPortfolio } from '../lib/portfolio';

export function usePortfolio(query: PortfolioQuery) {
  const [data, setData] = useState<PaginatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const key = JSON.stringify(query);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getPortfolio(query, controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if ((reason as Error).name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'Something went wrong.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [key]);

  return { data, loading, error };
}
