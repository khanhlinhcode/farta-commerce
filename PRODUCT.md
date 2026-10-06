# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Vietnamese fashion customers browsing and purchasing on mobile-first and desktop storefronts.
- FARTA staff operating product, inventory, media, banner and order workflows in a separate protected Admin realm.
- Future AI commerce agents, constrained to explicit API tools and never direct database mutation.

## Product Purpose

FARTA is a premium online fashion-commerce platform. It must let customers discover real catalog data and complete trustworthy commerce flows while giving staff an auditable operational system. Success means product presentation feels like a fashion brand while inventory, money, authorization and payment state remain server-authoritative.

## Positioning

FARTA combines an editorial, product-photography-led Vietnamese fashion experience with explicit commerce invariants: real variants, semantic availability, append-only stock history, separate customer/staff security realms and a future AI boundary that cannot bypass the commerce API.

## Operating Context

- Customer path: campaign or catalog discovery, variant selection, cart, checkout, payment and order tracking.
- Staff path: catalog/category/variant/inventory/media/banner operations followed by order and payment reconciliation.
- Public content comes from the NestJS API; the storefront never reads MongoDB directly.
- Development, test, staging and production remain separate; production configuration fails closed.

## Capabilities and Constraints

- pnpm monorepo with Next.js/React storefront, Vite/React Admin, NestJS/Mongoose/Redis API and a health-only FastAPI AI scaffold.
- Prices use authoritative integer VND values; browser-calculated totals are never authoritative.
- Products contain real color/size variants and expose semantic availability rather than internal warehouse quantity.
- Browser sessions use realm-separated secure cookie authentication, CSRF protection and server-side session authority.
- The current repository has no Cart/Checkout/Order/Payment implementation until Phase 4.
- Google/Apple provider adapters, final payment credentials and final brand assets are open external dependencies and must not be faked.

## Brand Commitments

- Name: FARTA.
- Premium fashion, editorial, minimal, clean, modern and confident.
- Restrained Liquid Glass is reserved for navigation, overlays, drawers and selected floating surfaces; product information and photography stay clear.
- TheUI is an interaction/composition reference only. No uncertain-license code, branding or assets are copied, and the project remains React/Next.js.
- Vietnamese content, typography and VND formatting are first-class; architecture remains ready for future i18n.
- A CSS/text FARTA wordmark is a temporary treatment until stakeholder-approved logo assets exist.

## Evidence on Hand

- Approved Phase 0 architecture and design-system decisions under `docs/`.
- Phase 1 authentication/session/RBAC/CSRF implementation and tests.
- Phase 2 real Category/Product/Variant/Inventory/Media/Banner APIs and Admin catalog workspace.
- Shared semantic tokens in `packages/design-tokens` and primitives in `packages/ui`.
- No stakeholder-owned fashion photography, final logo, testimonials, reviews, ratings, sales analytics or production OAuth/payment credentials are currently present; these must not be fabricated.

## Product Principles

1. Commerce truth lives in the NestJS domain layer, never in presentation code.
2. Show the clothing first; technology and decorative effects recede.
3. Security, authorization, idempotency and auditability are architectural requirements.
4. Empty, error and unavailable states remain honest; unfinished features are not simulated.
5. Mobile accessibility and performance are release gates, not cleanup work.

## Accessibility & Inclusion

Target strong WCAG-oriented practices: semantic structure, keyboard operation, visible focus, labelled forms, accessible dialog/drawer focus behavior, sufficient contrast, usable touch targets, reduced-motion support and Vietnamese-capable typography.
