# Phase 6 operational remediation

Date: 2026-10-21

Verdict: **source and runbook alignment implemented; external operations remain BLOCKED**.

## Implemented/local boundary

- Product Advisor safe event and metric hooks cover request, route, provider, tool and response
  lifecycle without raw prompts, credentials or customer PII.
- Provider-off remains the default; automatic provider switching is rejected.
- `docs/api/ai-agent.md`, `apps/ai-service/README.md`, `README.md` and `PRODUCT.md` now describe
  the current read-only Pydantic AI architecture and incident sequence.
- Existing notification outbox remains the only notification boundary; no second queue or email
  platform was created.
- Google and Apple controls remain visibly disabled with “chưa cấu hình”; no OAuth success is
  simulated. First production launch scope is **email/password only** unless the stakeholder makes
  a separate OAuth launch decision and supplies development credentials.

## Monitoring/alert matrix

| Signal                                      | Source available                     | Received alert evidence                 |
| ------------------------------------------- | ------------------------------------ | --------------------------------------- |
| API readiness / MongoDB / Redis             | health endpoints and structured logs | BLOCKED — no approved alert destination |
| elevated 5xx                                | API request logs                     | BLOCKED                                 |
| AI provider failure/rate limit/tool failure | Phase 6 safe events and counters     | BLOCKED                                 |
| reservation job failure                     | worker logs                          | BLOCKED                                 |
| payment conflict/webhook auth failure       | API audit/log events                 | BLOCKED                                 |

Adding an external monitoring provider requires stakeholder approval. No alert delivery is claimed.

## Transactional email

Status: **BLOCKED**. The idempotent notification outbox exists, but no provider, sender domain,
worker dependency, staging mailbox or received-message evidence is available. No dependency was
added and no delivery was faked.

## Remaining actions

1. select and approve monitoring ownership/destination, then receive a harmless staging test alert;
2. approve one email provider and exact SDK/version, configure sender-domain DNS and validate one
   controlled staging mailbox;
3. decide Google/Apple launch scope before implementing adapters;
4. keep the AI service at one replica until shared replay protection is approved.
