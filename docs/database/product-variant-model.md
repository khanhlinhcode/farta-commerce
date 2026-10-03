# Product and variant model

## Product

- identity: `_id`, slug
- merchandising: name, subtitle, structured description, materials, care, size-guide reference
- organization: category IDs, collection tags, status (`DRAFT`, `ACTIVE`, `ARCHIVED`)
- media: ordered product-level `MediaAsset` references
- SEO: title/description/canonical metadata
- publication timestamps and audit metadata

## ProductVariant

- `productId`
- globally unique `sku`
- normalized option values, initially `color` and `size`
- price in minor units, currency, optional compare-at price
- status (`ACTIVE`, `INACTIVE`, `ARCHIVED`)
- ordered media overrides/references
- physical fulfillment attributes when needed

Example option signature: `productId + colorKey + sizeKey`. A unique index prevents duplicate `Black / M` variants for one product.

## Sellability

A variant is sellable only when product and variant are active, current price is valid, required media/merchandising rules pass, and available inventory is positive or the configured preorder policy explicitly permits it. The server computes sellability; a frontend flag is advisory only.

## Price history

Current catalog price lives on the variant. Every administrative price change creates an audit event. Orders store a purchase-time snapshot so later catalog changes never rewrite history.

## Content safety

Descriptions are structured text by default. Arbitrary HTML is not accepted. If rich content is introduced later, allowed nodes/marks are schema-validated and rendered through a maintained sanitizer and restrictive CSP.
