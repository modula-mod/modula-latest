# Phase 7G UI Defect And Dead Control Inventory

Date: 2026-08-08
Evidence: source inspection plus screenshots under `docs/validation/evidence/phase7g-before/`.

Control states: `NO_OP`, `CONSOLE_ONLY`, `FAKE_SUCCESS`, `DEAD_NAVIGATION`, `PLACEHOLDER`, `LOCAL_ONLY`, `REAL`.

## Major Controls

| Surface | Control | State | Evidence | Required remediation |
| --- | --- | --- | --- | --- |
| Welcome | Get started | `REAL` | navigates to create account | keep |
| Welcome | Sign in | `REAL` | navigates to login | keep |
| Welcome | Explore as guest | `PARTIAL` | root can render Home shell with offline queries | define guest contract or hide if not supported |
| Create account | Continue | `PARTIAL` | live API returns invite-required without usable invite | add clear invite gate/copy or dev invite path |
| Login | Sign in | `REAL` | invalid credentials verified via live API | need valid account proof |
| Login | Show password | `REAL` | source toggles field | keep |
| Login | Forgot password | `PARTIAL` | route/API exist | verify email/reset |
| Home | Feed segmented control | `REAL` but gate-broken | visible in screenshot, native adapter has conditional hook lint bug | fix hook ordering |
| Home | Composer prompt | `PARTIAL` | opens composer, publish needs auth/data | prove publish or guard in guest/offline |
| Home | Refresh retry | `REAL` | QueryErrorState retry | keep; add network clarity |
| Home | Stories Add Story | `PARTIAL` | source fallback exists | live API stale; upload proof pending |
| Composer | Text publish | `PARTIAL` | real mutation path | prove signed-in post appears in feed |
| Composer | Photo | `PARTIAL` | camera/library picker and media base64 | verify upload/failure/retry |
| Composer | Camera | `PLATFORM_GATED` | picker/camera source abstraction | verify permissions and simulator/device behavior |
| Composer | GIF Preview | `PLACEHOLDER` | `previewTool('GIF')` | hide or move to labs |
| Composer | Module Preview | `PLACEHOLDER` | alert only | hide until module post contract exists |
| Composer | Location / Circle Preview | `PLACEHOLDER` | alert only | hide until persisted |
| Composer | Thread Preview | `LOCAL_ONLY` | `router.setParams({thread:'1'})` | hide or build real thread composer later |
| Composer | Content warning Preview | `LOCAL_ONLY` | local state only | hide or persist/enforce warning |
| Composer | Link | `LOCAL_ONLY` | `demoLink` hardcoded | remove fake preview; add real link parser later |
| Composer | Poll | `PARTIAL` | local poll object with canned question | replace canned poll with real form and backend proof or hide |
| Discover | Choose interests - Preview | `PLACEHOLDER` | label says Preview | hide/demote until preferences are real |
| Discover | Inspire | `PARTIAL` | navigates to route | classify route content before promoting |
| Discover | Category pills | `REAL` locally | filter visible sections | keep, consider canonical segmented adapter |
| Discover | Trends/topics | `MOCK_OR_LOCAL_ONLY` | live data static-looking; preview actions | hide fake trends/recommendations unless backend data exists |
| Activity | Filter segmented/menu | `PARTIAL` | source uses segments; notification generation pending | verify real notification platform |
| Reels | Like | `LOCAL_ONLY` | `setLiked` local state | hide or wire API before product route stays major |
| Reels | Save | `LOCAL_ONLY` | `setSaved`, alert says Preview | hide/wire |
| Reels | Comments | `PLACEHOLDER` | alert says comments land later | hide/wire |
| Reels | See more/less/not interested | `LOCAL_ONLY` | alert and local hide | hide/wire ranking feedback |
| Reels | Why this | `PLACEHOLDER` | canned source explanation | hide/wire real ranking explanation |
| Reels | Remix | `PLACEHOLDER` | alert only | hide |
| Settings | Search | `PARTIAL` | screenshot shows search | verify row filtering and keyboard |
| Settings | Account/Profile/Security rows | `REAL` route navigation | routes exist | verify each destination |
| Settings | DIMON row/routes | `PLACEHOLDER` or `PARTIAL` | route exists, ledger not real product | hide if not backed by real DIMON service |
| Board | Vault Notes/Installed/Product Hub cards | `PARTIAL` | expected capabilities exist | drive only from available registry/installation state |
| Board | CRM/Tasks/Gaia/DIMON/Automations style cards | `PLACEHOLDER` if visible | product data includes many future surfaces | hide or label as labs |
| Product Hub | Module install/enable/disable | `PARTIAL` | backend lifecycle routes and verifiers | prove current UI lifecycle end to end |
| Vault Notes | Editor/actions | `PARTIAL` | external module views and host route | verify create/edit/autosave/search/trash/version/export |
| AI actions | Preview/apply | `PARTIAL` | verifiers pass | UI must be honest when no provider configured |

## Visual Defects

| ID | Surface | Priority | Finding | Evidence |
| --- | --- | --- | --- | --- |
| UI-001 | Home | P1 | Home can show product chrome and offline card in static web with no obvious session/data context. | `phase7g-before/home-390x844.png` |
| UI-002 | Home | P2 | Focus and Merge banners occupy top of first viewport; Stories are not visible in screenshot. | `phase7g-before/home-390x844.png` |
| UI-003 | Discover | P1 | Preview/future controls are first-screen elements. | `phase7g-before/discover-390x844.png` |
| UI-004 | Settings | P2 | Settings list is usable but still a custom grouped RN list; Expo UI FieldGroup/List migration remains selective. | `phase7g-before/settings-390x844.png` |
| UI-005 | Appearance | P2 | Theme screen looks stronger than most product screens, but copy says Preview-only glass and must remain honest. | `phase7g-before/appearance-390x844.png` |
| UI-006 | Reels | P1 | Reels route is a major route but engagement is local/preview and video data is not proven. | `src/features/reels/screens/ReelsScreen.tsx` |
| UI-007 | Composer | P1 | Toolbar contains preview tools among real tools with equal visual weight. | `src/features/composer/screens/ComposerScreen.tsx` |
| UI-008 | Stories | P1 | Story create/viewer used raw black/white media styling and direct URI fetch. | Fixed in `src/features/presence/screens/*`; live API parity still blocked |
| UI-009 | Web media cards | P1 | Web `ModulaContextMenu` fallback rendered a button wrapper around card content that already contained buttons, causing React nested-button runtime overlay. | Fixed in `src/platform/ui/menus/modula-context-menu.tsx`; after screenshot `phase7g-after/web-dev-home-fixed-390x844.png` |

## Mock / Demo / Fixture Findings

`pnpm verify:phase7e-no-product-mocks` PASS, but manual search still found product-facing preview/local usage that must be classified:

| Pattern | Classification | Action |
| --- | --- | --- |
| Composer `demoLink` | `MOCK_OR_LOCAL_ONLY` | remove from production composer or gate behind labs |
| Composer `Preview` toolbar actions | `PLACEHOLDER` | hide until real |
| Reels local like/save/ranking feedback | `LOCAL_ONLY` | hide/wire |
| AI mock provider files | development-provider infrastructure | keep out of product mode; document honest unavailable state |
| `setTimeout` in Story viewer | legitimate story playback | keep |
| `setTimeout` in session/bootstrap and shell drawer timing | legitimate timeout/timing | keep |
| `Math.random` in post idempotency key suffix | acceptable entropy for local idempotency key but prefer UUID | P3 improvement |
| Raw colors in media overlays | legitimate media constants only if constrained to full-screen media | classify and migrate stories where possible |
