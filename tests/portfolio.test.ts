import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, dedupeRecords, filterAndPaginate, normalizeContentType } from '../shared/portfolio';
import { seedRecords } from '../src/data/seed';
import { queryForCategory, routePaths, setFilterParam, staticPortfolioRecords } from '../src/lib/portfolio';
import { qaFixtureRecords } from '../src/data/qaFixtures';

describe('spreadsheet content normalization', () => {
  it('maps every supported source type', () => {
    expect(normalizeContentType('BLOG')).toEqual({ category: 'blog', type: 'blog' });
    expect(normalizeContentType('SHORT FORM')).toEqual({ category: 'web-copy', type: 'short-form' });
    expect(normalizeContentType('LONG FORM')).toEqual({ category: 'web-copy', type: 'long-form' });
    expect(normalizeContentType('SOCIAL POST')).toEqual({ category: 'social-media', type: 'social-post' });
  });

  it('corrects the existing INFORMATONAL typo', () => {
    expect(normalizeContentType('INFORMATONAL')).toEqual({ category: 'web-copy', type: 'informational' });
    expect(normalizeContentType('INFORMATIONAL')).toEqual({ category: 'web-copy', type: 'informational' });
  });
});

describe('URL deduplication', () => {
  it('normalizes trailing slashes while retaining query parameters', () => {
    expect(canonicalizeUrl('https://Example.com/work/?campaign=a')).toBe('https://example.com/work?campaign=a');
  });

  it('preserves a favourite flag from any duplicate', () => {
    const result = dedupeRecords([
      { sourceUrl: 'https://example.com/work/', favourite: false, displayOrder: 0 },
      { sourceUrl: 'https://example.com/work', favourite: true, displayOrder: 1 },
    ]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].favourite).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  it('uses the newest duplicate row for ordering while preserving non-empty overrides', () => {
    const result = dedupeRecords([
      { sourceUrl: 'https://example.com/work/', favourite: true, displayOrder: 4, company: 'Older company', overview: 'Older overview', titleOverride: 'Older manual title', imageOverride: '' },
      { sourceUrl: 'https://example.com/work', favourite: false, displayOrder: 17, company: 'Newest company', overview: '', titleOverride: '', imageOverride: '/images/portfolio/newest.webp' },
    ]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      displayOrder: 17,
      company: 'Newest company',
      favourite: true,
      overview: 'Older overview',
      titleOverride: 'Older manual title',
      imageOverride: '/images/portfolio/newest.webp',
    });
  });
});

describe('filtering and pagination', () => {
  it('combines category, company and type filters', () => {
    const result = filterAndPaginate(seedRecords, { category: 'web-copy', company: 'rhino-africa', type: 'informational', page: 1, pageSize: 12 });
    expect(result.total).toBe(2);
    expect(result.records.every((record) => record.company === 'Rhino Africa' && record.contentType === 'informational')).toBe(true);
  });

  it('sorts newest-first before filtering and pagination', () => {
    const records = [3, 12, 8, 20, 15].map((displayOrder) => ({
      ...seedRecords[0],
      id: `order-${displayOrder}`,
      canonicalUrl: `https://example.com/${displayOrder}`,
      sourceUrl: `https://example.com/${displayOrder}`,
      displayOrder,
      company: displayOrder === 3 ? 'Other' : 'Rhino Africa',
    }));
    const firstPage = filterAndPaginate(records, { category: 'web-copy', company: 'rhino-africa', page: 1, pageSize: 2 });
    const secondPage = filterAndPaginate(records, { category: 'web-copy', company: 'rhino-africa', page: 2, pageSize: 2 });
    expect(firstPage.records.map((record) => record.displayOrder)).toEqual([20, 15]);
    expect(secondPage.records.map((record) => record.displayOrder)).toEqual([12, 8]);
  });

  it('clamps pagination boundaries', () => {
    const result = filterAndPaginate(seedRecords, { category: 'web-copy', page: 99, pageSize: 2 });
    expect(result.page).toBe(result.totalPages);
    expect(result.records.length).toBeLessThanOrEqual(2);
  });

  it('resets page when a filter changes', () => {
    const params = setFilterParam(new URLSearchParams('type=long-form&page=2'), 'type', 'informational');
    expect(params.get('page')).toBeNull();
    expect(params.get('type')).toBe('informational');
  });

  it('restores query state from direct URLs', () => {
    const query = queryForCategory('web-copy', new URLSearchParams('company=rhino-africa&type=long-form&page=2'), 12);
    expect(query).toMatchObject({ company: 'rhino-africa', type: 'long-form', page: 2 });
    expect(routePaths).toContain('/social-media');
  });

  it('ships exactly eight real development favourites', () => {
    expect(seedRecords.filter((record) => record.favourite)).toHaveLength(8);
  });

  it('keeps visual-QA pagination fixtures clearly non-featured and separate', () => {
    expect(qaFixtureRecords).toHaveLength(42);
    expect(qaFixtureRecords.every((record) => !record.favourite && record.title.startsWith('[QA only]'))).toBe(true);
  });
});

describe('generated static portfolio', () => {
  it('contains at least the verified production baseline without duplicate URLs', () => {
    expect(staticPortfolioRecords.length).toBeGreaterThanOrEqual(218);
    expect(staticPortfolioRecords.filter((record) => record.favourite)).toHaveLength(8);
    expect(new Set(staticPortfolioRecords.map((record) => record.canonicalUrl)).size).toBe(staticPortfolioRecords.length);
  });

  it('preserves category mappings and supports static filtering and pagination', () => {
    const categoryCounts = ['web-copy', 'blog', 'social-media'].map(
      (category) => staticPortfolioRecords.filter((record) => record.category === category).length,
    );
    expect(categoryCounts.every((count) => count > 0)).toBe(true);
    expect(categoryCounts.reduce((total, count) => total + count, 0)).toBe(staticPortfolioRecords.length);
    const filtered = filterAndPaginate(staticPortfolioRecords, { category: 'web-copy', company: 'rhino-africa', type: 'short-form', page: 2, pageSize: 12 });
    expect(filtered.total).toBeGreaterThan(12);
    expect(filtered.page).toBe(2);
    expect(filtered.records.every((record) => record.company === 'Rhino Africa' && record.contentType === 'short-form')).toBe(true);
    expect(filtered.records.map((record) => record.displayOrder)).toEqual([...filtered.records].map((record) => record.displayOrder).sort((a, b) => b - a));
  });

  it('contains no credential-shaped content', () => {
    expect(JSON.stringify(staticPortfolioRecords)).not.toMatch(/BEGIN PRIVATE KEY|private_key_id|client_email|access_token|SYNC_SECRET/i);
  });
});
