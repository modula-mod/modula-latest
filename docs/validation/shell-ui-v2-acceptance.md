# Shell UI V2 engineering acceptance

Date: 2026-09-04
Mission branch: `cursor/shell-ui-v2-product-quality`
Target: `main`
Start main SHA: `85cf6566ef3251503f71b311fa508c4ab0bf9b79`
Latest fetched `origin/main`: `85cf6566ef3251503f71b311fa508c4ab0bf9b79`

This is an engineering and evidence record. Founder visual approval, real iOS
and standalone-PWA acceptance, merge, and production deployment are separate
gates and are not implied by source or browser PASS results.

## Layer ownership

| Change | Owner |
| --- | --- |
| Semantic control, icon, radius, spacing, typography, field, toolbar, and grouped-row behavior | HOST |
| Generic product title, extension presentation, form validation, and product frontend rendering | HOST |
| Home, Settings, Activity, Discover, Profile, Composer, Product Hub, and Module Detail composition | SHELL |
| Vault Notes list/editor route composition | PRODUCT (`modula-mod/modula-vault-notes`) |

No Greenfield protocol, MPS contract, database, registry, broker, fabric,
entitlement, or generic product-release architecture was changed. No migration
or database step is required for the shell work.

## Implemented

- Canonical 44pt touch targets separated from 32-40pt painted icon controls.
- One semantic icon registry across compatibility and app-lock primitives: SF
  Symbols on iOS and Modula-owned SVG paths on Android/web; shell icon-font
  imports and browser font requests are both zero.
- Compact, regular, and prominent button geometry; semantic primary, secondary,
  quiet, and destructive roles; compact Product Hub `Get`, `Open`, and `Update`
  presentation.
- Canonical single-line, multiline, select, tag, search, helper, and field-error
  primitives with Dynamic Type expansion.
- Reduced radius hierarchy and shared section/list geometry.
- Generic product title sourced from release presentation metadata; no Vault
  Notes name branch and no `Module` fallback.
- Extension contributions routed to toolbar/menu/sheet-row presentation instead
  of a universal oversized button.
- Settings grouped rows, semantic icon tiles, account context, search, compact
  row sizing, rebuilt Appearance, and first-class Accessibility hierarchy.
- Denser Home, Activity, Discover, Composer, Product Hub, Module Detail, and
  public-profile presentation.
- Development-only buttons, fields, and Settings-row acceptance matrices.
- Localhost service-worker registration suppression so stale PWA cache cannot
  contaminate development visual evidence; production registration still uses
  `updateViaCache: 'none'`.

## Product-owned Vault Notes release candidate

Product worktree: `/root/modula-worktrees/vault-notes-shell-ui-v2-product-quality`
Product branch: `cursor/shell-ui-v2-product-quality`
Product start SHA: `30f73030c32f9ab49f96fe89f22d28a1320d2ad1`
Product release version: `1.7.0`
Product release commit: `e1f391225f3686f3c4fe4b7c8d390e4d886e632a`
Frontend artifact SHA-256: `4af252f64b8b55d18d10c827f1c998845256b985cfa664326284107871595d7d`

The product owns `/new` (`New Note`, create + `Save note`) and
`/note/:noteId/edit` (`Edit Note`, update). Its existing structured folder
reference and tag fields are rendered by the generic host select/tag
primitives. `CI=true MODULA_PRODUCT_STANDARD_ROOT=/root/modula-mod/modula-product-standard pnpm verify`
passes all 7 product tests plus manifest, provenance, safety, and release
checks. The generated local package is not published or installed.

## Browser route smoke

Playwright rendered these routes at 390 x 844 after a clean Metro-cache restart:

