# Phase 4C completion report

Date: 2026-10-08

## A. Architecture

- Added the provider-neutral `PaymentProvider` contract and isolated `SePayPaymentProvider`.
- Kept order/checkout code free of SePay payload parsing.
- Persisted payments in the checkout transaction before any customer instructions.
- Kept all database transactions free of network/provider calls.

## B. Payment methods

- COD behavior remains unchanged and never implies collection.
- `FULL` uses the exact server-owned order total.
- `DEPOSIT` uses typed fixed-VND or basis-point configuration and an exact remaining receipt.
- Unsupported methods are absent from preview and rejected at submission.

## C. Webhook integrity

- Verifies the official raw-body HMAC/timestamp contract before domain processing.
- Claims unique provider event IDs transactionally.
- Checks direction, receiving account, reference, exact amount, payment window, reservation and current states.
- Persists only a safe event summary and SHA-256 payload fingerprint, not the raw webhook body.
- Returns the provider-required success response for accepted and duplicate delivery.

## D. Storefront

- Checkout renders only payment methods/amounts supplied by the authoritative preview.
- Order detail can request real SePay/VietQR instructions and polls authoritative status for at most five minutes.
- Order reload checks authoritative status before requesting instructions, so terminal, refund and conflict states fail closed without exposing a stale QR.
- Success is displayed only from backend `FULLY_PAID` state.
- Deposit QR is hidden once the deposit is observed until remaining-payment instructions refresh, preventing reuse of a stale amount.
- Expired, unavailable and conflict states have explicit non-success UX.

## E. Security and reconciliation

- Owner-bound initiation/status prevents customer and guest BOLA.
- Browser requests retain existing CSRF/origin controls and Redis rate policies. Payment limits combine per-order and source-global buckets; the source IP honors only the explicitly configured trusted-proxy hop count.
- Invalid, stale and conflicting events cannot mutate payment to paid; reuse of an accepted event ID with a different signed payload is recorded and rejected.
- Payment conflicts retain transaction identity and a safe provider summary for Phase 4D reconciliation.
- `SEPAY_WEBHOOK_SECRET` is included in structured-log redaction.

## F. Automated evidence

Evidence recorded during implementation:

- API typecheck: passed.
- Storefront typecheck: passed.
- API unit: 12 files, 46 tests passed.
- Storefront component/unit: 6 files, 18 tests passed.
- Admin unit: 1 file, 1 test passed.
- API E2E: 6 files, 58 tests passed.

The E2E suite covers valid full payment, invalid/stale authentication, concurrent duplicate delivery, mismatched replay, amount/account/unknown-reference conflicts, deposit then remaining payment, non-authoritative initiation/polling, expired reservation, progressed-order conflict synchronization and guest ownership.

Final completion gate:

```text
pnpm install --frozen-lockfile       PASS (9 workspaces, lockfile current)
pnpm format:check                    PASS
pnpm lint                            PASS
pnpm typecheck                       PASS
pnpm test                            PASS (API 46, Storefront 18, Admin 1)
pnpm test:e2e                        PASS (API 58)
pnpm build                           PASS (API, Admin, Storefront)
pnpm audit:prod                      PASS (no known vulnerabilities)
uv sync --frozen                     PASS
uv run ruff check .                  PASS
uv run pytest                        PASS (2)
tracked high-signal secret scan      PASS (0 matches)
```

Local `gitleaks` and `trufflehog` executables are not installed, so no local full-history scanner result is claimed. CI retains the pinned Gitleaks action.

## G. Runtime smoke

MongoDB `7.0.41` replica set and Redis `8.2` were healthy. The production API, Storefront and Admin builds plus the AI FastAPI service were started locally.

- API live/ready, Storefront checkout/order lookup, Admin root and AI live/ready: HTTP 200.
- Guest Cart → preview exposed `COD`, `FULL`, `DEPOSIT` with authoritative total `329000` VND.
- Full-payment checkout created one `CREATED`/`UNPAID` order.
- Initiation returned a SePay instruction for `329000` VND and a `https://vietqr.app/img?...` URL.
- Status before webhook was `UNPAID`.
- A locally signed raw-body HMAC event returned `{ "success": true }`; status became `FULLY_PAID`, received `329000`, due `0`.
- Persistence check: one Order, one Payment, one Reservation and one webhook event; final Order `CONFIRMED`, Payment `FULLY_PAID`, Reservation `CONFIRMED`, webhook `PROCESSED/FULLY_PAID`; inventory remained `onHand=5`, `reserved=1`.

The smoke event was locally generated with test-only credentials; it was not delivered by SePay Test mode.

## H. Provider environment used

Automated tests used locally signed, provider-shaped payloads and isolated local MongoDB/Redis. No real SePay credential, official Test-mode transfer or production money was used. Therefore Phase 4C does **not** claim production payment readiness.

## I. External configuration required

- SePay Test-mode merchant/bank configuration.
- HMAC webhook secret in the API secret store.
- Public HTTPS callback registration for `/api/v1/webhooks/sepay`.
- Explicit deposit business policy, if enabled.
- Real Test-mode evidence before live enablement.

## J. Known limitations / Phase 4D handoff

- Admin order/payment-conflict reconciliation UI and commands are not yet implemented.
- Reservation expiry worker and notification outbox are Phase 4D.
- No automated refund exists.
- No provider Test-mode/live transfer has been run.
- The E2E run emits Node `MaxListenersExceededWarning` under concurrent Supertest activity while all assertions pass; Phase 4D should remove this test-harness warning rather than masking failures with timeouts.
