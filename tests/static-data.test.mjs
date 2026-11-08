import { describe, expect, it } from 'vitest';
import { buildPublicRecords, migrateMetadataCache } from '../scripts/lib/portfolio-data.mjs';

const baseRecord = {
  id: 'cw_test',
  sourceUrl: 'https://example.com/work',
  canonicalUrl: 'https://example.com/work',
  company: 'Example',
  category: 'web-copy',
  contentType: 'short-form',
  platform: 'Website',
  favourite: true,
  overview: '',
  titleOverride: '',
  imageOverride: '',
  displayOrder: 10,
  published: true,
};

describe('static metadata and manual overrides', () => {
  it('applies manual precedence without mutating the raw cache', () => {
    const cache = { version: 2, records: { [baseRecord.canonicalUrl]: { title: 'Raw title', description: 'Raw description', imageUrl: 'https://example.com/raw.webp', status: 'success', lastRefreshed: '2026-01-01T00:00:00.000Z' } } };
    const manual = { ...baseRecord, overview: 'Manual description', titleOverride: 'Manual title', imageOverride: '/images/portfolio/east-africa-safari.webp' };
    expect(buildPublicRecords([manual], cache)[0]).toMatchObject({ title: 'Manual title', description: 'Manual description', imageUrl: '/images/portfolio/east-africa-safari.webp' });
    expect(cache.records[baseRecord.canonicalUrl]).toMatchObject({ title: 'Raw title', description: 'Raw description', imageUrl: 'https://example.com/raw.webp' });
    expect(buildPublicRecords([baseRecord], cache)[0]).toMatchObject({ title: 'Raw title', description: 'Raw description', imageUrl: 'https://example.com/raw.webp' });
  });

  it('sanitises legacy override-contaminated cache fields during migration', () => {
    const manual = { ...baseRecord, overview: 'Manual description', titleOverride: 'Manual title', imageOverride: '/images/portfolio/manual.webp' };
    const cache = { version: 1, records: { [baseRecord.canonicalUrl]: { title: 'Manual title', description: 'Manual description', imageUrl: '/images/portfolio/manual.webp', status: 'success', lastRefreshed: '2026-01-01T00:00:00.000Z' } } };
    expect(migrateMetadataCache(cache, [manual])).toEqual({ migratedRecords: 1, sanitizedFields: 3 });
    expect(cache.version).toBe(2);
    expect(cache.records[baseRecord.canonicalUrl]).toMatchObject({
      title: 'Work',
      description: 'View the original published work.',
      imageUrl: '/images/fallback-web-copy.webp',
      status: 'pending',
      needsRawRefresh: ['title', 'description', 'image'],
    });
  });

  it('emits static records newest-first', () => {
    const cache = { version: 2, records: {} };
    const records = [2, 30, 11].map((displayOrder) => ({ ...baseRecord, id: `cw_${displayOrder}`, canonicalUrl: `https://example.com/${displayOrder}`, sourceUrl: `https://example.com/${displayOrder}`, displayOrder }));
    expect(buildPublicRecords(records, cache).map((record) => record.displayOrder)).toEqual([30, 11, 2]);
  });
});
