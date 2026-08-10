# Phase 7I-MAC-B — UI defect backlog

Authenticated audit on iPhone 17 Pro Simulator against private Greenfield (`127.0.0.1:4020`). Session under audit: founder/admin `@modula_org` (user-confirmed login). Evidence: `docs/validation/evidence/phase7i-mac-b-authenticated/`.

Severity: **P0** crash/data-loss/security · **P1** broken interaction/layout · **P2** poor product quality · **P3** polish.

| ID | Sev | Screen | Component | Screenshot | Symptom | Root cause | Proposed fix | Strategy |
|---|---|---|---|---|---|---|---|---|
| MACB-001 | P0 | Sign in | `parseSessionId` / identifiers | `01j-assert.png` (pre-fix) | Login failed with **Invalid session id.** despite valid credentials | Client id pattern required letter-leading ids; Greenfield returns UUIDv7 | Accept digit-leading ids (`[a-z0-9]…`) in `src` + `packages/api-contracts` | **FIXED** |
| MACB-002 | P0 | Root / Drawer | `NavigationDrawer` | Metro logs | Hermes `ReferenceError: runtimeEnvironment doesn't exist` after navigate-home | Stale/undefined `runtimeEnvironment` reference in drawer caption | Always use signed-out caption string; no runtime env import | **FIXED** |
| MACB-003 | P1 | Session | `SessionProvider` + SecureStore | `04c-drawer-auth.png` (cold) | Cold launch lost signed-in drawer identity (feed still public-readable) | Refresh-only bootstrap wiped vault on failure; SecureStore accessibility brittle on Simulator | Access-token fallback; read legacy keychain options; AFTER_FIRST_UNLOCK writes | **FIXED** (needs re-login once to re-persist) |
| MACB-004 | P1 | Home | `HomeFeedScreen` top inset | before geometry | Header / Stories / modes under Dynamic Island | Nested FlatList + automatic content inset unreliable | Explicit `paddingTop` + `contentInsetAdjustmentBehavior="never"` | **FIXED** |
| MACB-005 | P1 | Home | `HomeStickyFeedModes` | — | Sticky latch at `stickAtY <= 0` | `0 >= 0` treated measured | Ignore unmeasured (`<= 0`) | **FIXED** |
| MACB-006 | P1 | Product Hub | hub filters + tab bar | `12-product-hub.png` | Floating tab bar overlaps filter chips / metadata | Insufficient bottom content padding vs floating chrome | Apply `useFloatingTabBarContentPadding` on hub scroll | REPAIR |
| MACB-007 | P2 | Home | Stories rail | `01-home.png`, `02-stories.png` | Only **Your story**; no peer stories | API `GET /v1/stories/rail` → `items: []` | Keep empty/owner affordance; no demo stories | EMPTY_REAL_DATA |
| MACB-008 | P2 | Home | Focus / Merge banners | `01-home.png` | Large debug-like banners dominate hierarchy | Product copy + card chrome too heavy | Tighten copy; quieter surface; optional collapse | REPAIR |
| MACB-009 | P2 | Home | Dual compose entry | `01-home.png` | Header `+` and FAB `+` compete | Two create affordances | Keep FAB + tools drawer; demote header create | KEEP / polish |
| MACB-010 | P2 | Product Hub | filter chips | `12-product-hub.png` | Dense zero-count pills (Declarative/Services/APIs) | Admin metadata promoted to primary UI | Collapse to Menu / sheet; keep Discover·Installed·Updates segments | REPLACE_WITH_ADAPTER |
| MACB-011 | P2 | Settings | Appearance summary | `10-settings.png` | Row value `System · Native` while session was Light | Summary not reflecting resolved mode | Show resolved colour mode + surface | REPAIR |
| MACB-012 | P2 | Sign in | Auth fields | login evidence | Spell-check underline on email | `autoCorrect` not disabled | `autoCorrect={false}` on email | **FIXED** |
| MACB-013 | P3 | Profile | owner notice card | `07-profile.png` | Heavy “owner controls” callout | Custom card | Quieter caption / native banner later | KEEP |
| MACB-014 | P3 | Tab bar | floating glass | all | Content scrolls under bar | Expected with blur chrome | Ensure all scroll screens use shared inset helper | REPAIR |
| MACB-015 | P3 | Feed modes | Expo UI / Host | `03-feed-modes.png` | Geometry risk if Host in absolute sticky | Prior sticky overlay issues | Prefer Modula track / glass-embedded; no Host in absolute sticky until proven | CUSTOM |

## Stories classification

```text
EMPTY_REAL_DATA
```

Authenticated rail mounts; query hits Greenfield; HTTP 200 with empty `items`; owner **Your story** affordance renders. Not AUTH_ERROR / DECODER_ERROR / FEATURE_GATE.
