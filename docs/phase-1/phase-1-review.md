# Phase 1 implementation review

Date: 2026-10-03

## Decision

The bootstrap-only interpretation in the earlier report contradicted the dedicated Phase 1 prompt. ADR-011 corrects the scope: Phase 1 includes the security foundation required before Commerce Core.

## Implemented gate

- separate CUSTOMER and STAFF authentication realms;
- customer registration with fixed role and strict DTO allowlist;
- controlled development-only OWNER bootstrap that production configuration rejects;
- bcrypt service, access JWT verification, opaque refresh rotation and durable sessions;
- pre-auth, refresh and authenticated CSRF bindings;
- RBAC/permission decorators and guard plus object-scoped session revocation pattern;
- Redis-backed login/refresh policies;
- OAuth provider contract, disabled-provider status, external identity schema and state/nonce/PKCE transaction boundary;
- shared HTTP configuration for headers, CORS, validation and safe errors;
- real MongoDB replica-set/Redis integration coverage.

## Contradictions checked

- JWT is short-lived access only; refresh remains opaque as approved by ADR-002.
- Redis does not authorize sessions; MongoDB remains durable authority.
- Customer registration cannot provision staff/admin roles.
- OAuth remains disabled rather than returning fake success without provider adapters/credentials.
- Phase 2 may consume auth principals/permissions but must not rewrite the security boundary for convenience.

## Gate status

The code is ready for final repository-wide gates. Commerce Core must not begin until the completion report records those actual results and the stakeholder reviews the documented limitations.
