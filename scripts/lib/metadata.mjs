import dns from 'node:dns/promises';
import net from 'node:net';
import { fallbackImages, humanizeSlug } from './portfolio-data.mjs';

const MAX_BYTES = 512_000;
const MAX_REDIRECTS = 5;
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

function isPrivateAddress(address) {
  const value = String(address).toLowerCase().replace(/^\[|\]$/g, '');
  if (/^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(value)) return true;
  const match = value.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:') || /::ffff:(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(value);
}

export function isSafePublicUrl(raw) {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.username || url.password || !['', '80', '443'].includes(url.port)) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (net.isIP(host)) return !isPrivateAddress(host);
    return true;
  } catch {
    return false;
  }
}

async function resolvesOnlyToPublicAddresses(raw) {
  const hostname = new URL(raw).hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostname)) return !isPrivateAddress(hostname);
  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
  } catch {
    return false;
  }
}

function decode(value) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity.startsWith('#')) {
      const hexadecimal = entity[1]?.toLowerCase() === 'x';
      return String.fromCodePoint(Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
    }
    return entities[entity.toLowerCase()] ?? '';
  }).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decode(match[1]);
  }
  return '';
}

async function readBounded(response) {
  const length = Number(response.headers.get('content-length') || '0');
  if (length > MAX_BYTES) throw new Error('Response exceeded metadata size limit.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  let total = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error('Response exceeded metadata size limit.');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function selectMetadata(record, extracted = {}) {
  return {
    title: extracted.ogTitle || extracted.twitterTitle || extracted.documentTitle || humanizeSlug(record.sourceUrl),
    imageUrl: extracted.ogImage || extracted.twitterImage || fallbackImages[record.category] || fallbackImages['web-copy'],
    description: extracted.ogDescription || extracted.description || extracted.twitterDescription || 'View the original published work.',
  };
}

async function fetchWithSafeRedirects(rawUrl, signal) {
  let currentUrl = rawUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (!isSafePublicUrl(currentUrl) || !(await resolvesOnlyToPublicAddresses(currentUrl))) throw new Error('URL failed public-network safety validation.');
    const response = await fetch(currentUrl, {
      signal,
      redirect: 'manual',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'CaitWritesMetadataBot/1.0 (+portfolio metadata cache)',
      },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: currentUrl };
    const location = response.headers.get('location');
    if (!location) throw new Error('Source returned an invalid redirect.');
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error('Source exceeded the redirect limit.');
}

export async function fetchMetadata(record) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const { response, finalUrl } = await fetchWithSafeRedirects(record.sourceUrl, controller.signal);
    if (!response.ok) throw new Error(`Source returned ${response.status}.`);
    if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('Source did not return HTML.');
    const html = await readBounded(response);
    const documentTitle = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const resolve = (value) => {
      try {
        return value ? new URL(value, finalUrl).toString() : '';
      } catch {
        return '';
      }
    };
    return {
      ...selectMetadata(record, {
        ogTitle: meta(html, 'og:title'),
        twitterTitle: meta(html, 'twitter:title'),
        documentTitle,
        ogImage: resolve(meta(html, 'og:image')),
        twitterImage: resolve(meta(html, 'twitter:image')),
        ogDescription: meta(html, 'og:description'),
        description: meta(html, 'description'),
        twitterDescription: meta(html, 'twitter:description'),
      }),
      status: 'success',
    };
  } catch {
    return {
      ...selectMetadata(record),
      status: /instagram|facebook|linkedin/i.test(record.sourceUrl) ? 'blocked' : 'failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function needsRefresh(record, cached, now) {
  if (!cached) return true;
  if (cached.status === 'pending' || cached.status === 'failed') return true;
  const refreshed = Date.parse(cached.lastRefreshed || '');
  return !Number.isFinite(refreshed) || now - refreshed > REFRESH_AFTER_MS;
}

export async function refreshMetadata(records, cache, limit = 8) {
  const now = Date.now();
  const queue = records.filter((record) => record.published && needsRefresh(record, cache.records?.[record.canonicalUrl], now)).sort((a, b) => {
    const urgent = (record) => (cache.records?.[record.canonicalUrl]?.needsRawRefresh || []).some((field) => (
      (field === 'title' && !record.titleOverride)
      || (field === 'description' && !record.overview)
      || (field === 'image' && !record.imageOverride)
    ));
    const aUrgent = urgent(a);
    const bUrgent = urgent(b);
    if (aUrgent !== bUrgent) return Number(bUrgent) - Number(aUrgent);
    if (a.favourite !== b.favourite) return Number(b.favourite) - Number(a.favourite);
    const aMissing = cache.records?.[a.canonicalUrl] ? 0 : 1;
    const bMissing = cache.records?.[b.canonicalUrl] ? 0 : 1;
    if (aMissing !== bMissing) return bMissing - aMissing;
    return b.displayOrder - a.displayOrder;
  }).slice(0, Math.max(0, limit));

  const refreshedAt = new Date().toISOString();
  const results = await Promise.all(queue.map(async (record) => ({ record, metadata: await fetchMetadata(record) })));
  let success = 0;
  let blocked = 0;
  let failed = 0;
  cache.records ||= {};
  for (const { record, metadata } of results) {
    const existing = cache.records[record.canonicalUrl];
    const preserveExisting = metadata.status !== 'success' && existing;
    cache.records[record.canonicalUrl] = {
      title: preserveExisting ? existing.title : metadata.title,
      description: preserveExisting ? existing.description : metadata.description,
      imageUrl: preserveExisting ? existing.imageUrl : metadata.imageUrl,
      status: metadata.status,
      lastRefreshed: refreshedAt,
      needsRawRefresh: [],
    };
    if (metadata.status === 'success') success += 1;
    else if (metadata.status === 'blocked') blocked += 1;
    else failed += 1;
  }
  cache.version = 2;
  cache.updatedAt = refreshedAt;
  return { processed: queue.length, success, blocked, failed };
}
