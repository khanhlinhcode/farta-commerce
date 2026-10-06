# Phase 4.0 design freeze report

Date: 2026-10-06  
Baseline: `ff61e9b feat: build premium FARTA fashion storefront`

## Outcome

The transactional commerce contracts are frozen for incremental delivery as Phase 4A Cart, Phase 4B Checkout/Reservation/Order/COD, Phase 4C SePay and Phase 4D operations/hardening. This subphase changed documentation only; it did not implement or claim Cart, Order, Payment or provider runtime behavior.

## Contradictions resolved

1. Open decisions now point checkout/payment values to Phase 4 rather than the superseded Phase 6/7 numbering.
2. RBAC no longer claims Order authorization tests exist before the Orders domain.
3. The Phase 2 `InventoryService.reserve()` limitation is explicit: user-only actor, per-call transaction, weak reservation idempotency binding and no durable Reservation aggregate. Phase 4B must use session-aware batch primitives.
4. Cart/checkout/order/payment rate-limit policies are required; the runtime still only implements login/refresh until their owning subphase.
5. Redis is present and BullMQ is not. Phase 4D may use an idempotent Mongo-claimed worker without a new queue dependency; BullMQ requires stakeholder approval.

## Frozen decisions

- Guest and customer cart ownership: ADR-014.
- Reservation lifecycle and transaction participation: ADR-015.
- Immutable orders and explicit state machine: ADR-016.
- Provider-neutral payment boundary: ADR-017.
- SePay raw-body HMAC, timestamp and event idempotency: ADR-018.
- Proposed collections, indexes and transaction boundaries: `architecture.md`.
- Unresolved business values and fail-closed configuration: `business-rules.md`.
- API, security, failure and test contracts: the remaining Phase 4 documents.

## SePay research

Official documentation accessed 2026-10-06:

- <https://developer.sepay.vn/en/sepay-webhooks/xac-thuc>: HMAC-SHA256 signs `{timestamp}.{raw_body}`, headers `X-SePay-Signature` and `X-SePay-Timestamp`; raw bytes are required.
- <https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook>: transaction `id` is stable across retry/replay, `transferAmount` is integer VND, `code` is the payment reference candidate and success requires HTTP 200/201 plus `{"success":true}`.
- <https://developer.sepay.vn/en/sepay-webhooks/test-mode/so-sanh-voi-live>: Test mode uses simulated isolated transactions with the same payload/auth/retry contract.
- <https://developer.sepay.vn/en/cong-thanh-toan/API/tong-quan>: Payment Gateway exposes sandbox and production base URLs and authenticates API requests with Basic Auth.
- <https://developer.sepay.vn/en/sepay-webhooks/xu-ly-loi>: delivery can be retried and replayed; application-level deduplication is mandatory.

Known uncertainty: no production merchant/account, secrets, accepted bank account, webhook configuration or real provider transaction was supplied. Phase 4C may implement against mocks/Test mode contracts but cannot claim production payment readiness without external validation.

## Baseline evidence before documentation

```text
pnpm install --frozen-lockfile       PASS (lockfile current)
pnpm format:check                    PASS
pnpm lint                            PASS
pnpm typecheck                       PASS
pnpm test                            PASS (API 22, Storefront 5, Admin 1)
pnpm test:e2e                        PASS (API 25)
pnpm build                           PASS (API, Admin, Storefront)
pnpm audit:prod                      PASS (no known vulnerabilities)
uv sync --frozen                     PASS
uv run ruff check .                  PASS
uv run pytest                        PASS (2)
```

The first frozen-install attempt failed with `ENOSPC`. Only ignored generated build outputs (`apps/storefront/.next`, `apps/admin/dist`, `apps/api/dist`) were removed; the retry passed. Docker Desktop initially was not running; after starting it, MongoDB replica set and Redis became healthy and E2E passed. These were host-state failures, not hidden test failures.

## Completion gate evidence

The complete sequence was rerun after the documentation changes with the same passing counts shown above. A tracked high-signal secret-pattern scan returned zero matching files. `gitleaks` is not installed on this workstation, so no local full-history Gitleaks run is claimed; the pinned CI scan remains required.

## Remaining production decisions

Exact line/cart/reservation limits, shipping fee/threshold, address master data, deposit rule, refund process, email provider, legal cancellation/retention text, deployment origins and real SePay credentials/configuration remain unresolved and are fail-closed or disabled according to `business-rules.md`.
