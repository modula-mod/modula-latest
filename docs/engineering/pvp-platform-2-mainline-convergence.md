# PVP Platform Phase 2 mainline convergence

Recorded: 2026-08-24  
Repository: `modula-mod/modula-latest`  
VPS canonical checkout: `/root/modula-latest`  
Convergence worktree: `/root/modula-worktrees/pvp-platform-2-convergence`  
Convergence branch: `cursor/pvp-platform-2-convergence`  
Production modified: **NO**  
Production database modified: **NO**

## Fetch and baseline evidence

The audit began on `core.modula.digital` as `root`. The canonical checkout was
clean and detached; no unknown working-tree state was present.

| Evidence | Value |
| --- | --- |
| Fetch command | `git fetch --all --prune --tags` |
| Canonical checkout HEAD before convergence | `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a` |
| `origin/main` after fetch | `9841530a59250a8f162460332cc834715316038d` |
| Required visual-reset tip | `2735ecfe163fd5c81245a7c9be8c941d3e27601a` |
| Merge base of main and visual reset | `9841530a59250a8f162460332cc834715316038d` |
| Canonical checkout dirty paths | `0` |
| Remote development/archive heads audited | `10` |
| Unknown branches | `0` |

The detached canonical checkout was not switched, reset, cleaned, or otherwise
rewritten. The convergence worktree was created from the fetched
`origin/main`.

## Branch classification

`unique commits` and `unique files` are measured on the branch side of
`origin/main...branch` at audit time. `main ahead` records commits already on
main after an ancestor branch tip.

| Branch | Tip SHA | Relationship to main | Classification | Unique commits | Unique files | Source survives? | Merge/cherry-pick/archive decision | Reason |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| `origin/main` | `9841530a59250a8f162460332cc834715316038d` | identical | `ALREADY_INTEGRATED` | 0 | 0 | Yes | canonical base | Fetched canonical main. |
| `origin/archive/pre-7n-a-b10-20260821` | `d1a0b3a386de4d82f56090379c56a0155418af94` | ancestor; main ahead 5 | `ARCHIVE_ONLY` | 0 | 0 | Yes | retain as archive; do not merge | Preservation ref identical to the B10 tip; its tree is already in main. |
| `origin/cursor/full-route-screenshots-99cd` | `d81d2c9e544fc0ece22b8299441d9172cc6d159f` | ancestor; main ahead 29 | `ALREADY_INTEGRATED` | 0 | 0 | Yes | no action | Tip is an ancestor of main; PR #32 was merged. |
| `origin/cursor/phase7m-b7-full-route-post-v2` | `9bde9e7ec7ec7d844fca8749c145eff75d72ea8b` | ancestor; main ahead 22 | `ALREADY_INTEGRATED` | 0 | 0 | Yes | no action | All route/post work is already in main through the Phase 7N convergence lineage. |
| `origin/cursor/phase7m-b8-founder-mockup-reconstruction` | `ff6324f4720e071535b46930014198994e86c8ca` | ancestor; main ahead 15 | `ALREADY_INTEGRATED` | 0 | 0 | Yes | no action | Tip is an ancestor of main; PR #33 was merged. |
| `origin/cursor/phase7m-b9-product-hub-exact-reconstruction` | `5b0ccbed43df9db5298a731c5d07ef0434b86d8c` | ancestor; main ahead 6 | `ALREADY_INTEGRATED` | 0 | 0 | Yes | no action | B9 is already represented by the newer B10/7N mainline. |
| `origin/cursor/phase7m-b10-product-hub-founder-fidelity` | `d1a0b3a386de4d82f56090379c56a0155418af94` | ancestor; main ahead 5 | `ALREADY_INTEGRATED` | 0 | 0 | Yes | no action | The preserved B10 engineering is already in main. |
| `origin/cursor/phase7n-a-mainline-ui-convergence-60f3` | `9841530a59250a8f162460332cc834715316038d` | identical | `ALREADY_INTEGRATED` | 0 | 0 | Yes | no action | PR #34 is merged and its tip equals main. |
| `origin/cursor/pvp-ui-1-product-hub` | `8bf192a1cf7f18df728d187efe5aaa00cc44d07f` | descendant; branch ahead 14 | `SUPERSEDED` | 14 | 32 | Yes | archive tip; do not merge separately | The required visual-reset branch contains this entire lineage plus nine newer commits. Separate merge would duplicate history. |
| `origin/cursor/pvp-ui-1r-product-hub-visual-reset` | `2735ecfe163fd5c81245a7c9be8c941d3e27601a` | descendant; branch ahead 23 | `MERGE_FULL` | 23 | 74 | Yes | fast-forward into convergence branch | Newest founder-supplied Product Hub visual/product line; contains PVP-UI-1 in full and adds the accepted reset. PR #36 is open. |

Classification totals:

