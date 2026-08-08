# Phase 7G Greenfield API Inventory

Date: 2026-08-08
Source: `rg -n "app\\.(get|post|put|patch|delete)" services/greenfield-api/src`.

## Route Groups

| Group | Methods / paths | Auth / permissions | Service / repository | Database | Frontend consumers | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Health/meta | `GET /v1/health/live`, `/ready`, `/v1/meta` | public | app health/env | none | runtime probes | `WORKING_BUT_NEEDS_POLISH` |
| Preview session | `POST /v1/auth/preview/session` | preview capability | auth/session | sessions/capabilities | validation/dev flows | `PARTIAL`; production use must stay gated |
| Auth/account | `POST /v1/accounts/register`, `/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password`, `GET /v1/accounts/me`, sessions CRUD | auth/write/profile configs | account/session services | accounts, profiles, sessions, tokens | auth screens/session provider | `PARTIAL`; live registration invite-blocked |
| Account appearance | `GET/PATCH /v1/accounts/me/appearance` | profile/write | appearance service | appearance prefs | Appearance settings | `WORKING_BUT_NEEDS_POLISH` |
| Board layout | `GET/PATCH /v1/board/layout` | profile/write | board service | board layout | Board/product prefs | `PARTIAL` |
| Repository records | `/v1/repositories/me`, records CRUD/export | profile/write | repository records | repository tables | Vault/records surfaces | `PARTIAL` |
| Extensions/functions/tools/plugins/connectors | `/v1/extensions*`, `/v1/functions*`, `/v1/tools*`, `/v1/plugins`, `/v1/connectors*` | profile/write | extension/function/connector services | extension/function/connector tables | settings/product | `PARTIAL`; many product surfaces still not final |
| Social feed/posts | `GET /v1/feed/home`, `GET/POST/PATCH/DELETE /v1/posts*` | feed/profile/write | posts/reactions/comments services | posts, comments, reactions, saves, reposts | Home, Profile, Post detail, Composer | `PARTIAL`; full two-account proof pending |
| Comments/reactions/replies | `PUT/DELETE /v1/posts/:id/reaction`, comments/replies CRUD/reaction | feed/write | reactions/comments services | reactions/comments | post detail/social cards | `PARTIAL` |
| Follows/profile | `GET /v1/profiles/:handle`, posts/followers/following, `POST/DELETE follow`, profile update | profile/write | profiles/follows services | profiles/follows | Profile, Discover | `PARTIAL` |
| Moderation | block, mute, reports | write | moderation repository | moderation tables | profile/settings/report | `PARTIAL`; security proof pending |
| Notifications/activity | `/v1/notifications`, read/read-all, preferences; `/v1/activity` | feed/profile/write | notifications repository | notifications/preferences | Activity/settings | `PARTIAL`; live public activity is old seeded/static |
| Search | `/v1/search`, suggestions, recent, saved | feed/profile/write | search service | search documents/recent/saved | Discover/search | `PARTIAL`; DB verifiers env-blocked |
| Media | `/v1/media/:mediaFile` | feed | media storage | media refs | posts/reels/stories | `PARTIAL` |
| Discover/reels | `/v1/discover`, `/v1/reels` | feed | discovery repository | mixed/seeded | Discover/Reels | `MOCK_OR_LOCAL_ONLY` for reels/trends |
| Stories | `/v1/stories/rail`, `/v1/stories/:groupId`, `POST /v1/stories`, viewed/delete/media | feed/write | stories service | migration `028` story tables | Home rail, story viewer/create | `PARTIAL`; code present but live API route 404 |
| Atproto | OAuth metadata/start/callback, connections, prefs, feed, admin ops | mixed | atproto bridge | connections/jobs | Settings/composer | `PARTIAL` |
| Module registry/runtime | `/v1/registry/modules*`, publishers, installed modules, runtime, services invoke, lifecycle, permissions, settings, contributions, views, records, actions, export, health/backend/admin registry | profile/write/admin-like publisher checks | module registry/runtime services | module registry/install/runtime/records | Product Hub, Marketplace, Module Host | `PARTIAL`; many verifiers pass, product lifecycle proof pending |
| AI | `/v1/ai/providers`, `/models`, module AI executions/apply/requests, streams/cancel/tools, admin AI | profile/write/admin-like publisher checks | AI gateway/provider/product services | AI provider/model/execution/ledger tables | modules/admin/product | `PARTIAL`; provider unavailable state must be honest |
| Admin ops | queues, search health/reindex, policy evaluate, events replay, dead letters, atproto ops | write/admin-like | ops services | event/search/job tables | developer/admin surfaces | `PARTIAL`; access policy needs security audit |
| SSRF check | `GET /v1/internal/ssrf-check` | internal check endpoint | SSRF guard | none | link preview/security | `PARTIAL`; must not be publicly abusable |

## Live API Checks

| Check | Result |
| --- | --- |
| `GET https://api.modula.digital/v1/meta` | 200, Greenfield preview, invite-only true |
| `GET https://api.modula.digital/v1/health/ready` | 200 ready |
| Invalid login | 401 `UNAUTHENTICATED`, message `Invalid credentials` |
| Register without invite | 403 `FORBIDDEN`, message `Valid invitation required` |
| Local documented test invite against live | 403 `FORBIDDEN` |
| Remote demo credentials | 401 expected invalid credentials |
| `GET /v1/feed/home?mode=forYou` | 200 but returned old validation-style posts and feed labels not proving ranking |
| `GET /v1/stories/rail` | 404 route not found |
| `GET /v1/discover` | 200 with static-looking trends/profiles/modules/reels |
| `GET /v1/reels` | 200 with static preview-like reel entries, no real playback proof |
| `GET /v1/activity` | 200 with old static-looking activity items |

## API Verdict

The API surface is broad and structurally present, but "route exists" does not equal product readiness. Immediate risks are live deployment drift from current main, invite-only registration blocking new users, preview/static data surfacing as product content, and security proof gaps around admin-like operations and module/AI invocation.
