# Phase 1 defensive security review

Date: 2026-10-03

## Scope and evidence

Reviewed the NestJS configuration, HTTP bootstrap, authentication controllers/services/guards, MongoDB schemas, Redis operations, tests, environment policy and local Docker boundary. Evidence consists of source inspection, unit tests, API E2E tests against MongoDB replica set + Redis, dependency audit and secret scan gates recorded in the completion report.

Strix 1.6.2 was available, but the scan stopped before analysis because `STRIX_LLM` was not configured. No Strix finding or exploit-validation claim is made.

## Findings fixed during implementation

| Severity | Finding                                                                                                  | Resolution and regression evidence                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Medium   | Mongoose `strictQuery` was incorrectly passed to MongoDB driver, preventing runtime connection.          | Moved to `mongoose.set`; API E2E boots against the real replica set.                                                        |
| Medium   | Global `sanitizeFilter` rewrote trusted session expiry operators and string ownership IDs, denying auth. | Preserved sanitization; server-built operators use `mongoose.trusted`, ownership IDs are explicit `ObjectId`; E2E passes.   |
| Low      | JWT tamper test changed only Base64URL padding bits and could produce identical signature bytes.         | Test now mutates payload bytes and confirms cryptographic rejection.                                                        |
| Low      | Local MongoDB 8.0 image cannot boot on the current Docker Desktop Linux 6.19 kernel.                     | Local-only image pinned to MongoDB 7.0.41; replica-set health and init are verified. Production version remains a decision. |

## Control review

| Area                      | Result                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Passwords                 | Central bcrypt service; configurable cost; dummy-hash unknown-user path; no hash in serializers/logs.              |
| JWT                       | Fixed HS256 allowlist, issuer/audience/realm/expiry validation, minimal claims, no bearer JSON response.           |
| Refresh/session           | HMAC digest only, CAS rotation, replay/race revocation, idle/absolute expiry, current/all revocation.              |
| CSRF/CORS/cookies         | Origin + signed double-submit binding; explicit CORS origins; realm-specific HttpOnly/Secure production cookies.   |
| Authorization             | Global realm and permission guards; customer/staff audience separation; session revoke filters by principal owner. |
| Injection/mass assignment | DTO whitelist + forbid unknown; explicit mappings; strict schemas; sanitized filters; no request-object queries.   |
| Rate/resource controls    | Redis atomic login/refresh policies and 429; JSON/urlencoded limits configured in production entrypoint.           |
| Error/log/data exposure   | Safe envelope/request ID; unexpected errors hidden; credential/secret redaction test; explicit safe user/session.  |
| OAuth                     | State/nonce/PKCE transaction and persistence boundary only; provider success cannot be faked.                      |
| Local infrastructure      | MongoDB/Redis bind to loopback; development database has no production credentials.                                |

## Residual risks and limitations

- No concrete Google/Apple adapter or external-credential flow was executed; provider login must remain disabled.
- HS256 key rotation/KMS is unresolved for production. The current fixed-algorithm implementation is suitable for the engineering foundation, not a production key-operations claim.
- Password reset/email verification and MFA are not implemented.
- Rate-limit identity is source IP only; edge proxy trust and multi-signal abuse policy require deployment design.
- No exploit-validated penetration test ran. Manual review and automated regressions do not prove absence of vulnerabilities.
- Production CSP/provider allowlists, TLS termination and secret manager integration require deployment configuration.

No unresolved Critical/High issue was identified within the implemented Phase 1 scope. This statement is bounded by the evidence above and is not a general production security certification.
