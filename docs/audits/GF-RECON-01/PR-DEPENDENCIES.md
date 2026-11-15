# GF-RECON-01 PR Dependencies and Ancestry

> GF-RECON-01 — audit date 2026-11-13 (UTC). Read-only reconciliation.
> Backend `modula-mod/modula-latest` main `a91d490e61ebfff38069378ddf757429eb000449` · Native `modula-mod/modula-native` main `5db0f027dd29c6a877b04aa98e0b457ee2b82e2d` · Vault Notes `modula-mod/modula-vault-notes` main `15bf535785cb544fed40fb440499b7081fa89e93`.
> Live VPS revision, production migration ledger, worker image, feature flags and backup state: **UNKNOWN** (no read-only runtime access in this mission).
> Master plan `MODULA_GREENFIELD_MASTER_PLAN_2026.pdf` was **not available** to the auditor; comparison uses the 2026-11-13 founder audit document and the GreenField Experience Atlas v1.0. GreenField is **not** complete.

## modula-latest

| PR | Head | Base (recorded) | State | Mergeable | CI | Notes |
|---|---|---|---|---|---|---|
| #165 GREENFIELD-SIGNER-02 | 1bfdde97c2d51f410c03e1cbf2665ad38d564a97 | main @ 0840c736 (stale; main now a91d490e, 20 commits behind) | open | **false / dirty / rebaseable=false** | atlas, migration-validation, repository-validation success on 1bfdde97 against OLD base only (run 42912880580) | 44 files, +3203/−207. Trial merge onto a91d490e: 14 conflicts — 12 in docs/audits/api-atlas-01/* (generated), tests/api-fix-01.migration.test.ts, tests/greenfield-backend-v1.migration-ledger-security.test.ts. Migration collision 089. **Not altered by this mission.** |

### Migration numbering

