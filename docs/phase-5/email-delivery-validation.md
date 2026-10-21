# Phase 5E — Transactional email delivery validation

Date: 2026-10-21

Status: **BLOCKED — no transactional email provider is configured**.

## Existing foundation

The API persists idempotent notification intents for `ORDER_CREATED`,
`PAYMENT_RECEIVED`, `ORDER_CONFIRMED`, `ORDER_SHIPPED` and `ORDER_DELIVERED`.
Each order/lifecycle key is unique, and deposit/full-payment receipts are bound
to the resulting payment state. Events begin in `PENDING`; the schema supports
attempt count, processed time and a bounded safe error code.

This outbox foundation is inside the same MongoDB transaction as the relevant
commerce state change. Email failure therefore cannot roll back an order or
payment. No customer email address or full shipping snapshot is copied into the
notification payload.

## Missing delivery boundary

There is currently no approved provider adapter, sender domain, delivery worker,
bounded backoff policy, terminal dead-letter workflow or real mailbox evidence.
Northflank has no email-provider configuration at the inspected checkpoint.
Namecheap forwarding records are not a transactional email delivery service.

Therefore none of the following can be marked passing:

- order-created/payment/confirmed/shipped/delivered delivery;
- duplicate delivery suppression at provider boundary;
- transient retry and permanent-failure handling;
- provider message identifier and delivery status;
- receipt by a real staging mailbox.

## Approval checkpoint

Before implementation, the stakeholder must approve a provider and review its
current API/package version, authentication model, free/test limits, verified
sender-domain requirements, retry/webhook behavior and data-retention policy.
Required secrets must be placed in the deployment secret manager, never Git,
chat, `NEXT_PUBLIC_*` or `VITE_*`.

No production dependency was selected or installed in Phase 5E because that
choice and its security/retention impact require explicit approval.
