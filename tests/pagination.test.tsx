import React from 'react';
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaginatedResult, PortfolioQuery, PortfolioRecord } from '../shared/types';
import { GalleryPage } from '../src/pages/GalleryPage';
import { usePortfolio } from '../src/hooks/usePortfolio';

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{`${location.pathname}${location.search}`}</output>
      <button type="button" onClick={() => navigate(-1)}>Test browser back</button>
      <button type="button" onClick={() => navigate(1)}>Test browser forward</button>
    </>
  );
}

function renderGallery(route = '/web-copy') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <GalleryPage category="web-copy" />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function firstCardTitle(container: HTMLElement) {
  return container.querySelector('article.portfolio-card h3')?.textContent;
}

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('gallery pagination navigation', () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    scrollTo.mockClear();
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    setViewport(1440);
  });

  it('changes to the next page on one click and scrolls to the document top', async () => {
    const { container } = renderGallery();
    await screen.findByRole('navigation', { name: 'Portfolio pagination' });
    const pageOneTitle = firstCardTitle(container);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/web-copy?page=2'));
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page'));
    expect(firstCardTitle(container)).not.toBe(pageOneTitle);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });
  });

  it('changes to the previous page on one click and supports browser back and forward', async () => {
    renderGallery('/web-copy?page=2');
    await screen.findByRole('navigation', { name: 'Portfolio pagination' });

    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/web-copy'));
    await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page'));

    fireEvent.click(screen.getByRole('button', { name: 'Test browser back' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/web-copy?page=2'));
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page'));

    fireEvent.click(screen.getByRole('button', { name: 'Test browser forward' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/web-copy'));
    await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page'));
  });

  it('navigates directly to a numbered page and between non-adjacent pages', async () => {
    renderGallery('/web-copy?page=4');
    await screen.findByRole('navigation', { name: 'Portfolio pagination' });

    fireEvent.click(screen.getByRole('button', { name: '5' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/web-copy?page=5'));
    await waitFor(() => expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-current', 'page'));

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/web-copy'));
    await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page'));
  });

  it('preserves active filters while paging and resets to page one when a filter changes', async () => {
    renderGallery('/web-copy?company=rhino-africa&type=short-form');
    await screen.findByRole('navigation', { name: 'Portfolio pagination' });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => {
      const location = screen.getByTestId('location').textContent || '';
      const search = new URL(location, 'https://example.test').searchParams;
      expect(search.get('company')).toBe('rhino-africa');
      expect(search.get('type')).toBe('short-form');
      expect(search.get('page')).toBe('2');
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Content type' }), { target: { value: 'long-form' } });
    await waitFor(() => {
      const location = screen.getByTestId('location').textContent || '';
      const search = new URL(location, 'https://example.test').searchParams;
      expect(search.get('company')).toBe('rhino-africa');
      expect(search.get('type')).toBe('long-form');
      expect(search.has('page')).toBe(false);
    });
  });

  it('uses reduced-motion scrolling on mobile and keeps direct page URLs responsive', async () => {
    setViewport(390);
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const { container } = renderGallery('/web-copy?page=3');
    await screen.findByRole('navigation', { name: 'Portfolio pagination' });
    await waitFor(() => expect(container.querySelectorAll('article.portfolio-card')).toHaveLength(8));
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/web-copy?page=4'));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' }));

    setViewport(1440);
    await waitFor(() => expect(container.querySelectorAll('article.portfolio-card')).toHaveLength(12));
    expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-current', 'page');
  });
});

function recordForPage(page: number): PortfolioRecord {
  return {
    id: `page-${page}`,
    sourceUrl: `https://example.com/${page}`,
    canonicalUrl: `https://example.com/${page}`,
    company: 'Rhino Africa',
    category: 'web-copy',
    contentType: 'short-form',
    platform: 'Website',
    favourite: false,
    overview: '',
    title: `Page ${page}`,
    description: `Result for page ${page}`,
    imageUrl: '/images/fallback-web-copy.webp',
    displayOrder: page,
  };
}

function resultFor(query: PortfolioQuery): PaginatedResult {
  return {
    records: [recordForPage(query.page)],
    total: 5,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: 5,
  };
}

describe('usePortfolio request ordering', () => {
  it('prevents an older asynchronous result from replacing the current page', async () => {
    const resolvers = new Map<number, (result: PaginatedResult) => void>();
    const loader = vi.fn((query: PortfolioQuery) => new Promise<PaginatedResult>((resolve) => {
      resolvers.set(query.page, resolve);
    }));
    const firstQuery: PortfolioQuery = { category: 'web-copy', page: 1, pageSize: 12 };
    const secondQuery: PortfolioQuery = { ...firstQuery, page: 2 };

    function Harness({ query }: { query: PortfolioQuery }) {
      const { data, loading } = usePortfolio(query, loader);
      return <output>{loading ? 'loading' : `page-${data?.page}`}</output>;
    }

    const { rerender } = render(<Harness query={firstQuery} />);
    rerender(<Harness query={secondQuery} />);

    await act(async () => resolvers.get(2)?.(resultFor(secondQuery)));
    await waitFor(() => expect(screen.getByText('page-2')).toBeInTheDocument());

    await act(async () => resolvers.get(1)?.(resultFor(firstQuery)));
    expect(screen.getByText('page-2')).toBeInTheDocument();
  });
});