| Classification | Count |
| --- | ---: |
| `MERGE_FULL` | 1 |
| `CHERRY_PICK_VALID` | 0 |
| `ALREADY_INTEGRATED` | 7 |
| `SUPERSEDED` | 1 |
| `ARCHIVE_ONLY` | 1 |
| `ABANDON_INVALID` | 0 |
| `UNKNOWN` | **0** |

## Preserved branch history

Before convergence, the two not-yet-main PVP tips were preserved with new
annotated, non-release archive tags and pushed to origin. Existing release tags
were not modified.

| Archive tag | Tag object | Preserved commit |
| --- | --- | --- |
| `archive/pre-pvp-platform-2/cursor/pvp-ui-1-product-hub/2026-08-24` | `949d4e7d41bde57330a74941917ac299c30614ec` | `8bf192a1cf7f18df728d187efe5aaa00cc44d07f` |
| `archive/pre-pvp-platform-2/cursor/pvp-ui-1r-product-hub-visual-reset/2026-08-24` | `ae7c18298b09e252eeb5e687dcbf2b99081eede5` | `2735ecfe163fd5c81245a7c9be8c941d3e27601a` |

No remote branch is authorised for deletion until the converged mainline has
passed fresh-main verification.

## Surviving unique commits

The superseded PVP-UI-1 commits all survive as ancestors of the visual-reset
tip:

```text
2e94a35 PVP1-01 skill bootstrap + Product Hub inventory
30b19a3 PVP1-02 native experiment lab
9aa30a1 PVP1-03 Product Hub header + search
304e3dc PVP1-04 Featured editorial hero
f34f8e4 PVP1-05 module rows and shelves
029caaa PVP1-06 segmented installed states and Product Hub composition
efaa472 PVP1-07 Liquid Glass chrome and success haptics
9f17c7d PVP1-10 Product Hub verifier
a7b12be fix(pvp-ui-1): match skill-bootstrap SDK strings in verifier
987a333 fix(pvp-ui-1): let ESLint resolve pnpm @modula workspace packages
a49ad63 fix(pvp-ui-1): record expo-doctor in the Product Hub verifier
52b4a3f chore(pvp-ui-1): refresh Podfile.lock checksums after worktree pod install
17bf301 fix(pvp-ui-1): flatten Featured link styles for Expo Router Slot
8bf192a fix(pvp-ui-1): require Link asChild for Apple Zoom
```

The visual reset adds:

```text
8a680e5 feat(pvp-ui-1r): reconstruct Product Hub as editorial marketplace
e324054 fix(pvp-ui-1r): progressive blur header and Home control group
8c2bf2a fix(pvp-ui-1r): true title morph and Home-parity header alignment
f8e28f5 fix(pvp-ui-1r): use system liquid glass for overlay control groups
bcd5f62 fix(pvp-ui-1r): one shared liquid-glass control group capsule
f910e28 refactor(chrome): use ChromeGlassControlGroup for all control groups
563a2f1 Add PVP-UI-1R iOS evidence screenshots for shared control group
17d13a9 fix(home): restore iOS native header glass for control group
2735ecf docs(evidence): refresh PVP-UI-1R Home and Product Hub iOS screenshots
```

## Unique files

PVP-UI-1 contributes these 32 paths relative to the fetched main baseline:

```text
docs/research/pvp-ui-1-expo-ui-examples-provenance.md
docs/research/pvp-ui-1-marketplace-references.md
docs/research/pvp-ui-1-native-experiments.md
docs/validation/pvp-ui-1-current-product-hub-inventory.md
docs/validation/pvp-ui-1-skill-bootstrap.md
eslint.config.js
ios/Podfile.lock
package.json
scripts/pvp-ui-1-presentation.test.mjs
scripts/verify-pvp-ui-1.mjs
src/app/settings/developer/pvp-native-experiments.tsx
src/components/primitives/AppPressable.tsx
src/features/marketplace/screens/ModuleDetailScreen.tsx
src/features/modules/components/ProductHubHeader.tsx
src/features/modules/components/ProductHubSearchChrome.tsx
src/features/modules/components/ProductHubSegmentedControl.tsx
src/features/modules/components/presentation/ComingSoonRow.tsx
src/features/modules/components/presentation/ModuleAction.tsx
src/features/modules/components/presentation/ModuleEditorialHero.tsx
src/features/modules/components/presentation/ModuleFeatureCard.tsx
src/features/modules/components/presentation/ModuleRow.tsx
src/features/modules/components/presentation/ModuleShelf.tsx
src/features/modules/components/presentation/index.ts
src/features/modules/screens/ProductHubMarketplaceScreen.tsx
src/features/settings/screens/DeveloperSettingsScreen.tsx
src/features/settings/screens/ModulaUiLabScreen.tsx
src/lib/haptics.ts
src/platform/ui/chrome/section-header.tsx
src/platform/ui/dev/pvp-native-experiments.tsx
src/platform/ui/dev/pvp-ui-1-lab.tsx
src/platform/ui/materials/liquid-glass-chrome.tsx
src/theme/contracts/typography.ts
```

