import { describe, expect, it } from 'vitest';
import {
  buildCompanyDirectoryDataset,
  mapCompanyDirectoryValues,
  normalizePublicCompanyUrl,
  resolveCompanyDirectory,
} from '../scripts/lib/company-directory.mjs';

const header = ['Content Type', 'Company', 'Company Link'];
const existingDataset = buildCompanyDirectoryDataset([
  header,
  ['', 'Rhino Africa', 'https://www.rhinoafrica.com/en'],
  ['', 'Travel Chasers', 'https://travelchasers.com/en-za/'],
  ['', 'Lawsons & Daughters', 'https://www.ld.london/'],
], '2026-01-01T00:00:00.000Z');

describe('static company directory', () => {
  it('reads columns B and C independently and supports a fourth company', () => {
    const dataset = buildCompanyDirectoryDataset([
      header,
      ['BLOG', 'Rhino Africa', 'https://www.rhinoafrica.com/en'],
      ['SHORT FORM', 'Travel Chasers', 'https://travelchasers.com/en-za/'],
      ['', 'Lawsons & Daughters', 'https://www.ld.london/'],
      ['', 'Fourth Company', 'https://fourth.example.org/'],
    ]);
    expect(dataset.companies).toHaveLength(4);
    expect(dataset.companies[3]).toEqual({ name: 'Fourth Company', url: 'https://fourth.example.org/' });
  });

  it('ignores empty rows, incomplete rows, invalid URLs and case-insensitive duplicates', () => {
    const mapped = mapCompanyDirectoryValues([
      header,
      ['', '', ''],
      ['', 'Rhino Africa', 'https://www.rhinoafrica.com/en'],
      ['', ' rhino africa ', 'https://example.org/duplicate'],
      ['', 'Missing URL', ''],
      ['', 'Unsafe', 'javascript:alert(1)'],
      ['', 'Private', 'http://127.0.0.1/company'],
    ]);
    expect(mapped.companies).toEqual([{ name: 'Rhino Africa', url: 'https://www.rhinoafrica.com/en' }]);
    expect(mapped).toMatchObject({ emptyRows: 1, duplicateRows: 1, invalidRows: 3 });
  });

  it('accepts only public HTTP and HTTPS destinations', () => {
    expect(normalizePublicCompanyUrl('https://example.org/path#team')).toBe('https://example.org/path');
    expect(() => normalizePublicCompanyUrl('ftp://example.org')).toThrow();
    expect(() => normalizePublicCompanyUrl('http://192.168.1.20')).toThrow();
    expect(() => normalizePublicCompanyUrl('https://user:pass@example.org')).toThrow();
  });

  it('preserves the existing directory when LOOKUP synchronisation fails', async () => {
    const resolved = await resolveCompanyDirectory({
      existingDataset,
      readValues: async () => { throw new Error('Google Sheets unavailable'); },
    });
    expect(resolved.updated).toBe(false);
    expect(resolved.dataset).toEqual(existingDataset);
    expect(resolved.warning).toBe('Google Sheets unavailable');
  });

  it('preserves the existing directory when LOOKUP has no usable links', async () => {
    const resolved = await resolveCompanyDirectory({
      existingDataset,
      readValues: async () => [header, ['', 'Unsafe', 'javascript:alert(1)']],
    });
    expect(resolved.updated).toBe(false);
    expect(resolved.dataset.companies).toHaveLength(3);
  });
});
