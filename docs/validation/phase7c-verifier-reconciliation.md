# Phase 7C Verifier Reconciliation

Status: IN PROGRESS
Date: 2026-07-26
Repository: `/home/andrei/modula-latest`
Branch: `phase7c-modula-product-realisation`
Commit reviewed: `1e9e7009fb7a648517594cfd4a1302100e971f8b`

## Purpose

Phase 7C-C requires every failing earlier verifier to be reviewed before merge. This document records which failures are real release blockers and which checks were superseded by later accepted architecture.

Phase 7D work has not started.

## Reconciled Verifiers

| Verifier | Current classification | Resolution |
| --- | --- | --- |
| `scripts/verify-phase4-5-native-ui.mjs` | Obsolete assumptions | Phase 4.5 expected the older root tab model with Board as a tab and Create excluded. Phase 7C Founder Alpha intentionally uses `home`, `discover`, `create`, `activity`, `profile` and rejects Board as a root tab in `scripts/verify-phase7c-founder-alpha.mjs`. The verifier now delegates to `scripts/verify-phase7c-product-shell.mjs` and `scripts/verify-phase7c-native-readiness.mjs` when Phase 7C reconciliation is present. |
| `scripts/verify-phase6-atproto-frontend.mjs` | Partially obsolete presentation checks | AT Protocol remains optional and gated. The verifier keeps OAuth, token-storage, publication and capability checks, but accepts the Phase 7C copy demotion from `Atmosphere Preview` to `External network preview` and no longer requires the optional preview to be primary Discover IA or Profile About content. |
| `scripts/verify-phase6-frontend-boundary.mjs` | Obsolete boundary check | This verifier protected the Phase 6 VPS backend branch from Mac-owned frontend/native edits. Later Phase 7A, 7B and 7C work intentionally changed frontend/native paths. The verifier now delegates to current Phase 7C product shell and native-readiness gates when Phase 7C reconciliation is present. |
| `scripts/verify-phase7a-frontend-boundary.mjs` | Obsolete boundary check | This verifier protected Phase 7A contract work from frontend/native edits. Phase 7B and 7C intentionally added module host and Founder Alpha product changes. The verifier now delegates to `scripts/verify-phase7b-module-host.mjs`, `scripts/verify-phase7c-product-shell.mjs` and `scripts/verify-phase7c-native-readiness.mjs`. |

## Remaining Release Blockers

| Verifier | Blocking reason |
| --- | --- |
| `scripts/verify-phase7c-release-candidate.mjs` | `docs/validation/phase7c-native-acceptance.md` remains `Status: BLOCKED` until physical iPhone, development build and TestFlight candidate evidence are recorded. |
| `scripts/verify-phase7c-founder-alpha.mjs` | Correctly blocked by release-candidate status and by any uncommitted working-tree changes during development. |
| `scripts/verify-phase7b-branch-consolidation.mjs` | Expected to fail before Phase 7C merge because `phase7c-modula-product-realisation` is still the active local and remote product branch. It should pass only after the PR is merged, the Phase 7C branch is deleted, and `main` is the sole active remote product branch. |

## Verification commands

```bash
node scripts/verify-phase4-5-native-ui.mjs
node scripts/verify-phase6-atproto-frontend.mjs
node scripts/verify-phase6-frontend-boundary.mjs
node scripts/verify-phase7a-frontend-boundary.mjs
node scripts/verify-phase7a-module-platform.mjs
node scripts/verify-phase7c-release-candidate.mjs
node scripts/verify-phase7c-founder-alpha.mjs
node scripts/verify-phase7b-branch-consolidation.mjs
```
