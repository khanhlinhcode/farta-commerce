# Phase 5 staging readiness report

Date: 2026-10-13

Status: readiness checkpoint complete; deployment blocked on stakeholder inputs

## Scope and evidence boundary

This report is the provider-neutral checkpoint required before any staging deployment configuration is created. It does not claim that staging infrastructure exists, that an external provider has been validated, or that FARTA is production-ready.

The reviewed revision is `8543a89` (`refactor: modularize admin commerce features`). The approved local history was pushed normally to `origin/main`; `git rev-list --left-right --count origin/main...HEAD` returned `0 0` afterward. No force-push or history rewrite was used.

## Baseline gate evidence

| Gate                                                | Actual result                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                    | 9 workspace projects; lockfile current; completed with pnpm 10.34.3                       |
| `pnpm format:check`                                 | all matched files passed Prettier                                                         |
| `pnpm lint`                                         | ESLint completed without an error                                                         |
| `pnpm typecheck`                                    | TypeScript workspaces completed without an error                                          |
| `pnpm --filter @farta/api test`                     | 14 files / 54 tests passed                                                                |
| `pnpm --filter @farta/storefront test`              | 6 files / 18 tests passed                                                                 |
| `pnpm --filter @farta/admin test`                   | 4 files / 12 tests passed                                                                 |
| `pnpm test:e2e`                                     | 7 API files / 64 tests passed                                                             |
| `API_INTERNAL_URL=http://127.0.0.1:4000 pnpm build` | API, Storefront and Admin production builds passed; Storefront generated 19 static routes |
| `pnpm audit:prod`                                   | no known vulnerabilities found at the configured `high` threshold                         |
| `uv sync --frozen`                                  | frozen Python environment resolved successfully                                           |
| `uv run ruff check .`                               | passed                                                                                    |
| `uv run pytest`                                     | 2 tests passed                                                                            |
| Gitleaks 8.24.3 full-history scan                   | 23 commits and approximately 1.54 MB scanned; no leaks found                              |

The previously recorded local Chromium release lane remains 20/20 passed. It was not substituted for staging browser evidence.

## Repository inspection

Inspected inputs included:

- `README.md`, `PRODUCT.md` and the implementation roadmap;
- the root, Storefront and Admin environment examples;
- the API Zod environment schema and HTTP configuration;
- authentication and guest-cart cookie services;
- Storefront Next.js and Admin Vite configuration;
- AI service settings;
- local Docker Compose and GitHub Actions CI;
- Phase 4/4.1 completion, security, runtime and browser reports;
- deployment-related ADRs and open decisions.

The repository currently contains local Docker Compose for MongoDB/Redis and CI validation. It does not contain an approved provider-specific staging topology, application deployment manifest, managed database/Redis configuration, public staging domains or deployment secret-store integration.

## Required provider-neutral topology

```text
Customer
  -> HTTPS Storefront
  -> HTTPS NestJS API
  -> MongoDB / Redis / Cloudinary / payment provider

Admin
  -> HTTPS Admin application
  -> protected NestJS Admin API
  -> RBAC and domain services

Reservation worker
  -> MongoDB / Redis
  -> no public ingress by default

AI service
  -> health scaffold only
  -> no direct MongoDB mutation or privileged provider access
```

The NestJS API remains the commerce source of truth. The deployment order remains managed MongoDB, managed Redis, API, reservation worker, Storefront, Admin, AI health scaffold, Cloudinary, SePay Test mode, OAuth, email delivery and monitoring.

## Environment classification

Only names are documented here. Values must be injected by the selected deployment secret/configuration store.

### Public build-time configuration

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_INDEXABLE` (must remain `false` on staging)

### Private build/runtime routing configuration

- `API_INTERNAL_URL`
- `API_PROXY_TARGET`
- `AI_API_BASE_URL`

### Private provider and infrastructure credentials

- `MONGODB_URI`
- `REDIS_URL`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SEPAY_WEBHOOK_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `APPLE_PRIVATE_KEY`

### Private application secrets

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CSRF_SECRET`
- `CART_CREDENTIAL_SECRET`
- `ORDER_LOOKUP_SECRET`

### Private or controlled non-secret configuration

- `APP_ENV`, `PORT`, `APP_ORIGIN`, `ADMIN_ORIGIN`, `API_ORIGIN`
- `TRUST_PROXY_HOPS`
- JWT issuer, audiences and TTLs
- session, cart and reservation TTLs
- authentication, Cart, Checkout, Order lookup and Payment rate limits
- shipping fee and free-shipping threshold
- reservation worker interval and batch size
- SePay enablement, bank instructions, reference prefix and deposit policy
- OAuth client/team/key identifiers
- Cloudinary cloud name and upload limit

No private value may be placed in `NEXT_PUBLIC_*` or `VITE_*`. Development bootstrap and development seed variables must remain absent from staging.

