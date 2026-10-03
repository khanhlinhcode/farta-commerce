# Security architecture

## Defensive layers

| Layer         | Controls                                                                           |
| ------------- | ---------------------------------------------------------------------------------- |
| Edge          | TLS, bounded requests, known origins, coarse abuse controls                        |
| HTTP          | request ID, Helmet/CSP, explicit CORS, JSON limits, malformed-body handling        |
| Identity      | realm-separated auth, password hashing, OIDC verification, rotation/revocation     |
| Browser       | host-only cookies, CSRF token + Origin check, output encoding, safe redirects      |
| API           | DTO allowlists, explicit mapping, response serializers, rate-policy groups         |
| Authorization | permission guards, object policies, state-machine commands, default deny           |
| Data          | strict schemas, unique indexes, transactions, encrypted transport, least privilege |
| Providers     | scoped credentials, signature/replay checks, timeouts, allowlisted destinations    |
| Operations    | structured redacted logs, audit events, metrics, alert hooks, secure CI            |

## Input and injection rules

- Reject unexpected DTO fields and ambiguous repeated security parameters.
- Never pass a request object/DTO spread into Mongo filters or updates.
- Reject Mongo operator keys and prototype-pollution keys recursively before mapping.
- Never use `eval`, `new Function`, customer-controlled template execution or untrusted shell arguments.
- SQL, if introduced later, uses parameterized APIs only.
- Remote fetches require scheme/host allowlists, DNS/IP private-range rejection on every redirect, timeouts and response-size bounds.
- Filesystem paths use generated identifiers and fixed roots; user filenames are metadata only.

## Browser content security

- React escaping remains the default; arbitrary HTML is unsupported.
- CSP starts restrictive: self scripts, explicit image/connect/frame provider origins, `object-src 'none'`, controlled `frame-ancestors`, no `unsafe-eval`.
- Nonces/hashes are preferred for necessary inline scripts. Any framework-required deviation is documented and tested before production.
- Cloudinary images are constrained to the configured cloud/domain and safe transformations.

## Rate policy groups

`AUTH_STRICT`, `AUTH_REFRESH`, `ACCOUNT_RECOVERY`, `PUBLIC_STANDARD`, `SEARCH`, `SENSITIVE_MUTATION`, `ADMIN_SENSITIVE`, `UPLOAD`, `WEBHOOK`, `AI_TOOL`.

Numeric thresholds are typed environment configuration with documented defaults and deployment tuning. Identity plus IP/device signals are combined where appropriate; forwarded IP is trusted only from configured proxies. Authentication/security endpoints fail closed if the distributed limiter cannot establish policy.

## Logging and error invariants

Logs are structured and include timestamp, level, request ID, method, route template, status, duration and safe actor/session reference. Redaction covers authorization/cookie headers, passwords/hashes, JWTs, refresh/reset/OAuth tokens, database/Redis URIs, provider secrets and private keys. Production responses expose only stable error code, safe message and request ID.

## Secret and environment policy

No secret is prefixed for frontend exposure. Production configuration has no development fallback. Startup validation rejects placeholder secrets, missing origins, invalid URL schemes, short signing material and insecure production cookie/TLS settings.

## AI boundary

The AI service receives no MongoDB/Redis/Cloudinary/payment credentials. Every tool call returns to the API with authenticated service identity, delegated user context, allowlisted schema, authorization, idempotency and audit. High-impact actions remain unavailable or require explicit human confirmation/step-up.
