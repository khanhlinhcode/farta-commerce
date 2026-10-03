# Local infrastructure

`compose.yml` exposes MongoDB and Redis only on loopback. MongoDB runs as a single-node replica set so integration tests can exercise transactions. Local services intentionally have no authentication and are **development-only**; the Compose file is not a production deployment template.

```bash
pnpm infra:up
docker compose -f infrastructure/docker/compose.yml ps
pnpm infra:down
```

Production requires private networking, authentication/ACLs, TLS where appropriate, backups and provider-managed secret injection.
