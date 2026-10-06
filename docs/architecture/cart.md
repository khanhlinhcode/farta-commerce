# Cart architecture

## Ownership

- Guest cart: high-entropy signed cart credential in a secure host-only cookie; server stores the cart and expiration.
- Customer cart: linked to authenticated `userId`; one active cart per sales channel/currency.
- A caller never supplies an authoritative owner ID.

Implemented in Phase 4A by `CartModule`. Guest credentials contain a random 256-bit nonce plus HMAC, use a host-only `HttpOnly` cookie and are persisted only as a keyed digest. `OptionalAuth("CUSTOMER")` treats a valid customer cookie as authoritative and rejects an invalid presented session rather than silently downgrading it to guest.

## Cart item

`variantId`, desired quantity, optional customer-entered personalization supported by schema, timestamps. Display name/image/price are projections, not authoritative cart state.

## Commands

- add item
- change quantity
- remove item
- view/validate cart
- merge guest cart after authentication

Each command loads the variant by explicit identifier, bounds quantity and arrays, and maps fields explicitly. Price and availability are refreshed before checkout.

## Merge policy

Within a transaction or retry-safe command:

1. lock/version-check guest and customer carts;
2. deduplicate by variant and supported option signature;
3. sum quantities up to the configured per-item maximum;
4. drop no item silently—return unavailable/changed conflicts;
5. invalidate the guest credential after successful merge.

Merge is idempotent and scoped to the authenticated customer.

## Security

Cart IDs are non-authoritative selectors. Ownership policy is mandatory for every read/write. Client prices, discounts and totals are ignored. Search/filter Mongo syntax is never accepted.

Authenticated mutations use the Phase 1 session-bound CSRF token. Guest mutations still use an ambient cookie, so they require an allowlisted `Origin`/`Referer` and `SameSite=Lax`. Add/update/clear and merge have distinct Redis-backed rate-limit policies.

## Persistence

`carts` stores owner selectors, `STOREFRONT`, `VND`, explicit status, optimistic `version`, expiry and embedded item identifiers/quantities. Unique partial indexes enforce one active cart per customer or guest credential. A public read projects active Product/ProductVariant/Media and current Inventory into semantic availability and integer VND totals without exposing exact stock or the guest digest.
