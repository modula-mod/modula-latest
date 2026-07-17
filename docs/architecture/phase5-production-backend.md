# Phase 5 — Production backend foundation

## Starting point
- Branch: `phase5-production-backend`
- Start commit: see `/tmp/modula-phase5-start-commit.txt` on the VPS at Mission B start

## Scope
- Workspace packages for shared API and protocol contracts
- Fastify + PostgreSQL + Kysely API (`services/api`)
- Private Docker Postgres + loopback-bound API
- Read-only public preview routes
- Atomic web deployment under `/home/andrei/deployments/modula-web`
- Backup/restore operational scripts

## Non-goals
- Production authentication
- Mutations in production
- AT Protocol runtime
- Blockchain storage
- Media uploads
- Frontend UI changes on the VPS

## Runtime topology
```text
api.modula.digital → Nginx → 127.0.0.1:4020 → API container → private Postgres
modula.digital → Nginx → /home/andrei/deployments/modula-web/current
```

## Write policy
Write routes respond with `AUTHENTICATION_NOT_AVAILABLE` / `CAPABILITY_DISABLED`.

## Rate limits
In-memory per instance. Shared store required before horizontal scaling.
