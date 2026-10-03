# Phase 0 contradiction review

## Resolved contradictions

| Tension                                                        | Resolution                                                                                                                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greenfield vs earlier Farta systems                            | This repository is independent; no source, schema or deployment dependency is inherited.                                                                                            |
| HttpOnly cookies vs CSRF                                       | Both access and refresh credentials are cookie-bound; unsafe methods require Origin verification and a bound CSRF token.                                                            |
| Vite admin vs same-origin cookies                              | Production edge maps admin `/api` to NestJS, preserving a host-only same-origin cookie boundary.                                                                                    |
| JWT statelessness vs logout/revocation                         | Access JWT is short-lived but every protected request remains session-bound; server session state is authoritative.                                                                 |
| Redis-backed sessions vs MongoDB durability                    | MongoDB stores sessions/durable revocation; Redis only accelerates checks/coordination and cannot authorize alone.                                                                  |
| Refresh token rotation vs JWT requirement                      | Access token is JWT; refresh credential is opaque, rotated and hash-stored. The prompt does not require refresh to be JWT.                                                          |
| Shared UI vs Next.js Server Components/Vite                    | Share tokens and proven React primitives with split exports; keep domain/client-only components app-local.                                                                          |
| TheUI reference vs Svelte/licensing                            | Observe public interaction patterns only; implement FARTA-native React components and copy no source/assets.                                                                        |
| Liquid glass vs readability/performance                        | Restrict glass to transient/floating surfaces, with opaque fallback and reduced motion.                                                                                             |
| AI future stack vs secure commerce core                        | AI service is scaffold-only, holds no DB credentials and calls API-controlled tools.                                                                                                |
| MongoDB vs multi-document invariants                           | Require replica-set transactions plus unique indexes/atomic conditional updates.                                                                                                    |
| Payment foundation vs no fake production behavior              | Model adapter/state contracts only until a provider is chosen; never accept frontend payment success.                                                                               |
| Earlier “Phase 1 Engineering Foundation” vs greenfield roadmap | The latest greenfield roadmap is authoritative: Phase 1 is reproducible bootstrap; auth/session/RBAC implementation belongs to Phase 2. Reports use “Phase 1 Bootstrap” explicitly. |

## Consistency checks

- BA flows map to explicit domain services and state transitions.
- RBAC permissions cover each privileged admin flow; object policy remains separate from role permission.
- Schema indexes support identity uniqueness, SKU uniqueness, idempotency and provider-event replay defense.
- Threats map to planned controls and tests; no planned control is represented as already implemented.
- Open decisions are reversible and do not block monorepo bootstrap.

## Gate result

**PASS for Phase 1 bootstrap.** This is not a production-readiness approval. Phase 2 cannot pass until auth/session/cookie/CSRF controls exist in code and tests.
