# Phase 7C Final Report

Status: BLOCKED
Date: 2026-07-26
Repository: `/home/andrei/modula-latest`
Branch: `phase7c-modula-product-realisation`
Starting commit: `e0bd75ab1aad294ef4e1a2e3244c999ddbc23f23`
Current ending commit: `1e9e7009fb7a648517594cfd4a1302100e971f8b`
Tester: Codex on VPS

Phase 7D work has not started.

## Migration Versions

Applied on the VPS preview production stack:

- `011_phase7c_restrained_reactions`
- `012_phase7c_board_layout`
- `013_phase7c_notification_preferences`
- `014_phase7c_account_actor_backfill`

Final recorded migration state: no pending migrations through `014_phase7c_account_actor_backfill`.

## Deployment Record

- API deployment commit: `1e9e7009fb7a648517594cfd4a1302100e971f8b`
- Worker deployment commit: `1e9e7009fb7a648517594cfd4a1302100e971f8b`
- Web release commit: `1e9e7009fb7a648517594cfd4a1302100e971f8b`
- Web release path: `/home/andrei/deployments/modula-web/releases/20260726T214008Z`
- API image digest: `sha256:232ff0701c5fcca3d66f866ae09d4368aed85cc88139cdca854b78ab983df6f1`
- Worker image digest: `sha256:6eb69c9eb3736408f71e1cb348d5dad97d018ec51ae798e63087ef5015315b6e`
- API URL: `https://api.modula.digital`
- Web URL: `https://modula.digital`
- API version: `v1`

## Backup Record

- Pre-migration backup: `/var/backups/modula/greenfield/phase7c-pre-migration-20260726T204307Z.dump`
- Pre-migration SHA-256: `9dbee143095b7f3922e14dbfe99bc908f9ec559a2f76266f5335ca60d8d87630`
- Pre-migration size: 620K
- Pre-014 backup: `/var/backups/modula/greenfield/phase7c-pre-014-20260726T210305Z.dump`
- Pre-014 SHA-256: `33e8365a3f7ddd02a1aeb7325a8eb0c0c493c4876402efe49a9b469a0fa7c14f`
- Pre-014 size: 626K
- Backup inspection: `pg_restore -l` passed for both dumps.
- Restore command pattern: `pg_restore --exit-on-error --clean --if-exists --dbname "$RESTORE_DATABASE_URL" <backup-file>`

## Verification Results

Passed:

- `pnpm install --frozen-lockfile`
- `pnpm exec expo install --check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm --filter @modula/greenfield-api typecheck`
- `pnpm --filter @modula/greenfield-api test`
- `pnpm --filter @modula/greenfield-worker typecheck`
- `pnpm --filter @modula/greenfield-worker test`
- `scripts/build-web-preview.sh`
- `scripts/deploy-web-preview.sh`
- `scripts/smoke-api-preview.sh https://api.modula.digital`
- `scripts/smoke-web-preview.sh https://modula.digital`
- `node scripts/verify-phase7c-product-complete.mjs`
- `node scripts/verify-phase7c-api-parity.mjs`
- `node scripts/verify-phase7c-placeholder-free.mjs`
- `node scripts/verify-phase7c-native-readiness.mjs`

Blocked:

- `node scripts/verify-phase7c-release-candidate.mjs` because native acceptance is not accepted.
- `node scripts/verify-phase7c-founder-alpha.mjs` because release-candidate verification is blocked until physical device and TestFlight evidence exist.
- `node scripts/verify-phase7b-branch-consolidation.mjs` until Phase 7C is merged and the branch is deleted.

## Live Acceptance

Recorded in `docs/validation/phase7c-live-acceptance.md`.

Passed live flows include:

- health live and ready
- registration, verification, login, session restore, refresh and logout
- feed load and cursor pagination
- post creation
- reaction set/list/clear
- comment create/load/delete
- search and search pagination
- notification preferences GET/PATCH persistence
- notifications list, mark read and read all
- public and private media upload/retrieval authorization
- invalid and oversized media rejection
- Board layout GET/PATCH persistence and stale conflict
- Product Hub registry and Vault Notes install/enable/disable/uninstall lifecycle

## iPhone Validation

Status: BLOCKED

Physical iPhone validation has not been completed. Required native evidence is tracked in `docs/validation/phase7c-native-acceptance.md`.

## TestFlight Build

Status: BLOCKED

A TestFlight candidate has not been produced. `EXPO_TOKEN` was not present in the VPS shell used for this report, so EAS cloud build/submission could not be started from this environment without additional Expo authentication.

## Known Issues

- Native physical iPhone acceptance remains pending.
- TestFlight candidate production and upgrade testing remain pending.
- Older historical frontend-boundary verifiers have been reconciled in `docs/validation/phase7c-verifier-reconciliation.md`.
- Founder Alpha still uses separate Greenfield account sessions and preview actor sessions for social write flows.

## Merge Status

Phase 7C is not merge-ready. Do not merge into `main` until:

- native acceptance is complete;
- development iOS build is installed and validated;
- TestFlight candidate is produced and validated;
- `docs/validation/phase7c-native-acceptance.md` is updated to `Status: ACCEPTED`;
- `node scripts/verify-phase7c-release-candidate.mjs` passes;
- `node scripts/verify-phase7c-founder-alpha.mjs` passes from a clean working tree;
- `phase7c-modula-product-realisation` is merged and deleted.
