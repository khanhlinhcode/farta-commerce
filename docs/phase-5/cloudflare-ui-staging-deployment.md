# Cloudflare UI staging deployment

Date: 2026-10-20

## Outcome

The Storefront and Admin applications are deployed to Cloudflare Workers and
proxy API traffic to the existing Northflank NestJS service.

| Application | Runtime                                                 | Staging URL                                                     | Cloudflare version                     |
| ----------- | ------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| Storefront  | Next.js 16.4.2 through `@opennextjs/cloudflare` 1.20.12 | `https://farta-storefront-staging.linhto01012000cm.workers.dev` | `29c2cc3f-2df1-4dff-8e4a-a72bd83e6a12` |
| Admin       | Vite static assets plus a bounded `/api/*` Worker proxy | `https://farta-admin-staging.linhto01012000cm.workers.dev`      | `41ab87b3-70c2-44d7-8545-b8ab2371dc6d` |

The API origin used by both Workers is the Northflank-generated HTTPS domain.
The custom API domain remains outside this deployment because its
Northflank-generated DNS target was not publicly resolvable during validation.

## Architecture

- Storefront uses OpenNext because it requires SSR/App Router behavior and is
  not a safe static-export candidate.
- Admin assets are served directly by Cloudflare. Only `/api/*` invokes the
  Worker and is forwarded to the fixed HTTPS API origin.
- The proxy does not accept a client-controlled upstream URL.
- Auth and cart cookies remain host-only on each UI hostname. API mutations
  continue to use the existing double-submit CSRF token and Origin checks.
- The Northflank API staging secret group was updated with the two temporary
  `workers.dev` origins. All 59 existing variable keys were preserved, and the
  API service was restarted.

## Cache and image decisions

The Cloudflare account returned API error `10042` because R2 is not enabled.
The staging Storefront therefore uses `CATALOG_CACHE_MODE=no-store` and does not
claim durable ISR support. This favors data correctness over caching for the
expected low staging traffic. Production traffic requires an approved durable
cache and revalidation design.

Cloudflare Images was not enabled. The Cloudflare build sets Next image output
to unoptimized while Cloudinary remains the controlled delivery origin. This
avoids introducing an unconfigured paid/optional binding.

## Validation evidence

Commands executed from the repository root:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
API_INTERNAL_URL=https://http--farta-api--fjb5kqgqg6nn.code.run pnpm build
pnpm audit:prod
uv sync --frozen
uv run ruff check .
uv run pytest
pnpm --filter @farta/admin build
pnpm --filter @farta/admin exec wrangler deploy --dry-run
pnpm --filter @farta/storefront build:cloudflare
pnpm --filter @farta/storefront exec wrangler deploy --dry-run
docker run --rm -v "$PWD:/repo" -w /repo zricethezav/gitleaks:v8.24.3 git --redact=100 --verbose --exit-code=2 --log-opts='--all'
```

Results:

- Formatting and lint passed after generated `.open-next` and `.wrangler`
  artifacts were explicitly excluded.
- Workspace typecheck passed.
- API: 19 files, 84 tests passed.
- Storefront: 14 files, 40 tests passed.
- Admin: 5 files, 14 tests passed.
- API E2E/concurrency suite: 7 files, 65 tests passed.
- AI service: Ruff passed; 25 Pytest tests passed.
- Full workspace production build passed against the healthy Northflank API
  origin.
- Production dependency audit reported no known vulnerabilities.
- Gitleaks 8.24.3 scanned all 35 commits and reported no leaks.
- Storefront Worker bundle: 6,061.88 KiB raw, 1,218.30 KiB gzip; startup 16 ms.
- Admin Worker code: 1.15 KiB raw, 0.55 KiB gzip; startup 2 ms. Static assets
  are uploaded separately.
- `/`, `/shop`, `/login`, both Admin SPA routes, and both proxied API health
  paths returned HTTP 200.
- Browser smoke at 390x844 and 1440x900 found no horizontal overflow, page
  errors, or console errors on Home, Shop, and Admin Login.
- Admin static HTML now returns CSP, HSTS, COOP, Permissions-Policy,
  Referrer-Policy, `X-Content-Type-Options` and frame denial headers through
  Cloudflare Static Assets `_headers` configuration.
- Invalid Staff and Customer login attempts returned
  `401 AUTH_INVALID_CREDENTIALS` after a valid CSRF preflight. This confirms the
  proxy preserved the cookie and the configured Origin passed CSRF validation.
- Staging `robots.txt` returns `Disallow: /`.

## Known limitations and next checks

1. A read-only database count confirmed staging currently has zero users,
   products, media assets and banners. Development seed data must not be copied
   into staging as if it were production content, and no default staging OWNER
   should be created with a known password.
2. R2 is disabled, so durable ISR/revalidation has not been validated.
3. `fartacommerce.me` is still delegated to Namecheap DNS. A Cloudflare Worker
   Custom Domain requires the hostname to be in a Cloudflare-managed zone.
   Nameserver migration must recreate and verify the existing GitHub Pages,
   Northflank API, ACME, mail and verification records before cutover.
4. No real Staff credential, customer registration, Cart, COD checkout, OAuth,
   Cloudinary upload, SePay Test transfer, or email delivery was exercised in
   this UI deployment.
5. Free-plan CPU/request quotas were not load-tested. The successful bundle
   size and smoke checks do not establish production capacity.

## Primary references

- Cloudflare OpenNext adapter:
  `https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/`
- Cloudflare Static Assets:
  `https://developers.cloudflare.com/workers/static-assets/`
- OpenNext cache configuration:
  `https://opennext.js.org/cloudflare/caching`
- Cloudflare Worker Custom Domains:
  `https://developers.cloudflare.com/workers/configuration/routing/custom-domains/`
