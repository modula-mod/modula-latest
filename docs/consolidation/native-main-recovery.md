# MODULA Native main recovery and consolidation inventory

Mission: `VPS-CONSOLIDATION-01`

Snapshot time: 2026-10-25

Evidence source: GitHub remote refs, GitHub PR metadata/checks, and the read-only Linux reference checkout.

Reference checkout: `/root/modula-worktrees/modula-native-vps-reference`

Remote: `modula-mod/modula-native`

## Recovery boundary

The latest pushed Native `origin/main` and reference checkout are both:

`be679c8672a9cb0a857087e3e90ab7df644b1899`

The checkout is clean. No Native branch, tag, commit, or file was changed or deleted on the VPS. The VPS can establish facts about pushed commits, branches, PRs, CI, and published source only. It cannot recover uncommitted Mac files, Mac-local refs, commits never pushed to GitHub, or Mac-only screenshots. Any such work remains unavailable until the Mac returns and is explicitly classified as Mac-only below.

## Recent Native PRs

All check results in this table are the GitHub `Native boundaries / boundary-and-runtime` check observed on 2026-10-25.

| Feature | Repository | Remote branch | PR | Feature commit | Current main | Already merged? | Missing dependencies | CI state | Linux-testable? | Requires Xcode? | Requires physical iPhone? | Recommended next action |
|---|---|---|---:|---|---|---|---|---|---|---|---|---|
| Compact Moliboo picker in comments | `modula-native` | `fix/composer-moliboo-picker-compact` | #207 | `f1e08135282ccfc52311b909d57f9dc52b6ac1d0` | `be679c8672a9cb0a857087e3e90ab7df644b1899` | Yes; merge `98d6b1063e9cff53c6553f5b34ab973fa5759bba` | None known | PASS | Source checks only | Yes for UI acceptance | Yes for final interaction/layout | Keep on main; branch is a later cleanup candidate after Mac reconciliation. |
| Feed-sheet redesign | `modula-native` | `fix/feed-sheets-modula-glass` | #208 | `00e5ae5d11800cc31b3b54cc5ba6116009479032` | same | Yes; merge `3e48cc4b9461fb13b920d63051e15e1bb88c55ee` | None known | PASS | Source checks only | Yes | Yes for appearance/touch | Keep on main; branch is a later cleanup candidate. |
| Profile Message opens 1:1 chat | `modula-native` | `fix/profile-message-opens-chat` | #209 | `26a14a1ce4b14fc0f04701bfcae88aafd8d20d39` | same | Yes; merge is current main | Backend `/v1/conversations` behavior was revalidated by this mission | PASS | Source checks and backend API | Yes | Yes for navigation/deep-link acceptance | Accepted in main. |
| New Message recipient picker | `modula-native` | `fix/new-message-picker` | #210 | `41fb92843b543ef6111a0782cc8f69dda202417a` | same | No | Reconcile overlap with #206 and test recipient filtering/block rules | PASS; PR CLEAN | Source checks only | Yes | Yes | Rebase on current main, compare #206 behavior, then simulator and device test before merge. |
| Moliboo Home family tabs/activity tiles | `modula-native` | `fix/moliboo-home-tabs-tiles` | #211 | `0f75692f2f63f257c7b668873d07bbda9c462ba6` | same | No | Existing merged Moliboo 2D/asset work | PASS; PR CLEAN | Source checks only | Yes | Yes | Run Moliboo family/wardrobe persistence and layout tests on Mac, then merge. |
| Comment quick emoji row | `modula-native` | `feat/comments-quick-emoji` | #212 | `5cd3e74db157f0c5300130ce42d1e8442fdd3766` | same | No | Existing comment reaction endpoint | PASS; PR CLEAN | Source checks and backend contract | Yes | Yes | Verify tap, accessibility, keyboard, optimistic/error behavior, then merge. |
| Share sheet to a new 1:1 chat | `modula-native` | `feat/share-message-direct` | #213 | `c4cc7f3f5b9c94c0772e6a178a7ec6a3a9ae982f` | same | No | #210 behavior and existing conversation create/idempotency contract | PASS; PR CLEAN | Source checks and backend contract | Yes | Yes | Land #210 first if its shared picker behavior is required; test first-contact share on simulator/device. |
| Earlier new-chat/request-card stack | `modula-native` | `ui/messages-new-chat-v2` | #206 | `691deb9d769562ee5bc0770b4a800e24a62f5230` | same | No | Reported as stacked on #199; overlap with #210 must be resolved | PASS; PR CLEAN | Source checks only | Yes | Yes | Compare commit ranges and UX contracts with #210; do not merge both blindly. |

The offline-agent report that #210-#213 were “awaiting tests” is consistent with GitHub showing passing source/boundary CI but no Xcode, simulator, or physical-device acceptance. GitHub now proves #207-#209 are merged; that part is no longer report-only.

## Premium, Verification, and branding source

