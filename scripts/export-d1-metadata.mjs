import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  buildPublicRecords,
  cachePath,
  projectRoot,
  validatePublicDataset,
  writeDatasetFiles,
  writeJsonAtomic,
} from './lib/portfolio-data.mjs';

const wranglerCli = path.join(projectRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const query = `
  SELECT id, canonical_url, source_url, company, category, content_type, platform,
    favourite, custom_overview, metadata_title, metadata_description,
    metadata_image_url, manual_title_override, manual_image_override,
    display_order, published, metadata_fetch_status, last_metadata_refresh
  FROM portfolio_items
  ORDER BY display_order ASC, id ASC;
  SELECT duplicate_count, skipped_count
  FROM sync_runs
  WHERE status = 'success'
  ORDER BY id DESC
  LIMIT 1;
`;

function runLocalQuery() {
  const result = spawnSync(process.execPath, [
    wranglerCli,
    'd1',
    'execute',
    'caitwrites-portfolio',
    '--local',
    '--command',
    query,
    '--json',
  ], { cwd: projectRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('Local D1 export failed. Ensure the verified local database is available.');
  return JSON.parse(result.stdout.trim());
}

async function main() {
  const response = runLocalQuery();
  const rows = response[0]?.results || [];
  const latestSync = response[1]?.results?.[0] || { duplicate_count: 0, skipped_count: 0 };
  if (!rows.length) throw new Error('Local D1 returned no portfolio records; no static files were changed.');

  const cache = { version: 1, updatedAt: new Date().toISOString(), records: {} };
  const records = rows.map((row) => {
    cache.records[String(row.canonical_url)] = {
      title: String(row.metadata_title || ''),
      description: String(row.metadata_description || ''),
      imageUrl: String(row.metadata_image_url || ''),
      status: String(row.metadata_fetch_status || 'pending'),
      lastRefreshed: row.last_metadata_refresh ? String(row.last_metadata_refresh) : null,
    };
    return {
      id: String(row.id),
      canonicalUrl: String(row.canonical_url),
      sourceUrl: String(row.source_url),
      company: String(row.company || ''),
      category: String(row.category),
      contentType: String(row.content_type),
      platform: String(row.platform || ''),
      favourite: Boolean(row.favourite),
      overview: String(row.custom_overview || ''),
      titleOverride: String(row.manual_title_override || ''),
      imageOverride: String(row.manual_image_override || ''),
      displayOrder: Number(row.display_order),
      published: Boolean(row.published),
    };
  });
  const publicRecords = buildPublicRecords(records, cache);
  const duplicateRows = Number(latestSync.duplicate_count || 0);
  const skippedRows = Number(latestSync.skipped_count || 0);
  const dataset = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      sheet: 'Combined',
      sourceRows: records.length + duplicateRows + skippedRows,
      uniqueRecords: records.length,
      duplicateRows,
      skippedRows,
    },
    records: publicRecords,
  };
  const validation = validatePublicDataset(dataset);
  await writeJsonAtomic(cachePath, cache);
  await writeDatasetFiles(dataset);
  console.log(JSON.stringify({ exported: validation.records, favourites: validation.favourites, cacheEntries: Object.keys(cache.records).length }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Local D1 export failed.');
  process.exitCode = 1;
});
