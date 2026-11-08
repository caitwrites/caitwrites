import { pathToFileURL } from 'node:url';
import {
  readExistingCompanyDirectory,
  resolveCompanyDirectory,
  validateCompanyDirectory,
  writeCompanyDirectoryFiles,
} from './lib/company-directory.mjs';
import { readSheetValues } from './lib/google-sheets.mjs';

const defaultSpreadsheetId = '10_-eQ_659xyk6ccyl4hLpT--VxaYHVvd1uRADHj68A8';

export async function syncCompanyDirectory({
  spreadsheetId = process.env.GOOGLE_SHEET_ID || defaultSpreadsheetId,
  range = process.env.GOOGLE_COMPANY_RANGE || 'LOOKUP!A:C',
} = {}) {
  const existingDataset = await readExistingCompanyDirectory();
  const resolved = await resolveCompanyDirectory({
    existingDataset,
    readValues: () => readSheetValues({ spreadsheetId, range }),
  });
  if (resolved.updated) await writeCompanyDirectoryFiles(resolved.dataset);
  const validation = validateCompanyDirectory(resolved.dataset);
  if (resolved.warning) console.warn(`Company directory sync failed; preserved the existing generated directory. ${resolved.warning}`);
  return {
    updated: resolved.updated,
    companies: validation.companies,
    source: resolved.dataset.source,
    warning: resolved.warning,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncCompanyDirectory()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Company directory synchronisation failed.');
      process.exitCode = 1;
    });
}
