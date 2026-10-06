# Cart API

Base path: `/api/v1/cart`. Every response is an authoritative read model; request bodies never accept price, totals, `customerId`, cart owner or cart ID.

| Method   | Route                 | Body                    | Security                                                               |
| -------- | --------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `GET`    | `/cart`               | none                    | optional customer session or guest credential                          |
| `POST`   | `/cart/items`         | `{variantId, quantity}` | Origin; session CSRF when authenticated; cart mutation limit           |
| `PATCH`  | `/cart/items/:itemId` | `{quantity}`            | same                                                                   |
| `DELETE` | `/cart/items/:itemId` | none                    | same                                                                   |
| `DELETE` | `/cart`               | none                    | same; idempotent                                                       |
| `POST`   | `/cart/merge`         | none                    | customer session, session CSRF, merge limit, guest cookie when present |

Quantity is an integer within `CART_MAX_ITEM_QUANTITY`. Product and variant must be active and current available stock must cover the desired line quantity. Adding/updating a cart never reserves stock.

The response contains safe product/variant/image fields, semantic `availability`, authoritative `unitPrice`, `lineSubtotal`, `subtotal`, `total`, `itemCount` and structured conflicts. Money is integer VND. Exact inventory, internal actors and guest credential data are excluded.

Expected domain errors include `CART_NOT_FOUND`, `CART_ITEM_NOT_FOUND`, `CART_ITEM_LIMIT`, `CART_VARIANT_UNAVAILABLE` and `CART_STOCK_UNAVAILABLE`. Validation/CSRF/rate-limit failures use the shared safe envelope.

Merge combines matching variants and caps them at the configured maximum. The guest source becomes `MERGED`; replay returns the same customer cart and does not add quantities again. The browser credential is cleared only after commit.
