# Phase 7G Product Map

Date: 2026-08-08
Source: router filesystem under `src/app`, feature source under `src/features`, backend routes under `services/greenfield-api`.

## Architecture Reality

The current checkout is an Expo Router / React Native product with web export support and a Greenfield Fastify API. It is not the older Open WebUI Python/FastAPI plus SvelteKit tree described by earlier top-level instructions.

Primary app paths:

- Router: `src/app`
- Product features: `src/features`
- Repositories and API clients: `src/data`, `src/api`
- Platform UI adapters: `src/platform/ui`
- Greenfield API: `services/greenfield-api`
- Greenfield worker: `services/greenfield-worker`
- External Module Standard: `/home/andrei/modula-mod/modula-module-standard`
- External Vault Notes: `/home/andrei/modula-mod/modula-vault-notes`

## Runtime Data Source

`src/runtime/createAppServices.ts` selects:

- development default: local in-memory API unless `EXPO_PUBLIC_DATA_SOURCE=remote`;
- production default: remote API with `https://api.modula.digital`.

This explains the audit split: static web screenshots can render app chrome while many queries show "You appear to be offline"; live curl checks hit `api.modula.digital`; native/local account creation requires either local API state or an invite code on the live API.

## Route Map

| Route | Screen / feature | Entry points | Auth | Primary data source | API | Persistence | State | Native | Web |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/welcome` | Welcome | signed-out root, auth links | no | local screen | none | none | `WORKING_BUT_NEEDS_POLISH` | yes | screenshot captured |
| `/create-account`, `/register` | Create account | welcome, sign in | no | auth repository | `/v1/accounts/register`, handle availability, verify | accounts, profiles, sessions | `PARTIAL` because live API invite-only blocks new person flow | yes | screenshot captured |
| `/sign-in` | Login | welcome, auth redirects | no | auth repository | `/v1/sessions` | sessions, SecureStore/local storage | `WORKING_BUT_NEEDS_POLISH`; invalid credentials behavior verified | yes | screenshot captured |
| `/verify-email` | Verify account | registration | no | auth repository | `/v1/accounts/verify-email`, resend | accounts | `PARTIAL`; not end-to-end verified with live invite | yes | source verified |
| `/forgot-password`, `/reset-password`, `/recover` | Recovery | sign in | no | auth repository | `/v1/accounts/forgot-password`, `/reset-password`, recovery aliases | reset tokens | `PARTIAL`; route/API present, live mailbox not verified | yes | source verified |
| `/` and `/(tabs)/index` | Home | root tab | expected signed-in or local shell | feed/stories repositories | `/v1/feed/home`, `/v1/stories/rail` | posts, stories, preferences | `PARTIAL`; local static renders chrome but feed offline; live Stories route 404 | yes | screenshot captured |
| `/stories/create` | Story create | Home rail Add Story | signed-in | stories repository | `/v1/stories` | story tables/media | `PARTIAL`; UI present, source has direct `fetch(uri)` boundary issue | yes | screenshot captured |
| `/stories/[groupId]` | Story viewer | story rail | signed-in/visibility scoped | stories repository | `/v1/stories/:groupId`, viewed/delete | story tables/views | `PARTIAL`; source supports view/advance/delete, live API stale | yes | source verified |
| `/compose` and `/(tabs)/create` | Composer | bottom tab, Home prompt, reply/quote | signed-in for publish | post repository, Atproto capability | `/v1/posts`, `/v1/posts/:id/quote` | posts/media | `PARTIAL`; text/photo real, many tools Preview/local | yes | screenshot captured |
| `/post/[postId]` | Post detail | feed cards, notifications | mixed | post/comments/reactions repositories | `/v1/posts/:id`, comments/reactions | posts/comments/reactions | `PARTIAL`; API present, full two-account refresh proof pending | yes | route exists |
| `/discover` | Discover | tab | no for browse, auth for follow | discover/search repositories | `/v1/discover`, `/v1/search` | profiles/modules/search | `PARTIAL`; trends/interests/previews expose non-real pieces | yes | screenshot captured |
| `/activity` | Activity | tab | mixed | activity/notifications repositories | `/v1/activity`, `/v1/notifications` | notifications | `PARTIAL`; live public endpoint returns seeded/static old data | yes | screenshot captured |
| `/profile`, `/profile/[handle]` | Unified/public profile | tab, identity links | owner routes signed-in; public by handle | profile/feed repositories | `/v1/profiles/*`, follows | profiles/posts/follows | `WORKING_BUT_NEEDS_POLISH`; duplicate profile concepts need watch | yes | screenshot captured |
| `/profile/[handle]/followers`, `/following` | Connections | profile stats | mixed | profile connections repository | `/v1/profiles/:handle/followers`, following | follows | `PARTIAL`; API present, two-account proof pending | yes | routes exist |
| `/board` | Board | drawer, product shortcuts | signed-in/local | product preferences/module registry | `/v1/board/layout`, module APIs | board layout | `PARTIAL`; static cards can advertise unavailable capabilities | yes | screenshot captured |
| `/product` | Product Hub / capability hub | drawer, Board | signed-in/local | product catalogue/preferences | mixed module/product APIs | local prefs/module registry | `PARTIAL`; too much future/developer surface visible | yes | screenshot captured |
| `/marketplace` | Marketplace browse | Product Hub, Discover | mixed | module registry repository | `/v1/registry/modules` | registry, installs | `PARTIAL`; registry has placeholders/quarantined modules | yes | screenshot captured |
| `/marketplace/[moduleId]` | Module detail | Marketplace cards | mixed | module registry repository | `/v1/registry/modules/:moduleId` | registry/releases | `PARTIAL`; dynamic static evidence limited, live Vault lookup inconsistent |
| `/module/[moduleId]/[[...path]]` | Generic module host | Module detail, Product Hub, Board | signed-in/module scoped | module runtime repository | `/v1/modules/:moduleId/*` | installations, records, settings | `PARTIAL`; single generic host exists; Vault Notes UI quality pending | yes | screenshot captured |
| `/modules` and `/settings/modules` | Installed modules | Settings, Product Hub | signed-in | module installation repository | `/v1/modules/installed`, lifecycle routes | installations | `PARTIAL`; lifecycle verifiers pass, product proof pending | yes | routes exist |
| `/settings` | Settings index | drawer, profile | signed-in/local | settings/profile/preferences | many `/v1/accounts/me/*` | preferences/account | `WORKING_BUT_NEEDS_POLISH`; list usable, still mixed RN/native controls | yes | screenshot captured |
| `/settings/appearance` | Appearance | Settings | signed-in/local | appearance provider/repository | `/v1/accounts/me/appearance` | appearance preferences | `WORKING_BUT_NEEDS_POLISH`; source mostly tokenized, some raw visual media constants elsewhere | yes | screenshot captured |
| `/settings/accessibility` | Accessibility | Settings | signed-in/local | local prefs | appearance/accessibility prefs | local/remote appearance | `PARTIAL`; route exists, full VoiceOver/Dynamic Type proof pending | yes | route exists |
| `/settings/privacy`, `/blocked`, `/mute-words` | Privacy/moderation | Settings | signed-in | moderation repositories | block/mute/report routes | moderation tables | `PARTIAL`; API present, cross-account proof pending | yes | routes exist |
| `/settings/notifications` | Notification prefs | Settings | signed-in | notification repository | `/v1/accounts/me/notification-preferences` | notification prefs | `PARTIAL`; preferences exist, generated notification matrix pending | yes | route exists |
| `/settings/developer/*` | Developer surfaces | Settings | signed-in/local | local diagnostics/API | meta/session/runtime | local/remote | `WORKING_BUT_NEEDS_POLISH`; must remain developer-only | yes | routes exist |
| `/reels` | Reels | Discover/product | no/mixed | reels repository | `/v1/reels` | none proven for engagement | `MOCK_OR_LOCAL_ONLY`; static/no-video entries, local like/save | yes | screenshot captured |
| `/saved` | Saved/bookmarks | drawer, post actions | signed-in | saved repository | `/v1/saves`, post save actions | saves | `PARTIAL`; API present, refresh proof pending | yes | route exists |
| `/messages`, `/lists`, `/collections`, `/communities`, `/creator`, `/teams` | Secondary product surfaces | drawer/product links | mixed | preview/local | mixed/none | mostly none | `PLACEHOLDER` or `PARTIAL`; must be hidden or clearly demoted if not real | yes | routes exist |

## Current Rendering Evidence

Fresh baseline screenshots were captured under `docs/validation/evidence/phase7g-before/` using the web export served from `dist/` at commit `f7a1902`.

Limitations:

- Clean static web session does not prove native behavior.
- Many production-mode requests show offline/error states because the static host has no authenticated session and live API parity is stale.
- Dynamic route screenshots for module detail are path-rewrite approximations, not full lifecycle proof.
