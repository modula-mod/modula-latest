# Phase 7H Stories Contract Reconciliation

Date: 2026-08-08
Branch: `phase7h-production-social-hardening`
Scope: Checkpoint A, Stories API 404 and source contract reconciliation.

## Decision

The canonical source contract is `GET /v1/stories/rail`.

Do not add a duplicate route. The frontend and backend source agree on `/v1/stories/rail`; the live 404 is a deployed artifact/runtime drift issue until proven otherwise.

## Source Evidence

- Frontend repository: `src/data/repositories/api/ApiStoriesRepository.ts`
  - `getRail()` calls `GET /v1/stories/rail`.
  - `getGroup(groupId)` calls `GET /v1/stories/:groupId`.
  - `create(input)` calls `POST /v1/stories`.
  - `markViewed(itemId)` calls `POST /v1/stories/items/:itemId/viewed`.
  - `deleteItem(itemId)` calls `DELETE /v1/stories/items/:itemId`.
- Backend route module: `services/greenfield-api/src/app/register-phase7f-stories-routes.ts`
  - Registers the same five story API routes plus `GET /v1/media/stories/:mediaFile`.
- Backend route registration: `services/greenfield-api/src/app/register-routes.ts`
  - Calls `registerPhase7fStoriesRoutes(app, db, config, {sessions, feedConfig, writeConfig})`.
- Migration: `services/greenfield-api/migrations/028_phase7f_stories.sql`
  - Creates `greenfield_story_groups`, `greenfield_story_items`, and `greenfield_story_views`.

## Live Evidence

Command:

```sh
curl -sS -i --max-time 20 https://api.modula.digital/v1/meta
```

Result on 2026-08-08 at 18:25 UTC:

- HTTP 200.
- `backend: "greenfield"`.
- `environment: "preview"`.
- Legacy metadata still advertises `capabilities.inviteOnly: true`.
- The new Phase 7H `registration` object is not yet deployed.

Command:

```sh
curl -sS -i --max-time 20 https://api.modula.digital/v1/stories/rail
```

Result on 2026-08-08 at 18:25 UTC:

- HTTP 404.
- Body: `Route GET:/v1/stories/rail not found`.

## Finding

The source branch contains the route. The frontend source calls the same route. Therefore the observed live 404 is not caused by an obsolete frontend endpoint or an in-repo route rename.

Likely causes:

- The deployed API artifact predates `register-phase7f-stories-routes.ts`.
- The live process was not restarted after the Phase 7F route module landed.
- The live deployment is running a branch/commit before `028_phase7f_stories.sql` and route registration.
- The live route registration path is conditionally missing in the deployed artifact.

## Current Source Capability

Implemented in source:

- Story rail.
- Story group viewer.
- Image/video story create through `POST /v1/stories`.
- Caption.
- Visibility: `public`, `followers`, `close`.
- Multiple items per active author group.
- Viewed state with `UNIQUE (item_id, viewer_actor_id)`.
- Partial/viewed/unviewed ring state.
- Expiry through `expires_at`.
- Owner delete through soft deletion.

Not production-complete for Phase 7H:

- No upload intent/session/checksum contract.
- Story creation currently accepts `base64`; it does not use a bounded native upload pipeline.
- No media processing state beyond `uploading`, `ready`, `failed`.
- No thumbnail/poster artifact contract.
- No Story report route.
- No Story share route.
- No Story reaction route.
- No retry-failed-upload route.
- No persistent progress/completion field; views are item-level only.
- `canViewGroup` checks owner/public/follow relationship, but does not yet enforce block/mute policy.
- Media authorization is indirect through `listRail`; it needs a direct policy decision for production.

## Phase 7H Contract Target

One canonical Story contract must cover:

- Upload intent -> byte upload -> checksum verification -> processing -> create Story.
- `id`, `authorId`, `mediaId`, `mediaType`, `caption`, `visibility`, `createdAt`, `expiresAt`, `deletedAt`, `moderationState`.
- Persistent views with `storyId`, `viewerId`, `viewedAt`, and progress/completed where media duration requires it.
- Active Story rail derived server-side from unexpired, visible, non-deleted records.
- Server enforcement for expired, blocked, muted, deleted, moderated, and visibility-restricted content.

## Next Required Action

Deploy/push the Phase 7H registration metadata and existing Phase 7F story route registration before using the live preview API for Story acceptance. After deployment, rerun:

```sh
curl -sS -i https://api.modula.digital/v1/meta
curl -sS -i https://api.modula.digital/v1/stories/rail
```
