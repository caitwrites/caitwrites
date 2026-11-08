import path from 'node:path';
import { projectRoot, readJson, writeJsonAtomic } from './portfolio-data.mjs';

export const generatedCompanyDataPath = path.join(projectRoot, 'src', 'data', 'company-directory.generated.json');
export const publicCompanyDataPath = path.join(projectRoot, 'public', 'data', 'company-directory.json');

function isPublicHostname(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (host.includes(':')) {
    if (host === '::' || host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith('2001:db8:')) return false;
    return true;
  }
  const octets = host.split('.');
  if (octets.length === 4 && octets.every((part) => /^\d+$/.test(part))) {
    const numbers = octets.map(Number);
    if (numbers.some((part) => part < 0 || part > 255)) return false;
    const [first, second] = numbers;
    if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
    if (first === 169 && second === 254) return false;
    if (first === 172 && second >= 16 && second <= 31) return false;
    if (first === 192 && second === 168) return false;
    return true;
  }
  return host.includes('.');
}

export function normalizePublicCompanyUrl(rawUrl) {
  const url = new URL(String(rawUrl).trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !isPublicHostname(url.hostname)) {
    throw new Error('Company URL must be a public HTTP or HTTPS destination.');
  }
  url.hash = '';
  return url.toString();
}

export function mapCompanyDirectoryValues(values) {
  const rows = Array.isArray(values) ? values.slice(1) : [];
  const companiesByName = new Map();
  let emptyRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;

  for (const row of rows) {
    const name = String(row?.[1] || '').trim().replace(/\s+/g, ' ');
    const rawUrl = String(row?.[2] || '').trim();
    if (!name && !rawUrl) {
      emptyRows += 1;
      continue;
    }
    if (!name || !rawUrl) {
      invalidRows += 1;
      continue;
    }
    let url;
    try {
      url = normalizePublicCompanyUrl(rawUrl);
    } catch {
      invalidRows += 1;
      continue;
    }
    const key = name.toLocaleLowerCase('en');
    if (companiesByName.has(key)) {
      duplicateRows += 1;
      continue;
    }
    companiesByName.set(key, { name, url });
  }

  return {
    companies: [...companiesByName.values()],
    sourceRows: rows.length,
    emptyRows,
    invalidRows,
    duplicateRows,
  };
}

export function validateCompanyDirectory(dataset) {
  if (!dataset || !Array.isArray(dataset.companies) || dataset.companies.length === 0) {
    throw new Error('Generated company directory is empty or malformed.');
  }
  const names = new Set();
  for (const company of dataset.companies) {
    const name = String(company?.name || '').trim();
    if (!name || names.has(name.toLocaleLowerCase('en'))) throw new Error('Generated company directory contains an empty or duplicate company name.');
    names.add(name.toLocaleLowerCase('en'));
    normalizePublicCompanyUrl(company.url);
  }
  const serialized = JSON.stringify(dataset);
  if (/BEGIN PRIVATE KEY|private_key_id|client_email|access_token|GOOGLE_SERVICE_ACCOUNT/i.test(serialized)) {
    throw new Error('Generated company directory contains credential-like content.');
  }
  return { companies: dataset.companies.length };
}

export function buildCompanyDirectoryDataset(values, generatedAt = new Date().toISOString()) {
  const mapped = mapCompanyDirectoryValues(values);
  const dataset = {
    version: 1,
    generatedAt,
    source: {
      sheet: 'LOOKUP',
      sourceRows: mapped.sourceRows,
      duplicateRows: mapped.duplicateRows,
      invalidRows: mapped.invalidRows,
      emptyRows: mapped.emptyRows,
    },
    companies: mapped.companies,
  };
  validateCompanyDirectory(dataset);
  return dataset;
}

export async function resolveCompanyDirectory({ readValues, existingDataset, generatedAt }) {
  try {
    const values = await readValues();
    return {
      dataset: buildCompanyDirectoryDataset(values, generatedAt),
      updated: true,
      warning: null,
    };
  } catch (error) {
    validateCompanyDirectory(existingDataset);
    return {
      dataset: existingDataset,
      updated: false,
      warning: error instanceof Error ? error.message : 'LOOKUP synchronisation failed.',
    };
  }
}

export async function readExistingCompanyDirectory() {
  return readJson(generatedCompanyDataPath, null);
}

export async function writeCompanyDirectoryFiles(dataset) {
  validateCompanyDirectory(dataset);
  await Promise.all([
    writeJsonAtomic(generatedCompanyDataPath, dataset),
    writeJsonAtomic(publicCompanyDataPath, dataset),
  ]);
}
