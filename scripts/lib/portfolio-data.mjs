import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const cachePath = path.join(projectRoot, 'data', 'metadata-cache.json');
export const generatedDataPath = path.join(projectRoot, 'src', 'data', 'portfolio.generated.json');
export const publicDataPath = path.join(projectRoot, 'public', 'data', 'portfolio.json');

export const fallbackImages = {
  blog: '/images/fallback-blog.webp',
  'web-copy': '/images/fallback-web-copy.webp',
  'social-media': '/images/fallback-social-media.webp',
};

export function canonicalizeUrl(raw) {
  const url = new URL(String(raw).trim());
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  return url.toString();
}

export function stableId(rawUrl) {
  let hash = 2166136261;
  for (const char of canonicalizeUrl(rawUrl)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `cw_${(hash >>> 0).toString(36)}`;
}

export function normalizeContentType(raw) {
  const value = String(raw).trim().toUpperCase().replace(/\s+/g, ' ');
  if (value === 'BLOG') return { category: 'blog', type: 'blog' };
  if (value === 'SOCIAL POST') return { category: 'social-media', type: 'social-post' };
  const webTypes = {
    'SHORT FORM': 'short-form',
    'LONG FORM': 'long-form',
    INFORMATONAL: 'informational',
    INFORMATIONAL: 'informational',
  };
  return webTypes[value] ? { category: 'web-copy', type: webTypes[value] } : null;
}

export function humanizeSlug(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const last = parts.at(-1) || url.hostname;
    const pathPart = /^\d+$/.test(last) && parts.length > 1 ? parts.at(-2) : last;
    return pathPart.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return 'Published work';
  }
}

function parseBoolean(value, defaultValue) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  return !['no', 'false', '0', 'unpublished'].includes(normalized);
}

export function mapSheetValues(values) {
  if (!values.length) return { rows: [], skipped: 0, sourceRows: 0 };
  const headers = values[0].map((header) => String(header).trim().toLowerCase());
  const index = (name, fallback) => {
    const found = headers.indexOf(name.toLowerCase());
    return found >= 0 ? found : fallback;
  };
  const columns = {
    contentType: index('content type', 0),
    sourceUrl: index('page link', 1),
    favourite: index('favourites', 2),
    company: index('company', 3),
    platform: index('platform', 4),
    overview: index('overview', 5),
    titleOverride: index('title override', 6),
    imageOverride: index('image override', 7),
    sortOrder: index('sort order', 8),
    published: index('published', 9),
  };
  let skipped = 0;
  const rows = values.slice(1).flatMap((row, rowIndex) => {
    const contentType = String(row[columns.contentType] || '').trim();
    const sourceUrl = String(row[columns.sourceUrl] || '').trim();
    if (!contentType || !sourceUrl || !normalizeContentType(contentType)) {
      skipped += 1;
      return [];
    }
    try {
      canonicalizeUrl(sourceUrl);
    } catch {
      skipped += 1;
      return [];
    }
    const sortOrder = Number.parseInt(String(row[columns.sortOrder] || ''), 10);
    return [{
      contentType,
      sourceUrl,
      favourite: /^yes$/i.test(String(row[columns.favourite] || '').trim()),
      company: String(row[columns.company] || '').trim().replace(/\s+/g, ' '),
      platform: String(row[columns.platform] || '').trim().replace(/\s+/g, ' '),
      overview: String(row[columns.overview] || '').trim().replace(/\s+/g, ' '),
      titleOverride: String(row[columns.titleOverride] || '').trim(),
      imageOverride: String(row[columns.imageOverride] || '').trim(),
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : null,
      published: parseBoolean(row[columns.published], true),
      displayOrder: rowIndex,
    }];
  });
  return { rows, skipped, sourceRows: values.length - 1 };
}

export function normalizeSheetRows(rows) {
  const recordsByUrl = new Map();
  const warnings = [];
  for (const row of rows) {
    const normalized = normalizeContentType(row.contentType);
    if (!normalized) continue;
    const canonicalUrl = canonicalizeUrl(row.sourceUrl);
    const record = {
      id: stableId(canonicalUrl),
      sourceUrl: row.sourceUrl.trim(),
      canonicalUrl,
      company: row.company,
      category: normalized.category,
      contentType: normalized.type,
      platform: row.platform,
      favourite: row.favourite,
      overview: row.overview,
      titleOverride: row.titleOverride,
      imageOverride: row.imageOverride,
      displayOrder: row.displayOrder,
      published: row.published,
    };
    const existing = recordsByUrl.get(canonicalUrl);
    if (existing) {
      warnings.push(`Duplicate URL at display positions ${existing.displayOrder} and ${record.displayOrder}: ${canonicalUrl}`);
      const newer = record.displayOrder >= existing.displayOrder ? record : existing;
      const older = newer === record ? existing : record;
      recordsByUrl.set(canonicalUrl, {
        ...newer,
        favourite: existing.favourite || record.favourite,
        displayOrder: Math.max(existing.displayOrder, record.displayOrder),
        overview: newer.overview || older.overview,
        titleOverride: newer.titleOverride || older.titleOverride,
        imageOverride: newer.imageOverride || older.imageOverride,
      });
    } else {
      recordsByUrl.set(canonicalUrl, record);
    }
  }
  return {
    records: [...recordsByUrl.values()].sort((a, b) => b.displayOrder - a.displayOrder),
    warnings,
  };
}

