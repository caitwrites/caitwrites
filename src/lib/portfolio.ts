import type { Category, PaginatedResult, PortfolioQuery, PortfolioRecord } from '../../shared/types';
import { filterAndPaginate } from '../../shared/portfolio';
import generatedPortfolio from '../data/portfolio.generated.json';
import { qaFixtureRecords } from '../data/qaFixtures';

export const staticPortfolioRecords = generatedPortfolio.records as PortfolioRecord[];

export interface FilterOption { label: string; value: string }

export function sortFilterOptions<T extends FilterOption>(options: T[]): T[] {
  const defaults = options.filter((option) => option.value === '');
  const choices = options.filter((option) => option.value !== '').sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return [...defaults, ...choices];
}

export async function getPortfolio(query: PortfolioQuery, signal?: AbortSignal): Promise<PaginatedResult> {
  if (import.meta.env.VITE_USE_API === 'true') {
    const params = new URLSearchParams({
      category: query.category,
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    if (query.company) params.set('company', query.company);
    if (query.type) params.set('type', query.type);
    if (query.platform) params.set('platform', query.platform);
    if (query.favourites) params.set('favourites', 'true');
    const response = await fetch(`/api/portfolio?${params}`, { signal });
    if (!response.ok) throw new Error('Portfolio content could not be loaded.');
    return response.json() as Promise<PaginatedResult>;
  }
  await Promise.resolve();
  const localRecords = import.meta.env.VITE_ENABLE_QA_FIXTURES === 'true' ? [...staticPortfolioRecords, ...qaFixtureRecords] : staticPortfolioRecords;
  return filterAndPaginate(localRecords, query);
}

export function categoryLabel(category: Category, contentType?: string): string {
  if (category === 'blog') return 'Blog';
  if (category === 'social-media') return 'Social Media';
  if (contentType === 'informational') return 'Informational';
  if (contentType === 'short-form') return 'Short-form';
  if (contentType === 'long-form') return 'Long-form';
  return 'Web Copy';
}

export const routePaths = ['/', '/blogs', '/web-copy', '/social-media', '/about', '/contact'] as const;

export function pageSizeForWidth(width: number): number {
  return width >= 1024 ? 12 : 8;
}

export function safePage(value: string | null): number {
  const parsed = Number.parseInt(value || '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function queryForCategory(category: Category, params: URLSearchParams, pageSize: number): PortfolioQuery {
  return {
    category,
    company: params.get('company') || undefined,
    type: params.get('type') || undefined,
    platform: params.get('platform') || undefined,
    page: safePage(params.get('page')),
    pageSize,
  };
}

export function setFilterParam(params: URLSearchParams, key: string, value: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  next.delete('page');
  return next;
}

export function titleForRecord(record: PortfolioRecord) {
  return record.title || 'Published work';
}
