# Authentication API foundation

All paths are below `/api/v1`. Browser credentials are cookies; access and refresh credentials are never returned in response JSON.

## Customer routes

| Method   | Route                                | Auth | CSRF binding | Purpose                         |
| -------- | ------------------------------------ | ---- | ------------ | ------------------------------- |
| `GET`    | `/auth/customer/csrf`                | no   | none         | issue signed pre-auth token     |
| `POST`   | `/auth/customer/register`            | no   | pre-auth     | create CUSTOMER + session       |
| `POST`   | `/auth/customer/login`               | no   | pre-auth     | credential login                |
| `POST`   | `/auth/customer/refresh`             | no   | refresh      | rotate refresh credential       |
| `POST`   | `/auth/customer/logout`              | yes  | session      | revoke current session          |
| `POST`   | `/auth/customer/logout-all`          | yes  | session      | revoke all customer sessions    |
| `GET`    | `/auth/customer/me`                  | yes  | none         | safe current-user response      |
| `PATCH`  | `/auth/customer/profile`             | yes  | session      | update allowlisted display name |
| `POST`   | `/auth/customer/onboarding/complete` | yes  | session      | persist onboarding once         |
| `GET`    | `/auth/customer/sessions`            | yes  | none         | list safe active session views  |
| `DELETE` | `/auth/customer/sessions/:sessionId` | yes  | session      | revoke an owned session         |

Staff routes use the equivalent `/auth/staff/*` namespace but intentionally expose no public registration route.

Password-reset request/confirm endpoints are not implemented. The recovery design remains blocked on an approved one-use token/outbox schema evolution and email-provider boundary; `/forgot-password` must not be interpreted as delivered recovery functionality.

## Cookies

Development names are `farta_{customer|staff}_{access|refresh|csrf}`. Production access cookies use `__Host-`; refresh/CSRF cookies use `__Secure-`. Access and refresh are `HttpOnly`; all production cookies are `Secure`; access/CSRF use `SameSite=Lax`; refresh uses `SameSite=Strict` and a narrow refresh path. No `Domain` attribute is set.

Every unsafe cookie-authenticated request declares a CSRF policy. The API requires an allowlisted `Origin` (strict `Referer` fallback), a signed token in `x-csrf-token`, the matching readable CSRF cookie, and the correct pre-auth/session/refresh binding.

## Tokens and sessions

- Access JWT: HS256, default 300 seconds; validates fixed algorithm, signature, `iss`, realm-specific `aud`, `exp`, `sub`, `sid`, `realm` and `rolesVersion`.
- Refresh credential: opaque 256-bit secret plus public session selector. MongoDB stores only its HMAC-SHA-256 digest.
- Rotation is a compare-and-swap update. A stale/replayed credential revokes the session family and the newest credential becomes unusable.
- Protected requests require both a valid access JWT and an active matching MongoDB session.

## Rate limits

Login/registration and refresh use separate Redis atomic counters. Defaults are respectively 10 requests/300 seconds and 60 requests/300 seconds per source IP; all values are environment validated. Redis failure fails protected policies closed with HTTP 503. Exceeded policy returns HTTP 429.

## OAuth boundary

Google/Apple routes are intentionally not exposed yet. The implemented foundation includes complete-or-disabled configuration validation, an `OAuthProviderAdapter` contract, `external_identities` indexes, safe internal redirects and one-time Redis transactions containing state, nonce and S256 PKCE material. A future adapter must perform provider code exchange and cryptographic identity-token verification server-side before calling the internal account-link/session flow.
