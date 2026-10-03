# Security policy

## Supported state

This repository is in engineering foundation development and is not production-ready. No public security SLA or bug-bounty program exists yet.

## Reporting

Report suspected vulnerabilities privately to the repository owner. Do not include production credentials, customer data or destructive proof-of-concept payloads in public issues.

## Invariants

- Do not commit secrets or put server credentials in `NEXT_PUBLIC_*`/`VITE_*` variables.
- Customer and staff/admin identity realms remain separate.
- Authorization and object ownership are enforced by the API, never only by UI state.
- No request object or client-supplied MongoDB operator reaches a database query/update.
- Inventory/payment/order changes remain atomic, idempotent and auditable.
- The AI service has no direct database/provider authority.
- Security defects require a regression test where practical; tests are not weakened to hide failures.

See `docs/security/threat-model.md` and `docs/security/security-architecture.md` for the current design baseline.
