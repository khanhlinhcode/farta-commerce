# Phase 4 business rules and decision gate

No unresolved stakeholder value is silently converted into a production rule. Tests may set explicit values.

| Decision                  | Frozen contract                                                                                                                        | Production status                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Guest checkout            | Enabled by the approved Phase 4B scope; ownership is the ADR-014 guest credential                                                      | accepted for Phase 4                                 |
| Maximum quantity per line | `CART_MAX_ITEM_QUANTITY`, integer 1–100                                                                                                | unresolved value; production must supply             |
| Cart expiry/retention     | `GUEST_CART_TTL_SECONDS`, `CUSTOMER_CART_TTL_SECONDS`, bounded                                                                         | unresolved values; production must supply            |
| Reservation TTL           | `CHECKOUT_RESERVATION_TTL_SECONDS`, bounded and checked by application time                                                            | unresolved value; production must supply             |
| Shipping fee              | typed policy `FLAT` with integer VND fee in this phase                                                                                 | fee unresolved; production must supply               |
| Free-shipping threshold   | nullable integer VND config; disabled only when explicitly null                                                                        | unresolved                                           |
| Address                   | recipient name, normalized VN phone, address line, province/city; district and ward optional until address-provider policy is approved | provider/master-data unresolved                      |
| COD                       | supported; selection creates `UNPAID` payment and `codAmount`; collection is separate                                                  | accepted                                             |
| Deposit                   | percentage basis-points or fixed VND, exactly one strategy when enabled                                                                | unresolved; online deposit disabled until configured |
| Full payment              | provider-verified only                                                                                                                 | enabled only with configured provider                |
| Customer cancellation     | only before `PACKING`; server state is authoritative                                                                                   | accepted conservative rule; legal copy unresolved    |
| Refund/reconciliation     | no automatic refund in Phase 4; anomalies enter review                                                                                 | provider workflow unresolved                         |
| Guest lookup              | order code plus normalized recipient phone; same safe response on mismatch                                                             | accepted                                             |
| Email                     | outbox/pending notification only without provider                                                                                      | provider unresolved                                  |
| SePay                     | official Test mode/sandbox for verification; HMAC-SHA256 webhook; production credentials external                                      | account/config unresolved                            |

## Calculations

- Line subtotal: `unitPrice * quantity` using safe integers.
- Items subtotal: sum of line subtotals with overflow checks.
- Shipping: configured flat fee, or zero when the configured threshold is met.
- Total: items subtotal plus shipping. Client totals are rejected as unexpected properties.
- COD amount: total. Selecting COD never marks it collected.
- Deposit/full amount: calculated from typed policy and persisted expected amount; no client override.

## Phone normalization

Phase 4 accepts Vietnamese mobile numbers in local `0xxxxxxxxx` or `+84xxxxxxxxx` form, removes presentation separators, stores canonical `+84...`, and rejects ambiguous/non-mobile lengths. Public/order logs must mask the number; lookup compares a keyed digest or exact canonical value within the ownership query without returning existence details.
