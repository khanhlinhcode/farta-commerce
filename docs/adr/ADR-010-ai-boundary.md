# ADR-010: AI security boundary

Status: Accepted

The FastAPI service has no direct commerce database or privileged provider access. It requests allowlisted, typed NestJS tools using service identity and delegated user context. NestJS revalidates authorization, idempotency and domain rules and audits every sensitive tool result.
