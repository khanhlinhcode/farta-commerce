# Implementation roadmap

## Phase 0 — Discovery/design

Status: complete after contradiction review. Deliverable is this dossier and ADR set; it contains planned controls, not implementation claims.

## Phase 1 — Bootstrap

- initialize Git and pnpm workspace;
- create strict shared TypeScript/ESLint configuration;
- bootstrap Next.js storefront shell, Vite admin shell, NestJS API shell and FastAPI health scaffold;
- create design tokens/minimal shared primitives;
- add Docker MongoDB/Redis development infrastructure;
- add CI foundation, secret scan and dependency audit commands;
- prove frozen install, lint, typecheck, tests and builds.

Exit: reproducible shells and health checks; no commerce/auth implementation claim.

## Phase 2 — Security foundation

Typed environment validation, structured/redacted logging, request IDs, error contract, validation, Helmet/CSP baseline, CORS, rate policies, customer/staff realms, password/OIDC boundary, sessions/rotation, CSRF, RBAC and audit foundation.

## Phase 3 — Commerce core

Categories, products, variants, inventory aggregate/ledger/reservations and concurrency proof.

## Phase 4 — Admin operations

Catalog, inventory, media, banners and audit views with server-authoritative permissions.

## Phase 5 — Storefront

Editorial home, catalog/search/PDP, authentication/account/session experience.

## Phase 6 — Cart

Guest/customer carts, deterministic merge, validation and pricing projection.

## Phase 7 — Checkout/orders

Idempotent checkout, reservations, order snapshots/state machines and provider-neutral payment foundation.

## Phase 8 — Security hardening

Threat-model refresh against implemented topology, security headers/CSP validation, upload/provider reviews and defensive scan.

## Phase 9 — Test completion

Full integration/E2E/security regression matrix including race/replay/idempotency.

## Phase 10 — UX/performance/accessibility

Responsive composition, WCAG review, Core Web Vitals and production-like browser verification.

## Phase 11 — AI-ready boundary

Authenticated service identity, allowlisted tool schemas, delegated authorization, budgets, audit and no-direct-database deployment proof. No unrestricted agent mutations.
