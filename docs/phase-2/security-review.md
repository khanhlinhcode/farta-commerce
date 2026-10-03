# Phase 2 defensive security review

Date: 2026-10-03

## Scope and evidence

Reviewed Category, Product, ProductVariant, Inventory, MediaAsset, Banner, Admin catalog APIs/UI and the public catalog read model. Evidence is source inspection plus the unit/component/API E2E/build gates recorded in the completion report.

## Control review

| Area                | Result                                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RBAC                | Admin routes use the Phase 1 staff realm and granular permissions; product publication additionally requires `product.publish`.                                                                                                                       |
| CSRF                | Every Admin mutation uses the Phase 1 session-bound CSRF guard and explicit Admin origin.                                                                                                                                                             |
| NoSQL injection     | Global filter sanitization remains enabled; DTOs accept scalar allowlists only; server-owned operators are built internally.                                                                                                                          |
| Mass assignment     | DTO whitelist/unknown-field rejection and explicit persistence mapping prevent mutation of actor/audit/system fields.                                                                                                                                 |
| Public data         | Public DTOs omit exact stock, creator/updater IDs, inventory ledger and audit data.                                                                                                                                                                   |
| Inventory integrity | Stock mutation is centralized; on-hand and reservation mutations plus append-only ledger entries use short MongoDB transactions.                                                                                                                      |
| Races/idempotency   | Unique database indexes cover slug/SKU/publicId; inventory adjustments and reservations carry unique idempotency keys. The 100-way last-unit test yields one success and 99 safe failures.                                                            |
| Media               | Browser receives a time-bounded signed Cloudinary upload authorization, never the API secret. Finalization verifies provider response signature, Cloudinary host/path, type, format, dimensions and byte limit. Referenced assets cannot be archived. |
| Banner CTA/XSS      | CTA is restricted to normalized internal paths. CMS fields are plain text and storefront code must not render them as raw HTML.                                                                                                                       |
| Search/resource use | Filters are explicit, query length and page size are bounded, and client-provided Mongo expressions are rejected.                                                                                                                                     |
| Errors/logs         | Domain conflicts use safe codes; provider secrets and request credentials remain under Phase 1 redaction.                                                                                                                                             |

## Findings resolved during implementation

| Severity | Finding                                                           | Resolution                                                                                                          |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| High     | A read-modify-write stock path could oversell under concurrency.  | Inventory changes use conditional atomic updates inside a MongoDB transaction with an append-only ledger.           |
| Medium   | A banner CTA could become an open redirect or script URL.         | Only internal `/...` paths are accepted; protocol-relative paths, backslashes and control characters are rejected.  |
| Medium   | Direct upload finalization could trust browser-supplied metadata. | The API verifies Cloudinary's signed response and restricts the expected Cloudinary account URL before persistence. |
| Medium   | Admin DTO spreading could mutate privileged fields.               | Services explicitly map each accepted field and tests reject unexpected fields.                                     |

## Residual risks and limits

- No live Cloudinary upload was executed because stakeholder credentials are intentionally absent; the signed adapter and response verifier are tested with isolated test configuration.
- With direct Cloudinary upload, file decoding/magic-byte enforcement occurs at the provider boundary; the API validates the signed provider result, not raw bytes. A proxy-upload architecture would provide stronger local byte inspection at higher bandwidth cost.
- No exploit-validated penetration test ran. Automated regressions and bounded review do not prove absence of vulnerabilities.
- Automated orphan-media deletion is deferred; no destructive cleanup runs in Phase 2.
- Browser-level keyboard/a11y verification of Admin remains a Phase 3/operational UX follow-up; component tests and static semantics are present.

No unresolved Critical/High issue was identified within the implemented Phase 2 scope. This is a bounded engineering review, not a production-security certification.
