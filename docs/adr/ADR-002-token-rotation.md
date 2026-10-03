# ADR-002: JWT and refresh rotation

Status: Accepted

Use short-lived signed access JWTs plus high-entropy opaque refresh credentials linked to durable server sessions. Store only keyed refresh digests. Rotate with an atomic compare-and-swap; stale credential reuse revokes the family. This is simpler to revoke and safer to store than a long-lived self-contained refresh JWT.