| Route | HTTP | Console/page errors |
| --- | ---: | ---: |
| Home tab client navigation to `/` | rendered | 0 |
| `/settings` | 200 | 0 |
| `/settings/appearance` | 200 | 0 |
| `/settings/accessibility` | 200 | 0 |
| `/activity` | 200 | 0 |
| `/settings/notifications` | 200 | 0 |
| `/discover` | 200 | 0 |
| `/profile/andrei.modula` | 200 | 0 |
| `/compose` | 200 | 0 |
| `/marketplace` | 200 | 0 |
| `/marketplace/digital.modula.vault-notes` | 200 | 0 |
| `/module/digital.modula.vault-notes` | 200 | 0 |
| `/module/digital.modula.vault-notes/new` | 200 | 0 |

The static production export emits `/` as its index route and returned HTTP
200 from the built artifact. The development screenshot enters Home through
the actual tab navigator because a direct SSR request to the nested Expo Router
tab returns the development not-found document before client navigation.

Appearance interaction proof: selecting Dark then OLED persisted `mode: oled`.
Selecting Accessibility under Larger Text persisted custom scale `1.3`.
Keyboard Tab entered a conventional link target. No console or page error was
emitted during this interaction journey.

Activity is the social/product event inbox. `/settings/notifications` configures
delivery preferences, so it has a distinct purpose rather than duplicating the
Activity list.

## Automated gates

| Gate | Result |
| --- | --- |
| `git diff --check` | PASS |
| `CI=true pnpm lint` | PASS, 0 warnings |
| `CI=true pnpm typecheck` | PASS |
| `CI=true pnpm verify:shell-ui-v2` | PASS |
| Normal oversized control overrides | 0 |
| Static large-size findings classified | 107/107 |
| Product-specific host cases | 0 |
| Shell icon-font imports | 0 |
| Browser icon-font requests across priority routes | 0 |
| `CI=true pnpm build:web` | PASS, exact committed mission revision |
| `CI=true pnpm verify:web-build` | PASS, release identity and artifact scan |
| `CI=true pnpm verify:web-dist-routes` | PASS |
| Vault Notes `pnpm verify` | PASS |
| Product frontend API/DB/renderer/security stages | PASS |
| Reference Tasks full clean-host journey | PASS |
| `CI=true pnpm verify:product-frontend-v1` | PASS |
| Fresh detached checkout: frozen install, lint, typecheck, shell verifier, web build | PASS at `897c67b0a3b05d5d984f8bad0ef033235f5cc72e` |

The final production-mode export is built only after the implementation and
acceptance record are committed. The web verifier checks that `/version.json`
binds the artifact to that exact mission revision.

## Visual delta

Evidence index: [`evidence/shell-ui-v2/README.md`](evidence/shell-ui-v2/README.md)

Home, Settings, Appearance, Accessibility, Search/Discover, public Profile,
Product Hub, and Module Detail are immediately distinguishable from the
baseline. Compact controls, grouped rows, reduced cardification, tighter
headers, and stronger content hierarchy are visible without annotation.

Populated Activity rows and the authenticated Composer are source-complete but
not represented by the guest/local data captures. They remain manual-data
visual gates rather than falsely passing from empty/auth-gated frames.

## Open gates before merge

| Gate | Current result | Required environment/action |
| --- | --- | --- |
| Vault Notes 1.7.0 root/editor rendered through installed generic host | NOT_RUN | Publish/install immutable product release in an acceptance environment |
| Vault Notes create/save/back journey | NOT_RUN | Authenticated acceptance account and installed 1.7.0 release |
| Populated Activity and authenticated Composer visual review | NOT_RUN | Seeded/authenticated acceptance account |
| iOS build and iPhone visual/keyboard/VoiceOver journey | NOT_RUN | Current Mac/Xcode/iPhone simulator |
| Standalone iPhone PWA, safe areas, keyboard, and cache replacement | NOT_RUN | Physical iPhone standalone PWA |
| Android build/static or emulator acceptance | NOT_RUN | Android toolchain/emulator |
| Founder before/after approval | PENDING | PR visual review |
| Merge, immutable production web release, public smoke | NOT_RUN | Only after all merge gates pass |

Until those gates close, this mission must not be described as production
accepted, merged, or deployed, and P0/P1 totals must not be reported as zero.
