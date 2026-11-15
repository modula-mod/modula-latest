# GF-RECON-01 Delta vs Master Plan

> GF-RECON-01 — audit date 2026-11-13 (UTC). Read-only reconciliation.
> Backend `modula-mod/modula-latest` main `a91d490e61ebfff38069378ddf757429eb000449` · Native `modula-mod/modula-native` main `5db0f027dd29c6a877b04aa98e0b457ee2b82e2d` · Vault Notes `modula-mod/modula-vault-notes` main `15bf535785cb544fed40fb440499b7081fa89e93`.
> Live VPS revision, production migration ledger, worker image, feature flags and backup state: **UNKNOWN** (no read-only runtime access in this mission).
> Master plan `MODULA_GREENFIELD_MASTER_PLAN_2026.pdf` was **not available** to the auditor; comparison uses the 2026-11-13 founder audit document and the GreenField Experience Atlas v1.0. GreenField is **not** complete.

## Limitation

`MODULA_GREENFIELD_MASTER_PLAN_2026.pdf` (5 Nov 2026) was not on the audit box (searched /workspace, /home/box and agent stores). This delta is computed against (a) the founder's 2026-11-13 "Repository Completion & Implementation Audit" (inventory, D00–D17, M0–M9, S00–S09, L00–L19) and (b) `greenfield-experience-atlas-v1.0` (Parts I–XVI). Any master-plan item not restated in those documents is **UNVERIFIED** here.

## Founder audit inventory vs current source

| Area | Founder audit status | GF-RECON-01 status | Delta |
|---|---|---|---|
| Identity/sessions/MFA/passkeys/Apple | SOURCE PRESENT | SOURCE PRESENT | none |
| Social core | SOURCE PRESENT | SOURCE PRESENT | G020/G022(comments)/G023 still open in source |
| Messaging v3 | SOURCE PRESENT | SOURCE PRESENT | DB integration suite not executed in CI (RECON-N02) |
| Inbox UX (#295) | PR ONLY | PR ONLY | — |
| 1:1 calls backend | SOURCE PRESENT, OFF | INTENTIONALLY DISABLED (flag off) | calls integration not CI-executed |
| Native calls (#297) | PR ONLY | PR ONLY | adds unapproved SPM dependency stasel/WebRTC 156.0.0 |
| Group calls | NOT IMPLEMENTED | NOT FOUND | — |
| Stories/DM replies, Communities, Collections/drafts, Moliboo, Premium | SOURCE PRESENT | SOURCE PRESENT | native adoption of communities/collections/premium lives only in unmerged codex chain |
| Module install/publisher/MPS | SOURCE PRESENT | SOURCE PRESENT | artifact/presentation coverage runtime UNKNOWN |
| Online signing (#165) | PR ONLY / BLOCKED | PR ONLY (blocked) | confirmed mergeable=false/dirty; next free number 091 |
| Vault Notes | PARTIAL (#19 merged, #21 open) | SOURCE PRESENT; #21 likely superseded by merged #22 | needs Sentinel confirmation |
| AI routing, GAIA/Nodus/MAR | SOURCE PRESENT / PARTIAL | SOURCE PRESENT; Nodus route NOT FOUND | native calls a missing Nodus endpoint |
| Connectors webhooks | PARTIAL | SOURCE PRESENT (ingress NOT FOUND) | — |
| Media/backup | OPERATIONS DEBT | SOURCE PRESENT; off-host NOT FOUND in source | — |
| Push | SOURCE PRESENT | SOURCE PRESENT | — |
| Metrics/health | OPERATIONS DEBT | SOURCE PRESENT | stale 076 default; worker healthcheck missing |
| AT Protocol bridge | DISABLED BY DESIGN | INTENTIONALLY DISABLED | — |
| DIMON | CONTRACTS ONLY | INTENTIONALLY DISABLED | — |
| Node discovery/identity/federation/migration | NOT CERTIFIED | NOT FOUND (full-tree scan) | — |

## Distributed programme D00–D17

| Item | Found in source | Status |
|---|---|---|
| D00 Decentralisation Atlas | api-atlas DB map exists (static, prod-snapshot based); no authority/replication register | NOT FOUND |
| D01 Protocol spec | packages/greenfield-protocol (canonical-json, event-envelope, record-envelope, checkpoint, repository-export) — intra-server only; no docs/protocol | NOT FOUND (node/discovery/federation envelopes) |
| D02 Portable identity | no global principal/delegation | NOT FOUND |
| D03 Signed domain events | outbox_events table (001_init_schema.sql:182); no federation signing | NOT FOUND (federation layer) |
| D04 Node runtime/discovery | no bootstrap CLI/manifest | NOT FOUND |
| D05–D14 | none | NOT FOUND |
| D15–D17 DIMON | packages/dimon-contracts only | INTENTIONALLY DISABLED |

Proposed packages `greenfield-identity`, `greenfield-events`, `greenfield-federation`, `greenfield-node-sdk`, `tools/federation-conformance`, `tools/node-benchmark`, `docs/protocol`, `docs/threat-model`: none exist (proposals, not shipped code).

## Migration (M0–M9), capacity (S00–S09), launch (L00–L19)

- M0 (exact source/runtime snapshot + off-site backup + restore): source snapshot done here; runtime/backup **UNKNOWN**; off-site backup NOT FOUND in source.
- M1–M9: NOT FOUND.
- S00–S09: `tools/greenfield-closeout/mixed-load.mjs` and `database-chaos.mjs` exist (SOURCE PRESENT); no recorded staging baseline in this audit (UNVERIFIED).
- L00 source/runtime truth: source part = this mission; runtime part UNKNOWN. L01 native↔API contracts: path-level only (API-NATIVE-CONTRACTS.md). L02 backend consolidation: GreenField main clean except #165 + 3 merged-but-undeleted branches. L03 native consolidation: 19 open PRs. L17 simulator/device: native CI has no Xcode; UI tests INCOMPLETE. Federation and DIMON mainnet are not launch dependencies.

## GreenField Experience Atlas (Parts III–XI, XIV GF-UI-01–12)

No Part XI UI-facing services (CurrentNodeService, NodeDirectoryService, MigrationPlanningService, …) exist in native or backend, and no backend node/migration endpoints exist to bind them to. Per Part XI §4, screens may be built with clearly labelled, gated demo fixtures only; no fabricated migrations, trust or contribution states. Freezing Part XI contracts is a prerequisite for GF-UI-01–12.
