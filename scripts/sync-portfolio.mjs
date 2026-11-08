import {
  buildPublicRecords,
  cachePath,
  mapSheetValues,
  migrateMetadataCache,
  normalizeSheetRows,
  readJson,
  validatePublicDataset,
  writeDatasetFiles,
  writeJsonAtomic,
} from './lib/portfolio-data.mjs';
import { readSheetValues } from './lib/google-sheets.mjs';
import { refreshMetadata } from './lib/metadata.mjs';

const spreadsheetId = process.env.GOOGLE_SHEET_ID || '10_-eQ_659xyk6ccyl4hLpT--VxaYHVvd1uRADHj68A8';
const sheetRange = process.env.GOOGLE_SHEET_RANGE || 'Combined!A:K';
const metadataLimit = Number.parseInt(process.env.METADATA_REFRESH_LIMIT || '8', 10);
const minimumRecords = Number.parseInt(process.env.MIN_PORTFOLIO_RECORDS || '200', 10);

async function main() {
  const cache = await readJson(cachePath, { version: 1, updatedAt: null, records: {} });
  const cachedRecordCount = Object.keys(cache.records || {}).length;
  if (cachedRecordCount < minimumRecords && process.env.ALLOW_EMPTY_METADATA_CACHE !== 'true') {
    throw new Error(`Metadata cache has only ${cachedRecordCount} records; refusing to replace the existing static dataset below the ${minimumRecords}-record safety minimum.`);
  }

  const values = await readSheetValues({ spreadsheetId, range: sheetRange });
  const mapped = mapSheetValues(values);
  const normalized = normalizeSheetRows(mapped.rows);
  if (normalized.records.length < minimumRecords) {
    throw new Error(`Google Sheets produced only ${normalized.records.length} unique records; the existing static dataset was preserved.`);
  }

  const cacheMigration = migrateMetadataCache(cache, normalized.records);
  const metadata = await refreshMetadata(normalized.records, cache, Number.isFinite(metadataLimit) ? metadataLimit : 8);
  const manualOverrides = {
    titles: normalized.records.filter((record) => record.titleOverride).length,
    descriptions: normalized.records.filter((record) => record.overview).length,
    images: normalized.records.filter((record) => record.imageOverride).length,
  };
  const records = buildPublicRecords(normalized.records, cache);
  const dataset = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      sheet: 'Combined',
      sourceRows: mapped.sourceRows,
      uniqueRecords: normalized.records.length,
      duplicateRows: normalized.warnings.length,
      skippedRows: mapped.skipped,
    },
    records,
  };
  const validation = validatePublicDataset(dataset);

  await writeJsonAtomic(cachePath, cache);
  await writeDatasetFiles(dataset);

  console.log(JSON.stringify({
    sourceRows: mapped.sourceRows,
    uniqueRecords: validation.records,
    duplicateRows: normalized.warnings.length,
    skippedRows: mapped.skipped,
    favourites: validation.favourites,
    manualOverrides,
    cacheMigration,
    metadata,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Static portfolio synchronisation failed.');
  process.exitCode = 1;
});
