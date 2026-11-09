import { describe, expect, it } from 'vitest';
import { buildPublicRecords, isSupportedImageOverride } from '../scripts/lib/portfolio-data.mjs';
import { refreshMetadata } from '../scripts/lib/metadata.mjs';

const record = {
  id: 'cw_test',
  sourceUrl: 'https://example.com/work',
  canonicalUrl: 'https://example.com/work',
  company: 'Example',
  category: 'blog',
  contentType: 'blog',
  platform: 'Blog',
  favourite: false,
  overview: '',
  titleOverride: '',
  imageOverride: '',
  displayOrder: 1,
  published: true,
};
const cache = {
  records: {
    [record.canonicalUrl]: {
      title: 'Metadata title',
      description: 'Metadata description',
      imageUrl: 'https://cdn.example.com/automatic.jpg',
    },
  },
};

describe('manual image override precedence', () => {
  it('supports absolute HTTPS and local portfolio image overrides', () => {
    expect(isSupportedImageOverride('https://cdn.example.com/manual.jpg')).toBe(true);
    expect(isSupportedImageOverride('/images/portfolio/manual.webp')).toBe(true);
    expect(isSupportedImageOverride('http://cdn.example.com/manual.jpg')).toBe(false);
    expect(isSupportedImageOverride('/images/portfolio/../private.webp')).toBe(false);

    expect(buildPublicRecords([{ ...record, imageOverride: 'https://cdn.example.com/manual.jpg' }], cache)[0].imageUrl)
      .toBe('https://cdn.example.com/manual.jpg');
    expect(buildPublicRecords([{ ...record, imageOverride: '/images/portfolio/manual.webp' }], cache)[0].imageUrl)
      .toBe('/images/portfolio/manual.webp');
  });

  it('restores cached automatic metadata when an override is removed', () => {
    const overridden = buildPublicRecords([{ ...record, imageOverride: 'https://cdn.example.com/manual.jpg' }], cache)[0];
    const restored = buildPublicRecords([{ ...record, imageOverride: '' }], cache)[0];
    expect(overridden.imageUrl).toBe('https://cdn.example.com/manual.jpg');
    expect(restored.imageUrl).toBe('https://cdn.example.com/automatic.jpg');
    expect(cache.records[record.canonicalUrl].imageUrl).toBe('https://cdn.example.com/automatic.jpg');
  });

  it('upgrades a fallback image without changing existing cached text', async () => {
    const imageUpgradeCache = {
      version: 2,
      records: {
        [record.canonicalUrl]: {
          title: 'Existing title',
          description: 'Existing description',
          imageUrl: '/images/fallback-blog.webp',
          status: 'failed',
          lastRefreshed: new Date().toISOString(),
          imageDetectionVersion: 0,
        },
      },
    };
    const fetcher = async () => ({
      title: 'New metadata title',
      description: 'New metadata description',
      imageUrl: 'https://cdn.example.com/detected.jpg',
      imageSource: 'hero',
      imageDetectionVersion: 2,
      status: 'success',
      error: '',
    });
    const result = await refreshMetadata([record], imageUpgradeCache, 8, fetcher);
    expect(result.imageSources.hero).toBe(1);
    expect(imageUpgradeCache.records[record.canonicalUrl]).toMatchObject({
      title: 'Existing title',
      description: 'Existing description',
      imageUrl: 'https://cdn.example.com/detected.jpg',
      imageDetectionVersion: 2,
    });
  });
});
