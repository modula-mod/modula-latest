# API Atlas production acceptance

The API Atlas uses two fixed, non-person identities: `api-atlas-a` and `api-atlas-b`. Their email namespace is `.invalid`, their profiles are private, their identity metadata carries `modula-api-atlas-production-audit-v1`, and mailbox provisioning is explicitly skipped. A collision without that marker is a hard failure.

Credentials live only in `/etc/modula/api-atlas.env` with mode `0600`. Create the file once with `pnpm api:atlas:credentials`; the command refuses to overwrite an existing file and never prints secret values. Load it only into the guarded identity CLI or acceptance process.

Provisioning uses the normal account service and database transaction path. The exact guard value in the protected environment file is required. Re-running provisioning is idempotent and validates the stored marker, active state, handle and password before reuse.

The authenticated harness creates posts, a comment, an attachment and a private repository record with a unique `API-BASELINE-02` marker. It records every resource in memory, performs owner/non-owner checks, and deletes the fixtures in `finally`. Profile visibility is restored to private and the temporary follow is removed. Evidence contains only statuses, error codes and hashed fixture identifiers; tokens, passwords, email values and response bodies are excluded.

Module-installation, module-record, permission-review, intelligence and trust/privacy regressions run against an isolated database migrated by the exact candidate or accepted build. They are not enabled against arbitrary production accounts. API-FIX-01 regressions assert fail-closed ownership, explicit permission review, signed-release trust, private follow approval and idempotent reaction notifications. Automated passes do not establish production acceptance; the protected two-account production suite and controlled trust fixtures must still run after deployment.

Commands:

```sh
pnpm api:atlas:credentials
pnpm --filter @modula/greenfield-api build
set -a
. /etc/modula/api-atlas.env
set +a
eval "$(ops/deploy/running-release-env.sh)"  # release identity labels; compose has no defaults (GF-OPS-01)
docker compose -f ops/docker/compose.production.yml run --rm --no-deps greenfield-api node services/greenfield-api/dist/cli/api-atlas-identities.js
pnpm api:atlas:acceptance
pnpm api:atlas:lineage
```

Reserved identities are lifecycle infrastructure and remain private between runs. Marker-scoped content is ephemeral. If a run is interrupted, enumerate content by the unique marker reported in the root-only evidence file before cleanup; never delete unmarked data.
