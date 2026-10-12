# Phase 4.1C-A Cloudinary Media and Development Seed Report

Date: 2026-10-12

Baseline: `4e62192` (`feat: refine FARTA storefront and admin visual system`)

## Outcome

The local development environment now has a real Cloudinary-backed FARTA catalog seed. The seed is intentionally local-only and fail-closed: it runs only with `APP_ENV=development`, requires an explicitly selected existing active OWNER, validates every finalized `MediaAsset` before catalog writes, and refuses ambiguous namespace collisions.

This work does not seed staging or production, does not create authentication credentials, and does not claim production Cloudinary or browser-release readiness.

## Bootstrap and runtime repair

The local OWNER bootstrap initially failed through `tsx` with Mongoose 9.10.4 because the ESM module namespace exposed a getter-only `nextConnectionId`. The package command now builds the existing CommonJS target and runs `dist/scripts/bootstrap-owner.js`, matching the already-approved reservation-worker execution strategy.

The local MongoDB URI was normalized to the host-resolvable single-node replica-set form using `127.0.0.1` and `directConnection=true`. Bootstrap values were cleared immediately after creating the development OWNER. API `/health/live` and `/health/ready` both returned HTTP 200 after the repair.

## Cloudinary boundary exercised

The existing production-shaped flow was used without bypassing the API:

1. Staff pre-auth CSRF was issued.
2. The explicitly selected local OWNER authenticated in the `STAFF` realm.
3. `POST /api/v1/admin/media/upload-authorizations` returned a short-lived signed authorization without an API secret.
4. The image bytes were uploaded directly to Cloudinary.
5. `POST /api/v1/admin/media/finalize` verified the Cloudinary response signature and URL and created the authoritative `MediaAsset` record.

Five images were finalized: desktop hero, mobile hero, black Essential Tee, cream Essential Tee and cream Atelier Midi Dress. A direct delivery check against the resulting Cloudinary URL returned HTTP 200.

The checked-in code contains no Cloudinary secret and no environment-specific MongoDB ObjectId. The non-secret mapping is stored in ignored file `apps/api/.development-seed-media.json`.

## Asset provenance

All five assets were generated specifically for this development dataset with OpenAI image generation on 2026-10-12. Prompts requested original premium fashion photography, no text, no logos, no watermarks and no resemblance to a known campaign. No scraped commercial fashion image or uncertain-license third-party asset was used.

The local generation outputs remain under the Codex generated-image directory for this session and are not committed to Git. Cloudinary is the delivery source; MongoDB stores finalized `MediaAsset` metadata and references.

## Seed design

Command:

```bash
pnpm --filter @farta/api seed:development
```

Required local configuration:

- `APP_ENV=development`
- `DEVELOPMENT_SEED_ACTOR_EMAIL=<existing active development OWNER>`
- valid MongoDB/Redis/Cloudinary values
- ignored finalized-media manifest at `apps/api/.development-seed-media.json`

Ownership and collision policy:

- seed category/product slugs use the `dev-farta-` namespace;
- seed SKUs use the `DEV-FAR-` namespace;
- products carry the `development-seed` tag;
- an existing namespaced document must have been created by the configured actor;
- mismatched ownership, archive state, SKU/product relation or missing marker fails the run instead of overwriting data.

Inventory policy:

- stock is changed only through `InventoryService.adjust`;
- each initialization has a stable idempotency key;
- stock initializes only when both `onHand` and `reserved` are zero;
- a repeat run does not increment stock or delete user-created records.

## Seeded catalog

- 3 active categories: one root plus Áo thun and Đầm children.
- 2 active products with Vietnamese names/descriptions and integer VND prices.
- 9 active variants: Black/Cream and S/M/L combinations where applicable.
- 83 total `onHand`, 0 reserved after initialization.
- 1 active `home-hero` banner with separate desktop/mobile media.

Public API evidence:

- categories: 3 development slugs returned;
- products: 2 returned, with 6 and 3 real variants and valid covers;
- active `home-hero` banners: 1 with both desktop and mobile media;
- Cloudinary delivery: HTTP 200.

## Idempotency evidence

First execution:

```text
Development seed complete: created=15 updated=11 skipped=0.
```

Before and after the second execution:

```text
categories=3 products=2 variants=9 onHand=83 reserved=0
Development seed complete: created=0 updated=0 skipped=24.
categories=3 products=2 variants=9 onHand=83 reserved=0
```

