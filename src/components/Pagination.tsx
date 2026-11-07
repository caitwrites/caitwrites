import { ChevronLeft, ChevronRight } from 'lucide-react';

function range(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const values: Array<number | 'ellipsis'> = [1];
  if (current > 4) values.push('ellipsis');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) values.push(i);
  if (current < total - 3) values.push('ellipsis');
  values.push(total);
  return values;
}

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Portfolio pagination">
      <button onClick={() => onPage(page - 1)} disabled={page === 1}><ChevronLeft className="size-4" /> Previous</button>
      <span className="mobile-page md:hidden">Page {page} of {totalPages}</span>
      <div className="hidden items-center gap-1 md:flex">
        {range(page, totalPages).map((value, index) => value === 'ellipsis' ? <span className="px-2" key={`e-${index}`}>…</span> : <button className={page === value ? 'active' : ''} aria-current={page === value ? 'page' : undefined} onClick={() => onPage(value)} key={value}>{value}</button>)}
      </div>
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}>Next <ChevronRight className="size-4" /></button>
    </nav>
  );
}
