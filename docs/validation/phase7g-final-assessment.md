# Phase 7G Final Assessment

Date: 2026-08-08
Status: checkpoint assessment, not full Phase 7G completion.

## What Is Genuinely Complete

- Mainline consolidation source accounting: current audit branch equals `origin/main` at `f7a1902d856563ee2fbde302b5ecfdc87d645897`.
- Web export build and artifact verification after rebuilding `dist/`.
- Typecheck.
- Lint/code-quality after remediation.
- Phase 2 appearance, Phase 4 data/auth, Phase 4.5 native UI retirement gate, Phase 6 frontend boundary, and Phase 7C product shell after remediation.
- Many Phase 7E module, Vault Notes, AI, and Standard 2 focused verifiers.
- External repo cleanliness for Module Standard and Vault Notes.
- Invalid login and invite-only live registration gate behavior.

## What Is Partially Complete

- Authentication: routes and APIs exist, but live create-account is invite-blocked and no valid account session was available for full register -> verify -> sign in -> restore proof.
- Home: shell, feed modes, composer prompt, Focus/Merge banners render; feed/stories live parity is incomplete.
- Stories: code and migration exist; live API route is stale/404.
- Feed: backend routes exist; For You ranking is not proven and live content looks like old validation data.
- Composer: text/photo path exists; many visible tools are preview/local.
- Social interactions: APIs exist; two-account refresh/count/security proof pending.
- Discover/Activity: routes exist; live data contains static/preview-like content.
- Profile: unified architecture is present; duplicate identity concepts still require pruning audit.
- Settings/Appearance: usable and screenshot-captured; native control/accessibility polish incomplete.
- Product Hub/Marketplace/Module Host/Vault Notes: lifecycle and runtime systems exist; user product quality and live registry identity need proof.
- AI: platform exists and verifiers pass; product unavailable/provider-required states need UI proof.
- Standard 2 runtime: focused verifiers pass; umbrella verifier drifts after migration `028`.

## Fixed During This Checkpoint

1. `pnpm lint` failure:
   - `src/platform/ui/controls/modula-segmented-picker.native.tsx` now calls hooks before conditional returns.
   - `src/api/local/LocalApiDatabase.ts` no longer imports unused `AppearancePreferences`.
2. Product shell verifier failure:
   - `src/platform/ui/navigation/platform-tabs.native.tsx` now preserves the explicit `title: 'Create'` contract while keeping the route hidden from the liquid-glass tab bar.
3. Story create boundary failure:
   - `src/features/presence/screens/StoryCreateScreen.tsx` now requests base64 from `expo-image-picker` instead of using direct `fetch(uri)`.
4. Story screen raw color literals:
   - `StoryCreateScreen` and `StoryViewerScreen` now use theme/media overlay tokens.
5. Standard 2 migration rollback test drift:
   - `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts` now rolls down to the target migration instead of assuming `027` is latest.
6. Web nested-button runtime overlay:
   - `src/platform/ui/menus/modula-context-menu.tsx` no longer wraps web fallback content in an `AppPressable` button, which removed the React `<button>` inside `<button>` error from Home media cards.

## What Remains Broken Or Blocked

1. `verify:phase7e-module-runtime-2` still exits red only because it invokes `verify:phase7e-web-production-cutover`, which requires running from `main` and matching the deployed production marker. The isolated Standard 2 runtime test itself passed after remediation.
2. Live `/v1/stories/rail` returns 404 even though main contains stories routes.
3. Live new-person registration returns 403 without a usable invite path.
4. Authenticated two-account product proof remains pending.
5. Native iOS Simulator proof remains environment-blocked on this Linux host.
6. `pnpm web` renders after bundling, but still logs nested route-name, deprecated RN web style, and accessibility API warnings that should remain in the web audit backlog.

## What Should Be Removed Or Hidden

- Reels as a major route unless real video/persisted engagement exists.
- Composer GIF/module/location/thread/content-warning preview tools from the main product composer.
- Hardcoded composer `demoLink`.
- Discover fake trends/recommendations/interests if not backed by real data.
- Board/Product Hub cards for CRM, DIMON, Gaia, Automations, Tasks, or similar future concepts unless they are capability-backed or clearly lab-only.
- Developer diagnostics from ordinary Product Hub views.

## What Should Be Redesigned

No broad redesign should start until the full UI audit completes. Based on current evidence, redesign candidates are:

- Product Hub information architecture: user product info vs developer diagnostics.
- Vault Notes module UI if editor renders as a schema/debug surface.
- Reels route if kept; otherwise remove/hide.
- Settings list migration to native FieldGroup/List semantics.
- Composer toolbar information architecture.

## Expo UI Component Replacements

| Current files | Recommendation |
| --- | --- |
| `src/platform/ui/controls/modula-segmented-picker.native.tsx` | keep adapter, fix hook order, use canonical segmented control. |
| `src/features/settings/screens/*`, `src/features/settings/components/SettingsRows.tsx` | migrate rows/sections gradually to `List`, `ListItem`, `FieldGroup` adapters. |
| auth text fields/buttons | keep `ModulaTextInput`, `ModulaSecureInput`, `ModulaButton`; do not direct-import Expo UI in screens. |
| destructive confirmations in story/module/settings flows | add confirmation adapter later. |
| module install/story upload progress | add progress adapter later. |

## What Blocks Another Person From Using Modula

1. They cannot create a live account without a valid invite path.
2. A clean authenticated session on current main was not proven.
3. Live API is not deployed to current main for Stories.
4. Home can render offline/error states without clear product context in static web.
5. Major visible controls still present preview/local behavior.
6. Product Hub and Board can expose future/fake capabilities as if available.
7. iOS Simulator proof cannot be reproduced on this Linux host.

## Next Implementation Phase

The next phase should be a remediation phase with this order:

1. Establish a valid non-production account/invite path and prove auth end to end.
2. Restore deployed API parity for Stories or mark Stories unavailable in product until deployment.
3. Split deployment-scope web cutover verification from the Standard 2 runtime umbrella, or run it only on `main` during deployment acceptance.
4. Hide/gate preview composer tools and Reels product route.
5. Prove two-account social flows and security boundaries.
6. Clean Product Hub/Board visibility so only real capabilities appear.
7. Perform native iOS Simulator verification on a Mac workflow and attach screenshots.

This assessment is intentionally not a "Phase 7G complete" claim. Full DoD still requires authenticated two-account, native, worker, security, and performance proof.
