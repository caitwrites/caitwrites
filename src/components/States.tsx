export function LoadingGrid() {
  return <div className="portfolio-grid" aria-label="Loading portfolio"><span className="sr-only">Loading portfolio</span>{Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index}><div /><i /><i /></div>)}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="state-card" role="alert"><h2>Something interrupted the story.</h2><p>{message}</p>{onRetry && <button className="text-link mt-4" onClick={onRetry}>Try again</button>}</div>;
}

function ThoughtBubbleIcon() {
  return (
    <svg className="thought-bubble-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M18 42.5C10.8 42.5 5 37.1 5 30.5c0-5.5 4-10.2 9.6-11.6C16.3 12.6 22.2 8 29.3 8c5.8 0 10.9 3.1 13.4 7.7 8.9.2 16.1 6.4 16.1 14.1 0 7.9-7.6 14.2-17 14.2H18Z" />
      <circle cx="20" cy="51" r="3.2" />
      <circle cx="13" cy="58" r="1.8" />
    </svg>
  );
}

export function EmptyState({ onClear, showClear = false }: { onClear: () => void; showClear?: boolean }) {
  return <div className="empty-state"><ThoughtBubbleIcon /><h2>Currently brainstorming, click through again later</h2>{showClear && <button className="text-link" onClick={onClear}>Clear filters</button>}</div>;
}
