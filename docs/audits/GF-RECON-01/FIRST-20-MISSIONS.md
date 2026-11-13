# GF-RECON-01 — First 20 Missions

> GF-RECON-01 — audit date 2026-11-13 (UTC). Read-only reconciliation.
> Backend `modula-mod/modula-latest` main `a91d490e61ebfff38069378ddf757429eb000449` · Native `modula-mod/modula-native` main `5db0f027dd29c6a877b04aa98e0b457ee2b82e2d` · Vault Notes `modula-mod/modula-vault-notes` main `15bf535785cb544fed40fb440499b7081fa89e93`.
> Live VPS revision, production migration ledger, worker image, feature flags and backup state: **UNKNOWN** (no read-only runtime access in this mission).
> Master plan `MODULA_GREENFIELD_MASTER_PLAN_2026.pdf` was **not available** to the auditor; comparison uses the 2026-11-13 founder audit document and the GreenField Experience Atlas v1.0. GreenField is **not** complete.

Priority order: signer collision → calls + messaging E2E → package artifact integrity → backup/restore → operational AI → D00–D05. Each mission is ONE short-lived branch off the named base and ONE PR, independently reviewable. Merge only what SENTINEL (backend) or PRISM (native) certifies.

## Queue

| # | ID | Owner | Base | Scope (one line) |
|---|---|---|---|---|
| 1 | GF-SIGN-01 | Synapse (Sentinel certifies) | modula-latest main | Restage signer PR #165 on current main as migration 091_greenfield_online_signing_authority (+ .down.sql) |
| 2 | GF-SIGN-02 | Sentinel | modula-latest main | Add a repository-validation guard that fails CI when two up-migrations share a numeric prefix or when a new migration sorts before the current tip (migrate.ts:31-41 sorts by filename, so 089_greenfield_* would apply before 089_messaging_v3). |
| 3 | GF-CALL-01 | Forge | modula-latest main | Run the DB-gated calls.integration.test.ts and messaging-v3.integration.test.ts in the CI migration-validation job (they are describe.skip without MODULA_TEST_DATABASE_URL and are not in the job list today) |
| 4 | GF-MSG-01 | Forge | modula-latest main | Add a disposable-stack two-account messaging v3 E2E harness (script + doc) covering receipts, groups, attachments, presence, privacy and socket reconnect against a local API + Postgres. |
| 5 | GF-REG-01 | Prism | modula-native main | Baseline the 20 failing/INCOMPLETE ModulaUITests (EcosystemBasicLifecycle, MOL01–MOL03) on current native main 5db0f027 and capture Moliboo golden screenshots |
| 6 | GF-MSG-02 | Prism | modula-native main | Restage native messaging v3 wiring (#296 own commits, plus required #293–#295 pieces) as ONE branch off main |
| 7 | GF-CALL-02 | Mosaic | modula-latest main | Execute docs/ops/calls-coturn.md in an isolated staging environment (Coturn DNS/TLS/UDP/TCP relay ports, nginx WebSocket locations, staging APNs credentials separate from prod) |
| 8 | GF-CALL-03 | Prism | modula-native main | Restage native 1:1 calls (#297) as ONE branch off main after GF-MSG-02 |
| 9 | GF-MOD-01 | Mosaic | modula-latest main | Add a read-only artifact/presentation closure report (script) that lists, per installable release, package bytes, presentation blobs, digests and signature state |
| 10 | GF-MOD-02 | Mosaic | modula-latest main | Require presentation asset blob presence at ingestion/publication (G004) and expose missing-blob count internally. |
| 11 | GF-OPS-01 | Sentinel | modula-latest main | Release-pin hygiene: remove the misleading SOURCE_EXPECTED_MIGRATION default 076 in ops/docker/compose.production.yml (require explicit value), update scripts/verify-greenfield-backend-v1.mjs:113 to derive the expected schema instead of 055, and add a worker heartbeat healthcheck (G033). |
| 12 | GF-OPS-02 | Sentinel | modula-latest main | Off-host encrypted backup + restore drill design: add an off-host destination option to ops/backup/greenfield-v1-backup.mjs (age-encrypted, no secrets in repo) and a restore-into-disposable-host drill script. |
| 13 | GF-AI-01 | Synapse | modula-latest main | Governed provider integration acceptance: tests for denied actions, sensitive local-only content, AKI/Governor approvals and usage ledger through the existing gateway |
| 14 | GF-AI-02 | Synapse | modula-latest main + modula-native main | Nodus local-first contract: native main calls GET /v1/intelligence/nodus/releases/latest (NodusRelease.swift:141) but no backend route exists |
| 15 | GF-D00-01 | Forge | modula-latest main | Machine-readable authority/privacy/replication register for every table/aggregate (docs/architecture/decentralisation-atlas.json) generated from migrations + api-atlas. |
| 16 | GF-D01-01 | Synapse | modula-latest main | Draft versioned node/discovery/envelope protocol schema with canonical JSON + signature rules and reference vectors under docs/protocol |
| 17 | GF-D02-01 | Synapse | modula-latest main | Global principal + signed home-node delegation models with adversarial test vectors (package proposal packages/greenfield-identity), no runtime identity cutover. |
| 18 | GF-D03-01 | Forge | modula-latest main | Signed federation outbox proof on a disposable DB reusing outbox_events (001_init_schema.sql:182): atomic commit, sequence, canonical signature, idempotent replay. |
| 19 | GF-D04-01 | Mosaic | modula-latest main | Second isolated, independently keyed GreenField node bootstrap (docs + CLI script) with distinct Postgres/media and signed discovery manifest |
| 20 | GF-D05-01 | Forge (Synapse reviews) | modula-latest main | Authenticated two-node event delivery prototype: inbox/outbox, retries, replay rejection, SSRF/loopback denial (reuse services/greenfield-api/src/security/ssrf.ts), quotas, dead letters. |

Gates that are **not** PRs and stay outside the 20: GF-CALL-04 (two physical iPhones, multi-day, DEVICE VERIFIED only with logs + SHA), GF-OPS read-only production snapshot (needs owner-approved runtime access), GF-PREM-01 (Apple sandbox), GF-EDGE follow-ups G019/G020/G021/G022/G023/G025/G026/G030 (small Forge/Sentinel PRs after the queue).

## 1. GF-SIGN-01 — Synapse (Sentinel certifies)

- **Base:** modula-latest main
- **Scope:** Restage signer PR #165 on current main as migration 091_greenfield_online_signing_authority (+ .down.sql); rename only within the new branch; keep #165 untouched until the restage is certified.
- **Acceptance tests:**
  - git diff main...phase/greenfield-signer-01 reproduced on a new branch with 089→091 rename
  - api-fix-01.migration.test.ts and greenfield-backend-v1.migration-ledger-security.test.ts expect tip 091_greenfield_online_signing_authority
  - Full chain 001→091 on disposable Postgres 16 + down 091/re-up cycle
  - Upgrade path from a DB already at 090_calls_v1 applies only 091
  - Regenerated docs/audits/api-atlas-01 (pnpm api:atlas) with zero drift in CI
  - Vault Transit provider stays disabled by default; signer DB tests run with real Postgres, none skipped
  - pnpm api:atlas:verify + api:atlas:secrets green
- **Notes / dependency:** Resolve the 14 conflicting files (12 api-atlas docs, 2 migration tests) by regenerating, not hand-merging. Do not provision Vault, create keys or sign anything.

**Ready-to-paste prompt:**

```text
MISSION GF-SIGN-01 (owner Synapse (Sentinel certifies)), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-sign-01 (one branch, one PR, title "GF-SIGN-01: <summary>").
Scope: Restage signer PR #165 on current main as migration 091_greenfield_online_signing_authority (+ .down.sql); rename only within the new branch; keep #165 untouched until the restage is certified.
Acceptance:
- git diff main...phase/greenfield-signer-01 reproduced on a new branch with 089→091 rename
- api-fix-01.migration.test.ts and greenfield-backend-v1.migration-ledger-security.test.ts expect tip 091_greenfield_online_signing_authority
- Full chain 001→091 on disposable Postgres 16 + down 091/re-up cycle
- Upgrade path from a DB already at 090_calls_v1 applies only 091
- Regenerated docs/audits/api-atlas-01 (pnpm api:atlas) with zero drift in CI
- Vault Transit provider stays disabled by default; signer DB tests run with real Postgres, none skipped
- pnpm api:atlas:verify + api:atlas:secrets green
Notes: Resolve the 14 conflicting files (12 api-atlas docs, 2 migration tests) by regenerating, not hand-merging. Do not provision Vault, create keys or sign anything.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 2. GF-SIGN-02 — Sentinel

- **Base:** modula-latest main
- **Scope:** Add a repository-validation guard that fails CI when two up-migrations share a numeric prefix or when a new migration sorts before the current tip (migrate.ts:31-41 sorts by filename, so 089_greenfield_* would apply before 089_messaging_v3).
- **Acceptance tests:**
  - New script scripts/verify-migration-ordering.mjs wired into repository-validation
  - Unit test: duplicate prefix fixture fails; out-of-order fixture fails; current main passes
  - No change to migrate.ts runtime behaviour
- **Notes / dependency:** Independent of GF-SIGN-01; merge first so the restage is protected.

**Ready-to-paste prompt:**

```text
MISSION GF-SIGN-02 (owner Sentinel), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-sign-02 (one branch, one PR, title "GF-SIGN-02: <summary>").
Scope: Add a repository-validation guard that fails CI when two up-migrations share a numeric prefix or when a new migration sorts before the current tip (migrate.ts:31-41 sorts by filename, so 089_greenfield_* would apply before 089_messaging_v3).
Acceptance:
- New script scripts/verify-migration-ordering.mjs wired into repository-validation
- Unit test: duplicate prefix fixture fails; out-of-order fixture fails; current main passes
- No change to migrate.ts runtime behaviour
Notes: Independent of GF-SIGN-01; merge first so the restage is protected.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 3. GF-CALL-01 — Forge

- **Base:** modula-latest main
- **Scope:** Run the DB-gated calls.integration.test.ts and messaging-v3.integration.test.ts in the CI migration-validation job (they are describe.skip without MODULA_TEST_DATABASE_URL and are not in the job list today); fix only reproduced defects.
- **Acceptance tests:**
  - Both suites execute in CI with Postgres and report counts (not skipped)
  - Idempotency, block/privacy, ticket expiry/replay, TURN credential TTL, VoIP registration ownership, dead-letter cases covered
  - Record PASS/PARTIAL per case
- **Notes / dependency:** No flag changes; MODULA_CALLS_ENABLED stays off.

**Ready-to-paste prompt:**

```text
MISSION GF-CALL-01 (owner Forge), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-call-01 (one branch, one PR, title "GF-CALL-01: <summary>").
Scope: Run the DB-gated calls.integration.test.ts and messaging-v3.integration.test.ts in the CI migration-validation job (they are describe.skip without MODULA_TEST_DATABASE_URL and are not in the job list today); fix only reproduced defects.
Acceptance:
- Both suites execute in CI with Postgres and report counts (not skipped)
- Idempotency, block/privacy, ticket expiry/replay, TURN credential TTL, VoIP registration ownership, dead-letter cases covered
- Record PASS/PARTIAL per case
Notes: No flag changes; MODULA_CALLS_ENABLED stays off.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 4. GF-MSG-01 — Forge

- **Base:** modula-latest main
- **Scope:** Add a disposable-stack two-account messaging v3 E2E harness (script + doc) covering receipts, groups, attachments, presence, privacy and socket reconnect against a local API + Postgres.
- **Acceptance tests:**
  - tools/e2e/messaging-v3-two-account.mjs runnable against localhost only
  - Asserts REST is source of truth when socket drops; asserts single-instance capability flag
  - Refuses to run against *.modula.digital hosts other than test.modula.*
- **Notes / dependency:** Keep REST as source of truth until multi-replica fan-out exists.

**Ready-to-paste prompt:**

```text
MISSION GF-MSG-01 (owner Forge), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-msg-01 (one branch, one PR, title "GF-MSG-01: <summary>").
Scope: Add a disposable-stack two-account messaging v3 E2E harness (script + doc) covering receipts, groups, attachments, presence, privacy and socket reconnect against a local API + Postgres.
Acceptance:
- tools/e2e/messaging-v3-two-account.mjs runnable against localhost only
- Asserts REST is source of truth when socket drops; asserts single-instance capability flag
- Refuses to run against *.modula.digital hosts other than test.modula.*
Notes: Keep REST as source of truth until multi-replica fan-out exists.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 5. GF-REG-01 — Prism

- **Base:** modula-native main
- **Scope:** Baseline the 20 failing/INCOMPLETE ModulaUITests (EcosystemBasicLifecycle, MOL01–MOL03) on current native main 5db0f027 and capture Moliboo golden screenshots; record per-test PASS/FAIL with SHA and simulator runtime.
- **Acceptance tests:**
  - Per-class runs (no 20-min cap truncation) on main
  - Table: test, main result, #289-era result, classification (pre-existing / regression / environment)
  - Moliboo golden images committed under docs/evidence with SHA
- **Notes / dependency:** Report-only PR (docs/evidence). No UI changes; Moliboo appearance must not change.

**Ready-to-paste prompt:**

```text
MISSION GF-REG-01 (owner Prism), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-native main. Branch: gf-reg-01 (one branch, one PR, title "GF-REG-01: <summary>").
Scope: Baseline the 20 failing/INCOMPLETE ModulaUITests (EcosystemBasicLifecycle, MOL01–MOL03) on current native main 5db0f027 and capture Moliboo golden screenshots; record per-test PASS/FAIL with SHA and simulator runtime.
Acceptance:
- Per-class runs (no 20-min cap truncation) on main
- Table: test, main result, #289-era result, classification (pre-existing / regression / environment)
- Moliboo golden images committed under docs/evidence with SHA
Notes: Report-only PR (docs/evidence). No UI changes; Moliboo appearance must not change.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 6. GF-MSG-02 — Prism

- **Base:** modula-native main
- **Scope:** Restage native messaging v3 wiring (#296 own commits, plus required #293–#295 pieces) as ONE branch off main; certify cumulatively.
- **Acceptance tests:**
  - Branch off main, no stacked base
  - All v3 client paths still match backend routes (API-NATIVE-CONTRACTS scan)
  - MessagingV3ContractTests + full ModulaTests on simulator; UI tests compared to GF-REG-01 baseline
- **Notes / dependency:** Do not merge chained branches blindly; superseded stack PRs can be closed only with owner approval after archive tags.

**Ready-to-paste prompt:**

```text
MISSION GF-MSG-02 (owner Prism), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-native main. Branch: gf-msg-02 (one branch, one PR, title "GF-MSG-02: <summary>").
Scope: Restage native messaging v3 wiring (#296 own commits, plus required #293–#295 pieces) as ONE branch off main; certify cumulatively.
Acceptance:
- Branch off main, no stacked base
- All v3 client paths still match backend routes (API-NATIVE-CONTRACTS scan)
- MessagingV3ContractTests + full ModulaTests on simulator; UI tests compared to GF-REG-01 baseline
Notes: Do not merge chained branches blindly; superseded stack PRs can be closed only with owner approval after archive tags.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 7. GF-CALL-02 — Mosaic

- **Base:** modula-latest main
- **Scope:** Execute docs/ops/calls-coturn.md in an isolated staging environment (Coturn DNS/TLS/UDP/TCP relay ports, nginx WebSocket locations, staging APNs credentials separate from prod); document results; commit only runbook corrections.
- **Acceptance tests:**
  - External TURN relay test (turnutils or trickle-ice) from outside the host
  - wss upgrade for /v1/messaging/socket and /v1/calls/:id/signalling through nginx on staging
  - No public flag enabled; no production credentials touched
- **Notes / dependency:** Requires owner-approved staging host access.

**Ready-to-paste prompt:**

```text
MISSION GF-CALL-02 (owner Mosaic), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-call-02 (one branch, one PR, title "GF-CALL-02: <summary>").
Scope: Execute docs/ops/calls-coturn.md in an isolated staging environment (Coturn DNS/TLS/UDP/TCP relay ports, nginx WebSocket locations, staging APNs credentials separate from prod); document results; commit only runbook corrections.
Acceptance:
- External TURN relay test (turnutils or trickle-ice) from outside the host
- wss upgrade for /v1/messaging/socket and /v1/calls/:id/signalling through nginx on staging
- No public flag enabled; no production credentials touched
Notes: Requires owner-approved staging host access.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 8. GF-CALL-03 — Prism

- **Base:** modula-native main
- **Scope:** Restage native 1:1 calls (#297) as ONE branch off main after GF-MSG-02; request fresh approval for the stasel/WebRTC 156.0.0 SPM dependency.
- **Acceptance tests:**
  - Compiles on main; CallTests + ModulaTests pass on simulator
  - CallKit/PushKit state machine unit tests
  - Dependency approval recorded before merge
- **Notes / dependency:** Physical-device acceptance is a separate gate (GF-CALL-04, multi-day, two iPhones).

**Ready-to-paste prompt:**

```text
MISSION GF-CALL-03 (owner Prism), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-native main. Branch: gf-call-03 (one branch, one PR, title "GF-CALL-03: <summary>").
Scope: Restage native 1:1 calls (#297) as ONE branch off main after GF-MSG-02; request fresh approval for the stasel/WebRTC 156.0.0 SPM dependency.
Acceptance:
- Compiles on main; CallTests + ModulaTests pass on simulator
- CallKit/PushKit state machine unit tests
- Dependency approval recorded before merge
Notes: Physical-device acceptance is a separate gate (GF-CALL-04, multi-day, two iPhones).
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 9. GF-MOD-01 — Mosaic

- **Base:** modula-latest main
- **Scope:** Add a read-only artifact/presentation closure report (script) that lists, per installable release, package bytes, presentation blobs, digests and signature state; and make install preview fail closed when the package artifact is absent.
- **Acceptance tests:**
  - Script runs against disposable DB fixtures; emits JSON
  - Test: release without artifact → install preview refused
  - Test: digest mismatch → ARTIFACT_DIGEST_MISMATCH
- **Notes / dependency:** Production run of the report needs owner approval (read-only).

**Ready-to-paste prompt:**

```text
MISSION GF-MOD-01 (owner Mosaic), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-mod-01 (one branch, one PR, title "GF-MOD-01: <summary>").
Scope: Add a read-only artifact/presentation closure report (script) that lists, per installable release, package bytes, presentation blobs, digests and signature state; and make install preview fail closed when the package artifact is absent.
Acceptance:
- Script runs against disposable DB fixtures; emits JSON
- Test: release without artifact → install preview refused
- Test: digest mismatch → ARTIFACT_DIGEST_MISMATCH
Notes: Production run of the report needs owner approval (read-only).
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 10. GF-MOD-02 — Mosaic

- **Base:** modula-latest main
- **Scope:** Require presentation asset blob presence at ingestion/publication (G004) and expose missing-blob count internally.
- **Acceptance tests:**
  - Ingest test: metadata without blob rejected
  - Existing releases unaffected (read path unchanged)
- **Notes / dependency:** Backfill of production data is out of scope.

**Ready-to-paste prompt:**

```text
MISSION GF-MOD-02 (owner Mosaic), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-mod-02 (one branch, one PR, title "GF-MOD-02: <summary>").
Scope: Require presentation asset blob presence at ingestion/publication (G004) and expose missing-blob count internally.
Acceptance:
- Ingest test: metadata without blob rejected
- Existing releases unaffected (read path unchanged)
Notes: Backfill of production data is out of scope.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 11. GF-OPS-01 — Sentinel

- **Base:** modula-latest main
- **Scope:** Release-pin hygiene: remove the misleading SOURCE_EXPECTED_MIGRATION default 076 in ops/docker/compose.production.yml (require explicit value), update scripts/verify-greenfield-backend-v1.mjs:113 to derive the expected schema instead of 055, and add a worker heartbeat healthcheck (G033).
- **Acceptance tests:**
  - compose config fails fast when SOURCE_EXPECTED_MIGRATION is unset
  - deploy-safety verifier updated and green
  - Worker healthcheck uses heartbeat freshness, no new ports
- **Notes / dependency:** Source-only; no deploy. Live runtime snapshot is a separate owner-approved read-only task.

**Ready-to-paste prompt:**

```text
MISSION GF-OPS-01 (owner Sentinel), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-ops-01 (one branch, one PR, title "GF-OPS-01: <summary>").
Scope: Release-pin hygiene: remove the misleading SOURCE_EXPECTED_MIGRATION default 076 in ops/docker/compose.production.yml (require explicit value), update scripts/verify-greenfield-backend-v1.mjs:113 to derive the expected schema instead of 055, and add a worker heartbeat healthcheck (G033).
Acceptance:
- compose config fails fast when SOURCE_EXPECTED_MIGRATION is unset
- deploy-safety verifier updated and green
- Worker healthcheck uses heartbeat freshness, no new ports
Notes: Source-only; no deploy. Live runtime snapshot is a separate owner-approved read-only task.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 12. GF-OPS-02 — Sentinel

- **Base:** modula-latest main
- **Scope:** Off-host encrypted backup + restore drill design: add an off-host destination option to ops/backup/greenfield-v1-backup.mjs (age-encrypted, no secrets in repo) and a restore-into-disposable-host drill script.
- **Acceptance tests:**
  - Dry-run test with a local fake remote
  - Restore drill on disposable Postgres + media fixture verifies digests
  - Runbook updated; SPOF register row 11 updated with evidence
- **Notes / dependency:** Do not configure production destinations or keys.

**Ready-to-paste prompt:**

```text
MISSION GF-OPS-02 (owner Sentinel), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-ops-02 (one branch, one PR, title "GF-OPS-02: <summary>").
Scope: Off-host encrypted backup + restore drill design: add an off-host destination option to ops/backup/greenfield-v1-backup.mjs (age-encrypted, no secrets in repo) and a restore-into-disposable-host drill script.
Acceptance:
- Dry-run test with a local fake remote
- Restore drill on disposable Postgres + media fixture verifies digests
- Runbook updated; SPOF register row 11 updated with evidence
Notes: Do not configure production destinations or keys.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 13. GF-AI-01 — Synapse

- **Base:** modula-latest main
- **Scope:** Governed provider integration acceptance: tests for denied actions, sensitive local-only content, AKI/Governor approvals and usage ledger through the existing gateway; staging provider config doc.
- **Acceptance tests:**
  - Gateway tests: denied tool action, local-only content never routed to cloud provider, approval required paths
  - No unrestricted tool actions
  - Provider remains disabled by default
- **Notes / dependency:** No production provider keys.

**Ready-to-paste prompt:**

```text
MISSION GF-AI-01 (owner Synapse), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-ai-01 (one branch, one PR, title "GF-AI-01: <summary>").
Scope: Governed provider integration acceptance: tests for denied actions, sensitive local-only content, AKI/Governor approvals and usage ledger through the existing gateway; staging provider config doc.
Acceptance:
- Gateway tests: denied tool action, local-only content never routed to cloud provider, approval required paths
- No unrestricted tool actions
- Provider remains disabled by default
Notes: No production provider keys.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 14. GF-AI-02 — Synapse

- **Base:** modula-latest main + modula-native main
- **Scope:** Nodus local-first contract: native main calls GET /v1/intelligence/nodus/releases/latest (NodusRelease.swift:141) but no backend route exists. Either add a governed read-only release-manifest route with contract test, or change native to not default to it.
- **Acceptance tests:**
  - Contract test on both sides
  - No model bytes served without digest/signature
- **Notes / dependency:** Two small PRs (one per repo) if both sides change.

**Ready-to-paste prompt:**

```text
MISSION GF-AI-02 (owner Synapse), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main + modula-native main. Branch: gf-ai-02 (one branch, one PR, title "GF-AI-02: <summary>").
Scope: Nodus local-first contract: native main calls GET /v1/intelligence/nodus/releases/latest (NodusRelease.swift:141) but no backend route exists. Either add a governed read-only release-manifest route with contract test, or change native to not default to it.
Acceptance:
- Contract test on both sides
- No model bytes served without digest/signature
Notes: Two small PRs (one per repo) if both sides change.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 15. GF-D00-01 — Forge

- **Base:** modula-latest main
- **Scope:** Machine-readable authority/privacy/replication register for every table/aggregate (docs/architecture/decentralisation-atlas.json) generated from migrations + api-atlas.
- **Acceptance tests:**
  - Every table mapped to writer, owner, privacy class, replication class
  - Private messages, notes, secrets, private media marked non-replicable
  - CI check that new tables must be classified
- **Notes / dependency:** No new tables.

**Ready-to-paste prompt:**

```text
MISSION GF-D00-01 (owner Forge), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-d00-01 (one branch, one PR, title "GF-D00-01: <summary>").
Scope: Machine-readable authority/privacy/replication register for every table/aggregate (docs/architecture/decentralisation-atlas.json) generated from migrations + api-atlas.
Acceptance:
- Every table mapped to writer, owner, privacy class, replication class
- Private messages, notes, secrets, private media marked non-replicable
- CI check that new tables must be classified
Notes: No new tables.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 16. GF-D01-01 — Synapse

- **Base:** modula-latest main
- **Scope:** Draft versioned node/discovery/envelope protocol schema with canonical JSON + signature rules and reference vectors under docs/protocol; reuse packages/greenfield-protocol canonical-json/hashing.
- **Acceptance tests:**
  - Vectors verify with existing canonical-json.ts
  - ADR + security review notes
  - Existing /v1 wire unchanged
- **Notes / dependency:** Spec + vectors only.

**Ready-to-paste prompt:**

```text
MISSION GF-D01-01 (owner Synapse), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-d01-01 (one branch, one PR, title "GF-D01-01: <summary>").
Scope: Draft versioned node/discovery/envelope protocol schema with canonical JSON + signature rules and reference vectors under docs/protocol; reuse packages/greenfield-protocol canonical-json/hashing.
Acceptance:
- Vectors verify with existing canonical-json.ts
- ADR + security review notes
- Existing /v1 wire unchanged
Notes: Spec + vectors only.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 17. GF-D02-01 — Synapse

- **Base:** modula-latest main
- **Scope:** Global principal + signed home-node delegation models with adversarial test vectors (package proposal packages/greenfield-identity), no runtime identity cutover.
- **Acceptance tests:**
  - Rotation, revocation, takeover vectors reject
  - Keys separated: node vs identity-delegation vs publisher release vs settlement
- **Notes / dependency:** No migrations touching existing PKs.

**Ready-to-paste prompt:**

```text
MISSION GF-D02-01 (owner Synapse), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-d02-01 (one branch, one PR, title "GF-D02-01: <summary>").
Scope: Global principal + signed home-node delegation models with adversarial test vectors (package proposal packages/greenfield-identity), no runtime identity cutover.
Acceptance:
- Rotation, revocation, takeover vectors reject
- Keys separated: node vs identity-delegation vs publisher release vs settlement
Notes: No migrations touching existing PKs.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 18. GF-D03-01 — Forge

- **Base:** modula-latest main
- **Scope:** Signed federation outbox proof on a disposable DB reusing outbox_events (001_init_schema.sql:182): atomic commit, sequence, canonical signature, idempotent replay.
- **Acceptance tests:**
  - Test proves no silent writes; replay idempotent
  - If a migration is required it takes the next free number after the signer restage (092 if 091 is taken)
- **Notes / dependency:** Verify existing outbox semantics before any new table.

**Ready-to-paste prompt:**

```text
MISSION GF-D03-01 (owner Forge), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-d03-01 (one branch, one PR, title "GF-D03-01: <summary>").
Scope: Signed federation outbox proof on a disposable DB reusing outbox_events (001_init_schema.sql:182): atomic commit, sequence, canonical signature, idempotent replay.
Acceptance:
- Test proves no silent writes; replay idempotent
- If a migration is required it takes the next free number after the signer restage (092 if 091 is taken)
Notes: Verify existing outbox semantics before any new table.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 19. GF-D04-01 — Mosaic

- **Base:** modula-latest main
- **Scope:** Second isolated, independently keyed GreenField node bootstrap (docs + CLI script) with distinct Postgres/media and signed discovery manifest; no production peers.
- **Acceptance tests:**
  - Two nodes start locally with separate DB/media
  - Signed node manifest verifies with D01 vectors
- **Notes / dependency:** Depends on GF-D01-01.

**Ready-to-paste prompt:**

```text
MISSION GF-D04-01 (owner Mosaic), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-d04-01 (one branch, one PR, title "GF-D04-01: <summary>").
Scope: Second isolated, independently keyed GreenField node bootstrap (docs + CLI script) with distinct Postgres/media and signed discovery manifest; no production peers.
Acceptance:
- Two nodes start locally with separate DB/media
- Signed node manifest verifies with D01 vectors
Notes: Depends on GF-D01-01.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

## 20. GF-D05-01 — Forge (Synapse reviews)

- **Base:** modula-latest main
- **Scope:** Authenticated two-node event delivery prototype: inbox/outbox, retries, replay rejection, SSRF/loopback denial (reuse services/greenfield-api/src/security/ssrf.ts), quotas, dead letters.
- **Acceptance tests:**
  - Two-node outage/retry test
  - Replay and forged envelope rejected
  - SSRF to loopback/private ranges denied
- **Notes / dependency:** Depends on GF-D03-01 and GF-D04-01.

**Ready-to-paste prompt:**

```text
MISSION GF-D05-01 (owner Forge (Synapse reviews)), from GF-RECON-01 (a91d490e / native 5db0f027).
Base: modula-latest main. Branch: gf-d05-01 (one branch, one PR, title "GF-D05-01: <summary>").
Scope: Authenticated two-node event delivery prototype: inbox/outbox, retries, replay rejection, SSRF/loopback denial (reuse services/greenfield-api/src/security/ssrf.ts), quotas, dead letters.
Acceptance:
- Two-node outage/retry test
- Replay and forged envelope rejected
- SSRF to loopback/private ranges denied
Notes: Depends on GF-D03-01 and GF-D04-01.
Rules: never use Cursor cloud agents; one short branch off current main, one PR, do not merge; no production data, secrets, signing keys, payments, public flags, branch deletion or PR closure; tests use test.modula.* only. Start by fetching exact main and recording SHA + migration tip. Report PR URL, base/head SHA, changed files, migration number (if any), affected routes, test outputs (run vs skipped), blocks, security/rollback notes, and final status PASS / PARTIAL / BLOCKED with exact missing evidence.
```

