# ADR-014: Cart ownership and guest credential

Status: Accepted

## Decision

The API owns cart identity. A customer cart is selected from the verified customer session; a request body never selects `customerId` or an authoritative cart ID. A guest receives a random 256-bit credential in a host-only `HttpOnly` cookie. Only a keyed digest of that credential is stored in MongoDB.

One `ACTIVE` cart exists per owner, channel and currency. Cart items persist only `variantId`, quantity and timestamps. Product copy, media, price, subtotal, total and availability are authoritative projections resolved when a cart is read or checked out.

Guest-cookie settings are `SameSite=Lax`, `Secure` outside local development, path `/`, with no `Domain`. Guest state-changing requests require an allowed `Origin`; authenticated requests additionally use the Phase 1 synchronizer CSRF token. `CART_CREDENTIAL_SECRET` is independent from JWT and CSRF secrets.

Merge is a server-controlled transaction. Matching variant quantities are combined up to the configured line limit, conflicts are returned, the source cart becomes `MERGED`, and the credential is cleared only after commit. Replaying a merge against the same merged source returns the same target without adding quantities again.

## Consequences

- Guessing a MongoDB identifier or submitting another owner ID grants no cart access.
- Losing the guest cookie loses access to that guest cart; no recovery claim is made.
- Cart reads may become stale immediately and checkout must revalidate all commercial data.
- Production boot fails when the independent guest credential secret or bounded cart policy is absent.
