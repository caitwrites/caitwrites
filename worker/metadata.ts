import { humanizeSlug } from '../shared/portfolio';

export interface MetadataInput { sourceUrl: string; overview: string; titleOverride: string; imageOverride: string; category: string }
export interface MetadataResult { title: string; description: string; imageUrl: string; status: 'success' | 'blocked' | 'failed'; error: string }

const MAX_BYTES = 512_000;
const fallbackImages: Record<string, string> = { blog: '/images/fallback-blog.webp', 'web-copy': '/images/fallback-web-copy.webp', 'social-media': '/images/fallback-social-media.webp' };

export function isSafePublicUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.username || url.password || !['', '80', '443'].includes(url.port)) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(host)) return false;
    const match = host.match(/^172\.(\d+)\./);
    if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return false;
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return false;
    return true;
  } catch { return false; }
}

function isPrivateAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (/^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(value)) return true;
  const match = value.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:') || /::ffff:(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(value);
}

async function resolvesOnlyToPublicAddresses(raw: string): Promise<boolean> {
  const hostname = new URL(raw).hostname.replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return !isPrivateAddress(hostname);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const lookups = await Promise.all(['A', 'AAAA'].map(async (type) => {
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal: controller.signal });
      if (!response.ok) throw new Error('DNS safety lookup failed.');
      const payload = await response.json<{ Answer?: Array<{ type: number; data: string }> }>();
      return (payload.Answer || []).filter((answer) => answer.type === 1 || answer.type === 28).map((answer) => answer.data);
    }));
    const addresses = lookups.flat();
    return addresses.length > 0 && addresses.every((address) => !isPrivateAddress(address));
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function decode(value: string): string {
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => entity.startsWith('#') ? String.fromCodePoint(Number.parseInt(entity.slice(entity[1]?.toLowerCase() === 'x' ? 2 : 1), entity[1]?.toLowerCase() === 'x' ? 16 : 10)) : entities[entity.toLowerCase()] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function meta(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'), new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')];
  for (const pattern of patterns) { const match = html.match(pattern); if (match?.[1]) return decode(match[1]); }
  return '';
}

export function selectMetadata(input: MetadataInput, extracted: { ogTitle?: string; twitterTitle?: string; documentTitle?: string; ogImage?: string; twitterImage?: string; ogDescription?: string; description?: string; twitterDescription?: string }): Pick<MetadataResult, 'title' | 'description' | 'imageUrl'> {
  return {
    title: extracted.ogTitle || extracted.twitterTitle || extracted.documentTitle || humanizeSlug(input.sourceUrl),
    imageUrl: extracted.ogImage || extracted.twitterImage || fallbackImages[input.category] || fallbackImages['web-copy'],
    description: extracted.ogDescription || extracted.description || extracted.twitterDescription || 'View the original published work.',
  };
}

export function applyManualOverrides(input: MetadataInput, metadata: Pick<MetadataResult, 'title' | 'description' | 'imageUrl'>): Pick<MetadataResult, 'title' | 'description' | 'imageUrl'> {
  return {
    title: input.titleOverride || metadata.title,
    description: input.overview || metadata.description,
    imageUrl: input.imageOverride || metadata.imageUrl,
  };
}

async function readBounded(response: Response): Promise<string> {
  const length = Number(response.headers.get('content-length') || '0');
  if (length > MAX_BYTES) throw new Error('Response exceeded metadata size limit.');
  if (!response.body) return '';
  const reader = response.body.getReader(); let total = 0; const chunks: Uint8Array[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_BYTES) { await reader.cancel(); throw new Error('Response exceeded metadata size limit.'); } chunks.push(value); }
  const merged = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

export async function fetchMetadata(input: MetadataInput): Promise<MetadataResult> {
  if (!isSafePublicUrl(input.sourceUrl)) return { ...selectMetadata(input, {}), status: 'blocked', error: 'URL failed public-network safety validation.' };
  if (!(await resolvesOnlyToPublicAddresses(input.sourceUrl))) return { ...selectMetadata(input, {}), status: 'blocked', error: 'URL did not resolve exclusively to public network addresses.' };
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(input.sourceUrl, { signal: controller.signal, redirect: 'follow', headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'CaitWritesMetadataBot/1.0 (+portfolio metadata cache)' } });
    if (!response.ok) throw new Error(`Source returned ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) throw new Error('Source did not return HTML.');
    const html = await readBounded(response);
    const documentTitle = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const resolve = (value: string) => { try { return value ? new URL(value, input.sourceUrl).toString() : ''; } catch { return ''; } };
    const selected = selectMetadata(input, { ogTitle: meta(html, 'og:title'), twitterTitle: meta(html, 'twitter:title'), documentTitle, ogImage: resolve(meta(html, 'og:image')), twitterImage: resolve(meta(html, 'twitter:image')), ogDescription: meta(html, 'og:description'), description: meta(html, 'description'), twitterDescription: meta(html, 'twitter:description') });
    return { ...selected, status: 'success', error: '' };
  } catch (error) {
    return { ...selectMetadata(input, {}), status: /instagram|facebook|linkedin/i.test(input.sourceUrl) ? 'blocked' : 'failed', error: error instanceof Error ? error.message.slice(0, 300) : 'Metadata fetch failed.' };
  } finally { clearTimeout(timeout); }
}
