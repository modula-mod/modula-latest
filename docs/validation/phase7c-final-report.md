# Phase 7C Final Report

Status: ACCEPTED
Date: 2026-07-28
Repository: `/home/andrei/modula-latest`
Branch: `phase7c-modula-product-realisation`
Starting commit: `e0bd75ab1aad294ef4e1a2e3244c999ddbc23f23`
Current baseline commit: `dcbcee5310fd39a07d81181534d670406f91749d`
Product deployment commit: `1e9e7009fb7a648517594cfd4a1302100e971f8b`
Deployment commit: `1e9e7009fb7a648517594cfd4a1302100e971f8b`
Build number: web release `20260726T214008Z`
Tester: Codex on VPS

Phase 7D work has not started.

This report uses the revised Phase 7C-C workflow: backend, frontend, deployment, migrations, backup, live validation, documentation and Phase 7C verifiers are required. Native packaging is deferred and is not a Phase 7C release blocker.

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
- `node scripts/verify-phase7c-release-candidate.mjs` under the revised Phase 7C-C criteria
- `node scripts/verify-phase7c-founder-alpha.mjs` from a clean working tree under the revised Phase 7C-C criteria

Post-merge expected:

- `node scripts/verify-phase7b-branch-consolidation.mjs` should pass only after Phase 7C is merged, `phase7c-modula-product-realisation` is deleted, and `main` is the sole active remote product branch.

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

## Native Packaging Deferral

Status: DEFERRED

Physical iPhone validation has not been completed in Phase 7C because native packaging is deferred by policy. The deferral record is tracked in `docs/validation/phase7c-native-acceptance.md`.

The native packaging phase will separately cover Xcode project finalisation, iOS builds, signing, provisioning, App Store Connect, TestFlight and App Store submission.

## Known Issues

- Native physical iPhone and TestFlight acceptance are intentionally deferred to the native packaging phase.
- Older historical frontend-boundary verifiers have been reconciled in `docs/validation/phase7c-verifier-reconciliation.md`.
- Founder Alpha still uses separate Greenfield account sessions and preview actor sessions for social write flows.

## Merge Status

Phase 7C is merge-ready after the revised verifier set passes from a clean working tree and the final branch tip is pushed.

Merge sequence:

- open or update the Pull Request for `phase7c-modula-product-realisation`;
- merge into `main` only after backend, frontend, APIs, deployment, migrations, live validation, documentation and revised Phase 7C verifiers are green;
- delete `phase7c-modula-product-realisation`;
- keep Phase 7D blocked until `main` is canonical again.

## Verification commands

```bash
git diff --check
pnpm typecheck
pnpm lint
pnpm verify:phase7c-product-complete
pnpm verify:phase7c-api-parity
pnpm verify:phase7c-placeholder-free
pnpm verify:phase7c-native-readiness
pnpm verify:phase7c-release-candidate
pnpm verify:phase7c-founder-alpha
scripts/smoke-api-preview.sh https://api.modula.digital
scripts/smoke-web-preview.sh https://modula.digital
```
