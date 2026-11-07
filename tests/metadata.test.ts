import { describe, expect, it } from 'vitest';
import { fetchMetadata, isSafePublicUrl, selectMetadata } from '../worker/metadata';

const input = { sourceUrl: 'https://example.com/a-useful-page', overview: '', titleOverride: '', imageOverride: '', category: 'blog' };

describe('metadata fallback priority', () => {
  it('prioritises manual values and Overview', () => {
    const selected = selectMetadata({ ...input, titleOverride: 'Manual title', imageOverride: 'https://cdn.example.com/manual.jpg', overview: 'Manual overview' }, { ogTitle: 'OG title', ogImage: 'https://cdn.example.com/og.jpg', ogDescription: 'OG description' });
    expect(selected).toEqual({ title: 'Manual title', imageUrl: 'https://cdn.example.com/manual.jpg', description: 'Manual overview' });
  });

  it('uses metadata in the documented order', () => {
    const selected = selectMetadata(input, { ogTitle: 'OG title', twitterTitle: 'Twitter', documentTitle: 'Document', ogImage: 'https://cdn.example.com/og.jpg', twitterImage: 'https://cdn.example.com/twitter.jpg', ogDescription: 'OG description', description: 'Meta', twitterDescription: 'Twitter description' });
    expect(selected.title).toBe('OG title');
    expect(selected.imageUrl).toContain('og.jpg');
    expect(selected.description).toBe('OG description');
  });

  it('provides a neutral missing-description fallback', () => {
    expect(selectMetadata(input, {}).description).toBe('View the original published work.');
  });

  it('blocks private and local network targets', () => {
    expect(isSafePublicUrl('http://127.0.0.1/admin')).toBe(false);
    expect(isSafePublicUrl('http://192.168.1.1/admin')).toBe(false);
    expect(isSafePublicUrl('https://example.com/page')).toBe(true);
  });

  it('handles blocked social metadata without throwing', async () => {
    const result = await fetchMetadata({ ...input, sourceUrl: 'http://127.0.0.1/instagram' });
    expect(result.status).toBe('blocked');
    expect(result.imageUrl).toBe('/images/fallback-blog.webp');
  });
});