| Feature | Repository | Remote branch | PR | Feature commit | Current main | Already merged? | Missing dependencies | CI state | Linux-testable? | Requires Xcode? | Requires physical iPhone? | Recommended next action |
|---|---|---|---:|---|---|---|---|---|---|---|---|---|
| Premium Hub, tier comparison, upgrade/welcome, first-week checklist, membership/cancellation UI, Premium badge surfaces | `modula-native` | `premium/hub-and-tiers` | None | `5c020488e9a04eb25b08ae4378a3f87e969c674a` | `be679c8672a9cb0a857087e3e90ab7df644b1899` | No; branch is one commit ahead and diverged from main | Rebase, adopt the authoritative GreenField DTOs, keep purchase disabled, replace provisional UI constants when product approval exists | No branch PR/remote CI found; Linux boundary and generated-contract checks PASS in detached source check | Yes, source-only | Yes | Yes | Preserve branch. Rebase on Mac, integrate backend optional fields, and test with purchase controls disabled. |
| Authoritative Verification marks | `modula-native` | No pushed dedicated branch found | None | Not available on VPS | same | No evidence of a pushed implementation | GreenField canonical `publicIdentity.verification` decoder and UI mapping | No pushed CI evidence | No source available | Yes | Yes | Recover/push Mac work; do not reconstruct it from the VPS. |
| Modula Unit icon/mark and QR branding | `modula-native` | No pushed dedicated branch found | None | Not available on VPS | same | No evidence of pushed source | Premium mark mapping and final brand assets | No pushed CI evidence | No source available | Yes | Yes | Recover/push Mac assets and source. GreenField emits `modula_unit` as data, not artwork. |

The pushed Premium branch is disabled UI/source only. It contains provisional prices and limits and no verified billing implementation. This mission therefore does not treat those constants as an approved product contract. The original Premium concept outside pushed Git history is unavailable on the VPS.

## Older platform workstreams

| Feature | Repository | Remote branch | PR | Feature commit | Current main | Already merged? | Missing dependencies | CI state | Linux-testable? | Requires Xcode? | Requires physical iPhone? | Recommended next action |
|---|---|---|---:|---|---|---|---|---|---|---|---|---|
| Native Product UI | `modula-native` | `phase/product-ui-polish-01` | #77 draft | `95bfc6b75ff0b6588dd05365f96bd6d06f9fa235` | `be679c…` | No | Conflict resolution against current main; product contract compatibility | No current checks; GitHub reports DIRTY | Partly | Yes | Yes | Preserve. Rebase and review on Mac; do not merge from the VPS. |
| GameHost | `modula-native` | `feature/game-platform-02` | #99 draft | `163fd7b6012423fc9c51514d19293baeb9d3fd9b` | `be679c…` | No | Package contract stack described below | PASS; CLEAN | Partly | Yes | Yes | Keep as the Native base of the package stack; merge only after producer/backend contracts. |
| PackageManager/on-demand packages | `modula-native` | `codex/on-demand-packages-02` | #168 draft | `9cbfa13440922bad14411de43ccfb982971650a9` | `be679c…` | No; stacked on #99 | Product Standard #9, Module Generator #5, Game Lab #2, GreenField #137, then #99 | PASS; CLEAN | Partly | Yes | Yes | Preserve stacked base and merge only in dependency order. |
| Nodus released foundation | `modula-native` | `nodus-release` | historical | `8f5ab068cac0eb7520c95dea785963872dc9644c` | `be679c…` | Yes; ancestry is in main | No VPS inference; R7/R8 release decision remains separate | Historical merged source | Contract/source only | Yes for runtime | Yes | Keep local-only privacy invariant; no server or Premium dependency. |
| Nodus R7/R8 | `modula-native` | No R8 remote branch found; R7 experimental data remains non-shipping | historical | No independent R8 tip available | `be679c…` | No shippable R8 evidence | Model/provider/device compatibility and founder release approval | Not available | Metadata only | Yes | Yes | Recover Mac state. Do not download models or run inference on the VPS. |
| Moliboo 2D platform and asset-pack hooks | `modula-native` | `mol03/*`, `moliboos/*`, and merged feature/UI branches | historical | Representative merged tips: `1522cc454634dc73f1ed2d08738a6f286ac75c51`, `745afd3fcd17ae0a4ea5f3924ce60c1234b4a3b1` | `be679c…` | Yes for the listed historical branches; #211 remains open | #211 device validation; preserve ownership/outfits through downgrade | Historical branches merged; #211 CI PASS | Contract/source only | Yes | Yes | Keep 2D only. Merge #211 after persistence/layout acceptance; do not recreate package infrastructure. |
| Vault Notes compatibility | `modula-native` | `cursor/notes-account-records-ac33` | None found | `4f20d36031a26324e9bc5e3ff53dc14e4f10f70d` | `be679c…` | Unknown | Determine ownership and relationship to current Vault 1.8/2.0 work | No PR evidence found | Partly | Yes | Yes | Classify as unknown and preserve until Mac/owner confirms. |
| Shell chrome fixes | `modula-native` | `fix/shell-chrome-tests` | No open PR found | `cae757832285afd782393a661daf7b6f1c6f6257` | `be679c…` | No | Mac test reconciliation including AppLock expectations | No PR evidence found | Source only | Yes | Yes | Preserve, compare against current main, and open/update a PR from Mac if still needed. |

