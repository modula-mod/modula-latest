# Phase 7G Feature Status Matrix

Date: 2026-08-08
Classification is based on source inspection, current verifiers, live API checks, and web screenshots captured from current main.

States: `COMPLETE`, `WORKING_BUT_NEEDS_POLISH`, `PARTIAL`, `BROKEN`, `MOCK_OR_LOCAL_ONLY`, `PLACEHOLDER`, `HIDDEN`, `DEAD_CODE`, `DUPLICATED`, `UNREACHABLE`, `NOT_IMPLEMENTED`.

Priorities: `P0`, `P1`, `P2`, `P3`, `P4`.

| Area | State | Priority | Evidence | Missing / defect |
| --- | --- | --- | --- | --- |
| Canonical app baseline | `WORKING_BUT_NEEDS_POLISH` | P1 | Audit branch equals `origin/main` at `f7a1902` | Local `main` divergence must be reconciled later without losing `98d3474`. |
| Web production build | `WORKING_BUT_NEEDS_POLISH` | P1 | `pnpm build:web` PASS, `pnpm verify:web-build` PASS after rebuild | Static route hosting needs correct rewrite support; screenshots use local rewrite server. |
| Lint gate | `COMPLETE` | P0 | `pnpm lint` PASS after remediation | Fixed conditional hook in `modula-segmented-picker.native.tsx`; removed unused import in `LocalApiDatabase.ts`. |
| Typecheck | `COMPLETE` | P1 | `pnpm typecheck` PASS | None observed. |
| Expo Doctor health | `PARTIAL` | P2 | `pnpm exec expo-doctor` 15/20 PASS | Patch drift, duplicate `expo-web-browser`, native config sync warnings. |
| Create account | `PARTIAL` | P0 | route and API present; live registration returns 403 invite required | New person cannot create an account on live without invite. |
| Email verification | `PARTIAL` | P0 | API and route present | No live invite/mailbox proof. |
| Login | `WORKING_BUT_NEEDS_POLISH` | P0 | invalid login returns 401; remote demo creds return expected invalid credentials | Need known dev account for valid login proof. |
| Invalid credentials UX | `WORKING_BUT_NEEDS_POLISH` | P1 | source handles remote demo rejection and invalid login | Need native screenshot after failed login. |
| Session bootstrap/restore | `PARTIAL` | P0 | `SessionProvider` refresh timeout and bootstrap inspected | Need real signed-in restore proof on current main. |
| Logout/session revoke | `PARTIAL` | P1 | routes and service calls exist | Current audit did not execute a valid session. |
| Home shell | `PARTIAL` | P0 | screenshot shows Home chrome, modes, composer prompt | Feed query fails offline in static session; authenticated live Home not fully proven. |
| Stories rail | `PARTIAL` | P1 | source uses `useStoriesRailQuery`, Add Story fallback | live `/v1/stories/rail` returns 404; deployment not current. |
| Story create/view/delete | `PARTIAL` | P1 | `StoryCreateScreen`, `StoryViewerScreen`, Greenfield routes/migration `028`; `node scripts/verify-phase7f-b-stories.mjs` PASS | direct `fetch(uri)` boundary fixed; full upload/viewed/expiry proof pending. |
| Feed following | `PARTIAL` | P1 | `/v1/feed/home?mode=following` live returns posts | two-account follow visibility/blocks/mutes/pagination proof pending. |
| Feed For You | `PARTIAL` | P1 | live `mode=forYou` returned items labelled `following` | actual ranking appears fallback, not personalized intelligence. |
| Feed Modules | `PARTIAL` | P1 | module event platform exists | exact qualifying events and hardcoded Vault Notes risk need deeper proof. |
| Composer text post | `PARTIAL` | P1 | `useCreatePostMutation`, `/v1/posts` present | valid signed-in publish/refresh proof pending. |
| Composer photo/camera | `PARTIAL` | P1 | `captureMediaFromSource` and base64 media mutation path | upload failure/retry/native permission proof pending. |
| Composer GIF/module/location/thread/CW | `MOCK_OR_LOCAL_ONLY` | P1 | source labels Preview/local | visible controls must be hidden, gated, or backed by real flow. |
| Link preview | `MOCK_OR_LOCAL_ONLY` | P1 | `demoLink` in composer | fake link preview must not publish as real metadata. |
| Poll | `PARTIAL` | P1 | local poll preview object sent to mutation path | backend contract/persistence not verified. |
| Reactions/comments/replies | `PARTIAL` | P1 | APIs and UI actions exist | two-account refresh/count proof pending. |
| Repost/bookmark | `PARTIAL` | P1 | APIs and post actions exist | refresh/count proof pending. |
| Follow/unfollow | `PARTIAL` | P1 | profile/discover follow mutations exist | two-account proof pending. |
| Block/mute/report | `PARTIAL` | P1 | APIs exist | cross-account security proof pending. |
| Discover search | `PARTIAL` | P1 | `/v1/search`, UI search query | screenshot shows offline in static session; live search works but returns inconsistent Vault module id. |
| Discover trends/interests/live | `MOCK_OR_LOCAL_ONLY` | P1 | UI labels Preview; live `/v1/discover` contains static trend-like data | hide/demote until backend truth exists. |
| Activity | `PARTIAL` | P1 | routes and notification APIs exist | live public `/v1/activity` returns old seeded items; generated notification matrix pending. |
| Profile owner/public | `WORKING_BUT_NEEDS_POLISH` | P1 | unified profile architecture present | duplicate identity/profile concepts still need removal audit. |
| Settings | `WORKING_BUT_NEEDS_POLISH` | P1 | screenshot captured; rows navigate | Expo UI List migration incomplete; audit all rows before cosmetic redesign. |
| Appearance | `WORKING_BUT_NEEDS_POLISH` | P2 | screenshot captured, theme provider present | raw media colors remain in stories/reels/media overlays; classify constants. |
| Accessibility | `PARTIAL` | P1 | settings route and some semantic labels present | VoiceOver/Dynamic Type/contrast proof pending. |
| Drawer | `WORKING_BUT_NEEDS_POLISH` | P1 | implementation present, Phase 7F-A merged | current main interactive stress proof pending. |
| Bottom navigation | `WORKING_BUT_NEEDS_POLISH` | P1 | native/web adapters present; product shell verifier PASS after remediation | interactive native stress proof still pending. |
| Segmented controls | `WORKING_BUT_NEEDS_POLISH` | P1 | adapter present; lint and Phase 7F-B segmented verifier PASS | sticky overlay behavior still needs native proof. |
| Blur/glass | `PARTIAL` | P2 | shell chrome/progressive blur present | Discover search and large chrome need overdraw/perf pass; no broad redesign yet. |
| Board | `PARTIAL` | P1 | screenshot captured | cards must be capability-driven; fake CRM/Gaia/DIMON style claims need hiding. |
| Product Hub | `PARTIAL` | P1 | screenshot and registry APIs | technical/dev metadata and placeholder products are too visible. |
| Marketplace module detail | `PARTIAL` | P1 | route/API present | live Vault lookup inconsistency; dynamic static evidence limited. |
| Generic module host | `PARTIAL` | P1 | `/module/[moduleId]/[...path]`, runtime verifiers | disabled/missing/incompatible/quarantine scenarios not fully exercised. |
| Vault Notes | `PARTIAL` | P1 | external release verified; host route exists | editor/product quality not proven; live registry detail for expected id failed. |
| AI provider/model registry | `WORKING_BUT_NEEDS_POLISH` | P1 | AI verifiers PASS | UI must show unavailable/config-required when no provider configured. |
| AI product actions | `PARTIAL` | P1 | apply/preview/stale revision verifiers PASS | live provider/product flow not smoke-tested; no deterministic provider in product. |
| Standard 2 runtime support | `PARTIAL` | P1 | specific runtime verifiers PASS | umbrella verifier drift; support matrix must separate supported vs declarative-only. |
| Greenfield workers | `PARTIAL` | P1 | worker source/tests exist | current host did not prove worker process running. |
| Security boundaries | `PARTIAL` | P0 | SSRF guard/internal endpoint and auth configs exist | cross-account and spoofing tests pending. |
| Performance measurements | `PARTIAL` | P2 | web screenshot timings possible, build successful | authenticated native/web metrics pending. |
| Dependency posture | `PARTIAL` | P2 | `pnpm list`, `pnpm why`, Expo Doctor | no upgrades performed; classification needed before upgrades. |

## Immediate P0/P1 List

1. P0: live new-person registration is blocked by invite-only API; no public/dev invite path was available in audit.
2. P1: live API is stale relative to main for Stories (`/v1/stories/rail` 404).
3. P1: composer exposes preview/local controls as major tools.
4. P1: Reels is not a real video/engagement product yet.
5. P1: Standard 2 umbrella verifier still exits red because it invokes the deployment-scope web production cutover verifier on a non-main audit branch.
6. P1: two-account social, security, worker, and native iOS proof remain pending.

Fixed during this checkpoint:

- `pnpm lint` and `pnpm verify:phase7e-code-quality` now pass.
- `pnpm verify:phase4`, `pnpm verify:phase4-5`, `pnpm verify:phase6-frontend-boundary`, and `pnpm verify:phase7c-product-shell` now pass.
- Story create no longer uses direct `fetch(uri)` to read selected media.
