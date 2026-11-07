import type { Category, PaginatedResult, PortfolioQuery, PortfolioRecord, WebCopyType } from './types';

export const companySlug = (value: string) => value.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function canonicalizeUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  return url.toString();
}

export function stableId(url: string): string {
  let hash = 2166136261;
  for (const char of canonicalizeUrl(url)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `cw_${(hash >>> 0).toString(36)}`;
}

export function normalizeContentType(raw: string): { category: Category; type: string } | null {
  const value = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (value === 'BLOG') return { category: 'blog', type: 'blog' };
  if (value === 'SOCIAL POST') return { category: 'social-media', type: 'social-post' };
  const webTypes: Record<string, WebCopyType> = {
    'SHORT FORM': 'short-form',
    'LONG FORM': 'long-form',
    INFORMATONAL: 'informational',
    INFORMATIONAL: 'informational',
  };
  return webTypes[value] ? { category: 'web-copy', type: webTypes[value] } : null;
}

export function dedupeRecords<T extends { sourceUrl: string; favourite: boolean; displayOrder: number }>(records: T[]): { records: T[]; warnings: string[] } {
  const byUrl = new Map<string, T>();
  const warnings: string[] = [];
  for (const record of records) {
    const key = canonicalizeUrl(record.sourceUrl);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, { ...record, sourceUrl: record.sourceUrl.trim() });
      continue;
    }
    warnings.push(`Duplicate URL at display positions ${existing.displayOrder} and ${record.displayOrder}: ${key}`);
    byUrl.set(key, { ...existing, favourite: existing.favourite || record.favourite });
  }
  return { records: [...byUrl.values()].sort((a, b) => a.displayOrder - b.displayOrder), warnings };
}

export function filterAndPaginate(records: PortfolioRecord[], query: PortfolioQuery): PaginatedResult {
  const filtered = records.filter((record) => {
    if (record.category !== query.category) return false;
    if (query.favourites && !record.favourite) return false;
    if (query.company && companySlug(record.company) !== query.company) return false;
    if (query.type && record.contentType !== query.type) return false;
    if (query.platform && companySlug(record.platform) !== query.platform) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const start = (page - 1) * query.pageSize;
  return { records: filtered.slice(start, start + query.pageSize), total: filtered.length, page, pageSize: query.pageSize, totalPages };
}

export function humanizeSlug(url: string): string {
  try {
    const urlObject = new URL(url);
    const parts = urlObject.pathname.split('/').filter(Boolean);
    const last = parts.at(-1) || urlObject.hostname;
    const path = /^\d+$/.test(last) && parts.length > 1 ? parts.at(-2)! : last;
    return path.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return 'Published work';
  }
}
