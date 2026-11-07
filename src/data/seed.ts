import type { PortfolioRecord } from '../../shared/types';
import { canonicalizeUrl, humanizeSlug, stableId } from '../../shared/portfolio';

const actualFeatured = [
  { url: 'https://www.rhinoafrica.com/en/tours/serengeti-ngorongoro-zanzibar/2268', company: 'Rhino Africa', category: 'web-copy', type: 'long-form' },
  { url: 'https://www.rhinoafrica.com/en/tours/explore-maasai-mara-great-migration-mombasa/2267', company: 'Rhino Africa', category: 'web-copy', type: 'long-form' },
  { url: 'https://www.rhinoafrica.com/en/accommodation/silvan-safari/28239', company: 'Rhino Africa', category: 'web-copy', type: 'short-form' },
  { url: 'https://www.rhinoafrica.com/en/accommodation/jack-s-camp/24524', company: 'Rhino Africa', category: 'web-copy', type: 'short-form' },
  { url: 'https://www.rhinoafrica.com/en/destinations/tsavo-national-park/21727', company: 'Rhino Africa', category: 'web-copy', type: 'informational' },
  { url: 'https://www.rhinoafrica.com/en/destinations/lower-zambezi-national-park/2939', company: 'Rhino Africa', category: 'web-copy', type: 'informational' },
  { url: 'https://travelchasers.com/en-za/blog/mind-the-gap-europe-differences-tips/', company: 'Travel Chasers', category: 'blog', type: 'blog' },
  { url: 'https://www.instagram.com/p/DfJ5JmJDFf-/', company: '', category: 'social-media', type: 'social-post', platform: 'Instagram' },
] as const;

const fallbackByCategory = {
  blog: '/images/fallback-blog.webp',
  'web-copy': '/images/fallback-web-copy.webp',
  'social-media': '/images/fallback-social-media.webp',
};

export const seedRecords: PortfolioRecord[] = actualFeatured.map((item, index) => ({
  id: stableId(item.url),
  sourceUrl: item.url,
  canonicalUrl: canonicalizeUrl(item.url),
  company: item.company,
  category: item.category,
  contentType: item.type,
  platform: 'platform' in item ? item.platform : '',
  favourite: true,
  overview: '',
  title: item.category === 'social-media' ? 'Instagram post' : humanizeSlug(item.url),
  description: `Published ${item.category === 'blog' ? 'blog writing' : item.category === 'social-media' ? 'social media copy' : 'web copy'}${item.company ? ` for ${item.company}` : ''}.`,
  imageUrl: fallbackByCategory[item.category],
  displayOrder: index,
}));

export const fallbackImage = fallbackByCategory;
