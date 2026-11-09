import { describe, expect, it, vi } from 'vitest';
import {
  chooseUsableImage,
  collectImageCandidates,
  normalizeImageUrl,
} from '../scripts/lib/image-detection.mjs';

const baseUrl = 'https://www.rhinoafrica.com/en/example/article';

describe('portfolio image detection', () => {
  it('keeps Open Graph ahead of Twitter and page hero images', () => {
    const candidates = collectImageCandidates(`
      <meta name="twitter:image" content="/images/twitter.jpg">
      <meta content="/images/open-graph.jpg" property="og:image">
      <main><img class="article-hero" src="/images/hero.jpg" width="1400" height="800" alt="Article landscape"></main>
    `, baseUrl);
    expect(candidates.map((candidate) => candidate.source).slice(0, 3)).toEqual(['open-graph', 'twitter', 'hero']);
    expect(candidates[0].url).toBe('https://www.rhinoafrica.com/images/open-graph.jpg');
  });

  it('finds a relative hero in picture and srcset markup', () => {
    const candidates = collectImageCandidates(`
      <header class="article-header hero">
        <picture>
          <source srcset="/media/story-small.webp 480w, /media/story-large.webp 1600w">
          <img src="/media/story-small.webp" width="1200" height="675" alt="Safari article hero">
        </picture>
      </header>
    `, baseUrl);
    expect(candidates[0]).toMatchObject({
      source: 'hero',
      url: 'https://www.rhinoafrica.com/media/story-large.webp',
    });
  });

  it('supports lazy-loaded article images and structured-data images', () => {
    const lazy = collectImageCandidates(`
      <main><article><img class="article-image" data-lazy-src="/uploads/lazy-story.jpg" width="1280" height="720" alt="Travel story"></article></main>
    `, 'https://travelchasers.com/en-za/blog/story/');
    expect(lazy[0]?.url).toBe('https://travelchasers.com/uploads/lazy-story.jpg');

    const structured = collectImageCandidates(`
      <script type="application/ld+json">{"@type":"BlogPosting","image":{"url":"/uploads/structured.jpg"}}</script>
    `, 'https://travelchasers.com/en-za/blog/story/');
    expect(structured[0]).toMatchObject({ source: 'hero', url: 'https://travelchasers.com/uploads/structured.jpg' });
  });

  it('rejects logos, tracking pixels, tiny images and the Cait homepage portrait', () => {
    const candidates = collectImageCandidates(`
      <header><img class="site-logo" src="/assets/company-logo.svg" width="300" height="80"></header>
      <img src="https://tracking.example/pixel.gif?w=1&h=1" width="1" height="1">
      <main><img class="hero" src="/images/cait-hero-desktop.webp" width="1402" height="1122"></main>
    `, baseUrl);
    expect(candidates).toEqual([]);
    expect(normalizeImageUrl('data:image/png;base64,abc', baseUrl)).toBe('');
    expect(normalizeImageUrl('https://scontent.example.cdninstagram.com/photo.jpg?oe=123', baseUrl)).toBe('');
  });

  it('falls through from an inaccessible metadata image to a usable hero', async () => {
    const candidates = collectImageCandidates(`
      <meta property="og:image" content="https://cdn.example.com/missing.jpg">
      <article><img class="featured-image" src="https://cdn.example.com/hero.jpg" width="1200" height="630"></article>
    `, baseUrl);
    const validate = vi.fn(async (candidate: { url: string }) => candidate.url.endsWith('/hero.jpg'));
    const selected = await chooseUsableImage(candidates, validate);
    expect(validate).toHaveBeenCalledTimes(2);
    expect(selected).toMatchObject({ source: 'hero', url: 'https://cdn.example.com/hero.jpg' });
  });
});
