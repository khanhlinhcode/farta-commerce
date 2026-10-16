# Catalog correctness remediation report

Date: 2026-10-16

## Implemented

- Public Product responses now expose allowlisted category summaries (`id`, `slug`, `name`). Related Products resolves the first public category slug instead of sending a MongoDB identifier to the `category` filter.
- ProductCard shows an exact price only when all active offers agree; mixed prices use `Từ …`. Compare-at price is rendered only when the visible price/compare pair is unambiguous.
- Product, Variant and Category image references are checked server-side for existence, non-archived state and `resourceType=image`. Admin image pickers query only images. Banner poster/video references remain type-separated.
- Public Product listing moves variant/inventory eligibility into a MongoDB aggregation and fetches only the selected page of Product documents. The response contract and stable ordering are preserved.
- Sitemap traversal uses bounded pages of 100, deduplicates slugs and returns deterministic partial output if a later API page fails.
- Product alternate imagery is decorative to assistive technology; visible color dots have screen-reader color names. Image `sizes` values now reflect the actual card/gallery/cart/order contexts and no longer mark the first four grid cards eager by default.
- Admin Media listing is server-paginated and resource-type filtered. Shared Admin media pickers expose their own bounded pagination instead of silently stopping at the first 100 assets.

## Verification

- API unit: 16 files, 77 tests passed.
- Storefront unit/component: 13 files, 38 tests passed.
- Focused Catalog E2E: 1 file, 9 tests passed.
- Full API E2E after serial file configuration: 7 files, 65 tests passed.
- Regression cases include category slug summaries, invalid/archived/wrong-type media, mixed image/video arrays, media pagination bounds, ProductCard ranges and compare-price ambiguity, and a 101-product sitemap.

## Evidence limits

- No production query latency or throughput was measured. The aggregation removes unbounded application-memory joins by inspection and test, but this report does not claim a production performance percentage.
- Build-time sitemap generation logged a safe partial-result warning because no API process was running during the production build. Runtime completeness remains covered by the sitemap unit fixture, not by that build invocation.
- Historical invalid media references were not rewritten or deleted.