- Main up-migrations: 001…090, one file per number (no duplicate prefixes on main); tip `090_calls_v1` (+ `.down.sql`).
- Scanned every fetched ref (branches + all 168 PR refs): only `phase/greenfield-signer-01` (#165) adds a migration above 088, and it uses 089. No ref claims 091+.
- Registries/validators that pin the tip: `services/greenfield-api/tests/api-fix-01.migration.test.ts:126,143,168,394,424`, `services/greenfield-api/tests/greenfield-backend-v1.migration-ledger-security.test.ts:119`, `docs/ops/calls-coturn.md:99`, `ops/docker/compose.production.yml` (stale default 076), `MODULA_EXPECTED_MIGRATION` (env.ts:37, health.ts:17).
- **Next free migration number: 091** → `091_greenfield_online_signing_authority.sql` for the signer restage. Any later migration (e.g. GF-D03) takes 092.

### Remote branches

`main`, `phase/greenfield-signer-01` (#165, unmerged), and three branches already merged into main: `andy/calls-1`, `andy/messaging-backend-1`, `fix/api-dockerfile-intelligence-core`.

## modula-native (19 open PRs)

Computed locally on a fresh clone with `refs/pull/*`; cross-check with GitHub compare is recommended before any closure. `cherry+` = commits with no patch-equivalent on main. `differ` = files the branch touched that still differ from main.

| PR | Head | Base ref | Base SHA ancestor of head? | Merge-base with main | Ahead / behind main | Own commits vs base | cherry+ | Files touched / still differ | Trial merge into main | Draft |
|---|---|---|---|---|---|---|---|---|---|---|
| #77 Harden generic Product UI reading, editing, and re | 95bfc6b75ff0 | main | yes | 4f20d360 | 8 / 555 | 10 | 7 | 16 / 16 | CONFLICTS(4) | True |
| #113 Tests: align shell chrome tests with Activity/Prof | cae757832285 | main | NO (stale base) | cc2e1225 | 1 / 492 | 1 | 1 | 5 / 5 | CONFLICTS(3) | False |
| #262 feat(native): integrate signed Moliboo package lif | b82aedf64a68 | main | yes | e50fc391 | 2 / 24 | 2 | 2 | 9 / 9 | clean | True |
| #263 feat(native): connect conversations and story repl | f7c102d81756 | codex/native-reality-01-package-lifecycle | yes | e50fc391 | 3 / 24 | 1 | 3 | 16 / 16 | clean | True |
| #264 NATIVE-03: adopt persisted GreenField Communities | e79aa2da5643 | codex/native-reality-02-conversations-story-reply | yes | e50fc391 | 4 / 24 | 1 | 4 | 23 / 23 | clean | True |
| #265 NATIVE-04: sync Collections and Drafts with GreenF | 6669fafb7f19 | codex/native-reality-03-community-api | yes | e50fc391 | 5 / 24 | 1 | 5 | 32 / 32 | clean | True |
| #266 NATIVE-05: install signed content-only modules | ebba415b7285 | codex/native-reality-04-collections-drafts-sync | yes | e50fc391 | 6 / 24 | 1 | 6 | 39 / 39 | clean | True |
| #267 NATIVE-06: integrate Premium StoreKit sandbox flow | aae0823e3a93 | codex/native-reality-05-vault-notes-module-runtime | yes | e50fc391 | 7 / 24 | 1 | 7 | 45 / 45 | clean | True |
| #268 NATIVE-07: lock package media dispatch and GUBIC r | 8d58814cf605 | codex/native-reality-06-premium-storekit-sandbox | yes | e50fc391 | 8 / 24 | 1 | 8 | 47 / 47 | clean | True |
| #269 NATIVE-08: record pinned integrated acceptance and | f722c755a754 | codex/native-reality-07-package-gubic-regression | yes | e50fc391 | 11 / 24 | 3 | 11 | 49 / 49 | clean | True |
| #270 CLOUD-IOS-ACCEPTANCE-01: hosted simulator acceptan | a571310d0e72 | codex/native-reality-08-integrated-acceptance | yes | e50fc391 | 45 / 24 | 34 | 37 | 56 / 56 | clean | True |
| #273 diag(keychain): log operation and OSStatus on secu | d89490af0e15 | codex/cloud-ios-acceptance-01 | NO (stale base) | e50fc391 | 24 / 24 | 1 | 23 | 54 / 54 | clean | False |
| #280 diagnostic: test-only scheme for one local StoreKi | c46cef5f2f73 | codex/cloud-ios-acceptance-01 | yes | e50fc391 | 45 / 24 | 4 | 38 | 56 / 56 | clean | True |
| #293 UI fixes 2: comments composer, send button, Molibo | 77be681d9597 | main | NO (stale base) | 6b15c12d | 1 / 14 | 1 | 1 | 9 / 9 | clean | False |
| #294 Sidebar 2: ChatGPT-style density, inline search, r | c04b9f356567 | andy/ui-fixes-2 | yes | 6b15c12d | 5 / 14 | 4 | 5 | 12 / 12 | clean | False |
| #295 Messaging UI batch: Page features | 8805174a4320 | andy/sidebar-2 | yes | 6b15c12d | 12 / 14 | 7 | 12 | 18 / 18 | clean | True |
| #296 Messaging v3 native wiring | 72c0a3680d99 | andy/messaging-ui-1 | yes | 6b15c12d | 18 / 14 | 6 | 18 | 25 / 25 | clean | True |
| #297 1:1 voice and video calls | c379ee219d1e | andy/messaging-ui-2 | yes | 6b15c12d | 27 / 14 | 9 | 27 | 38 / 38 | clean | True |
| #298 Enhancements 3: speed rounds + features (draft) | 4ea4841d0092 | andy/calls-1 | yes | 6b15c12d | 46 / 14 | 19 | 46 | 63 / 63 | clean | True |

### Active chain #293 → #298

`#293 (base main) → #294 → #295 → #296 → #297 → #298`. Every PR's diff is cumulative: #298 is 46 commits ahead of main and carries everything below it. #293's recorded base SHA (5db0f027) is not its ancestor — it was branched from #289's head 6b15c12d, which is now merged; the trial merge onto main is clean. Certify cumulative ancestry, then restage as single branches off main (GF-MSG-02, GF-CALL-03). Do not merge chained branches blindly.

### #298 rounds 15–16

The PR body says rounds 15 (`4e6c891d`) and 16 (`6648483d`) are "committed locally on the Mac … not pushed yet". On 2026-11-13 neither object exists in a fresh clone that includes all 30 branch heads and all `refs/pull/*`; #298 head is `4ea4841d` (round 14). **Status: NOT PUSHED — GitHub cannot audit them.** Do not close/supersede #298 until the Mac push state is checked.

### Codex / cursor chain #262–#270, #273, #280

All eleven heads contain commits with no patch-equivalent on main (`cherry+` 2–38) and every touched file still differs from main; all trial-merge cleanly onto main. They are based on e50fc391 (24 commits behind main). **They contain unique code not on main.** Do not delete: preserve `archive/<branch>` tags with head SHA and recorded results first, and only close with owner approval. Themes per PR title: signed Moliboo package lifecycle (#262), conversations/story reply (#263), communities (#264), collections/drafts sync (#265), Vault Notes module runtime (#266), Premium StoreKit sandbox (#267), package/GUBIC regression (#268), integrated acceptance (#269), hosted simulator acceptance (#270), keychain diagnostic (#273, stale base), StoreKit test scheme (#280).

### #113 and #77

- #113 `fix/shell-chrome-tests`: 1 unique commit, 492 behind main, 3 conflicting files on trial merge. Needs independent rebase + test, or archive tag + close (owner approval).
- #77 `phase/product-ui-polish-01`: 7 unique commits, 555 behind main, 4 conflicting files. Overlaps Vault Notes host gaps (GF-VAULT-01); needs independent disposition.

## modula-vault-notes

| PR | Head | State | Mergeable | Notes |
|---|---|---|---|---|
| #19 | 86cd5652 | **merged** (ancestor of main) | — | Do not treat as open. |
| #22 | caa039ce | merged | — | Integrated 2.1.0-rc.4, "26 rendered and reachable routes". |
| #21 | cad02d2e | open | **false / dirty** | 28 conflicting files vs main 15bf5357; version 2.0.3 < main 2.1.0-rc.4; its reachability test/LibraryNav/ReturnHome now exist on main (add/add conflicts). **Likely superseded by #22 — needs Sentinel diff confirmation before any closure.** Host gaps it lists (navigation metadata, filterParam, settings writes, function calls) remain open → GF-VAULT-01. |

## CI evidence (GitHub check runs)

- modula-latest a91d490e: atlas ✅, migration-validation ✅, repository-validation ✅ (run 42937914326, 2026-11-11 01:18–01:24 UTC).
- modula-latest #165 head 1bfdde97: same three ✅ — against stale base only.
- modula-native 5db0f027: boundary-and-runtime ✅ (run 43412276140, 2026-11-13 10:51 UTC) — Ubuntu only, no Xcode.
- modula-vault-notes 15bf5357: vault-notes ✅ (run 42798470320).
