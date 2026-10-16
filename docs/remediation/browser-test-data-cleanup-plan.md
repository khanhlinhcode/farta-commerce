# Browser test data cleanup plan

Date: 2026-10-16

## Current evidence and retention decision

The local development database contains historical Browser E2E users and orders from earlier runs. This remediation does not delete, rewrite or hide those records. They remain business-history-shaped data with order, reservation, inventory ledger, audit and notification relationships; deleting only the user or order documents would invalidate evidence and invariants.

## Proposed historical selection criteria

A future reviewed cleanup candidate must satisfy all of the following:

- environment is explicitly `development` or `test`;
- database name is allowlisted and is not a staging or production name;
- user `normalizedEmail` begins with the exact Browser E2E prefix `browser-` and ends with `@example.test`, or the order shipping recipient is the exact test marker `Khách hàng Browser E2E`;
- related order, reservation, inventory ledger, payment, webhook, notification and audit records are enumerated before any mutation;
- active reservations/orders are cancelled or released through domain services rather than direct document deletion.

The candidate set must be exported as identifiers and counts for stakeholder review. No cleanup command is implemented or run until deletion is explicitly approved.

## Rollback and retention

Direct deletion has no safe application-level rollback. Preferred handling is to retain existing historical records and isolate future browser runs. If deletion is later approved, take a local database backup first and record its location, database name, timestamp and restore command without embedding credentials.

## Future-run isolation

- Release evidence now starts API, Storefront and Admin from the current worktree by default. Reusing developer-owned servers requires the explicit `E2E_REUSE_SERVERS=true` opt-in.
- The preferred next step is a dedicated MongoDB database whose name ends in `_browser_e2e`, seeded with deterministic catalog media and a test-only staff identity supplied through secret environment variables.
- A database reset/drop guard must verify the exact suffix and reject `development`, `staging`, `production`, empty and unknown names.
- The existing Cloudinary development manifest and test staff bootstrap currently make a fully isolated automatic reset an approval/configuration boundary. Until that is completed, interrupted Browser E2E artifacts are identifiable by the exact markers above and release runs must leave no active order through existing cancellation helpers.

## Verification criteria

- Two successful browser runs do not increase active Browser E2E order count.
- A deliberately interrupted run is reported and recoverable through domain cancellation/release operations.
- Non-test records are never selected by the cleanup predicate.
- No staging/production database URI can pass the reset guard.
