import type { Category, PortfolioQuery } from '../shared/types';
import { enrichMetadata, queryPortfolio, upsertSheetRows } from './repository';
import { fetchSheetRows } from './sheets';
import type { Env } from './types';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': status === 200 ? 'public, max-age=60' : 'no-store' } });

function parseQuery(url: URL): PortfolioQuery | null {
  const category = url.searchParams.get('category') as Category;
  if (!['blog', 'web-copy', 'social-media'].includes(category)) return null;
  const number = (key: string, fallback: number, max: number) => Math.min(max, Math.max(1, Number.parseInt(url.searchParams.get(key) || String(fallback), 10) || fallback));
  return { category, company: url.searchParams.get('company') || undefined, type: url.searchParams.get('type') || undefined, platform: url.searchParams.get('platform') || undefined, favourites: url.searchParams.get('favourites') === 'true', page: number('page', 1, 10000), pageSize: number('pageSize', 12, 24) };
}

async function sync(env: Env) {
  const sheet = await fetchSheetRows(env);
  const result = await upsertSheetRows(env.DB, sheet.rows, sheet.skipped);
  const metadata = await enrichMetadata(env.DB, Math.min(12, Math.max(1, Number(env.METADATA_BATCH_SIZE) || 8)));
  return { ...result, metadataProcessed: metadata.length };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/portfolio' && request.method === 'GET') {
        const query = parseQuery(url);
        return query ? json(await queryPortfolio(env.DB, query)) : json({ error: 'A valid category is required.' }, 400);
      }
      if (url.pathname === '/api/sync' && request.method === 'POST') {
        const authorization = request.headers.get('authorization');
        if (!env.SYNC_SECRET || authorization !== `Bearer ${env.SYNC_SECRET}`) return json({ error: 'Unauthorized.' }, 401);
        return json(await sync(env));
      }
      if (url.pathname === '/api/health') return json({ ok: true, service: 'caitwrites-portfolio' });
      if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('Request failed', error);
      return json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500);
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sync(env).then((result) => console.log('Scheduled sync complete', result)).catch((error) => console.error('Scheduled sync failed', error)));
  },
} satisfies ExportedHandler<Env>;
