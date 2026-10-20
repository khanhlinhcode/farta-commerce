# Phase 5C — Staging rollback rehearsal

Date: 2026-10-20

Status: **procedure and immutable targets verified; live rollback not executed**

A live rollback was intentionally not started while the custom-domain cutover,
external providers and Cloudflare 1102 investigation remain incomplete. This
document is a non-destructive staging procedure, not production SLA evidence.

## Recorded runtime targets

Cloudflare deployment status at the latest checkpoint:

- Storefront routes 100% to candidate version
  `2fce4e69-b9b5-48c9-9fcd-430e71da7799`. The previously recorded version
  `f9c3e5ab-3ec0-4f0d-b42c-42a2bba777ba` is the rollback target for rehearsal.
- Admin deployment `fdb311bb-119c-4703-9274-34a4c59f9110` routes 100% to
  version `b4d06f53-78e2-49a4-9565-376cb4a657eb`.

Northflank service status at inspection time:

- `farta-api`: build `SUCCESS`, deployment `COMPLETED`, last transition
  2026-10-20 11:05 UTC;
- `farta-ai`: build `SUCCESS`, deployment `COMPLETED`, last transition
  2026-10-20 11:05 UTC;
- Phase 5B recorded API source revision
  `8a15e3364e9f5bd4fdc97f669681ec7d66e11304`.

The current Northflank list response does not expose a deployment image digest
or source SHA, so the Phase 5B SHA must not be treated as freshly proven by that
response alone. Before a live rehearsal, record the exact deployment/image ID
from Northflank deployment history.

## Database compatibility rule

Rollback changes application code only. It must not restore/delete MongoDB
data, Orders, Payments, Inventory, Reservations or audit events. A target is
eligible only if it can read the current schema and indexes. If a release
contains an incompatible migration, the rehearsal stops before traffic moves.

## Rehearsal procedure

1. Freeze unrelated staging deploys and record the current Git SHA, Worker
   deployment/version IDs, Northflank deployment/image ID and health responses.
2. Run a read-only catalog check and record one pre-existing Cart/Order reference
   through authorized APIs without exposing customer data.
3. Upload/deploy a harmless identifiable revision if no newer revision exists.
4. Roll Storefront/Admin back to the recorded previous Worker versions with the
   repository's installed Wrangler, for example:

   ```bash
   pnpm --filter @farta/storefront exec wrangler rollback \
     f9c3e5ab-3ec0-4f0d-b42c-42a2bba777ba \
     --name farta-storefront-staging --message 'Phase 5C staging rehearsal'
   pnpm --filter @farta/admin exec wrangler rollback \
     b4d06f53-78e2-49a4-9565-376cb4a657eb \
     --name farta-admin-staging --message 'Phase 5C staging rehearsal'
   ```

5. Select the exact previous known-good Northflank API deployment from deployment
   history. Do not use the generic rollout command until its target deployment
   ID is confirmed; do not rebuild from a moving branch.
6. Verify API live/ready, Storefront/Admin HTTP 200, public catalog reads,
   login/session/CSRF, existing Cart access and existing owned Order access.
7. Restore the intended release candidate versions and the exact intended API
   image, then repeat the health and critical Chromium smoke.

   The current Storefront candidate to restore is
   `2fce4e69-b9b5-48c9-9fcd-430e71da7799`.

8. Record elapsed staging recovery times separately. They are observations, not
   an RTO/SLA commitment.

## Stop conditions

Stop and restore the current candidate if any target requires destructive data
rollback, breaks current schema/index compatibility, changes secrets/origins,
or loses access to an existing Cart/Order. No production resource is part of
this rehearsal.

Because steps 3–8 were not executed, rollback acceptance remains **PENDING**.
