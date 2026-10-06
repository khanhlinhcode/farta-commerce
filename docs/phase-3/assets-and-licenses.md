# Phase 3 assets and licenses

Date: 2026-10-06

## Shipped storefront asset

`apps/storefront/public/images/farta-edit-01-hero.webp` is an AI-generated development-only fallback. Its adjacent JSON records the generation intent and date. It appears only when `NODE_ENV=development` and no valid Banner CMS image is available. It must not be represented as stakeholder-owned photography or used as the production campaign source.

## Design evidence

`.impeccable/mocks/` and `assets/plates/` contain generated design exploration/evidence. They are not imported by the runtime storefront. Metadata beside the mock images identifies the generation tool/status.

## External code and media

- No commercial fashion imagery was scraped.
- No TheUI source, package, branding or assets were copied.
- TheUI documentation and license were reviewed on 2026-10-06; the site states its Svelte component library is MIT-licensed. FARTA uses only interaction principles and retains original React/Next.js code.
- Runtime product/category/banner images must come from stakeholder-controlled Cloudinary `MediaAsset` records.

Final stakeholder logo, campaign photography and brand font licenses remain external configuration/content dependencies.