## Blocking findings

### P5-B01 — staging received development-grade HTTP security behavior

Severity: High for a public staging deployment

Status: resolved locally on 2026-10-14; staging deployment validation pending

The original audit found that `AuthCookieService` and `CartCredentialService` enabled `Secure` cookies and protected cookie prefixes only when `APP_ENV === "production"`. `configureHttpApplication` also disabled CSP and HSTS outside production, while the API/AI configuration allowed non-HTTPS staging origins.

Phase 5A introduced one typed deployed-environment policy: `staging` and `production` now receive secure protected cookies, explicit CSP/HSTS/frame/no-sniff policy, HTTPS origin validation, placeholder/bootstrap rejection, operational logging and disabled Mongoose auto-index creation. The AI service now requires an HTTPS commerce API in both deployed environments. Development and test retain local HTTP compatibility.

Regression coverage proves the local policy for:

- customer/staff/CSRF and guest-cart cookie attributes and clearing;
- HTTPS origins, placeholder secrets and bootstrap values;
- explicit HTTP security options and deployed logging level;
- deployed database auto-index behavior;
- AI staging/production HTTPS requirements.

This finding is resolved in code, not closed as deployment evidence. A real HTTPS staging environment must still validate proxy hops, forwarded protocol handling, response headers and browser cookie acceptance before public exposure.

### P5-B02 — hosting, domains and proxy topology are not selected

Severity: blocking decision

Status: stakeholder input required

The exact proxy hop count, TLS termination, same-origin routing and Admin/API routing cannot be configured safely without the hosting topology and canonical staging domains. `API_INTERNAL_URL` must be available during the Storefront build. Admin production routing needs a provider-approved same-origin reverse proxy or an explicitly reviewed API routing design; the current Vite proxy is a development-server facility.

### P5-B03 — managed data services and secret store are absent

Severity: blocking dependency

Status: stakeholder input required

Staging requires a managed MongoDB replica set with transaction support, managed Redis, TLS/authentication/network controls and a deployment secret store. A successful local Docker connection is not evidence for those controls.

### P5-B04 — external provider accounts are absent or unvalidated

Severity: blocking dependency for the corresponding feature

Status: stakeholder input required

Required inputs are a separated Cloudinary staging account, SePay Test-mode account and public HTTPS webhook, Google OAuth development credentials, optional Apple development credentials, a transactional email provider and monitoring/error-tracking provider. Local signed webhook fixtures are not external SePay evidence, and notification outbox records remain pending without a delivery provider.

### P5-B05 — reproducible staging data/bootstrap policy is unresolved

Severity: release-process blocker

Status: design approval required

The development seed correctly refuses staging and production. Staging data must be created through approved authenticated Admin APIs or a separately reviewed staging-only procedure. Development MediaAsset IDs and production customer data must not be copied into staging.

### P5-B06 — Browser E2E is local-only

Severity: release-evidence gap

Status: deferred pending non-production media bootstrap

The current Chromium lane uses a finalized local development media manifest. CI/staging must not import local ObjectIds or production provider credentials. A reproducible staging/CI MediaAsset finalization strategy is required before enabling that lane outside local development.

## Required stakeholder decisions and inputs

No secret value should be sent through chat, Git, documentation or issue trackers. After choosing providers, enter secrets directly in the selected secret-management interface.

Required decisions:

1. hosting provider and service topology;
2. Storefront, Admin and API staging domains;
3. managed MongoDB provider/cluster;
4. managed Redis provider/instance;
5. secret-management mechanism;
6. Cloudinary staging account;
7. SePay Test-mode account and webhook registration path;
8. Google OAuth development application;
9. whether Apple login is required for this staging milestone;
10. transactional email provider;
11. monitoring/error-tracking provider, retention and PII residency;
12. approved staging-data creation policy.

## Next authorized work after the checkpoint

After the stakeholder supplies the non-secret provider selections and configures credentials in provider secret stores:

1. verify current official documentation for each selected provider;
2. verify the locally resolved P5-B01 controls against the selected HTTPS proxy topology;
3. create provider-specific architecture, environment matrix and runbook;
4. provision managed MongoDB/Redis;
5. deploy API and reservation worker before frontends;
6. deploy Storefront, Admin and AI health scaffold;
7. validate Cloudinary, SePay Test mode, OAuth, email and monitoring;
8. execute staging security, commerce, responsive and accessibility evidence;
9. create the Phase 5 completion report only from actual deployed evidence.

## Conclusion

The local release baseline, Git synchronization and provider-neutral staging hardening gates are green. Phase 5 deployment remains intentionally stopped because provider selections, domains, managed infrastructure and external credentials are not available. The hardened controls still require verification behind a real staging TLS/proxy boundary. No staging resource was created and no production-readiness claim is made.
