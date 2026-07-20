# Phase 6S — Product completion audit

**Date:** 2026-07-18  
**Branch:** `phase6s-social-product-completion` (from `phase6-greenfield-sovereign-core`)  
**Base tip audited:** `88695cd969a1b5c5aa2f4a1e0821ef287a9abe7d`  
**API:** `https://api.modula.digital`  
**Classification rule:** Evidence from routes, migrations, UI wiring, and repository contracts — not folder structure alone.

## Legend

| Class | Meaning |
| --- | --- |
| **WORKING** | End-to-end path exists and is coherent against Greenfield |
| **PARTIAL** | Significant pieces exist but gaps block product completeness |
| **STATIC ONLY** | UI or seed data only; no durable remote behaviour |
| **API ONLY** | Backend route/table exists; no usable frontend wiring |
| **UI ONLY** | Frontend surface exists; no matching Greenfield persistence |
| **BROKEN** | Wired but contract/behaviour fails against Greenfield |
| **MISSING** | No meaningful implementation for Phase 6S scope |

---

## Feature audit

| Feature | Class | Evidence |
| --- | --- | --- |
| Authentication | PARTIAL | Greenfield email/password sessions exist (`services/greenfield-api` sessions + `ApiAuthRepository`); invite-only preview; SMTP not configured. |
| Registration | PARTIAL | Register UI → `/v1/accounts/register` works; public registration blocked without invite/SMTP. |
| Verification | BROKEN | Backend activates account; frontend `ApiAuthRepository` throws after successful verify so UI treats success as failure. |
| Sessions | WORKING | Access/refresh rotation, reuse detection, list/revoke UI (`AccountSessionsScreen`). |
| Home feed | PARTIAL | `/v1/feed/home` + `HomeFeedScreen` exist; default local simulator still common in development; engagement fields incomplete. |
| Post creation | PARTIAL | Text create works via Composer → Greenfield; media/link/poll payloads not persisted. |
| Post editing | API ONLY | `PATCH /v1/posts/:postId` with version checks; no frontend edit mutation found. |
| Post deletion | API ONLY | Soft-delete route exists; no frontend delete action found. |
| Reactions | BROKEN / MISSING | Only like toggle (`POST/DELETE …/like`) returning `{ok:true}`; no multi-reaction types; FE expects full engagement object. |
| Comments | STATIC ONLY / MISSING | Post detail shows hard-coded reply rows; no comment tables/routes. |
| Replies | MISSING | No reply-parent model; composer `replyTo` not sent to API. |
| Reposts | BROKEN | Route/table exist; FE/API engagement response mismatch. |
| Quote posts | STATIC ONLY / MISSING | UI “Quote (Preview)” alert only; no quote post model. |
| Saves | BROKEN | Save mutate exists; FE expects engagement object; saved-list route missing on Greenfield. |
| Follows | BROKEN | Follow routes return `{following}`; FE decodes profile + counts → decode failure. |
| Notifications | API ONLY | List/read routes + table exist; Activity UI uses `/v1/activity` + local read state, not notification APIs. |
| Search | API ONLY | `/v1/search` exists; Discover filters local discovery results and does not call search. |
| Profiles | PARTIAL | Profile read/posts/followers routes + screens exist; Greenfield account profiles and legacy actor rows are not fully aligned. |
| Profile editing | PARTIAL | Edit UI + `/v1/profiles/me` exist; capability path still tied to legacy actor session assumptions. |
| Appearance | PARTIAL | Full local appearance/theme system works; **no** server appearance API or sync. |
| Accessibility | PARTIAL | Accessibility settings UI exists; Phase 6S large-text / VO labels for new social controls not validated. |
| Composer | PARTIAL | Full composer UX; only text reliably reaches Greenfield. |
| Media | UI ONLY | Capture/preview local; no media upload/persist path on Greenfield posts. |
| Links | STATIC ONLY | Composer inserts demo link; Phase-1 placeholder, no backend. |
| Extension catalogue | PARTIAL | Extension Centre + `/v1/extensions` exist; published catalogue thin; Marketplace still seeded static. |
| Extension installation | BROKEN | Backend install/uninstall exist; FE lacks install flow and mishandles failures. |
| Plugin lifecycle | API ONLY | Plugin listing/status internals exist; no lifecycle job UI or failure isolation product surface. |
| Functions | PARTIAL | Invoke route + composer states; few/no live invokeable functions; background/native intentionally limited. |
| Tools | PARTIAL | `/v1/tools` registry + drawer; many tools preview/placeholder; module tools honestly unavailable. |
| Offline behaviour | PARTIAL | Banner + React Query online mode; no durable remote offline queue. |
| Error states | PARTIAL | Shared query error/retry exists; several screens report false success or swallow errors. |

---

## Contract gaps for Phase 6S

Missing from `packages/greenfield-contracts` at audit time:

- Multi-reaction types and summaries
- Comments / threads
- Repost / quote-post contracts
- Social counts + interaction state
- Notifications (typed kinds / subjects)
- Synced appearance preferences
- Extension catalogue / installation / lifecycle status events

Existing related contracts: account, session, repository, record, extension, function, tool, plugin, module, connector, widget, bridge.

---

## Backend route gaps (social product)

Present: feed, posts CRUD, like/save/repost toggles, follows, blocks/mutes/reports, notifications list/read, search, extensions list, tools.

Absent or incomplete vs Phase 6S:

- `PUT/DELETE/GET …/reaction` (multi-reaction)
- Comment / reply CRUD + comment reactions
- Quote post create
- Private saves list (`GET /v1/saves`)
- Appearance `GET/PATCH /v1/accounts/me/appearance`
- Recovery request/complete (if incomplete)
- Extension enable/disable/configure/lifecycle events
- Function job status/cancel
- Mention resolution storage

---

## Frontend gaps (social product)

- No shared `social-post` renderer used across Home/Profile/Search/Discover/Saved/Detail
- No multi-reaction picker
- Comments are static demo rows
- Quote is preview alert
- Activity not wired to Greenfield notifications
- Appearance not synced to Greenfield
- Extension Centre incomplete install/lifecycle states
- Auth verification UX broken after successful activation

---

## Constraints confirmed

- AT Protocol remains optional (not required for accounts).
- DIMON remains inactive (contracts reserved; no balances).
- Phase 6R PR must **not** be merged until Phase 6S gates pass.
- Physical iPhone / TestFlight acceptance was **BLOCKED** in Phase 6R PART 5 (no device; SMTP/invite limits).

---

## Phase 6S workstreams implied

1. Contracts (PART 1) — this branch foundation.  
2. Greenfield social backend + verification/recovery + extensions (PART 2).  
3. Native social frontend completion (PART 3).  
4. VPS migrate/seed/restore/live acceptance (PART 4).  
5. Simulator + physical + TestFlight (PART 5).  
6. PR to `phase6-greenfield-sovereign-core` only after all gates (PART 6).