export function buildPublicRecords(sheetRecords, metadataCache) {
  return sheetRecords.filter((record) => record.published).sort((a, b) => b.displayOrder - a.displayOrder).map((record) => {
    const cached = metadataCache.records?.[record.canonicalUrl] || {};
    return {
      id: record.id,
      sourceUrl: record.sourceUrl,
      canonicalUrl: record.canonicalUrl,
      company: record.company,
      category: record.category,
      contentType: record.contentType,
      platform: record.platform,
      favourite: record.favourite,
      overview: record.overview,
      title: record.titleOverride || cached.title || humanizeSlug(record.sourceUrl),
      description: record.overview || cached.description || 'View the original published work.',
      imageUrl: record.imageOverride || cached.imageUrl || fallbackImages[record.category] || fallbackImages['web-copy'],
      displayOrder: record.displayOrder,
    };
  });
}

export function migrateMetadataCache(metadataCache, sheetRecords) {
  if ((metadataCache.version || 1) >= 2) return { migratedRecords: 0, sanitizedFields: 0 };
  metadataCache.records ||= {};
  let migratedRecords = 0;
  let sanitizedFields = 0;
  for (const record of sheetRecords) {
    const cached = metadataCache.records[record.canonicalUrl];
    if (!cached) continue;
    const needsRawRefresh = [];
    if (record.titleOverride) {
      cached.title = humanizeSlug(record.sourceUrl);
      needsRawRefresh.push('title');
      sanitizedFields += 1;
    }
    if (record.overview) {
      cached.description = 'View the original published work.';
      needsRawRefresh.push('description');
      sanitizedFields += 1;
    }
    if (record.imageOverride) {
      cached.imageUrl = fallbackImages[record.category] || fallbackImages['web-copy'];
      needsRawRefresh.push('image');
      sanitizedFields += 1;
    }
    cached.needsRawRefresh = needsRawRefresh;
    if (needsRawRefresh.length) {
      cached.status = 'pending';
      cached.lastRefreshed = null;
      migratedRecords += 1;
    }
  }
  metadataCache.version = 2;
  return { migratedRecords, sanitizedFields };
}

export function validatePublicDataset(dataset, options = {}) {
  const minimumRecords = Number(options.minimumRecords ?? process.env.MIN_PORTFOLIO_RECORDS ?? 200);
  const expectedFavourites = Number(options.expectedFavourites ?? process.env.EXPECTED_FAVOURITES ?? 8);
  if (!dataset || !Array.isArray(dataset.records)) throw new Error('Generated portfolio dataset is malformed.');
  if (dataset.records.length < minimumRecords) throw new Error(`Generated portfolio dataset has ${dataset.records.length} records; refusing to replace the existing dataset below the ${minimumRecords}-record safety minimum.`);
  const urls = new Set(dataset.records.map((record) => record.canonicalUrl));
  if (urls.size !== dataset.records.length) throw new Error('Generated portfolio dataset contains duplicate canonical URLs.');
  const favourites = dataset.records.filter((record) => record.favourite).length;
  if (favourites !== expectedFavourites) throw new Error(`Generated portfolio dataset has ${favourites} favourites; expected ${expectedFavourites}.`);
  const invalid = dataset.records.find((record) => !record.id || !record.sourceUrl || !record.canonicalUrl || !record.category || !record.title || !record.description || !record.imageUrl);
  if (invalid) throw new Error(`Generated portfolio dataset contains an incomplete record (${invalid.id || 'unknown id'}).`);
  for (const record of dataset.records) {
    if (!record.imageUrl.startsWith('/images/portfolio/')) continue;
    const portfolioRoot = path.resolve(projectRoot, 'public', 'images', 'portfolio');
    const imagePath = path.resolve(projectRoot, 'public', record.imageUrl.replace(/^\/+/, ''));
    if (!imagePath.startsWith(`${portfolioRoot}${path.sep}`) || !existsSync(imagePath)) throw new Error(`Portfolio image override does not exist in public/images/portfolio (${record.imageUrl}).`);
  }
  const serialized = JSON.stringify(dataset);
  if (/BEGIN PRIVATE KEY|private_key_id|client_email|access_token|GOOGLE_SERVICE_ACCOUNT/i.test(serialized)) throw new Error('Generated portfolio dataset contains credential-like content.');
  return { records: dataset.records.length, favourites };
}

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}

export async function writeDatasetFiles(dataset) {
  validatePublicDataset(dataset);
  await Promise.all([
    writeJsonAtomic(generatedDataPath, dataset),
    writeJsonAtomic(publicDataPath, dataset),
  ]);
}
