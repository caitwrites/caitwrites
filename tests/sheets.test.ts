import { describe, expect, it } from 'vitest';
import { mapSheetValues, normalizeSheetRows } from '../worker/sheets';

describe('Google Sheets mapping', () => {
  it('maps required and future optional columns', () => {
    const mapped = mapSheetValues([
      ['Content Type', 'Page Link', 'Favourites', 'Company', 'Platform', 'Overview', 'Title Override', 'Image Override', 'Sort Order', 'Published'],
      [' INFORMATONAL ', ' https://example.com/page/ ', 'Yes', ' Rhino Africa ', '', ' Manual overview ', 'Manual title', 'https://example.com/image.jpg', '4', 'Yes'],
    ]);
    expect(mapped.skipped).toBe(0);
    expect(mapped.rows[0]).toMatchObject({ contentType: 'INFORMATONAL', favourite: true, company: 'Rhino Africa', overview: 'Manual overview', titleOverride: 'Manual title', sortOrder: 4, published: true });
  });

  it('skips malformed rows without mutating valid rows', () => {
    const mapped = mapSheetValues([['Content Type', 'Page Link'], ['UNKNOWN', 'https://example.com'], ['BLOG', 'not a url'], ['BLOG', 'https://example.com/blog']]);
    expect(mapped.skipped).toBe(2);
    expect(mapped.rows).toHaveLength(1);
  });

  it('deduplicates mapped rows and preserves favourite', () => {
    const base = { contentType: 'BLOG', company: '', platform: '', overview: '', titleOverride: '', imageOverride: '', sortOrder: null, published: true };
    const result = normalizeSheetRows([
      { ...base, sourceUrl: 'https://example.com/blog/', favourite: false, displayOrder: 0 },
      { ...base, sourceUrl: 'https://example.com/blog', favourite: true, displayOrder: 1 },
    ]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].favourite).toBe(true);
  });

  it('reads the documented A:H override columns without optional columns', () => {
    const mapped = mapSheetValues([
      ['Content Type', 'Page Link', 'Favourites', 'Company', 'Platform', 'Overview', 'Title Override', 'Image Override'],
      ['BLOG', 'https://example.com/newest', 'Yes', 'Travel Chasers', 'Blog', 'Manual description', 'Manual title', '/images/portfolio/newest.webp'],
    ]);
    expect(mapped.rows[0]).toMatchObject({
      overview: 'Manual description',
      titleOverride: 'Manual title',
      imageOverride: '/images/portfolio/newest.webp',
      displayOrder: 0,
    });
  });

  it('uses source-row position rather than optional sort order', () => {
    const mapped = mapSheetValues([
      ['Content Type', 'Page Link', 'Favourites', 'Company', 'Platform', 'Overview', 'Title Override', 'Image Override', 'Sort Order'],
      ['BLOG', 'https://example.com/older', 'No', '', '', '', '', '', '999'],
      ['BLOG', 'https://example.com/newer', 'No', '', '', '', '', '', '1'],
    ]);
    const result = normalizeSheetRows(mapped.rows);
    expect(result.records.map((record) => record.sourceUrl)).toEqual(['https://example.com/newer', 'https://example.com/older']);
    expect(result.records.map((record) => record.displayOrder)).toEqual([1, 0]);
  });
});
