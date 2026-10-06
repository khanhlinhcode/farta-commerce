# Phase 4A cart completion report

Date: 2026-10-06  
Starting commit: `91cbd25 docs: freeze phase 4 transactional architecture`

## Implementation

- Added a bounded `CartModule`, strict Cart/CartItem schema, owner-aware service, credential service and conditional mutation guard.
- Guest ownership uses a signed 256-bit `HttpOnly` credential; MongoDB stores only its HMAC digest.
- Customer ownership is derived from the verified Phase 1 session via optional customer authentication.
- One active cart per owner/channel/currency is enforced by unique partial indexes; document `version` provides optimistic concurrency.
- Public cart reads resolve current catalog/media/inventory and calculate safe integer VND line/subtotals server-side.
- Add, update, remove and clear never reserve inventory.
- Transactional merge combines matching variants, caps quantity, marks the source `MERGED` and is replay-safe.
- Added separate Redis policies for cart mutation and merge.

## Storefront

- PDP Add to Cart sends the actual resolved ProductVariant.
- Header count and `/cart` use the real server cart; no cart data is stored in `localStorage`.
- Cart includes responsive quantity/remove/clear controls, semantic availability conflicts, loading/error/retry and branded empty state.
- Login/register invokes the authenticated merge endpoint before navigation.
- Checkout remains visibly unavailable until Phase 4B; no fake checkout result exists.

## Security evidence

API E2E covers guest CRUD, authenticated isolation, guessed credential rejection, cross-origin and missing-CSRF rejection, price/owner/mass-assignment/operator/quantity payload rejection, merge replay/concurrency, idempotent clear, no inventory reservation and digest-only persistence. Cart endpoints expose no client owner selector, so changing an object ID cannot select another cart.

The full API E2E suite passed with 32 tests after the backend implementation. Storefront unit/component tests passed with 9 tests, including selected-variant submission and cart loading/empty/error states.

## Final gate evidence

```text
pnpm install --frozen-lockfile            PASS (9 workspaces, lockfile current)
pnpm format:check                         PASS
pnpm lint                                 PASS
pnpm typecheck                            PASS
pnpm --filter @farta/api test             PASS (10 files / 22 tests)
pnpm --filter @farta/storefront test      PASS (4 files / 9 tests)
pnpm --filter @farta/admin test           PASS (1 file / 1 test)
pnpm test:e2e                             PASS (4 files / 32 tests)
pnpm build                                PASS (API, Admin, Storefront; /cart emitted)
pnpm audit:prod                           PASS (no known vulnerabilities)
tracked high-signal secret pattern scan  PASS (0 matching files)
uv sync --frozen                          PASS
uv run ruff check .                       PASS
uv run pytest                             PASS (2 tests)
```

Local runtime smoke with MongoDB replica set and Redis healthy returned API live `200`, API ready `200`, guest Cart `200` and Storefront `/cart` `200`. The new guest cookie carried `HttpOnly; SameSite=Lax`; the Cart response was an authoritative empty `ACTIVE` cart with zero total and no conflicts.

`gitleaks` is not installed locally, so no local full-history Gitleaks result is claimed. The pinned CI scanner remains required.

## Known limitations

- Cart price/availability is a current projection, not a promise; Phase 4B must revalidate transactionally.
- Exact production limit/retention values must be supplied outside source control.
- No cart cleanup job exists yet; expiry metadata is present and destructive cleanup remains policy-gated.
- Automated screenshot capture was blocked by macOS screen-capture permissions, so no visual screenshot evidence is claimed. Responsive CSS and component states were reviewed in source/build; interactive browser visual QA remains required before production.
- Strix was not run; no scanner LLM/runtime credentials were configured. Explicit E2E security tests are the current evidence.
