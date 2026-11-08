import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const READ_ONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const DEFAULT_LOCAL_CREDENTIAL = path.join(os.homedir(), '.secrets', 'caitwrites-service-account.json');

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

export async function loadServiceAccount() {
  let raw;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  } else {
    const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_LOCAL_CREDENTIAL;
    raw = await readFile(credentialPath, 'utf8');
  }
  const credentials = JSON.parse(raw);
  if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) throw new Error('Google service-account credentials are invalid or incomplete.');
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && credentials.client_email !== process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) throw new Error('Google service-account email does not match the configured account.');
  return credentials;
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: READ_ONLY_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(credentials.private_key, 'base64url')}`;
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status}).`);
  const payload = await response.json();
  if (!payload.access_token) throw new Error('Google authentication returned no access token.');
  return payload.access_token;
}

export async function readSheetValues({ spreadsheetId, range }) {
  const credentials = await loadServiceAccount();
  const accessToken = await getAccessToken(credentials);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`);
  const payload = await response.json();
  if (!Array.isArray(payload.values) || payload.values.length <= 1) throw new Error('Spreadsheet range returned no data rows; the existing generated data was preserved.');
  return payload.values;
}
