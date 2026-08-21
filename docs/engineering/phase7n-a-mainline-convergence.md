# Phase 7N-A mainline convergence

Recorded: 2026-08-21  
Product: `modula-mod/modula-latest`  
Working branch: `cursor/phase7n-a-mainline-ui-convergence-60f3`  
Working tree: `/Users/msjoy/Documents/Codex/2026-08-21/modula-phase-7n-a-mainline`  
Production modified: NO  
Database applied to production: NO

## Ancestry (determined first)

```
origin/main  fcca100137526ff44892ba1b2870238d11b78834
    └── ancestor of
origin/cursor/full-route-screenshots-99cd  d81d2c9
    └── ancestor of
origin/cursor/phase7m-b7-full-route-post-v2  9bde9e7
    └── ancestor of
origin/cursor/phase7m-b8-founder-mockup-reconstruction  ff6324f
    └── ancestor of
origin/cursor/phase7m-b9-product-hub-exact-reconstruction  5b0ccbed43df9db5298a731c5d07ef0434b86d8c
    └── + 1 preservation commit
origin/cursor/phase7m-b10-product-hub-founder-fidelity  d1a0b3a
```

`git rev-list --count 5b0ccbed..origin/main` = 0. Current GitHub `main` is an ancestor of B9. B9 already contains B7, B8, the full-route screenshot branch, and `main`. Convergence is therefore a fast-forward of `main` → B9 → B10. No conflict resolution occurred.

## Remote branch classification

GitHub `origin` heads after `git fetch --all --tags --prune` (including preservation refs created this phase):

| Ref | SHA | Classification | Reason |
| --- | --- | --- | --- |
| `origin/main` | `fcca100` | ALREADY_INTEGRATED | Current GitHub main; base of 7N-A. Does not yet contain B7–B10. |
| `origin/cursor/full-route-screenshots-99cd` | `d81d2c9` | SUPERSEDED | Ancestor of B9. Open PR #32 remains historical. Do not re-merge. |
| `origin/cursor/phase7m-b7-full-route-post-v2` | `9bde9e7` | SUPERSEDED | Ancestor of B9. |
| `origin/cursor/phase7m-b8-founder-mockup-reconstruction` | `ff6324f` | SUPERSEDED | Ancestor of B9. Open PR #33 remains historical. Do not reintroduce B8 over B9. |
| `origin/cursor/phase7m-b9-product-hub-exact-reconstruction` | `5b0ccbed` | MERGE_FULL | Validated Product Hub / Module Detail reconstruction. Fast-forwarded into 7N-A. |
| `origin/cursor/phase7m-b10-product-hub-founder-fidelity` | `d1a0b3a` | MERGE_FULL | Interrupted B10 engineering, preserved then fast-forwarded. |
| `origin/archive/pre-7n-a-b10-20260821` | `d1a0b3a` | ARCHIVE_ONLY | Identical SHA to B10 preservation commit. |

`vps-modula` refs (inspection only; production not modified):

