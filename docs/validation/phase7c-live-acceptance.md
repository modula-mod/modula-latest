# Phase 7C Live Acceptance

Status: ACCEPTED
Date: 2026-07-26
Repository: `/home/andrei/modula-latest`
Branch: `phase7c-modula-product-realisation`
Deployment commit: `1e9e7009fb7a648517594cfd4a1302100e971f8b`
Build number: web release `20260726T214008Z`
API version: `v1`
Environment: VPS preview production stack at `https://api.modula.digital`
Tester: Codex on VPS
Result: PASS

## Deployment Record

- API image digest: `sha256:232ff0701c5fcca3d66f866ae09d4368aed85cc88139cdca854b78ab983df6f1`
- Worker image digest: `sha256:6eb69c9eb3736408f71e1cb348d5dad97d018ec51ae798e63087ef5015315b6e`
- Web release: `/home/andrei/deployments/modula-web/releases/20260726T214008Z`
- Web release commit: `1e9e7009fb7a648517594cfd4a1302100e971f8b`
- Web built at: `2026-07-26T21:39:28Z`
- API public URL: `https://api.modula.digital`
- Web public URL: `https://modula.digital`
- Media root: `/var/lib/modula/greenfield-media`

## Backup Record

- Pre-migration backup: `/var/backups/modula/greenfield/phase7c-pre-migration-20260726T204307Z.dump`
- Pre-migration backup size: 620K
- Pre-migration backup SHA-256: `9dbee143095b7f3922e14dbfe99bc908f9ec559a2f76266f5335ca60d8d87630`
- Pre-014 backup: `/var/backups/modula/greenfield/phase7c-pre-014-20260726T210305Z.dump`
- Pre-014 backup size: 626K
- Pre-014 backup SHA-256: `33e8365a3f7ddd02a1aeb7325a8eb0c0c493c4876402efe49a9b469a0fa7c14f`
- Restore inspection: `pg_restore -l` completed for both recorded dumps.
- Restore command pattern: `pg_restore --exit-on-error --clean --if-exists --dbname "$RESTORE_DATABASE_URL" <backup-file>`

## Evidence

The live acceptance run exercised the deployed API, Worker-backed module lifecycle jobs, persistent media storage, Board persistence, Product Hub module lifecycle, Vault Notes install lifecycle, public web smoke checks and public API smoke checks against the VPS preview production stack.

## Migration State

Applied migrations:

- `011_phase7c_restrained_reactions`
- `012_phase7c_board_layout`
- `013_phase7c_notification_preferences`
- `014_phase7c_account_actor_backfill`

Final migration status:

```json
{
  "applied": [
    "001_init_schema",
    "002_phase6_social_atproto",
    "003_phase6_api_rls_writes",
    "004_greenfield_sovereign_core",
    "005_greenfield_backup_access",
    "006_phase6s_social_product",
    "007_phase6s_backfill_counts_and_defaults",
    "008_phase6s_comment_reply_counter_consistency",
    "009_phase7a_module_platform",
    "010_phase7b_module_runtime",
    "011_phase7c_restrained_reactions",
    "012_phase7c_board_layout",
    "013_phase7c_notification_preferences",
    "014_phase7c_account_actor_backfill"
  ],
  "pending": []
}
```

## Live API Checks

Health and metadata:

- `GET /v1/health/live`: PASS
- `GET /v1/health/ready`: PASS
- `GET /v1/meta`: PASS

Authentication:

- `POST /v1/accounts/register`: PASS
- `POST /v1/accounts/verify-email`: PASS
- `POST /v1/sessions`: PASS
- `GET /v1/accounts/me`: PASS
- `GET /v1/accounts/me/sessions`: PASS
- `POST /v1/sessions/refresh`: PASS
- `DELETE /v1/sessions/current`: PASS
- logged-out token rejection: PASS

Feed, comments and reactions:

- `GET /v1/feed/home`: PASS
- feed cursor pagination: PASS
- `POST /v1/posts`: PASS
- `PUT /v1/posts/:postId/reaction`: PASS
- `GET /v1/posts/:postId/reactions`: PASS
- `DELETE /v1/posts/:postId/reaction`: PASS
- `POST /v1/posts/:postId/comments`: PASS
- `GET /v1/posts/:postId/comments`: PASS
- `DELETE /v1/comments/:commentId`: PASS

Search:

- `GET /v1/search`: PASS
- search cursor pagination: PASS
- invalid cursor rejection: PASS

Notification preferences:

- `GET /v1/accounts/me/notification-preferences`: PASS
- `PATCH /v1/accounts/me/notification-preferences`: PASS
- persisted readback: PASS

Notifications:

- `GET /v1/notifications`: PASS
- `POST /v1/notifications/:notificationId/read`: PASS
- `POST /v1/notifications/read-all`: PASS

Media:

- public image post upload through `POST /v1/posts`: PASS
- `GET /v1/media/:mediaFile`: PASS
- private image post upload through `POST /v1/posts`: PASS
- anonymous private media denial: PASS
- author private media retrieval: PASS
- invalid media request rejection: PASS
- oversized media rejection: PASS (`413` at request boundary)

Board:

- `GET /v1/board/layout`: PASS
- `PATCH /v1/board/layout`: PASS
- persisted readback: PASS
- stale version conflict: PASS

Product Hub and Vault Notes:

- `GET /v1/registry/modules`: PASS
- `GET /v1/registry/modules/digital.modula.vault-notes`: PASS
- `GET /v1/registry/modules/digital.modula.vault-notes/versions`: PASS
- `POST /v1/modules/digital.modula.vault-notes/install-preview`: PASS
- `POST /v1/modules/digital.modula.vault-notes/install`: PASS
- worker transition to `installedDisabled`: PASS
- `POST /v1/modules/digital.modula.vault-notes/enable`: PASS
- worker transition to `enabled`: PASS
- `POST /v1/modules/digital.modula.vault-notes/disable`: PASS
- worker transition to `disabled`: PASS
- `POST /v1/modules/digital.modula.vault-notes/uninstall-preview`: PASS
- `DELETE /v1/modules/digital.modula.vault-notes/install`: PASS
- worker removal: PASS

## Public Smoke

- `scripts/smoke-api-preview.sh https://api.modula.digital`: PASS
- `scripts/smoke-web-preview.sh https://modula.digital`: PASS

## Known Limitations

- Founder Alpha still uses separate Greenfield account sessions and preview actor sessions for social write flows.
- Oversized media is rejected at the request boundary with `413`.
- Physical iPhone and TestFlight acceptance are recorded separately in `docs/validation/phase7c-native-acceptance.md`.

## Verification commands

```bash
set -a
source /etc/modula/api.host.env >/dev/null 2>&1
set +a
pnpm --filter @modula/greenfield-api db:status
scripts/smoke-api-preview.sh https://api.modula.digital
scripts/smoke-web-preview.sh https://modula.digital
node scripts/verify-phase7c-release-candidate.mjs
```
