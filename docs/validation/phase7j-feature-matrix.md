# Phase 7J — Feature matrix

Date: 2026-08-11  
Branch: `phase7j-product-convergence`  
API under test: private Greenfield via `127.0.0.1:4020`

Status: **PASS** | **PARTIAL** | **FAIL / MISSING** | **BLOCKED_BACKEND**

## Core social

| Feature | Client | API | Priority | Notes |
|---|---|---|---|---|
| Auth / session restore | PASS | PASS | P0 | SESSION_RESTORE gate PASS (lab account evidence) |
| Posts create | PASS | PASS | P0 | Composer → `POST /v1/posts` |
| Posts edit | PARTIAL | PASS | P0 | Client `updatePost` + owner overflow Edit → compose; composer submit path still needs edit mode wiring |
| Posts delete | PARTIAL | PASS | P0 | Client `deletePost` + owner overflow → confirm on post detail |
| Reactions | PARTIAL | PARTIAL | P0 | Types are like/celebrate/insightful/support/curious — not Love/Laugh/Fire |
| Comments / replies | PARTIAL | PASS | P0 | Create/list wired; reply UI thin |
| Follow | PASS | PASS | P0 | |
| Block / mute / report | FAIL / MISSING | PASS | P0 | Preview screens only |
| Bookmarks | PASS | PASS | P1 | |
| Repost | PASS | PASS | P0 | |
| Quote | PARTIAL | PASS | P1 | |
| Share | PARTIAL | N/A | P2 | OS share sheet |
| Stories | PASS | PARTIAL | P0 | Rail empty-real on tunnel; create E2E needed |
| Search | PASS | PASS | P1 | |
| Notifications / Activity | PARTIAL | PASS | P0 | Read path; generation matrix unproven |

## Shell / product / labs

| Feature | Client | API | Priority | Notes |
|---|---|---|---|---|
| Product Hub / modules / Vault Notes | PARTIAL | PASS | P0 | Honesty gaps; Vault Notes generic host |
| Appearance / Settings | PARTIAL | PASS | P1 | Theme sync real; some Preview rows |
| Drawer | PASS | N/A | P1 | Crash + restore fixed; monitor freeze |
| UI Lab `/dev/ui-lab` | PARTIAL | N/A | P2 | Present as `/settings/developer/expo-ui`; rename/route |
| Production Preview mocks | FAIL | N/A | P0 | Preview nav still reachable |

## P0 queue (implementation order)

1. Wire post edit + delete client → existing Greenfield routes
2. Real block / mute / report (or hide Preview)
3. Reaction product decision (Love/Laugh/Fire vs current taxonomy)
4. Gate Preview destinations behind dev-only
5. Comments reply E2E
6. Stories create → rail E2E on VPS
7. Notification generation proof
8. Quote acceptance
9. Vault Notes / Product Hub honesty
10. MotionTokens adoption (springs + Reduce Motion) across drawer/feed

## Evidence

- Session restore: `docs/validation/evidence/phase7j-session-restore/50-52-*.png`
- Mac-B: `docs/validation/phase7i-mac-b-final.md`
