# Implementation roadmap

## Phase 0 — Discovery/design

Status: complete after contradiction review. Deliverable is this dossier and ADR set; it contains planned controls, not implementation claims.

## Phase 1 — Engineering foundation

- initialize Git and pnpm workspace;
- create strict shared TypeScript/ESLint configuration;
- bootstrap Next.js storefront shell, Vite admin shell, NestJS API shell and FastAPI health scaffold;
- create design tokens/minimal shared primitives;
- add Docker MongoDB/Redis development infrastructure;
- add CI foundation, secret scan and dependency audit commands;
- implement typed configuration, logging/error/validation/header/CORS foundations;
- implement customer/staff realms, password authentication, sessions/refresh rotation, CSRF, RBAC and Redis rate policies;
- establish Google/Apple OAuth integration boundary without fake provider success;
- prove frozen install, lint, typecheck, tests, builds and runtime health.

Exit: reproducible engineering and security foundation; no commerce-domain claim.

## Phase 2 — Commerce core and admin catalog operations

Categories, products, variants, inventory aggregate/ledger, MediaAsset/Cloudinary boundary, Banner CMS, public catalog APIs and operational admin catalog UI.

## Phase 3 — Premium fashion storefront

Editorial home, real catalog/search/PDP, authentication/account/session experience, SEO, accessibility and responsive performance using Phase 2 APIs.

## Phase 4 — Transactional commerce

Guest/customer cart, deterministic merge, checkout, reservations, order snapshots/state machines, payment provider boundary, webhook verification and admin order operations.

## Later hardening and expansion

After stakeholder approval of Phases 2–4: threat-model refresh, full security regression/pentest, production CSP/provider validation, deeper UX/performance/accessibility work, and finally the controlled AI-service tool boundary. AI remains unable to access MongoDB directly or bypass commerce authorization.
