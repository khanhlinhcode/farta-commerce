# Phase 3 storefront architecture

Date: 2026-10-06

## Runtime boundary

```text
Browser
  -> Next.js Storefront
       -> NestJS /api/v1 public catalog and customer auth
            -> domain services
                 -> MongoDB / Redis / Cloudinary
```

The storefront never imports Mongoose models or reads MongoDB directly. Public pages receive explicit Phase 2 DTOs through `src/lib/catalog.ts`; customer session actions use the same-origin `/api` rewrite and Phase 1 cookie/CSRF contract.

## Server and client responsibilities

- Server Components render home, catalog, category, collection, search and product content. Public reads use `fetch` with a five-second timeout and `revalidate: 60`.
- Client Components are limited to interaction: header overlays, catalog URL filters, gallery selection, variant resolution, auth forms and account/session actions.
- URL query parameters are the public catalog filter state. Only `q`, `category`, `size`, `color`, `minPrice`, `maxPrice`, `availability` and bounded `page` values are mapped to the API contract.
- Prices and availability are displayed from authoritative API responses. The storefront does not calculate a sellable total or expose warehouse quantity.

## Route model

- `/`, `/shop`, `/new-arrivals`, `/category/[slug]`, `/search` and `/product/[slug]` use real Banner/Category/Product DTOs.
- `/collections/[slug]` is explicitly a temporary editorial projection over an active Category because Phase 2 has no independent Collection aggregate. No permanent collection data is fabricated.
- Auth routes call Phase 1 endpoints. OAuth and password recovery remain unavailable when no corresponding server route exists.
- Account orders is an honest empty/future state because Order is Phase 4 scope.

## Cache and visibility

Catalog and CMS changes become visible within approximately 60 seconds under normal successful revalidation. Errors produce safe page states instead of cached invented data. `robots.ts` allows indexing only when both production mode and `NEXT_PUBLIC_INDEXABLE=true` are present. `sitemap.ts` includes only active public content returned by the API.

## Media

`next/image` accepts only the configured Cloudinary account path under `res.cloudinary.com`. Redirect following is disabled. Local generated fallback media is development-only; production without an active CMS hero receives a typographic fallback rather than a fake campaign.

## Known API gaps

- No distinct Collection domain.
- No customer profile mutation or onboarding-completion mutation.
- No password-reset endpoints.
- No public Google/Apple OAuth start/callback endpoints.
- No Order/Cart/Wishlist domain before Phase 4.

These gaps are represented honestly in UI and were not bypassed with browser storage or direct database access.
