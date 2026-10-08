# ADR-019: Reservation worker and notification outbox

Status: Accepted  
Date: 2026-10-08

## Context

Phase 4 needs reservation expiry and durable notification intent. Redis is already present, but BullMQ is not installed and no production queue dependency has stakeholder approval. A network email/provider call must not extend the order transaction or make order correctness depend on delivery availability.

## Decision

- Run reservation expiry as a separate Nest application-context process using `worker:reservations`.
- Poll only bounded `ACTIVE` reservations whose `expiresAt` is due.
- Re-check state and release inventory plus ledger entry in one short MongoDB transaction. Concurrent workers are expected; a losing worker performs no mutation.
- Keep interval and batch size in typed, bounded environment configuration.
- Persist notification intent in `notification_events` inside the same MongoDB transaction as the relevant order/payment mutation.
- Use a unique semantic idempotency key. Payment receipts include the resulting payment state so deposit and final receipts remain distinct.
- Leave events as `PENDING` until an explicitly configured delivery adapter/worker exists. Do not claim email delivery.

## Consequences

- Correctness does not depend on an in-process timer in the API or on an unavailable queue product.
- Multiple worker replicas can run safely, but polling latency and deployment scheduling must be monitored operationally.
- The outbox prevents a committed order from losing notification intent, while provider delivery/retry/dead-letter handling remains later work.
- Adopting BullMQ or another queue requires a separate decision and stakeholder approval.
