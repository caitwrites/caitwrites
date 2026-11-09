const SOURCE_PRIORITY = {
  'open-graph': 3_000,
  twitter: 2_000,
  hero: 1_000,
};

const POSITIVE_HINT = /(?:^|[\s_:/-])(hero|banner|featured|feature|lead|masthead|cover|background-cover|article[-_ ]?image|post[-_ ]?image|primary[-_ ]?image)(?:$|[\s_:/-])/i;
const NEGATIVE_HINT = /(?:^|[\s_:/-])(logo|favicon|icon|sprite|avatar|badge|tracking|pixel|spacer|blank|placeholder|advert|advertisement|doubleclick|gravatar)(?:$|[\s_:/.-])/i;
const CAIT_HERO = /cait-hero-(?:desktop|mobile)\.webp/i;

export function decodeHtml(value) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity.startsWith('#')) {
      const hexadecimal = entity[1]?.toLowerCase() === 'x';
      const parsed = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : '';
    }
    return entities[entity.toLowerCase()] ?? '';
  });
}

function attributes(tag) {
  const result = {};
  const pattern = /([^\s=<>`]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '').trim();
  }
  return result;
}

export function getMetaContent(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if ((attrs.property || attrs.name || '').toLowerCase() === name.toLowerCase()) return attrs.content || '';
  }
  return '';
}

export function normalizeImageUrl(raw, baseUrl) {
  try {
    const value = decodeHtml(raw).trim();
    if (!value || /^(?:data|blob|javascript|file):/i.test(value)) return '';
    const url = new URL(value, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    if (!['', '80', '443'].includes(url.port)) return '';
    if (/(?:cdninstagram\.com|fbcdn\.net)$/i.test(url.hostname)) return '';
    const searchable = `${url.hostname}${url.pathname}`.toLowerCase();
    const strongHint = POSITIVE_HINT.test(searchable);
    if (CAIT_HERO.test(searchable) || /\.(?:svg|ico)(?:$|[?#])/i.test(url.pathname)) return '';
    if (NEGATIVE_HINT.test(searchable) && !strongHint) return '';
    if (/(?:^|[/_.-])thumb(?:nail)?(?:s|[/_.-]|$)/i.test(searchable) && !strongHint) return '';
    const width = Number(url.searchParams.get('w') || url.searchParams.get('width') || '0');
    const height = Number(url.searchParams.get('h') || url.searchParams.get('height') || '0');
    if ((width > 0 && width < 200) || (height > 0 && height < 120)) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function bestSrcset(value) {
  return String(value || '').split(',').map((entry) => {
    const [url, descriptor = ''] = entry.trim().split(/\s+/, 2);
    const width = descriptor.endsWith('w') ? Number.parseInt(descriptor, 10) : 0;
    const density = descriptor.endsWith('x') ? Number.parseFloat(descriptor) * 1_000 : 0;
    return { url, size: Number.isFinite(width + density) ? width + density : 0 };
  }).filter((entry) => entry.url).sort((a, b) => b.size - a.size)[0] || { url: '', size: 0 };
}

function dimensions(attrs) {
  const width = Number.parseInt(attrs.width || attrs['data-width'] || '0', 10);
  const height = Number.parseInt(attrs.height || attrs['data-height'] || '0', 10);
  return {
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  };
}

function heroScore(tag, context, position, htmlLength) {
  const attrs = attributes(tag);
  const hintText = `${attrs.class || ''} ${attrs.id || ''} ${attrs.alt || ''} ${attrs.title || ''} ${attrs.role || ''}`;
  const { width, height } = dimensions(attrs);
  if ((width > 0 && width < 200) || (height > 0 && height < 120)) return -1;
  if (NEGATIVE_HINT.test(hintText) && !POSITIVE_HINT.test(hintText)) return -1;
  let score = 20;
  if (POSITIVE_HINT.test(hintText)) score += 75;
  if (/<(?:article|main|header)\b/i.test(context)) score += 25;
  if (width >= 600) score += 30;
  else if (width >= 320) score += 12;
  if (height >= 300) score += 20;
  else if (height >= 180) score += 8;
  if (attrs.alt && attrs.alt.length >= 8) score += 5;
  if (/srcset/i.test(tag)) score += 15;
  if (position < htmlLength * 0.4) score += 10;
  return score;
}

function structuredImages(html) {
  const values = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]).trim());
      const visit = (value, key = '', articleContext = false) => {
        if (!value) return;
        if (typeof value === 'string') {
          if (['image', 'contenturl', 'thumbnailurl', 'primaryimageofpage'].includes(key.toLowerCase())) {
            values.push({ value, score: articleContext ? 155 : 115 });
          }
          return;
        }
        if (Array.isArray(value)) {
          for (const item of value) visit(item, key, articleContext);
          return;
        }
        if (typeof value !== 'object') return;
        const type = String(value['@type'] || '');
        const nextArticleContext = articleContext || /Article|BlogPosting|NewsArticle/i.test(type);
        for (const [childKey, child] of Object.entries(value)) {
          if (childKey === 'url' && ['image', 'primaryimageofpage'].includes(key.toLowerCase()) && typeof child === 'string') {
            values.push({ value: child, score: nextArticleContext ? 155 : 115 });
          } else {
            visit(child, childKey, nextArticleContext);
          }
        }
      };
      visit(parsed);
    } catch {
      // Invalid structured data is ignored; page markup can still provide a candidate.
    }
  }
  return values;
}

export function collectImageCandidates(html, baseUrl) {
  const candidates = [];
  const add = (raw, source, score) => {
    const url = normalizeImageUrl(raw, baseUrl);
    if (url) candidates.push({ url, source, score: SOURCE_PRIORITY[source] + score });
  };

  add(getMetaContent(html, 'og:image') || getMetaContent(html, 'og:image:url'), 'open-graph', 0);
  add(getMetaContent(html, 'twitter:image') || getMetaContent(html, 'twitter:image:src'), 'twitter', 0);

  for (const item of structuredImages(html)) add(item.value, 'hero', item.score);

  const tagPattern = /<(?:img|source)\b[^>]*>/gi;
  for (const match of html.matchAll(tagPattern)) {
    const tag = match[0];
    const attrs = attributes(tag);
    const position = match.index || 0;
    const context = html.slice(Math.max(0, position - 700), Math.min(html.length, position + tag.length + 250));
    const score = heroScore(tag, context, position, html.length);
    if (score < 60) continue;
    const srcset = bestSrcset(attrs.srcset || attrs['data-srcset'] || attrs['data-lazy-srcset']);
    const responsiveBonus = srcset.size >= 1_200 ? 150 : srcset.size >= 600 ? 60 : 0;
    const raw = srcset.url
      || attrs.src
      || attrs['data-src']
      || attrs['data-lazy-src']
      || attrs['data-original']
      || attrs['data-image']
      || attrs['data-flickity-lazyload'];
    add(raw, 'hero', score + responsiveBonus);
  }

  for (const match of html.matchAll(/<[^>]+style=["'][^"']*background(?:-image)?\s*:\s*url\((?:["']?)([^)"']+)["']?\)[^"']*["'][^>]*>/gi)) {
    const tag = match[0];
    if (POSITIVE_HINT.test(tag)) add(match[1], 'hero', 170);
  }

  const deduplicated = new Map();
  for (const candidate of candidates) {
    const existing = deduplicated.get(candidate.url);
    if (!existing || candidate.score > existing.score) deduplicated.set(candidate.url, candidate);
  }
  return [...deduplicated.values()].sort((a, b) => b.score - a.score);
}

export async function chooseUsableImage(candidates, validate, limit = 4) {
  for (const candidate of candidates.slice(0, Math.max(0, limit))) {
    try {
      if (await validate(candidate)) return candidate;
    } catch {
      // An inaccessible candidate must not prevent lower-priority candidates from being tried.
    }
  }
  return null;
}
