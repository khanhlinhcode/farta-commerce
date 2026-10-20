# Phase 5 staging sample catalog import

Date: 2026-10-20

Status: staging sample catalog imported and public read paths verified

## Scope and evidence boundary

This operation copied the repository's realistic development catalog shape into the isolated staging database through the existing NestJS domain services. It did not copy local MongoDB documents, ObjectIds, customer records, orders or payment data. It did not seed production and does not claim production readiness.

The sample media are the existing generated FARTA development assets stored in Cloudinary. They are not scraped commercial imagery and are registered as staging sample assets rather than represented as stakeholder-approved production media.

## Guarded tooling

The API now exposes two explicit operational commands:

- `pnpm --filter @farta/api bootstrap:owner -- <secure-config-file>` for a one-time staging OWNER bootstrap;
- `pnpm --filter @farta/api seed:staging-sample` for the reviewed sample catalog.

The catalog command requires both `APP_ENV=staging` and the process-only one-time gate `ALLOW_STAGING_SAMPLE_SEED=ONE_TIME_STAGING_SAMPLE_V1`. Production, development, test and unknown environments are rejected. The ordinary `seed:development` command remains development-only.

Media registration validates the expected Cloudinary host, resource type, metadata and ownership collision before persistence. Category, product, variant, banner and inventory writes continue through their domain services. Inventory is established through `InventoryService`, preserving ledger and idempotency rules.

## Deployment evidence

| Evidence                            | Actual result                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Source revision deployed            | `3e594b81a69994ecdb2419b50db598e9ae94ff65`                                     |
| Northflank build                    | `defiant-ray-4362` completed successfully                                      |
| API live/readiness                  | `GET /api/v1/health/live` and `/ready` returned HTTP 200                       |
| First staging seed                  | `media=5 created=15 updated=11 skipped=0`                                      |
| Immediate idempotency rerun         | `media=5 created=0 updated=0 skipped=24`                                       |
| Public catalog                      | 2 products and 3 active categories                                             |
| Public hero                         | 1 active `home-hero` banner titled `Quiet Form — Bộ sưu tập mới`               |
| Storefront smoke                    | `/`, `/shop` and `/product/dev-farta-essential-tee` returned HTTP 200          |
| Cloudinary administration path      | authenticated staff media authorization returned HTTP 201                      |
| Cloudinary response confidentiality | cloud name and API key present where required; API secret absent from response |

The staging database contained the following immediately after import:

- 1 active OWNER;
- 3 categories;
- 2 active products;
- 9 variants;
- 5 media assets;
- 1 active banner;
- 9 inventory records and 9 initial inventory ledger transactions;
- total `onHand=83` and `reserved=0`.

The public catalog exposes semantic availability only. Eight sample variants were `IN_STOCK`; the Cream/L dress variant was `LOW_STOCK`.

## Security and credential handling

During an infrastructure metadata inspection, the Northflank CLI returned secret values unexpectedly. The affected MongoDB and application credentials were treated as compromised and rotated. A restricted higher-priority API runtime secret group now provides the rotated values, Atlas uses the matching rotated database credential, and the API was restarted and verified healthy afterward. Authenticated staff login and Cloudinary media authorization also passed after rotation.

The old lower-priority Northflank group contains stale rotated-out values until Northflank's secret-group patch endpoint is available again. Those values are overridden and the former Atlas password is invalid, but the stale entries should still be removed as operational hygiene.

The staging OWNER password was generated locally and stored in macOS Keychain under:

- account: `owner.staging@fartacommerce.me`
- service: `farta-commerce-staging-owner`

No password or provider secret is recorded in Git or this report. The temporary bootstrap input, cookie jars and copied secret files were removed. The temporary bootstrap job was also deleted; the regular `farta-reservation-expiry` job remains.

## Public endpoints verified

- API: `https://api-staging.fartacommerce.me`
- Storefront: `https://farta-storefront-staging.linhto01012000cm.workers.dev`
- Admin: `https://farta-admin-staging.linhto01012000cm.workers.dev`

The custom Storefront and Admin hostnames are not yet attached. The Namecheap root records still require the approved Cloudflare/DNS cutover before `fartacommerce.me` can be claimed as the deployed storefront domain.

## Known limitations and follow-up

- Sample slugs retain the `dev-farta-*` prefix so their non-production origin remains visible.
- This operation verified public catalog rendering, not the complete guest checkout, COD, customer account or Admin browser flows.
- The Northflank control plane returned errors for remote exec and did not schedule the temporary one-shot job, so the guarded seed was executed locally against the staging services using the same NestJS application/domain boundaries.
- The sample media are suitable for staging validation, not final brand approval or a production catalog.
- Remove stale fields from the lower-priority Northflank secret group after the provider patch endpoint recovers.
- Attach and validate custom Storefront/Admin domains separately, including TLS, cookie, CORS and CSP behavior.
