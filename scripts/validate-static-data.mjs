import { readFile } from 'node:fs/promises';
import { generatedDataPath, publicDataPath, readJson, validatePublicDataset } from './lib/portfolio-data.mjs';

async function main() {
  const generated = await readJson(generatedDataPath, null);
  const published = await readJson(publicDataPath, null);
  const validation = validatePublicDataset(generated);
  if (JSON.stringify(generated) !== JSON.stringify(published)) throw new Error('Bundled and public portfolio datasets are out of sync.');
  const raw = await readFile(publicDataPath, 'utf8');
  if (/private_key|client_email|access_token|BEGIN PRIVATE KEY|SYNC_SECRET/i.test(raw)) throw new Error('Public portfolio JSON contains credential-like content.');
  console.log(JSON.stringify({ records: validation.records, favourites: validation.favourites, source: generated.source }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Static portfolio validation failed.');
  process.exitCode = 1;
});
