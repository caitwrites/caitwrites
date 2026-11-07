import { canonicalizeUrl, dedupeRecords, normalizeContentType, stableId } from '../shared/portfolio';
import type { PortfolioRecord } from '../shared/types';
import type { Env, SheetRow } from './types';

const encoder = new TextEncoder();

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
}

async function accessToken(env: Env): Promise<string> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) throw new Error('Google service-account credentials are not configured.');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({ iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey('pkcs8', pemToBuffer(env.GOOGLE_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(`${header}.${claim}`));
  const assertion = `${header}.${claim}.${base64url(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status}).`);
  const payload = await response.json<{ access_token: string }>();
  return payload.access_token;
}

function parseBoolean(value: string, defaultValue: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  return !['no', 'false', '0', 'unpublished'].includes(normalized);
}

export function mapSheetValues(values: string[][]): { rows: SheetRow[]; skipped: number } {
  if (!values.length) return { rows: [], skipped: 0 };
  const headers = values[0].map((header) => header.trim().toLowerCase());
  const index = (name: string, fallback: number) => { const found = headers.indexOf(name.toLowerCase()); return found >= 0 ? found : fallback; };
  const columns = { contentType: index('content type', 0), sourceUrl: index('page link', 1), favourite: index('favourites', 2), company: index('company', 3), platform: index('platform', 4), overview: index('overview', 5), titleOverride: index('title override', 6), imageOverride: index('image override', 7), sortOrder: index('sort order', 8), published: index('published', 9) };
  let skipped = 0;
  const rows = values.slice(1).flatMap((row, rowIndex) => {
    const contentType = row[columns.contentType]?.trim() || '';
    const sourceUrl = row[columns.sourceUrl]?.trim() || '';
    if (!contentType || !sourceUrl || !normalizeContentType(contentType)) { skipped++; return []; }
    try { canonicalizeUrl(sourceUrl); } catch { skipped++; return []; }
    const sort = Number.parseInt(row[columns.sortOrder] || '', 10);
    return [{ contentType, sourceUrl, favourite: /^yes$/i.test(row[columns.favourite]?.trim() || ''), company: row[columns.company]?.trim().replace(/\s+/g, ' ') || '', platform: row[columns.platform]?.trim().replace(/\s+/g, ' ') || '', overview: row[columns.overview]?.trim().replace(/\s+/g, ' ') || '', titleOverride: row[columns.titleOverride]?.trim() || '', imageOverride: row[columns.imageOverride]?.trim() || '', sortOrder: Number.isFinite(sort) ? sort : null, published: parseBoolean(row[columns.published] || '', true), displayOrder: rowIndex }];
  });
  return { rows, skipped };
}

export async function fetchSheetRows(env: Env): Promise<{ rows: SheetRow[]; skipped: number }> {
  const token = await accessToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.GOOGLE_SHEET_ID)}/values/${encodeURIComponent(env.GOOGLE_SHEET_RANGE)}?majorDimension=ROWS`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`);
  const payload = await response.json<{ values?: string[][] }>();
  if (!payload.values || payload.values.length <= 1) throw new Error('Spreadsheet returned no portfolio records; the existing database was preserved.');
  return mapSheetValues(payload.values);
}

export function normalizeSheetRows(rows: SheetRow[]) {
  const prepared = rows.flatMap((row) => {
    const normalized = normalizeContentType(row.contentType);
    if (!normalized) return [];
    const canonicalUrl = canonicalizeUrl(row.sourceUrl);
    const record: PortfolioRecord & { titleOverride: string; imageOverride: string; published: boolean } = {
      id: stableId(canonicalUrl), sourceUrl: row.sourceUrl, canonicalUrl, company: row.company, category: normalized.category, contentType: normalized.type, platform: row.platform, favourite: row.favourite, overview: row.overview, title: '', description: '', imageUrl: '', displayOrder: row.sortOrder ?? row.displayOrder, titleOverride: row.titleOverride, imageOverride: row.imageOverride, published: row.published,
    };
    return [record];
  });
  return dedupeRecords(prepared);
}
