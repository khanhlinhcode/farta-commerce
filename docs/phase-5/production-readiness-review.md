# Phase 5E — Production-readiness review

Date: 2026-10-21

Recommendation: **REMEDIATION REQUIRED — REMAIN ON STAGING**.

No Critical issue was found in the executed source/runtime scope. Unresolved
High findings prevent a production recommendation.

## Findings

| Severity      | Finding                                                  | Evidence and required action                                                                                                                                                                                |
| ------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High          | No actionable alert delivery or operational owner        | Safe logs/probes exist, but Northflank has no notification/log-sink integration and no test alert was received. Select provider/destination, SLOs and on-call ownership; prove safe delivery.               |
| High          | Backup/restore and Atlas recovery not rehearsed          | No restore point, restore exercise, measured recovery time or post-restore commerce integrity evidence was available. Define retention/RPO/RTO and execute a staging restore drill without production data. |
| High          | SePay external Test mode not validated                   | Local HMAC/replay/mismatch tests pass; runtime is disabled/incomplete and no provider delivery exists. Online payment must remain disabled until official Test-mode evidence passes.                        |
| High          | Transactional email has no delivery worker/provider      | Idempotent outbox exists, but delivery, retry exhaustion and real mailbox receipt are absent. Approve provider and validate end to end.                                                                     |
| High          | Social login is incomplete if included in launch scope   | Google and Apple have foundations only, no adapters/callbacks/credentials. Remove/disable promises in launch scope or implement and validate separately.                                                    |
| Medium        | Live staging rollback rehearsal remains pending          | Immutable versions are known, but rolling back to the pre-remediation Storefront could reintroduce Worker 1102. Rehearse with a harmless compatible candidate and prove restore; do not mutate data.        |
| Medium        | Cloudflare Free-plan capacity is bounded-only            | 7 sequential and 4 concurrent representative requests returned 200; Worker tail had no exception/CPU-limit event. This is not production load proof. Define a capacity/SLO plan.                            |
| Medium        | Redis recovery/durability behavior is not exercised      | Readiness and current job behavior pass, but restart/failover effects on OAuth/idempotency/session-related ephemeral data are not measured. Execute a controlled staging interruption/recovery drill.       |
| Medium        | Physical-device and assistive-technology evidence absent | Chromium, Linux Firefox and WebKit pass; no physical device or screen reader was tested. Run a device/AT acceptance matrix.                                                                                 |
| Medium        | Provider/log retention and privacy ownership incomplete  | Redaction tests pass, but retention periods, access review, deletion/export and incident handling are not approved operationally. Define policy and accountable owner.                                      |
| Low           | Admin bundle remains relatively large                    | Vite reports the main Admin JS chunk at about 461 kB raw / 145 kB gzip. Continue route-level splitting where measurement supports it; no correctness blocker observed.                                      |
| Informational | AI Product Advisor remains provider-off/read-only        | It uses the signed NestJS tool boundary and cannot mutate commerce. Live LLM/RAG/LangGraph remain intentionally out of scope.                                                                               |

## Controls reviewed

- Database indexes and unique/idempotency constraints are exercised by unit and
  E2E suites, including inventory and checkout concurrency.
- Reservation expiry is a one-shot, idempotent, transactional worker; the
  Northflank job exists. Alerting on missed/failing runs remains blocked.
- Payment webhook recovery/reconciliation models duplicate, mismatch, late
  payment and conflict states. Provider delivery is still blocked.
- HTTPS staging domains, restrictive CORS/CSP/CSRF/cookies and non-indexing pass
  the browser/runtime suite. Production domains/edge are not configured here.
- Dependency audit reports no known high-level production vulnerability, and
  GitHub secret scans report no leak for the tested commit/history.
- No production deployment, DNS cutover, production payment or production LLM
  traffic was performed.

## Rollback and recovery decision

A live rollback was not executed. The currently recorded pre-Phase-5D
Storefront target predates the Worker CPU remediation; routing staging traffic
to it would deliberately reintroduce a known risk while browser validation was
active. The safe next rehearsal must deploy a harmless schema-compatible
candidate, roll to a known-good current-compatible version, verify Cart/owned
Order continuity, and restore the intended release. No MongoDB rollback or
record deletion is permitted.
