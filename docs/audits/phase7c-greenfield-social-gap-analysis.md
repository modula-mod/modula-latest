# Phase 7C Greenfield Social Gap Analysis

Status: Phase 7C implementation audit.
Repository: `/home/andrei/modula-latest`
Branch: `phase7c-modula-product-realisation`
Baseline: `e0bd75ab1aad294ef4e1a2e3244c999ddbc23f23`

## Route Inventory

Core Greenfield routes live in `services/greenfield-api/src/app/register-routes.ts`.
Phase 6S social completion routes live in `services/greenfield-api/src/app/register-phase6s-routes.ts`.
Module routes live under `services/greenfield-api/src/modules/routes/index.ts`.

| Area | Status | Evidence | Phase 7C action |
| --- | --- | --- | --- |
| Accounts | Implemented but incomplete | `/v1/accounts/register`, verify email, resend verification, handle availability, account me, handle change | Onboarding UI still needs progressive Alpha flow and real verification UX polish. |
| Sessions | Implemented but incomplete | `/v1/sessions`, `/v1/sessions/refresh`, revoke current, revoke by id, list account sessions | Core token rotation exists; native acceptance must still validate cold start, expiry, revocation, disabled accounts and offline start. |
| Profiles | Implemented but incomplete | `/v1/profiles/:handle`, `/v1/profiles/:handle/posts`, `/v1/profiles/me`, profile repository hydration | Unified profile exists; editing remains limited to display name and bio in Greenfield writes. |
| Follows | Production ready for Alpha | `/v1/profiles/:profileId/follow`, delete follow, followers/following lists | Phase 7C fixed route response to return hydrated profile, relationship and follower count. |
| Posts | Implemented but incomplete | `/v1/feed/home`, `/v1/posts`, get/update/delete post | Text/link/module/media contracts exist; media upload remains disabled by `/v1/meta`. |
| Media | Prototype | post media rows and seeded media; capability flag `mediaUpload=false` | Founder Alpha media publish requires upload/processing worker before release acceptance. |
| Comments | Production ready for Alpha | `/v1/posts/:postId/comments`, create/list; comment update/delete service | Depth bounded to 4 and deeper replies flatten. UI still needs final polish and moderation flows. |
| Replies | Production ready for Alpha | `/v1/comments/:commentId/replies`, create/list; bounded depth | UI supports expansion; acceptance needs browser/native coverage. |
| Reactions | Production ready for Alpha | `/v1/posts/:postId/reaction`, `/v1/posts/:postId/reactions`, comment reactions | Phase 7C restricted reactions to Like, Celebrate, Insightful, Support and Curious. |
| Reposts | Implemented but incomplete | `/v1/posts/:postId/repost`, delete repost | Row action exists; repost wrapper distinction still needs final UI acceptance. |
| Quotes | Implemented but incomplete | `/v1/posts/:postId/quote`, composer quote mode | Quote create path exists; delete quote and quote analytics remain deferred. |
| Saves | Production ready for Alpha | `/v1/posts/:postId/save`, delete save, `/v1/saves` | Saved list is account-backed; Save to Vault flows through Vault Notes route. |
| Notifications | Implemented but incomplete | `/v1/notifications`, mark item read, mark all read, worker notification jobs | Read state exists; settings persistence and OS push are not complete. |
| Search | Implemented but incomplete | `/v1/search`, `SearchRepository` | People/posts/modules/tools/functions search exists at repository level; spelling tolerance and pagination acceptance remain. |
| Recommendations | Prototype | `/v1/discover`, seeded discovery repository | Suggested people reasons need final backend provenance. |
| Blocks | Production ready for Alpha | `/v1/profiles/:profileId/block`, delete block, moderation repository exclusion | Review UI exists as preview; enforcement is used by feeds/profile/comment queries. |
| Mutes | Production ready for Alpha | `/v1/profiles/:profileId/mute`, delete mute, feed/comment exclusion | Muted-account settings UI remains preview. |
| Reports | Implemented but incomplete | `/v1/reports`, moderation repository, audit record | Minimal review record exists; restricted review workflow is not complete. |
| Board layout | Production ready for Alpha | `/v1/board/layout`, `BoardLayoutService`, `greenfield_board_layouts` | Phase 7C added account-backed layout sync for Board widget order/hide. |
| Drafts | Prototype | Composer AsyncStorage draft retention | Offline drafting exists locally; account-backed drafts remain deferred. |

## Backend Gaps Still Required

- Media upload and processing are still disabled, so Founder Alpha can publish text today but not production media.
- Notification settings are UI-local and need Greenfield preference persistence before push/email controls can be called complete.
- Search needs cancellation/pagination proof on the client and spelling tolerance where available on the backend.
- Suggested people reasons are presentational until recommendation provenance is backed by Greenfield data.
- Public moderation review workflow is minimal; admin review queue is not a finished console.
- Data export and account deletion preparation exist as repository export primitives, but full deletion worker orchestration remains deferred.

## Safety Notes

- AT Protocol remains optional and disabled by the current `/v1/meta` capability flags.
- DIMON remains inactive and must not expose wallet, balance, transfer, billing or payment controls as live.
- Module execution remains governed by the Phase 7B module-host/runtime boundaries; remote/community execution stays disabled.
- Board layout data is account-scoped and stores only widget ids, version and updated timestamp. It does not store note contents, post bodies or module private records.
