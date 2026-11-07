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
});
