# Phase 4 security plan

## Trust controls

- Cart/order ownership comes from a verified session or digest-bound guest credential, never request IDs.
- Every mutation DTO is allowlisted and mapped; Mongo operators, prototype keys, client money/status/owner fields are rejected.
- Authenticated browser mutations retain synchronizer CSRF plus Origin validation. Guest ambient-cookie mutations require allowed Origin and SameSite cookies.
- Checkout and payment mutations have operation-specific Redis rate limits and persistent idempotency.
- Order lookup uses random public codes plus normalized phone verification, a restricted response and an enumeration-safe error.
- Admin commands require staff realm, granular permission, current object/state policy, CSRF and audit.

## Payment boundary

- Dedicated SePay HMAC secret; raw-body verification; constant-time comparison; bounded timestamp tolerance.
- Provider event ID uniqueness, expected reference/amount checks and explicit conflict state.
- No raw provider secrets/payloads, auth/cookie headers, full phone/address, tokens or guest credentials in logs/audit.
- Redirect/polling cannot mark payment successful. No automatic refund without an official implemented workflow.

## Resource controls

- Per-line quantity, cart sizes, notes, pagination, JSON body, request time and polling are bounded.
- Search/admin filters are typed; no client regex/database expression.
- Reservation/checkout transactions are short; external calls happen afterward.
- Redis rate-limit outage behavior follows the existing fail-closed policy for sensitive mutations.

## Evidence requirements

Security completion requires negative E2E tests for BOLA, CSRF, RBAC, NoSQL/mass assignment, price/quantity/payment tampering, lookup enumeration, replay/spoofing, rate limits, race conditions and leakage. A local Strix run requires a running API plus explicit test credentials and is supplementary; no scan is claimed if those prerequisites are absent.

## Phase 4A implementation review

Cart ownership has no client-selected object ID. The API verifies a customer session or HMAC guest credential before resolving the one active owner cart. DTO whitelist rejection covers price/total/customer/operator fields and quantity bounds. Guest cross-origin mutation and authenticated missing-CSRF cases are covered by E2E tests. Only the credential digest is stored and neither digest nor raw credential appears in the public read model.

Residual risks for later phases: cart state is not checkout authority; price and stock must be revalidated in Phase 4B. Edge proxy/client-IP trust remains a deployment prerequisite for meaningful distributed rate limiting. Full Strix execution was not performed because no scanner runtime/credentials were configured.
