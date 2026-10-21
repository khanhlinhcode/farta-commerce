# Phase 5E — Observability and alert validation

Date: 2026-10-21

Status: **PARTIAL — runtime observability exists; alert delivery is BLOCKED**.

## Verified implementation

- NestJS emits structured `pino-http` request logs and returns an
  `x-request-id`. The error envelope carries the same request identifier.
- Log redaction covers browser credentials, cookies, authorization headers,
  OAuth secrets, JWT/session material and provider secrets. The unit regression
  is part of the 92-test API suite.
- API and private AI services expose separate live/ready endpoints. Northflank
  has startup, readiness and liveness probes configured for both services.
- The reservation expiry worker logs start, completion and failure and exits
  non-zero on a failed one-shot run. Inventory release and ledger mutation are
  transactional and idempotent.
- Payment webhook events, payment conflicts, order audit events and notification
  intents are persisted as bounded records instead of relying on browser state.
- Cloudflare `wrangler tail` observed the bounded Phase 5E sample on Storefront
  version `f851b777-6f89-4edc-9ff8-ada2a8a665fb`: all observed invocations had
  `outcome=ok`, HTTP 200 and empty `exceptions` arrays.

## Platform inspection

- Northflank returned no configured notification integration and no log sink for
  the staging project at the inspection checkpoint.
- A fixed-name, value-free runtime configuration check found no alert sink
  configuration. No secret value was read into a report.
- Atlas and Redis are reachable through API readiness, but no independent alert
  delivery, backup alert or Redis durability evidence was available.
- No safe test alert was delivered to a human endpoint. Alerting therefore must
  remain `BLOCKED`; logs and health probes are not a substitute for paging.

## Required actionable alerts

| Signal                 | Proposed trigger                       | Minimum context, without PII      | Status                             |
| ---------------------- | -------------------------------------- | --------------------------------- | ---------------------------------- |
| API readiness          | consecutive readiness failures         | environment, service, request ID  | BLOCKED                            |
| Elevated 5xx           | rate/window above an approved SLO      | route template, count, deployment | BLOCKED                            |
| Worker exception/CPU   | any 1102, exception or CPU-limit event | Worker version, route, outcome    | observable; delivery BLOCKED       |
| MongoDB connectivity   | readiness or driver failure            | service, error code, deployment   | BLOCKED                            |
| Redis connectivity     | readiness or worker failure            | service/job, error code           | BLOCKED                            |
| Reservation cleanup    | one-shot job non-zero or overdue       | job ID, released count            | observable; delivery BLOCKED       |
| Webhook authentication | rejected signature/timestamp spike     | provider, safe event digest       | source-supported; delivery BLOCKED |
| Payment conflict       | new reconciliation conflict            | order code, conflict code         | source-supported; delivery BLOCKED |
| Email exhaustion       | terminal delivery failure              | notification ID, error code       | delivery worker not implemented    |

Thresholds and escalation ownership require stakeholder SLO/on-call decisions;
they were not invented in this phase.

## Provider checkpoint

No monitoring provider or production dependency was added. To unblock alert
delivery, the stakeholder must select a destination/provider, define incident
ownership and supply credentials through Northflank/Cloudflare secret stores.
Afterward, send a safe synthetic alert and record receipt and recovery without
including tokens, cookies, addresses or customer PII.
