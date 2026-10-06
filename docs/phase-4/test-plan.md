# Phase 4 test plan

## Unit/component

- cart quantity bounds, totals, conflict projection and merge rules;
- Vietnamese phone normalization and money overflow/rounding rules;
- canonical request hashing, same-key replay and different-hash conflict;
- complete allowed/rejected Reservation, Order and Payment transitions;
- storefront selected variant, cart states, checkout conflict/retry and real timelines;
- Admin transition controls and safe reconciliation states.

## MongoDB integration/E2E

- guest and customer ownership, guessed credential, Cart/Order BOLA and merge replay;
- CSRF/Origin, RBAC, NoSQL operators, mass assignment, malformed/oversized payloads;
- stock `1`, 100 concurrent checkout requests: exactly one allocation/order and 99 safe conflicts;
- double-click same idempotency key: one logical order/reservation set;
- forced transaction failure: no partial inventory, ledger, reservation, order or payment;
- release/expiry and concurrent workers are idempotent;
- verified, invalid, stale, duplicate, concurrent and out-of-order webhooks;
- amount/currency/reference mismatch and late-payment conflict;
- guest lookup enumeration limits and restricted response fields;
- safe production errors and structured-log redaction.

Concurrency evidence must run against the local replica-set MongoDB, not an in-memory substitute. Tests use explicit values for unresolved business configuration.

## Gate sequence

Run frozen install, format, lint, strict typecheck, package unit/component tests, API E2E/security/concurrency tests, production builds, `pnpm audit:prod`, Python frozen sync/Ruff/Pytest and available secret scanning. Runtime smoke verifies API live/ready, Storefront, Admin, AI health and each implemented Phase 4 flow.

No Lighthouse, production throughput, real payment or external-email claim is made without that exact evidence.
