import dns from 'node:dns/promises';
import net from 'node:net';
import { fallbackImages, humanizeSlug } from './portfolio-data.mjs';
import { chooseUsableImage, collectImageCandidates, getMetaContent } from './image-detection.mjs';

const MAX_BYTES = 512_000;
const MAX_REDIRECTS = 5;
const MAX_IMAGE_ATTEMPTS = 4;
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const FAILED_RETRY_MS = 7 * 24 * 60 * 60 * 1000;
const IMAGE_DETECTION_VERSION = 2;

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

async function readBounded(response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  let total = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = MAX_BYTES - total;
    if (value.byteLength > remaining) {
      if (remaining > 0) {
        chunks.push(value.slice(0, remaining));
        total += remaining;
      }
      await reader.cancel();
      break;
    }
    total += value.byteLength;
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
    imageUrl: extracted.imageUrl || fallbackImages[record.category] || fallbackImages['web-copy'],
    description: extracted.ogDescription || extracted.description || extracted.twitterDescription || 'View the original published work.',
  };
}

async function fetchWithSafeRedirects(rawUrl, signal, headers = {}) {
  let currentUrl = rawUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (!isSafePublicUrl(currentUrl) || !(await resolvesOnlyToPublicAddresses(currentUrl))) throw new Error('URL failed public-network safety validation.');
    const response = await fetch(currentUrl, {
      signal,
      redirect: 'manual',
      headers: {
        'user-agent': 'CaitWritesMetadataBot/1.0 (+portfolio metadata cache)',
        ...headers,
      },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: currentUrl };
    const location = response.headers.get('location');
    if (!location) throw new Error('Source returned an invalid redirect.');
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error('Source exceeded the redirect limit.');
}

async function firstUsableImage(html, finalUrl, signal) {
  const candidates = collectImageCandidates(html, finalUrl).slice(0, MAX_IMAGE_ATTEMPTS);
  return chooseUsableImage(candidates, async (candidate) => {
      const { response } = await fetchWithSafeRedirects(candidate.url, signal, {
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
        range: 'bytes=0-4095',
      });
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const length = Number(response.headers.get('content-length') || '0');
      const usable = response.ok
        && contentType.startsWith('image/')
        && !contentType.includes('svg')
        && (length === 0 || length >= 128);
      if (response.body) await response.body.cancel().catch(() => undefined);
      return usable;
  }, MAX_IMAGE_ATTEMPTS);
}

export async function fetchMetadata(record) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const { response, finalUrl } = await fetchWithSafeRedirects(record.sourceUrl, controller.signal, {
      accept: 'text/html,application/xhtml+xml',
    });
    if (!response.ok) throw new Error(`Source returned ${response.status}.`);
    if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('Source did not return HTML.');
    const html = await readBounded(response);
    const documentTitle = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const image = await firstUsableImage(html, finalUrl, controller.signal);
    return {
      ...selectMetadata(record, {
        ogTitle: decode(getMetaContent(html, 'og:title')),
        twitterTitle: decode(getMetaContent(html, 'twitter:title')),
        documentTitle,
        imageUrl: image?.url || '',
        ogDescription: decode(getMetaContent(html, 'og:description')),
        description: decode(getMetaContent(html, 'description')),
        twitterDescription: decode(getMetaContent(html, 'twitter:description')),
      }),
      imageSource: image?.source || 'fallback',
      imageDetectionVersion: IMAGE_DETECTION_VERSION,
      status: 'success',
      error: '',
    };
  } catch (error) {
    return {
      ...selectMetadata(record),
      imageSource: 'fallback',
      imageDetectionVersion: IMAGE_DETECTION_VERSION,
      status: /instagram|facebook|linkedin/i.test(record.sourceUrl) ? 'blocked' : 'failed',
      error: error instanceof Error ? error.message.slice(0, 300) : 'Metadata fetch failed.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function needsRefresh(record, cached, now) {
  if (!cached) return true;
  if (cached.status === 'pending') return true;
  const rawFieldsNeeded = cached.needsRawRefresh || [];
  if (rawFieldsNeeded.some((field) => (
    (field === 'title' && !record.titleOverride)
    || (field === 'description' && !record.overview)
    || (field === 'image' && !record.imageOverride)
  ))) return true;
  const fallbackImage = fallbackImages[record.category] || fallbackImages['web-copy'];
  if (!record.imageOverride && cached.imageUrl === fallbackImage && (cached.imageDetectionVersion || 0) < IMAGE_DETECTION_VERSION) return true;
  const refreshed = Date.parse(cached.lastRefreshed || '');
  if (cached.status === 'failed') return !Number.isFinite(refreshed) || now - refreshed > FAILED_RETRY_MS;
  return !Number.isFinite(refreshed) || now - refreshed > REFRESH_AFTER_MS;
}

function isImageDetectionUpgrade(record, cached) {
  if (!cached || record.imageOverride) return false;
  const fallbackImage = fallbackImages[record.category] || fallbackImages['web-copy'];
  return cached.imageUrl === fallbackImage && (cached.imageDetectionVersion || 0) < IMAGE_DETECTION_VERSION;
}

export async function refreshMetadata(records, cache, limit = 8, fetcher = fetchMetadata) {
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
    const imageUpgrade = (record) => isImageDetectionUpgrade(record, cache.records?.[record.canonicalUrl]);
    if (imageUpgrade(a) !== imageUpgrade(b)) return Number(imageUpgrade(b)) - Number(imageUpgrade(a));
    if (a.favourite !== b.favourite) return Number(b.favourite) - Number(a.favourite);
    const aMissing = cache.records?.[a.canonicalUrl] ? 0 : 1;
    const bMissing = cache.records?.[b.canonicalUrl] ? 0 : 1;
    if (aMissing !== bMissing) return bMissing - aMissing;
    return b.displayOrder - a.displayOrder;
  }).slice(0, Math.max(0, limit));

  const refreshedAt = new Date().toISOString();
  const results = await Promise.all(queue.map(async (record) => ({
    record,
    imageOnlyUpgrade: isImageDetectionUpgrade(record, cache.records?.[record.canonicalUrl]),
    metadata: await fetcher(record),
  })));
  let success = 0;
  let blocked = 0;
  let failed = 0;
  const imageSources = { 'open-graph': 0, twitter: 0, hero: 0, fallback: 0 };
  cache.records ||= {};
  for (const { record, metadata, imageOnlyUpgrade } of results) {
    const existing = cache.records[record.canonicalUrl];
    const preserveExisting = metadata.status !== 'success' && existing;
    const preserveExistingText = imageOnlyUpgrade && existing;
    cache.records[record.canonicalUrl] = {
      title: preserveExisting || preserveExistingText ? existing.title : metadata.title,
      description: preserveExisting || preserveExistingText ? existing.description : metadata.description,
      imageUrl: preserveExisting ? existing.imageUrl : metadata.imageUrl,
      status: metadata.status,
      lastRefreshed: refreshedAt,
      needsRawRefresh: [],
      imageSource: preserveExisting ? existing.imageSource || 'cached' : metadata.imageSource,
      imageDetectionVersion: metadata.imageDetectionVersion,
      error: metadata.error || '',
    };
    if (metadata.imageSource in imageSources) imageSources[metadata.imageSource] += 1;
    if (metadata.status === 'success') success += 1;
    else if (metadata.status === 'blocked') blocked += 1;
    else failed += 1;
  }
  cache.version = 2;
  cache.updatedAt = refreshedAt;
  return { processed: queue.length, success, blocked, failed, imageSources };
}
