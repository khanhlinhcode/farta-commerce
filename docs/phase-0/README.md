# FARTA Phase 0 dossier

Status: **Approved engineering baseline for Phase 1 bootstrap**  
Scope: greenfield `Farta_ecommerce`; no architecture or source is inherited from any previous Farta project.

## Artifact map

| Requirement                         | Artifact                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Target folder tree                  | `docs/architecture/target-folder-tree.md`                                          |
| System architecture                 | `docs/architecture/system-architecture.md`                                         |
| Trust boundaries                    | `docs/architecture/trust-boundaries.md`                                            |
| Customer BA flows                   | `docs/ba/customer-flows.md`                                                        |
| Admin BA flows                      | `docs/ba/admin-flows.md`                                                           |
| Authentication and OAuth            | `docs/security/authentication.md`                                                  |
| JWT/session lifecycle               | `docs/security/session-lifecycle.md`                                               |
| RBAC matrix                         | `docs/security/rbac.md`                                                            |
| Threat model                        | `docs/security/threat-model.md`                                                    |
| Security architecture               | `docs/security/security-architecture.md`                                           |
| MongoDB schema design               | `docs/database/schema-design.md`                                                   |
| Product/variant model               | `docs/database/product-variant-model.md`                                           |
| Inventory consistency               | `docs/database/inventory-consistency.md`                                           |
| Cart architecture                   | `docs/architecture/cart.md`                                                        |
| Checkout/order state machine        | `docs/architecture/checkout-orders.md`                                             |
| Cloudinary/media lifecycle          | `docs/architecture/media-lifecycle.md`                                             |
| Design-system strategy              | `docs/architecture/design-system.md`                                               |
| Testing strategy                    | `docs/testing/strategy.md`                                                         |
| Implementation roadmap              | `docs/architecture/implementation-roadmap.md`                                      |
| Contradiction review/open decisions | `docs/architecture/contradiction-review.md`, `docs/architecture/open-decisions.md` |

## Binding principles

1. The NestJS API is the sole commerce source of truth and authorization enforcement point.
2. Customer and staff/admin authentication are separate realms with distinct routes, audiences, cookies and session namespaces.
3. MongoDB owns durable business state. Redis owns ephemeral coordination, rate-limit and cache state only.
4. Browser authentication uses same-origin application routing, secure cookies, explicit CSRF protection and server-side sessions.
5. Inventory, checkout, payments and privileged changes are idempotent, state-machine constrained and auditable.
6. The AI service has no direct database or privileged provider access; it can only request allowlisted NestJS tools.
7. Phase 0 describes planned controls. A control becomes "implemented" only after code and tests exist.

## Phase gate

The contradiction review found no blocker to Phase 1 bootstrap. Product policy choices that are not needed for bootstrap remain open and must not be silently fixed in code. Phase 1 may create the monorepo and application shells, but may not implement commerce features.
