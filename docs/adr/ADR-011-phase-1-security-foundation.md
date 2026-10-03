# ADR-011: Phase 1 includes the executable security foundation

- Status: Accepted
- Date: 2026-10-03

## Context

The first Phase 1 pass interpreted the broad greenfield roadmap as a bootstrap-only phase. The dedicated Phase 1 prompt is more specific and explicitly requires authentication, sessions, refresh rotation, RBAC, CSRF and Redis-backed rate-limit infrastructure. Deferring those controls would leave Commerce Core without an enforceable identity boundary.

## Decision

Phase 1 has two delivery increments in one repository:

1. reproducible monorepo/application bootstrap (`e43c18e`);
2. executable security foundation before Commerce Core begins.

The security increment implements realm-separated customer/staff authentication, bcrypt password hashing, short-lived HS256 access JWTs, opaque rotating refresh credentials stored only as HMAC digests, durable MongoDB sessions, cookie/CSRF enforcement, permission guards, object-scoped session revocation and Redis-backed rate policies.

Google and Apple remain disabled unless their complete environment configuration exists. Phase 1 provides the provider contract, external-identity persistence model and one-time Redis state/nonce/PKCE transaction. It does not fake provider callbacks or claim a verified provider login without concrete adapters and credentials.

HS256 is an accepted reversible foundation choice for this phase. The verifier fixes the algorithm to HS256 and validates issuer, audience, realm and expiration. Production key rotation/KMS remains an explicit pre-production decision; Commerce code must not depend on the signing algorithm.

## Consequences

- Phase 2 Commerce Core can rely on authenticated principals and permissions.
- The earlier completion report must be replaced rather than treated as final Phase 1 evidence.
- OAuth buttons must remain unavailable until provider adapters are integrated and tested with real sandbox/development credentials.
- Passing Phase 1 does not imply production launch readiness or a completed penetration test.
