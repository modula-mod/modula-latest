# Phase 7J — Feature matrix

Date: 2026-08-11  
Branch: `phase7j-product-convergence`  
API under test: private Greenfield via `127.0.0.1:4020`  
API image (tunnel): `modula-greenfield-api:2141c59-authbridge`

Status: **PASS** | **PARTIAL** | **FAIL / MISSING** | **BLOCKED_BACKEND**

## Core social

| Feature | Client | API | Priority | Notes |
|---|---|---|---|---|
| Auth / session restore | PASS | PASS | P0 | SESSION_RESTORE gate PASS (lab account evidence) |
| Posts create | PASS | PASS | P0 | Composer → `POST /v1/posts` (auth bridge required) |
| Posts edit | PASS | PASS | P0 | Composer edit mode → `useUpdatePostMutation` / `PATCH /v1/posts/:id` |
| Posts delete | PASS | PASS | P0 | Owner overflow → confirm on post detail → `DELETE /v1/posts/:id` |
| Reactions | PASS | PASS | P0 | Taxonomy locked: like/celebrate/insightful/support/curious (not Love/Laugh/Fire). One active per actor+post; transitions proven on post `794da78d` |
| Comments / replies | PARTIAL | PASS | P0 | Create/list wired; reply UI thin |
| Follow | PASS | PASS | P0 | |
| Block / mute / report | PASS | PASS | P0 | Real client `ModerationRepository`; mute-words + blocked-list UIs honestly unavailable (no list APIs). API proof mute/block/report + unblock/unmute |
| Bookmarks | PASS | PASS | P1 | |
| Repost | PASS | PASS | P0 | |
| Quote | PARTIAL | PASS | P1 | |
| Share | PARTIAL | N/A | P2 | OS share sheet |
| Stories | PASS | PASS | P0 | Create→rail E2E after media root perms fix (`groupId` `c2639656…`, `itemCount=1`) |
| Search | PASS | PASS | P1 | |
| Notifications / Activity | PASS | PASS | P0 | Follow generates persisted rows; `GET /v1/notifications` + mark-read persist `readAt` |

## Shell / product / labs

| Feature | Client | API | Priority | Notes |
|---|---|---|---|---|
| Product Hub / modules / Vault Notes | PARTIAL | PASS | P0 | Honesty gaps; Vault Notes generic host |
| Appearance / Settings | PARTIAL | PASS | P1 | Theme sync real; some Preview rows remain labs-visible |
| Drawer | PASS | N/A | P1 | Crash + restore fixed; Preview profile gated |
| UI Lab `/dev/ui-lab` | PARTIAL | N/A | P2 | Present as `/settings/developer/expo-ui`; rename/route |
| Production Preview mocks | PASS | N/A | P0 | Expansion/lab destinations `devOnly`; engagement Preview overflow labs-only |

## Backend note (auth bridge)

Greenfield account session tokens (`POST /v1/sessions`) previously authenticated account routes only. Social write routes used legacy `request.auth` via `attachAuth`. Phase 7J added `attachGreenfieldAccountAuth` so signed-in Modula accounts can mute/block/report/post/react/stories. Deployed to production API image `2141c59-authbridge`.

## P0 queue (implementation order)

1. ~~Wire post edit + delete client → existing Greenfield routes~~ **PASS**
2. ~~Real block / mute / report (or hide Preview)~~ **PASS**
3. ~~Reaction product decision (Love/Laugh/Fire vs current taxonomy)~~ **PASS** (keep shipped taxonomy)
4. ~~Gate Preview destinations behind dev-only~~ **PASS**
5. Comments reply E2E — remaining
6. ~~Stories create → rail E2E on VPS~~ **PASS**
7. ~~Notification generation proof~~ **PASS**
8. Quote acceptance
9. Vault Notes / Product Hub honesty
10. MotionTokens adoption (springs + Reduce Motion) across drawer/feed — started earlier

## Evidence

- Session restore: `docs/validation/evidence/phase7j-session-restore/50-52-*.png`
- Mac-B: `docs/validation/phase7i-mac-b-final.md`
- Reactions: post `794da78d-266c-4ceb-9220-cb0b8f69a94e` transition log (like→celebrate→insightful→like→curious→clear, `total` stayed ≤1)
- Stories: group `c2639656-ec3f-48d9-b233-f4e277348ebb` / item `48932789-5a3d-4219-aa1e-568c918d0c62`
- Notifications: follow → `0b4a774e-…` then mark-read set `readAt`
- Commits (this queue): `e7c2dd4` edit · `2141c59` moderation+auth bridge · `1e58586` Preview gate · `cbb6bb7` reactions · `3660958` stories · (matrix update)
