# Performance and SEO remediation report

Date: 2026-10-16

## Catalog and sitemap

- Public Product list work is bounded at the database/page boundary instead of loading all matching Variant and Inventory documents into Node.js memory.
- Sitemap reads all active public product pages with a per-page bound of 100, a hard 100-page ceiling, slug deduplication and deterministic partial failure behavior.
- No direct Storefront-to-MongoDB path was added.

## Images

- Fashion-card, category, PDP, Cart, Checkout and Order image `sizes` values were aligned to their rendered widths.
- Generic ProductGrid order no longer implies that four images are LCP candidates; only the first visible card can be marked eager when no higher-priority hero is present.
- Distinct desktop/mobile campaign posters use one responsive `<picture>` generated from Next.js `getImageProps`, avoiding two simultaneously mounted hero images. A single poster continues through `next/image`.
- Alternate hover media is decorative; primary imagery keeps meaningful alt text.

## Current build evidence

- Next.js 16.3.8 production compilation completed and generated 19 static pages/routes where applicable.
- Admin route-level chunks were emitted; exact current sizes are recorded in `admin-operations-report.md`.
- The build logged `[sitemap] Product page 1 was unavailable` because the build command had no live API process. The code returned the documented deterministic static subset and completed rather than fabricating catalog URLs.

## CSP decision

The locked Next.js 16.3.8 local documentation states that nonce-based CSP requires dynamic rendering. FARTA currently uses static generation/revalidation for public pages. Removing `'unsafe-inline'` in this batch would therefore require an unapproved rendering/cache architecture change and hydration validation. The existing explicit CSP keeps `unsafe-eval` development-only, `object-src 'none'`, `frame-ancestors 'none'` and bounded provider sources. Inline script/style remains a recorded residual risk, not a fixed finding.

No Lighthouse score, production Core Web Vital, throughput or bundle-improvement percentage is claimed.

The production-mode Chromium release run passed 22/22 tests. This confirms the implemented responsive and interaction regressions, but it is not field Core Web Vitals evidence.
