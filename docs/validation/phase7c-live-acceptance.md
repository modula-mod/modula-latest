# Phase 7C Live Acceptance

Status: BLOCKED
Date: 2026-07-26
Repository: `/home/andrei/modula-latest`
Branch: `phase7c-modula-product-realisation`
Deployment commit: not deployed
Build number: not produced
API version: `v1`

## Evidence

Live acceptance has not been completed for this branch. Migrations `011_phase7c_restrained_reactions`, `012_phase7c_board_layout` and `013_phase7c_notification_preferences` still require VPS backup, migration, deployment and public endpoint verification before Phase 7C can merge. The API deployment must also configure a persistent `MODULA_MEDIA_ROOT` for Founder Alpha media posts.

Required live API checks:

- `GET /v1/health/live`
- `GET /v1/health/ready`
- `GET /v1/meta`
- `GET /v1/feed/home`
- `GET /v1/search`
- `POST /v1/posts` with a bounded image media attachment
- `GET /v1/media/:mediaFile`
- `GET /v1/notifications`
- `GET /v1/accounts/me/notification-preferences`
- `PATCH /v1/accounts/me/notification-preferences`
- `GET /v1/board/layout`
- `PATCH /v1/board/layout`

Required deployment evidence:

- VPS backup path
- Backup SHA-256
- Migration state
- `MODULA_MEDIA_ROOT` persistence path
- API image digest
- Worker image digest
- Web release commit
- Deployment timestamp

## Verification commands

```bash
set -a
source services/greenfield-api/.env >/dev/null 2>&1
set +a
pnpm --filter @modula/greenfield-api db:status
pnpm --filter @modula/greenfield-api db:migrate
curl -fsS https://api.modula.digital/v1/health/live
curl -fsS https://api.modula.digital/v1/health/ready
curl -fsS https://api.modula.digital/v1/meta
node scripts/verify-phase7c-release-candidate.mjs
```

Do not mark this file accepted until migration, deployment, live API and Vault Notes replay evidence are recorded.
