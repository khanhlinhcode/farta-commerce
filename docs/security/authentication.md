# Authentication architecture

## Realms

| Property        | Customer                   | Staff/admin                                              |
| --------------- | -------------------------- | -------------------------------------------------------- |
| Route namespace | `/api/v1/auth/customer/*`  | `/api/v1/auth/staff/*`                                   |
| JWT audience    | `farta-storefront`         | `farta-admin`                                            |
| Session realm   | `CUSTOMER`                 | `STAFF`                                                  |
| Cookie names    | customer-prefixed          | admin-prefixed                                           |
| Provisioning    | public registration/OIDC   | invite or controlled bootstrap only                      |
| OAuth policy    | Google and Apple supported | disabled by default; allowlisted enterprise policy later |

The API uses distinct guards and rejects a valid token from the wrong audience/realm. Public registration always creates `CUSTOMER`; `role`, `permissions`, `isAdmin` and `isVerified` are rejected as unexpected fields.

## Passwords

- `PasswordService.hash()` and `PasswordService.verify()` are the only bcrypt entry points.
- Initial bcrypt work factor is configuration-driven and benchmarked on production-class hardware before launch; Phase 0 does not invent a universal number.
- A dummy password hash is verified on unknown-email login to reduce obvious enumeration timing differences.
- Passwords/hashes are never logged or returned.

## Google OIDC

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as FARTA API
  participant G as Google
  B->>A: GET customer/google/start + redirect target
  A->>A: validate redirect, create state/nonce/PKCE verifier
  A-->>B: HttpOnly transaction cookie + authorization redirect
  B->>G: authenticate/consent
  G-->>A: callback code + state
  A->>A: constant-time state check; consume transaction once
  A->>G: exchange code with PKCE
  A->>A: verify issuer, audience, signature, exp, nonce, subject
  A->>A: apply explicit account-linking policy
  A-->>B: create customer session; internal relative redirect
```

Frontend-submitted profile claims are never accepted as proof of identity. Automatic linking by email is disabled unless the provider email is verified and the customer completes a deliberate linking flow in an authenticated session.

## Sign in with Apple

- Uses state and nonce, validates Apple-signed identity tokens and binds the provider `sub`.
- The email can be a private relay address; it is not treated as a stable cross-provider identity key.
- Name/email returned only on first authorization are captured once after token validation; later absence is normal.
- Client-secret generation uses an Apple private key available only to the API secret store. Missing credentials disables the provider rather than faking success.

## Recovery and redirects

- Reset credentials are 256-bit random values, stored as keyed hashes, single-use and short-lived.
- Responses do not reveal whether an account exists.
- Redirects must be internal relative paths or exact allowlisted origins; protocol-relative URLs and encoded bypasses are rejected.
