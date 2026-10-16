# Account and recovery security review

Date: 2026-10-16

## Completed account work

- `PATCH /api/v1/auth/customer/profile` derives the customer from the verified session and allowlists only `displayName`.
- `POST /api/v1/auth/customer/onboarding/complete` is session-CSRF protected and idempotent. The Storefront persists both the primary and skip actions, so the welcome state is not repeated indefinitely.
- Profile/onboarding mutations produce safe audit events without email, password, token or session material.
- Authentication success is now separated from post-auth Cart merge. A merge failure routes to Account with an explicit Cart-review notice and never reports a false login/registration failure.

## Tests

- Customer profile ownership and update success.
- Rejection of `roles` and `status` mass assignment.
- Repeated onboarding completion.
- Login/register success when Cart merge fails, without repeating registration.

## Release blocker: password recovery

Password reset is **not implemented** in this remediation snapshot. A compliant implementation needs a one-use digest/expiry record and a durable notification intent. The current `notification_events` schema is intentionally ORDER-only (`aggregateType=ORDER` and an order code is required). Reusing it for recovery therefore requires an approved database schema evolution and migration/index decision. Provider delivery remains separately blocked because no transactional email provider or worker dependency is approved.

Until those approvals exist:

- `/forgot-password` remains an honest unavailable boundary;
- no plaintext token is created or logged;
- no email-delivery claim is made;
- the repository must not be called production-ready.

The planned `password_reset_tokens` entry in `docs/database/schema-design.md` is an architecture target, not an implemented collection.
