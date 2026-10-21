# Phase 6 rollback rehearsal

Date: 2026-10-21

Status: **BLOCKED — no staging deployment or rollback executed for the Phase 6 worktree**.

The validated baseline remains commit `3c88ba955c897c274445ae491b621c7b27dd1f38`. Phase 6 changes
are local source until committed, pushed, built and deployed as exact revisions. Rolling back the
live services without a new Phase 6 deployment would not exercise this change set.

An approved rehearsal must record the source and target revision, deployment IDs, schema
compatibility and pre/post checks for API live/ready, Storefront, Admin, Cart continuity, owned
Order access, reservation worker and provider-off Product Advisor. It must not select a revision
known to contain the prior Worker CPU regression.
