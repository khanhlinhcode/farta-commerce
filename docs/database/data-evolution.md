# MongoDB data-evolution policy

Date: 2026-10-03

MongoDB collections remain governed by application schemas; schema-less storage is not a migration strategy.

## Rules

- Every incompatible schema change requires a versioned, idempotent migration under `apps/api/src/migrations/` before production rollout.
- Deploy additive readers before writers when a rolling deployment must support old and new documents simultaneously.
- Create or change indexes through an explicit migration and verify uniqueness conflicts before enabling a unique index.
- Never delete historical inventory ledger, audit or future order-snapshot fields during an online migration.
- Migrations must support dry-run reporting, bounded batches, progress checkpoints and safe restart.
- Production migrations require a database backup/restore procedure, staging rehearsal and an owner-approved rollback plan.
- The application must fail closed when a required migration version is absent; it must not silently invent defaults for security- or money-sensitive data.

Phase 2 does not need a data rewrite because it introduces new collections. This policy becomes executable when the first non-additive change is proposed.
