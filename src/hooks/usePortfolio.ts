import { useEffect, useRef, useState } from 'react';
import type { PaginatedResult, PortfolioQuery } from '../../shared/types';
import { getPortfolio } from '../lib/portfolio';

type PortfolioLoader = typeof getPortfolio;

interface PortfolioState {
  key: string;
  data: PaginatedResult | null;
  loading: boolean;
  error: string;
}

export function usePortfolio(query: PortfolioQuery, loadPortfolio: PortfolioLoader = getPortfolio) {
  const key = JSON.stringify(query);
  const requestId = useRef(0);
  const [state, setState] = useState<PortfolioState>({
    key,
    data: null,
    loading: true,
    error: '',
  });

  useEffect(() => {
    const controller = new AbortController();
    const currentRequest = ++requestId.current;
    setState({ key, data: null, loading: true, error: '' });
    loadPortfolio(query, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted && requestId.current === currentRequest) {
          setState({ key, data, loading: false, error: '' });
        }
      })
      .catch((reason: unknown) => {
        if ((reason as Error).name !== 'AbortError' && requestId.current === currentRequest) {
          setState({
            key,
            data: null,
            loading: false,
            error: reason instanceof Error ? reason.message : 'Something went wrong.',
          });
        }
      });
    return () => controller.abort();
  }, [key, loadPortfolio]);

  const isCurrentQuery = state.key === key;
  return {
    data: isCurrentQuery ? state.data : null,
    loading: !isCurrentQuery || state.loading,
    error: isCurrentQuery ? state.error : '',
  };
}
