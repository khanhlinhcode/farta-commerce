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

Status: implemented and gated on 2026-10-06. Editorial home, real catalog/search/PDP, authentication/account/session experience, SEO, accessibility and responsive behavior use Phase 2 APIs. See `docs/phase-3/completion-report.md` for evidence and remaining external/provider limitations.

## Phase 4 — Transactional commerce

Status: implemented and gated locally. Guest/customer cart, deterministic merge, checkout, reservations, order snapshots/state machines, payment provider boundary, webhook verification and admin order operations are present. Provider and deployment validation remain external evidence, not implementation claims.

## Phase 4.1 — Local release stabilization

Status: implemented locally through the development seed, Chromium Storefront/Admin release suite and feature-oriented Admin modularization. The browser CI lane remains deferred until an approved non-production Cloudinary media bootstrap can reproduce the finalized MediaAsset records without production credentials or fake media.

## Phase 5 — Staging and external-provider validation

Status: provider-neutral security defaults hardened locally; deployment not started. Staging now follows the deployed cookie, HTTPS, security-header, logging, database-index and AI-to-API transport policy, with regression coverage. Execution remains blocked on approved staging domains/hosting, proxy validation, managed MongoDB and Redis, secret storage, Cloudinary staging, SePay Test mode with public HTTPS webhook, OAuth credentials, notification delivery and monitoring. No production-readiness claim may be made from local mocks or local browser evidence.

## Release remediation checkpoint

Status (2026-10-16): catalog correctness, truthful price presentation, profile/onboarding, media integrity, bounded catalog/sitemap work and expanded Admin operations are implemented locally. Password recovery schema approval, generated Next file policy, strict CSP rendering decision, provider delivery and a green low-load Browser E2E rerun remain open. See `docs/remediation/final-remediation-report.md`.

## Later hardening and expansion

After Phase 5 staging evidence: threat-model refresh, full security regression/pentest, production CSP/provider validation, deeper UX/performance/accessibility work, and finally the controlled AI-service tool boundary. AI remains unable to access MongoDB directly or bypass commerce authorization.
