# Testing strategy

## Test pyramid

| Layer               | Purpose                              | Examples                                                                       |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| Unit                | pure policies/state machines/mappers | permissions, order transitions, token parsing, price arithmetic                |
| Component           | accessible UI behavior               | forms, dialog focus, drawer keyboard, errors/loading                           |
| Integration         | real infrastructure boundaries       | Mongo indexes/transactions, Redis Lua/rate limits, Cloudinary adapter contract |
| API E2E             | full Nest HTTP pipeline              | validation, cookies/CSRF, auth, RBAC, IDOR, error/log contract                 |
| Browser E2E         | critical customer/operator journeys  | registration, cart/checkout, admin catalog, responsive/a11y smoke              |
| Security regression | malicious/edge inputs                | injection, token replay, upload, SSRF, pollution, resource limits              |

Mocks are allowed only at external boundaries and must not replace tests for MongoDB/Redis concurrency or HTTP security behavior.

## Required security coverage

- NoSQL/operator injection and unexpected nested keys;
- XSS-safe rendering/CSP regression;
- pre-auth and authenticated CSRF;
- SSRF destination/redirect/private-IP rejection when any fetch feature exists;
- path traversal and upload type/size/signature checks;
- mass assignment, RBAC bypass and customer object isolation;
- JWT tamper/expiry/issuer/audience/realm checks;
- refresh rotation, concurrent refresh and reuse-triggered family revocation;
- brute-force/rate-limit enforcement behind configured proxy behavior;
- OAuth state/nonce/PKCE and redirect validation;
- malformed/oversized bodies and bounded query arrays/pagination;
- duplicate checkout/webhook and order state-machine rejection;
- 100-way inventory reservation race;
- public error and structured-log secret leakage assertions.

## Frontend quality

- Vitest + Testing Library for components/hooks.
- Playwright for desktop/mobile flows, keyboard navigation, route error/loading states and explicit semantic accessibility assertions. Automated axe coverage remains deferred until that dependency is separately approved.
- Visual regression is limited to stable shells/components; it does not replace semantic assertions.
- Core Web Vitals and bundle budgets become release gates after real product pages exist.

## Phase gates

Every phase runs frozen install, lint, strict typecheck, relevant unit/integration/E2E/security tests and production build. A gate report records exact commands and results; skipped tests are explicit. Critical/high security defects block continuation.
