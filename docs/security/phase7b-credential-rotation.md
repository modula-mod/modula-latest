# Phase 7B Credential Rotation

Date: 2026-07-21

## Scope

The prior deployment inspection exposed local Compose database values. Treat
those values as compromised.

Affected Greenfield database login roles:

- `modula_admin`
- `modula_migrator`
- `modula_api`
- `modula_readonly`
- `modula_backup`
- `modula_worker`

Protected runtime files updated without recording secret values:

- `/etc/modula/greenfield-api.env`
- `/etc/modula/greenfield-worker.env`
- `/home/andrei/modula-latest/ops/docker/.env`
- `/home/andrei/modula-latest/services/greenfield-api/.env`

## Actions

- Generated new high-entropy credentials with `umask 077`.
- Changed all affected PostgreSQL role passwords using an admin connection inside `modula-preview-greenfield-postgres-1`.
- Rewrote protected environment files atomically.
- Recreated the Greenfield Postgres, API, and Worker containers with the new runtime environment.
- Removed stopped orphan preview containers that could retain old environment metadata:
  - `modula-preview-api-1`
  - `modula-preview-worker-1`
  - `modula-preview-postgres-1`
- Verified each rotated role can authenticate.
- Ran a targeted shell-history and deployment-log redaction scan; no secret-shaped matches were found.

No new credential values are recorded in this document.

## Readiness Evidence

Both public health endpoints passed after rotation:

- `curl -fsS https://api.modula.digital/v1/health/live`
- `curl -fsS https://api.modula.digital/v1/health/ready`

Observed responses:

- live: `{"ok":true,"data":{"status":"live"}}`
- ready: `{"ok":true,"data":{"status":"ready"}}`

## Backup Relocation

The Phase 7A backup was moved out of the source checkout.

- Previous path: `services/greenfield-api/backups/phase7a-pre-migration-20260720T124511Z.dump`
- New path: `/var/backups/modula/greenfield/phase7a-pre-migration-20260720T124511Z.dump`
- Size: `268K`
- SHA-256: `bcc216f72bdb76a4f85491e727698b38b7b1cbf16a0c832fb567d58d50cc06de`

Repository protections added:

- `services/greenfield-api/backups/`
- `*.dump`
- `*.sql.gz`
- `*.backup`

