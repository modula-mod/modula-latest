# Phase 7J — Feature matrix

Date: 2026-08-11  
Branch: `phase7j-product-convergence`  
API under test: private Greenfield via `127.0.0.1:4020`  
API image (tunnel): `modula-greenfield-api:e29b789-quotehydrate`

Status: **PASS** | **PARTIAL** | **FAIL / MISSING** | **BLOCKED_BACKEND**

## Core social

| Feature | Client | API | Priority | Notes |
|---|---|---|---|---|
| Auth / session restore | PASS | PASS | P0 | SESSION_RESTORE gate PASS (lab account evidence) |
| Posts create | PASS | PASS | P0 | Composer → `POST /v1/posts` (auth bridge required) |
| Posts edit | PASS | PASS | P0 | Composer edit mode → `useUpdatePostMutation` / `PATCH /v1/posts/:id` |
| Posts delete | PASS | PASS | P0 | Owner overflow → confirm on post detail → `DELETE /v1/posts/:id` |
| Reactions | PASS | PASS | P0 | Taxonomy locked: like/celebrate/insightful/support/curious (not Love/Laugh/Fire). One active per actor+post; transitions proven on post `794da78d` |
| Comments / replies | PASS | PASS | P0 | Create/list/reply E2E on `:4020`; PostDetail inline reply UI wired (`c4c1d5a`) |
| Follow | PASS | PASS | P0 | |
| Block / mute / report | PASS | PASS | P0 | Real client `ModerationRepository`; mute-words + blocked-list UIs honestly unavailable (no list APIs). API proof mute/block/report + unblock/unmute |
| Bookmarks | PASS | PASS | P1 | |
| Repost | PASS | PASS | P0 | |
| Quote | PASS | PASS | P1 | `POST /v1/posts/:id/quote` + `GET` embeds `quotedPost` + `quoteCount` (`e29b789-quotehydrate`) |
| Share | PARTIAL | N/A | P2 | OS share sheet |
| Stories | PASS | PASS | P0 | Create→rail E2E after media root perms fix (`groupId` `c2639656…`, `itemCount=1`) |
| Search | PASS | PASS | P1 | |
| Notifications / Activity | PASS | PASS | P0 | Follow generates persisted rows; `GET /v1/notifications` + mark-read persist `readAt` |

## Shell / product / labs

| Feature | Client | API | Priority | Notes |
|---|---|---|---|---|
| Product Hub / modules / Vault Notes | PASS | PASS | P0 | Install + enable E2E: `019fefb7…` → `enabled`; records CRUD after enable; Board widget honest state (`f34c288`) |
| Appearance / Settings | PARTIAL | PASS | P1 | Theme sync real; MotionTokens in drawer/feed/modals (`b52cded`); some Preview rows remain labs-visible |
| Drawer | PASS | N/A | P1 | MotionTokens springs + cancelAnimation stress fix; Reduce Motion fade-only path |
| UI Lab `/dev/ui-lab` | PARTIAL | N/A | P2 | Present as `/settings/developer/expo-ui`; rename/route |
| Production Preview mocks | PASS | N/A | P0 | Expansion/lab destinations `devOnly`; engagement Preview overflow labs-only |

## Backend note (auth bridge)

Greenfield account session tokens (`POST /v1/sessions`) previously authenticated account routes only. Social write routes used legacy `request.auth` via `attachAuth`. Phase 7J added `attachGreenfieldAccountAuth` so signed-in Modula accounts can mute/block/report/post/react/stories. Deployed to production API image `2141c59-authbridge`.

## P0 queue (implementation order)

1. ~~Wire post edit + delete client → existing Greenfield routes~~ **PASS**
2. ~~Real block / mute / report (or hide Preview)~~ **PASS**
3. ~~Reaction product decision (Love/Laugh/Fire vs current taxonomy)~~ **PASS** (keep shipped taxonomy)
4. ~~Gate Preview destinations behind dev-only~~ **PASS**
5. ~~Comments reply E2E~~ **PASS**
6. ~~Stories create → rail E2E on VPS~~ **PASS**
7. ~~Notification generation proof~~ **PASS**
8. ~~Quote acceptance~~ **PASS**
9. ~~Vault Notes / Product Hub honesty~~ **PASS**
10. ~~MotionTokens adoption (springs + Reduce Motion) across drawer/feed~~ **PASS**

## Evidence

- Session restore: `docs/validation/evidence/phase7j-session-restore/50-52-*.png`
- Mac-B: `docs/validation/phase7i-mac-b-final.md`
- Reactions: post `794da78d-266c-4ceb-9220-cb0b8f69a94e` transition log (like→celebrate→insightful→like→curious→clear, `total` stayed ≤1)
- Stories: group `c2639656-ec3f-48d9-b233-f4e277348ebb` / item `48932789-5a3d-4219-aa1e-568c918d0c62`
- Notifications: follow → `0b4a774e-…` then mark-read set `readAt`
- Commits (this queue): `e7c2dd4` edit · `2141c59` moderation+auth bridge · `1e58586` Preview gate · `cbb6bb7` reactions · `3660958` stories · `947f218` matrix · `c4c1d5a` comment replies · `e29b789` quote hydrate · `f34c288` product hub honesty · `b52cded` motion tokens
- Comments E2E: post `acd445d1…` → comment `a15431e1…` → reply `05ef7541…` depth 1
- Quote E2E: source `9e68b640…` quoted by post with embedded `quotedPost.id` + source `quoteCount=1`
- Vault Notes: install `019fefb7…` → enable → `GET records/note` ok → create `019fefbd-51d3…`; views `available=true`
- Motion: `useMotionEntering` + drawer `cancelAnimation` rapid toggle; feed sticky modes use `motion.springs.navigation`
- Simulator reply thread screenshots: **SKIPPED** (no booted iOS Simulator; Mobile MCP unavailable)