The complete visual-reset lineage contributes 74 paths relative to fetched
main (the 32 above plus these 42):

```text
docs/design/pvp-ui-1r-directions.md
docs/research/pvp-ui-1r-marketplace-references.md
docs/research/pvp-ui-1r-native-experiments.md
docs/research/pvp-ui-1r-rejection.md
docs/validation/evidence/pvp-ui-1r/pvp-ui-1r-ios-home-control-group-light-top.png
docs/validation/evidence/pvp-ui-1r/pvp-ui-1r-ios-product-hub-light-top.png
docs/validation/pvp-ui-1r-skills.md
scripts/maestro-pvp-ui-1r-capture-chrome.yaml
scripts/pvp-ui-1r-presentation.test.mjs
scripts/verify-phase7m-b6.mjs
scripts/verify-pvp-ui-1r.mjs
src/app/(tabs)/activity/_layout.tsx
src/app/(tabs)/profile/_layout.tsx
src/features/activity/screens/ActivityScreen.tsx
src/features/board/screens/BoardScreen.tsx
src/features/discover/screens/DiscoverScreen.tsx
src/features/modules/components/ModuleAIActionMenu.tsx
src/features/modules/components/ProductHubLibraryControl.tsx
src/features/modules/components/presentation/ComingSoonEditorial.tsx
src/features/modules/components/presentation/EditorialBleedHero.tsx
src/features/modules/components/presentation/EditorialSplitHero.tsx
src/features/modules/components/presentation/ModuleBrowseGrid.tsx
src/features/modules/components/presentation/ModuleIconShelf.tsx
src/features/modules/components/product-detail/ProductCover.tsx
src/features/modules/components/product-detail/ProductTopChrome.tsx
src/features/modules/identity/marketplaceCanvas.ts
src/features/modules/identity/moduleArtwork.ts
src/features/modules/identity/productCopy.ts
src/features/reels/screens/ReelsScreen.tsx
src/features/reels/screens/YourAlgorithmScreen.tsx
src/features/settings/components/SettingsRows.tsx
src/features/social/screens/SocialSurfaceScreens.tsx
src/platform/ui/dev/modula-primitives-lab.tsx
src/platform/ui/dev/pvp-ui-1r-lab.tsx
src/platform/ui/menus/chrome-glass-control-group.native.tsx
src/platform/ui/menus/chrome-glass-control-group.tsx
src/platform/ui/menus/modula-control-group.native.tsx
src/platform/ui/menus/modula-control-group.tsx
src/platform/ui/navigation/activity-stack-header.tsx
src/platform/ui/navigation/home-stack-header.tsx
src/platform/ui/navigation/profile-stack-header.tsx
src/shell/SecondaryScreenHeader.tsx
```

Every other audited branch has zero branch-side commits and zero branch-side
files relative to main because its tip is already equal to or an ancestor of
main.

## Convergence action

The convergence branch was created at fetched `origin/main` and advanced with:

```text
git merge --ff-only origin/cursor/pvp-ui-1r-product-hub-visual-reset
```

Result before this evidence commit:

| Field | Result |
| --- | --- |
| Convergence branch pre-merge | `9841530a59250a8f162460332cc834715316038d` |
| Convergence branch post-merge | `2735ecfe163fd5c81245a7c9be8c941d3e27601a` |
| Conflicts | 0 |
| Blind `ours`/`theirs` resolutions | 0 |
| Visual-reset commits preserved | 23/23 |
| PVP-UI-1 commits preserved | 14/14 |

The Product Hub visual reset is therefore preserved exactly as a linear
descendant of current main. Verification results and final mainline promotion
evidence will be appended only after the repository's accepted gates pass.

## Expo SDK 57 patch alignment

The first convergence gate found eight Expo patch mismatches. The repository
remains on Expo SDK 57; no SDK upgrade and no new dependency was introduced.
The workspace-root guard prevented `expo install --fix` from mutating source,
so the repository's documented pnpm-workspace fallback was used to align only
the versions Expo reported:

| Package | Before | SDK 57 expected/aligned |
| --- | --- | --- |
| `@expo/metro-runtime` | `57.0.12` | `57.0.13` |
| `@expo/ui` | `~57.0.12` | `~57.0.13` |
| `expo` | `~57.0.15` | `~57.0.16` |
| `expo-constants` | `~57.0.13` | `~57.0.14` |
| `expo-dev-client` | `~57.0.14` | `~57.0.15` |
| `expo-image-picker` | `~57.0.12` | `~57.0.13` |
| `expo-router` | `~57.0.15` | `~57.0.16` |
| `expo-splash-screen` | `~57.0.7` | `~57.0.8` |

The dependency register was updated to match. The committed-native-project
Doctor advisory remains governed by
`docs/architecture/native-project-policy.md`; it is not suppressed and is not
treated as permission to regenerate the tracked native projects blindly.