This confirms that the second execution did not duplicate slugs/SKUs or drift inventory.

## Safety and test evidence

- Direct executions with `APP_ENV` missing, `staging`, `production` and `unknown` each exited with status 1 before creating an application context.
- API unit tests after adding seed safety coverage: 14 files, 54 tests passed.
- Existing catalog E2E already verifies authorization creation without API-secret disclosure, rejects an invalid Cloudinary response signature, finalizes a valid response, rejects unsafe banner CTA targets and protects referenced media from archival.

Final sequential results:

| Gate                               | Result                                    |
| ---------------------------------- | ----------------------------------------- |
| `pnpm install --frozen-lockfile`   | pass; lockfile unchanged                  |
| `pnpm format:check`                | pass                                      |
| `pnpm lint`                        | pass                                      |
| `pnpm typecheck`                   | pass                                      |
| API unit                           | 14 files, 54 tests passed                 |
| Storefront unit/component          | 6 files, 18 tests passed                  |
| Admin component                    | 1 file, 2 tests passed                    |
| API E2E/security/concurrency       | 7 files, 64 tests passed                  |
| Production builds                  | API, Admin and Storefront passed          |
| `pnpm audit:prod`                  | no known vulnerabilities found            |
| Python frozen sync / Ruff / Pytest | pass / pass / 2 passed                    |
| Gitleaks 8.24.3 full history       | 21 commits, about 1.39 MB, no leaks found |
| Gitleaks tracked worktree snapshot | about 1.30 MB, no leaks found             |

Runtime smoke after the production build returned HTTP 200 for API live/ready, Storefront Home/Shop/PDP, Admin root, public category/product/banner APIs and AI live/ready. Unauthenticated Admin media returned HTTP 401.

## Failure and cleanup behavior

- Missing/invalid manifest or missing/archived/mismatched media fails before any category/product/banner mutation.
- Cloudinary upload failures cannot create a `MediaAsset` because finalization is a separate verified step.
- A provider upload followed by failed finalization can leave an unreferenced Cloudinary object. Automatic destructive cleanup remains intentionally absent; inspect it against database references and remove it manually through an approved provider operation.
- Seed rollback is not destructive. There is no automatic reset command; removal of seed-owned catalog data requires a separately reviewed cleanup procedure.

## Browser tooling checkpoint

`@playwright/test` is not a direct workspace dependency. Its lockfile mentions are optional peer metadata from Next.js/Vitest tooling and do not provide an approved browser-test setup. No browser dependency or browser binary was installed in this phase.

Registry inspection on 2026-10-12 returned `@playwright/test` `1.64.0` with Node `>=20`; this repository's pinned Node 22 line satisfies that engine. The package metadata reports only 28,542 unpacked bytes, but this excludes browser binaries.

Proposed next-phase dependency and initial scope, pending approval:

- add exact dev dependency `@playwright/test@1.64.0`;
- install Chromium first for the deterministic seeded customer/Admin journeys and requested viewport matrix;
- add WebKit as a small cross-browser smoke lane after the primary flow is stable;
- keep CI workers at 1, set a bounded global timeout, and upload traces/screenshots only on failure;
- start API, Storefront and Admin through Playwright `webServer` configuration against the deterministic local seed.

The official browser guide states that every Playwright version needs matching browser binaries and upgrades can require another install. The official CI guide requires browser/system-dependency installation (or the matching container) and recommends one worker for stability. Exact download/cache size is not stated by the official documentation and must be measured on the chosen CI runner after approval; it will be materially larger than the npm package.

Sources checked 2026-10-12:

- https://playwright.dev/docs/browsers
- https://playwright.dev/docs/ci
- npm registry metadata via `pnpm view @playwright/test version engines dist.unpackedSize --json`

Per the phase boundary, Playwright coverage remains blocked on explicit stakeholder approval for the dependency, browser download/storage and CI impact.

## Known limitations

- This is local development evidence, not staging or production deployment evidence.
- Media was validated against the configured Cloudinary account, but provider-side moderation, retention and operational alerts are not validated here.
- The ignored manifest is environment-specific and must be created through signed upload/finalization for each development environment.
- No automated destructive cleanup is provided for generated seed data or orphaned provider uploads.
- Browser visual/responsive/accessibility release coverage is not part of this subphase.
