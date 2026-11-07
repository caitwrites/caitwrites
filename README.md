# Cait Writes portfolio

A responsive React/TypeScript copywriting portfolio based on the approved Cait Writes design. The primary production architecture is a static Vite build for GitHub Pages. A build-time synchroniser reads the `Combined` Google Sheet, normalises and deduplicates the portfolio, incrementally refreshes cached metadata, and generates the public dataset used by the frontend.

The existing Cloudflare Worker and D1 implementation remains available as an undeployed fallback under `worker/`, `migrations/` and `wrangler.toml`.

## Local website

The tracked static dataset contains the verified portfolio snapshot, so the site does not need Google credentials, D1 or a Worker at runtime.

```powershell
npm install
npm run dev
```

The routes `/`, `/blogs`, `/web-copy`, `/social-media`, `/about`, and `/contact` all use the same static data and retain query-string filtering, responsive pagination and browser history navigation.

### Visual-QA fixtures

```powershell
npm run dev:qa
```

This adds 42 clearly labelled `[QA only]` in-memory cards for pagination testing. They are never favourites and are not written to the static dataset, Google Sheets or D1.

## Static portfolio data

- `data/metadata-cache.json` is the tracked incremental cache migrated from the verified local D1 database.
- `src/data/portfolio.generated.json` is bundled into the frontend, so no runtime API is required.
- `public/data/portfolio.json` is the public generated dataset.
- Generated JSON contains public portfolio fields only. It must never contain credentials, access tokens or private keys.

Validate the current dataset:

```powershell
npm run data:validate
```

Re-export the existing local D1 cache if a deliberate migration is required:

```powershell
npm run data:export-d1
```

## Local Google Sheets synchronisation

The synchroniser uses the read-only service account and defaults locally to:

`%USERPROFILE%\.secrets\caitwrites-service-account.json`

Alternatively set `GOOGLE_APPLICATION_CREDENTIALS` to another external credential path. Never copy the credential into this repository.

```powershell
npm run data:sync
```

The script:

1. authenticates with the Sheets read-only scope;
2. reads `Combined!A:K`;
3. validates, normalises and deduplicates rows;
4. preserves favourite, company, type and platform mappings;
5. refreshes at most eight stale metadata entries by default;
6. validates the record and favourite safety thresholds;
7. atomically updates the cache and generated datasets.

If authentication fails, the Sheet is unexpectedly empty, the cache is unexpectedly missing, fewer than 200 records are generated, or the favourite count is not eight, the command fails before replacing the published dataset.

## Quality checks and static build

```powershell
npm test
npm run typecheck
npm run build
```

`npm run build` validates the dataset, builds Vite, then creates route-specific `index.html` entrypoints for every public route plus `404.html`. The output includes canonical and Open Graph metadata, `robots.txt`, `sitemap.xml`, the favicon, `CNAME`, and `.nojekyll`.

## GitHub Actions and Pages

The workflow at `.github/workflows/pages.yml` runs daily at 03:17 UTC and can also be started manually. It restores the incremental metadata cache, synchronises Google Sheets, runs tests and TypeScript checks, builds the static site, and uploads a Pages artifact.

Deployment is deliberately disabled until the repository variable below is created:

| Type | Name | Required value |
| --- | --- | --- |
| Encrypted Actions secret | `GOOGLE_SERVICE_ACCOUNT_JSON` | The complete service-account JSON document |
| Repository variable | `ENABLE_PAGES_DEPLOYMENT` | `true` only after publication is authorised |

The workflow does not need `SYNC_SECRET`, `GOOGLE_PRIVATE_KEY`, a local Windows path, D1 credentials or Cloudflare credentials. If sync, validation, tests or build fails, the deploy job cannot run and the previously published Pages site remains unchanged.

To enable Pages after creating the repository:

1. In **Settings → Pages**, set **Source** to **GitHub Actions**.
2. In **Settings → Secrets and variables → Actions**, add the encrypted `GOOGLE_SERVICE_ACCOUNT_JSON` repository secret.
3. Leave `ENABLE_PAGES_DEPLOYMENT` unset while reviewing build-only workflow runs.
4. In **Settings → Pages**, set the custom domain to `caitwrites.co.za`.
5. Add the DNS records below and wait for GitHub’s DNS check and certificate provisioning.
6. Enable **Enforce HTTPS** in Pages settings when it becomes available.
7. After explicit publication approval, add `ENABLE_PAGES_DEPLOYMENT=true` and manually run the workflow.

## DNS for `caitwrites.co.za`

Remove conflicting apex `A`, `AAAA`, `ALIAS` or `ANAME` records and conflicting `www` records before adding:

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `<YOUR-GITHUB-USERNAME>.github.io` |

With `caitwrites.co.za` configured as the Pages custom domain, GitHub redirects `www.caitwrites.co.za` to the apex domain when both DNS variants are configured. The committed `CNAME` file prepares the artifact but does not replace the Pages custom-domain setting.

## Cloudflare fallback

The previous Worker/D1 route remains intact and has not been deployed. To use it locally:

```powershell
npm run db:migrate:local
npm run build:cloudflare
npm run cf:dev
```

Set `VITE_USE_API=true` only for a Cloudflare build that should query `/api/portfolio`. Worker credentials remain in ignored `.dev.vars` locally or in Wrangler secrets for any future authorised Cloudflare deployment.

## Security notes

- `.dev.vars`, `.env`, `.wrangler`, `dist`, logs and local databases are not committed.
- GitHub receives the service account through one encrypted Actions secret.
- The browser bundle never receives Google credentials.
- Metadata requests enforce public HTTP(S) URLs, standard ports, public DNS resolution, redirect checks, an eight-second timeout and a 512 KB response limit.
- The source Google Sheet is read-only and is never modified.
- Nothing in this repository performs an automatic production deployment until the deployment variable is explicitly enabled.
