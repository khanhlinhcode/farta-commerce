# Phase 6 backup, restore and Redis recovery rehearsal

Date: 2026-10-21

Status: **BLOCKED — no destructive recovery action executed**.

## MongoDB

A safe rehearsal requires an exact staging source cluster, a separate empty restore target, proof
that neither contains production data, approved RPO/RTO targets and stakeholder approval. Those
inputs were not available. The active staging database was not overwritten and no backup was
claimed.

After approval, validate indexes/unique constraints, users/session policy, catalog/variants,
`onHand - reserved` invariants, inventory ledger, Cart ownership, Orders, Payments and audit history
against the isolated restore target.

## Redis

No controlled staging interruption was authorized. Recovery behavior for sessions, OAuth
transactions, rate limits, idempotency, Agent conversation TTL, replay claims and the reservation
worker is therefore **NOT TESTED**. Redis loss must be treated as security-relevant because sessions,
rate limits, conversation ownership and replay/idempotency state are not all reconstructable from
MongoDB.

## Approval checklist

- source and isolated target identifiers;
- written non-production confirmation;
- approved RPO/RTO;
- backup retention and access owner;
- rollback path if restore validation fails;
- maintenance window for Redis interruption.
