import type { PortfolioQuery, PortfolioRecord } from '../shared/types';
import type { SheetRow } from './types';
import { normalizeSheetRows } from './sheets';
import { fetchMetadata } from './metadata';

const companyValues: Record<string, string> = { 'travel-chasers': 'Travel Chasers', 'rhino-africa': 'Rhino Africa', 'lawsons-and-daughters': 'Lawsons & Daughters', 'lawsons-daughters': 'Lawsons & Daughters' };
const platformValues: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };

export async function queryPortfolio(db: D1Database, query: PortfolioQuery) {
  const clauses = ['category = ?', 'published = 1'];
  const bindings: unknown[] = [query.category];
  if (query.company && companyValues[query.company]) { clauses.push('company = ? COLLATE NOCASE'); bindings.push(companyValues[query.company]); }
  if (query.type && ['short-form', 'long-form', 'informational'].includes(query.type)) { clauses.push('content_type = ?'); bindings.push(query.type); }
  if (query.platform && platformValues[query.platform]) { clauses.push('platform = ? COLLATE NOCASE'); bindings.push(platformValues[query.platform]); }
  if (query.favourites) clauses.push('favourite = 1');
  const where = clauses.join(' AND ');
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM portfolio_items WHERE ${where}`).bind(...bindings).first<{ total: number }>();
  const total = count?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const offset = (page - 1) * query.pageSize;
  const rows = await db.prepare(`SELECT id, source_url, canonical_url, company, category, content_type, platform, favourite, custom_overview, COALESCE(NULLIF(manual_title_override, ''), NULLIF(metadata_title, ''), 'Published work') AS title, COALESCE(NULLIF(custom_overview, ''), NULLIF(metadata_description, ''), 'View the original published work.') AS description, COALESCE(NULLIF(manual_image_override, ''), NULLIF(metadata_image_url, ''), CASE category WHEN 'blog' THEN '/images/fallback-blog.webp' WHEN 'social-media' THEN '/images/fallback-social-media.webp' ELSE '/images/fallback-web-copy.webp' END) AS image_url, display_order FROM portfolio_items WHERE ${where} ORDER BY display_order DESC, id ASC LIMIT ? OFFSET ?`).bind(...bindings, query.pageSize, offset).all();
  const records: PortfolioRecord[] = rows.results.map((row) => ({ id: String(row.id), sourceUrl: String(row.source_url), canonicalUrl: String(row.canonical_url), company: String(row.company), category: row.category as PortfolioRecord['category'], contentType: String(row.content_type), platform: String(row.platform), favourite: Boolean(row.favourite), overview: String(row.custom_overview), title: String(row.title), description: String(row.description), imageUrl: String(row.image_url), displayOrder: Number(row.display_order) }));
  return { records, total, page, pageSize: query.pageSize, totalPages };
}

export async function upsertSheetRows(db: D1Database, rows: SheetRow[], skipped: number) {
  const { records, warnings } = normalizeSheetRows(rows);
  if (!records.length) throw new Error('No valid records were available; the existing database was preserved.');
  const now = new Date().toISOString();
  let existing = 0;
  for (let index = 0; index < records.length; index += 50) {
    const urls = records.slice(index, index + 50).map((record) => record.canonicalUrl);
    const placeholders = urls.map(() => '?').join(',');
    const result = await db.prepare(`SELECT COUNT(*) AS total FROM portfolio_items WHERE canonical_url IN (${placeholders})`).bind(...urls).first<{ total: number }>();
    existing += result?.total || 0;
  }
  const run = await db.prepare("INSERT INTO sync_runs (started_at, status, skipped_count, duplicate_count, warnings_json) VALUES (?, 'running', ?, ?, ?)").bind(now, skipped, warnings.length, JSON.stringify(warnings)).run();
  const runId = run.meta.last_row_id;
  let failed = 0;
  const statements = records.map((record) => db.prepare(`INSERT INTO portfolio_items (id, canonical_url, source_url, company, category, content_type, platform, favourite, custom_overview, manual_title_override, manual_image_override, display_order, published, metadata_fetch_status, last_sheet_sync)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    ON CONFLICT(canonical_url) DO UPDATE SET source_url=excluded.source_url, company=excluded.company, category=excluded.category, content_type=excluded.content_type, platform=excluded.platform, favourite=excluded.favourite, custom_overview=excluded.custom_overview, manual_title_override=excluded.manual_title_override, manual_image_override=excluded.manual_image_override, display_order=excluded.display_order, published=excluded.published, last_sheet_sync=excluded.last_sheet_sync`).bind(record.id, record.canonicalUrl, record.sourceUrl, record.company, record.category, record.contentType, record.platform, record.favourite ? 1 : 0, record.overview, record.titleOverride, record.imageOverride, record.displayOrder, record.published ? 1 : 0, now));
  for (let index = 0; index < statements.length; index += 50) {
    try {
      await db.batch(statements.slice(index, index + 50));
    } catch { failed += Math.min(50, statements.length - index); }
  }
  const updated = Math.max(0, existing - failed);
  const imported = Math.max(0, records.length - existing - failed);
  await db.prepare("UPDATE sync_runs SET finished_at=?, status=?, imported_count=?, updated_count=?, failed_count=? WHERE id=?").bind(new Date().toISOString(), failed ? 'partial' : 'success', imported, updated, failed, runId).run();
  return { imported, updated, duplicates: warnings.length, skipped, failed, warnings };
}

export async function enrichMetadata(db: D1Database, limit: number) {
  const queue = await db.prepare(`SELECT id, source_url, custom_overview, manual_title_override, manual_image_override, category FROM portfolio_items WHERE published=1 AND (metadata_fetch_status='pending' OR last_metadata_refresh IS NULL OR (metadata_fetch_status='failed' AND last_metadata_refresh < datetime('now','-7 days')) OR (metadata_fetch_status NOT IN ('pending','failed') AND last_metadata_refresh < datetime('now','-30 days'))) ORDER BY favourite DESC, display_order DESC LIMIT ?`).bind(limit).all();
  const settled = await Promise.all(queue.results.map(async (row) => {
    const metadata = await fetchMetadata({ sourceUrl: String(row.source_url), overview: String(row.custom_overview), titleOverride: String(row.manual_title_override), imageOverride: String(row.manual_image_override), category: String(row.category) });
    await db.prepare('UPDATE portfolio_items SET metadata_title=?, metadata_description=?, metadata_image_url=?, metadata_fetch_status=?, metadata_error=?, last_metadata_refresh=? WHERE id=?').bind(metadata.title, metadata.description, metadata.imageUrl, metadata.status, metadata.error, new Date().toISOString(), row.id).run();
    return { id: row.id, status: metadata.status };
  }));
  return settled;
}