| Ref | SHA | Classification | Reason |
| --- | --- | --- | --- |
| `vps-modula/main` | `03123d2` | ARCHIVE_ONLY | Production-tracking ref, older than GitHub `main`. |
| `vps-modula/cursor/phase7m-b7-full-route-post-v2` | `9bde9e7` | SUPERSEDED | Same as GitHub B7. |
| `vps-modula/cursor/phase7l-b-beta-remediation-b75e` | `4cd3d2a` | SUPERSEDED | Merged historically (PR #17). |
| `vps-modula/phase7j-product-convergence` | `2ef3755` | SUPERSEDED | Merged historically (PR #14). |
| `vps-modula/phase7i-trusted-production-alpha` | `7632e03` | SUPERSEDED | Historical trusted alpha. |

VPS product checkout `/root/modula-latest` is detached at `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a`. That SHA is **not** GitHub `main` and was **not** modified.

UNKNOWN remaining: **0**.

Counts at classification time (GitHub product heads + VPS product heads + one archive preservation ref):

| Class | Count |
| --- | --- |
| MERGE_FULL | 2 |
| CHERRY_PICK_VALID | 0 |
| ALREADY_INTEGRATED | 1 |
| SUPERSEDED | 7 |
| ARCHIVE_ONLY | 2 |
| ABANDON_INVALID | 0 |
| NEEDS_INVESTIGATION | 0 |
| UNKNOWN | 0 |

## Convergence order actually used

1. Current `origin/main` (`fcca100`).
2. Valid surviving B9 (`5b0ccbed`) via `git merge --ff-only`.
3. Preserved interrupted B10 (`d1a0b3a`) via `git merge --ff-only`.
4. 7N-A audit docs, verifier, and (after gates) visual baseline artefacts.

No commits were duplicated. Cherry-picks were unnecessary because every surviving commit is already on the B9/B10 line.

## Conflict policy

No conflicts. If conflicts had appeared, the rule would have been: prefer newer verified module architecture and accepted component architecture over “ours/theirs” blindly. B8 UI is superseded by B9 and would not have been restored.

## Interrupted B10 recovery

Described by the previous agent as: clean B10 worktree created from B9 at `5b0ccbed`.

| Field | Truth |
| --- | --- |
| PATH | `/Users/msjoy/Documents/Codex/2026-08-21/modula-phase-7m-b10-product-hub` |
| BRANCH | `cursor/phase7m-b10-product-hub-founder-fidelity` |
| HEAD at discovery | `5b0ccbed` (zero commits after B9) |
| DIRTY STATE | 27 modified + 6 untracked files |
| COMMITS AFTER `5b0ccbed` at discovery | none |
| Preservation commit | `d1a0b3a386de4d82f56090379c56a0155418af94` |

Interactive Simulator inspection was never completed (Mac display locked). That does **not** discard the engineering.

## B10 change inventory

| Item | Present? | Classification | Notes |
| --- | --- | --- | --- |
| `expo-local-authentication` correction | YES | KEEP | `16.0.5` → `~57.0.2`; lockfile + Podfile.lock refreshed. Isolated; no broad Expo upgrade. |
| Marketplace metadata additions | YES | KEEP | Registry contracts + Vault Notes `extensions.marketplace`. |
| Ratings aggregate/write model | YES | KEEP | `GreenfieldModuleMarketplaceService`, authenticated `POST /v1/registry/modules/:moduleId/rating`. |
| Registry detail marketplace projection | YES | KEEP | Detail payload projects publisher declarations + live aggregates. Unknown values render as `—` / `Not declared`. |
| Product detail density/type changes | YES | KEEP | Compact strips, product typography roles. Visual approval still required; this is baseline engineering, not a 7N-A redesign. |
| Native segmented adapter usage | YES | KEEP | `ModulaSegmentedPicker` in `ProductTabs`. |
| Reviews tab | YES | KEEP | Tab exists; `ProductRatingPanel` is numeric ratings. Written reviews explicitly “not available yet” — not faked. |
| Vault Notes manifest metadata | YES | KEEP | In `modula-mod/modula-vault-notes` preservation commit `b439d89`. |
| 12 declared Vault views | YES | KEEP | `availableViewIds` lists the twelve canonical view IDs. |
| Release provenance files | YES | KEEP | `release/vault-notes-v1.1.0.provenance.json`. |
| External Vault Notes release asset | YES | KEEP | Local tarball SHA-256 matches GitHub release asset. Tag `vault-notes-v1.1.0` commit `f443972`. No 1.2.0. |
| Migration changes | YES | KEEP | `038_phase7m_b10_module_marketplace.sql` + `.down.sql`. Ordering after 037. Not applied to production. |
| Backend rating tests | YES | KEEP | `phase7e.vault-notes-platform.test.ts` asserts null aggregate then 5+3 → average 4 / count 2. |
| B10 verifier | YES | KEEP | `scripts/verify-phase7m-b10.mjs`. |
| Evidence / Simulator screenshots | NO | INCOMPLETE | Capture blocked by locked display. 7N-A must recapture from fresh main after convergence. |

DROP was not used for any B10 engineering item. Incomplete visual evidence is replaced by a new 7N-A baseline, not by old B2/B4/B5/B7/B9 shots.

## Database change rule

B10 **did** add product-source migration 038:

- UP: `greenfield_module_ratings` + `schema_version = 038`
- DOWN: drop table + `schema_version = 037`
- Existing API tests extended; new rating assertions present
- Must be proven on **disposable** Postgres before claiming the ratings contract PASS
- Must **not** be applied to production in 7N-A

## Vault Notes release provenance (reverified)

| Field | Value |
| --- | --- |
| Repository | `modula-mod/modula-vault-notes` |
| Module | `digital.modula.vault-notes` |
| Release | `1.1.0` |
| Tag | `vault-notes-v1.1.0` |
| Tag commit | `f443972d53f94b6f192a37bcce8742bdf18a99b5` |
| Artifact | `modula-vault-notes-1.1.0.tgz` (26,458 bytes) |
| Checksum | `46f918b07dc7d9c2734be4e6bb7729c137d316ceaa3f9d272da1bd7f78ad253a` |
| Published | `2026-08-01T16:34:15Z` |
| Canonical ID commit on `origin/main` | `d92e4455cd56f95b0109e3dc8f1df0c8a52c60da` |
| Provenance preservation commit | `b439d89be7466c338310c9c31283ccec4e898786` |

GitHub release asset byte-compared equal to the local copy. VPS clone `/root/modula-mod/modula-vault-notes` is still on `4f2c3c9` (`phase7i-trusted-production-alpha`) and was not modified.

Production registry still historically served `0.2.0` at the B10 audit; 7N-A does not deploy, so that production version remains a distinct environment fact.

## Expo dependency correction

Isolated B10 change only:

```
- expo-local-authentication: ~16.0.5
+ expo-local-authentication: ~57.0.2
```

Tracked `ios/` and `android/` remain first-class. Expo Doctor’s tracked-native-folder/CNG warning is expected (`docs/architecture/native-project-policy.md`) and is not a reason to prebuild `--clean`.

## Native codesign workaround (ExpoModulesJSI xattr)

iPhone 17 Pro Debug builds from a worktree under `~/Documents/Codex` fail at:

```
expo-modules-jsi/.../PackageFrameworks/ExpoModulesJSI.framework:
resource fork, Finder information, or similar detritus not allowed
```

Diagnosis: iCloud File Provider writes `com.apple.FinderInfo` and `com.apple.fileprovider.fpfs#P` onto the Expo-generated framework. This is not a project signing-architecture defect. `xattr -cr` on the framework is immediately overwritten while the tree remains under Documents.

Workaround used: perform native builds from a second worktree outside iCloud,

`/Users/msjoy/Developer/modula-7n-a-native`

same branch SHA. Only the generated framework metadata is avoided; codesign is not globally disabled; `ios/` / `android/` are not deleted.

## Skills loaded this phase

Canonical UI skill remains Phase 7M:

- Binding: `.cursor/skills/phase7m/SKILL.md`
- Canonical body: `docs/agent-skills/phase7m/SKILL.md` plus companions (reference-policy, component-implementation, screen-composition, accessibility, visual-verification)

No newer UI skill superseded 7M. 7N-A does **not** authorise a broad redesign; it converges surviving work and captures the current UI.

Expo skills loaded (SDK 55 examples — **not** copied): `building-native-ui`, `expo-ui-swift-ui`, `expo-ui-jetpack-compose`, `native-data-fetching`. Installed product is Expo SDK 57 (`expo ~57.0.15`, RN `0.86.2`, `@expo/ui ~57.0.12`). Adapters stay in `src/platform/ui`.

Also loaded: `modula-architecture`, `modula-dependencies`, `modula-ui`, `animate-expo`.

## Open PRs superseded by this convergence

- PR #32 `cursor/full-route-screenshots-99cd` — ancestor of B9
- PR #33 `cursor/phase7m-b8-founder-mockup-reconstruction` — ancestor of B9

They must not be merged on top of 7N-A. Close them after 7N-A lands on `main`.

## Local catalogue repair (truthful Module Detail)

`ApiModuleRepository` `LOCAL_CATALOGUE` previously listed only Tasks (coming soon) and DIMON Core. With `EXPO_PUBLIC_DATA_SOURCE=local` the registry request fails closed into that list, so `/marketplace/digital.modula.vault-notes` rendered “This product isn’t available right now.”

7N-A added canonical Vault Notes 1.1.0 as the featured local catalogue item so Module Detail evidence is the **actual product UI**, not an empty state. This is a data fallback repair, not a visual redesign. Local `/install-preview` still has no fallback; the install sheet surfaces `Alert.alert` “Vault Notes couldn’t be prepared” — isolated, not judged as layout.

## Visual baseline capture (2026-08-21)

| Gate | Result |
| --- | --- |
| iPhone 17 Pro Debug build | PASS (`/tmp/modula-7na-native-derived`) |
| iPhone 17 Pro Release build | PASS (same derived-data tree) |
| iOS interactive (taps/swipes) | BLOCKED_MAC_LOCKED (`CGSSessionScreenIsLocked=Yes`) |
| Core-7 light native stills | CAPTURED via `simctl openurl` |
| OLED / Dim / Surface Types on Core-3 | NOT DISTINCTLY CAPTURED |
| Motion clips | 0 |
| Fresh clone `modula-main-ui-baseline` | NOT CREATED (`origin/main` still `fcca100` until PR #34 merges) |
| Production modified | NO |

Evidence: `modula-mod/modula-evidence-screenshots` `phase-7n/a/`.

## What 7N-A is not

- Not a Product Hub / Profile / Post redesign
- Not a production deploy
- Not a production migration
- Not founder visual approval
