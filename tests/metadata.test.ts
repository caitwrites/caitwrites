import { describe, expect, it } from 'vitest';
import { applyManualOverrides, fetchMetadata, isSafePublicUrl, selectMetadata } from '../worker/metadata';

const input = { sourceUrl: 'https://example.com/a-useful-page', overview: '', titleOverride: '', imageOverride: '', category: 'blog' };

describe('metadata fallback priority', () => {
  it('keeps raw metadata separate, then prioritises manual values for display', () => {
    const manualInput = { ...input, titleOverride: 'Manual title', imageOverride: '/images/portfolio/manual.webp', overview: 'Manual overview' };
    const raw = selectMetadata(manualInput, { ogTitle: 'OG title', ogImage: 'https://cdn.example.com/og.jpg', ogDescription: 'OG description' });
    expect(raw).toEqual({ title: 'OG title', imageUrl: 'https://cdn.example.com/og.jpg', description: 'OG description' });
    expect(applyManualOverrides(manualInput, raw)).toEqual({ title: 'Manual title', imageUrl: '/images/portfolio/manual.webp', description: 'Manual overview' });
  });

  it('uses metadata in the documented order', () => {
    const selected = selectMetadata(input, { ogTitle: 'OG title', twitterTitle: 'Twitter', documentTitle: 'Document', ogImage: 'https://cdn.example.com/og.jpg', twitterImage: 'https://cdn.example.com/twitter.jpg', heroImage: 'https://cdn.example.com/hero.jpg', ogDescription: 'OG description', description: 'Meta', twitterDescription: 'Twitter description' });
    expect(selected.title).toBe('OG title');
    expect(selected.imageUrl).toContain('og.jpg');
    expect(selected.description).toBe('OG description');
    expect(selectMetadata(input, { heroImage: 'https://cdn.example.com/hero.jpg' }).imageUrl).toContain('hero.jpg');
  });

  it('provides a neutral missing-description fallback', () => {
    expect(selectMetadata(input, {}).description).toBe('View the original published work.');
  });

  it('preserves overrides across metadata refreshes and restores raw metadata when removed', () => {
    const manualInput = { ...input, titleOverride: 'Manual title', imageOverride: '/images/portfolio/manual.webp', overview: 'Manual overview' };
    const firstRefresh = { title: 'First metadata title', description: 'First metadata description', imageUrl: 'https://cdn.example.com/first.jpg' };
    const laterRefresh = { title: 'Later metadata title', description: 'Later metadata description', imageUrl: 'https://cdn.example.com/later.jpg' };
    expect(applyManualOverrides(manualInput, firstRefresh)).toEqual({ title: 'Manual title', description: 'Manual overview', imageUrl: '/images/portfolio/manual.webp' });
    expect(applyManualOverrides(manualInput, laterRefresh)).toEqual({ title: 'Manual title', description: 'Manual overview', imageUrl: '/images/portfolio/manual.webp' });
    expect(applyManualOverrides(input, laterRefresh)).toEqual(laterRefresh);
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