## Package-system dependency map

This is a stacked contract flow, not a set of independent cherry-picks:

1. `modula-product-standard` draft PR #9, `b137df2a4e2eaf8549db8dc06745a93b6c23b00a` — optional package and shared-runtime contract.
2. `modula-module-generator` draft PR #5, `858a8d104c8b0a294e37f4451b141e8983251a79` — generated games consume the contract.
3. `modula-game-lab` draft PR #2, `a94b1415d9e7df1f4ffd2d24d29ddb88f10525d7` — produces separate runtime/content archives.
4. GreenField draft PR #137, `ca43b2f311151d60c267521e54011dd10b12eb04` — resolves signed dependency closures and install plans.
5. Native draft PR #99, `163fd7b6012423fc9c51514d19293baeb9d3fd9b` — verified GameHost consumer.
6. Native draft PR #168, `9cbfa13440922bad14411de43ccfb982971650a9` — PackageManager UI/runtime, explicitly based on #99.

All six remote checks currently pass and the PRs are clean, but all are draft. GreenField #137 also currently owns an unrelated migration numbered `076`; it must be rebased and renumbered after this mission's accepted migration lands. No package-stack PR was merged by this mission.

The inspected package contracts cover signed release artifacts, compatible package descriptors, shared runtime ownership, dependency closure, and revocation. Nodus model-data and Moliboo asset packs must use those generic contracts; Premium must not duplicate package resolution or revoke already-owned Moliboo content.

## AppLock handoff

The pushed source policy in `AppLockController` (introduced by commit `c0f1c68c…` on 2026-10-22) is:

| Failed attempts | Delay |
|---:|---:|
| 0-4 | 0 seconds |
| 5 | 30 seconds |
| 6 | 60 seconds |
| 7 | 300 seconds |
| 8 | 900 seconds |
| 9 or more | 3600 seconds |

`AppLockTests.testAttemptDelay` still expects 5 seconds at attempt 6 and 60 seconds at attempt 12. The source and test are inconsistent. The stronger source behavior is intentional-looking and there is no evidence of a security regression; the test should be updated to expect 60 and 3600 seconds, with boundary assertions for attempts 4-9. Do not reduce the production delays merely to satisfy the stale test. Final confirmation and execution require Xcode on the Mac.

## Dependency-safe Native merge plan

1. On the returned Mac, fetch GitHub and first preserve every local-only ref and dirty file before rebasing anything.
2. Reconcile #206 with #210; choose or compose one new-chat behavior and run AppLock plus messaging tests.
3. Merge #210 after recipient filtering, first-message, duplicate-retry, block, restricted-account, and In-Mail tests.
4. Merge #213 after #210 if it consumes the same picker/starter; otherwise prove it is independent. Merge #212 independently after comment-reaction UI tests.
5. Merge #211 after Moliboo family, wardrobe, saved-outfit, ownership, asset-pack, and performance checks.
6. Rebase `premium/hub-and-tiers` onto the resulting main. Decode optional GreenField `publicIdentity`, `membership`, and `verification` fields; keep all purchase actions disabled. Recover Verification/Modula Unit Mac-only work before composing it.
7. Resolve Product UI #77 separately; its current DIRTY merge state is a hard stop.
8. Land the package stack in producer-to-consumer order listed above; do not merge Native #168 independently of #99 and the four upstream repositories.
9. Reconcile shell fixes and update AppLock tests without weakening delays.
10. Run Xcode unit/UI tests, simulator acceptance, then physical-iPhone acceptance. Linux source checks are not substitutes.

## Branch classification

- A — fully merged/redundant: #207-#209 branches, `nodus-release`, merged `mol03/*`, merged `moliboos/*`, and the merged Moliboo/message UI refs enumerated in `branch-cleanup-candidates.md`. These are candidates only after Mac confirmation.
- B — open active: #210-#213, `premium/hub-and-tiers`, and `fix/shell-chrome-tests`.
- C — stacked: #206 until reconciled, #99, #168, and the cross-repository package PR stack.
- D — superseded: none declared conclusively by this VPS audit. Potential #206/#210 supersession needs owner review.
- E — unknown: `cursor/notes-account-records-ac33` and any remote ref without clear PR/ownership evidence.
- F — Mac-only: reported Verification badge work, Modula Unit artwork/icon work, and any uncommitted Premium/Moliboo/Nodus changes. These are unavailable and untouched.

Branches deleted: **NONE**. Tags deleted: **NONE**. Native merges performed: **NONE**.
