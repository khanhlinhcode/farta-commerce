# Local infrastructure

`compose.yml` exposes MongoDB and Redis only on loopback. MongoDB runs as a single-node replica set so integration tests can exercise transactions. Local services intentionally have no authentication and are **development-only**; the Compose file is not a production deployment template.

MongoDB is pinned to `7.0.41-jammy` for local development. MongoDB 8.x
currently refuses to start on Docker Desktop's Linux 6.19 kernel because of
MongoDB issue `SERVER-121912`. Re-evaluate this pin when Docker Desktop ships a
Linux kernel version supported by MongoDB 8.x.

```bash
pnpm infra:up
docker compose -f infrastructure/docker/compose.yml ps
pnpm infra:down
```

Production requires private networking, authentication/ACLs, TLS where appropriate, backups and provider-managed secret injection.
