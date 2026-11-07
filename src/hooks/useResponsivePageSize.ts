import { useEffect, useState } from 'react';
import { pageSizeForWidth } from '../lib/portfolio';

export function useResponsivePageSize() {
  const [pageSize, setPageSize] = useState(() => pageSizeForWidth(typeof window === 'undefined' ? 1280 : window.innerWidth));
  useEffect(() => {
    const update = () => setPageSize(pageSizeForWidth(window.innerWidth));
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);
  return pageSize;
}
