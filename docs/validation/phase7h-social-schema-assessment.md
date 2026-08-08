# Phase 7H Social Schema Assessment

Date: 2026-08-08
Branch: `phase7h-production-social-hardening`
Scope: Checkpoint A assessment before adding or changing social storage.

## Rule

Do not create duplicate social tables until the existing schema is exhausted. The current database already has production-relevant primitives for posts, follows, comments, reactions, reposts, saves, reports, blocks, mutes, notifications, and Stories.

## Existing Storage

### Core Posts and Relationships

- `services/greenfield-api/migrations/001_init_schema.sql`
  - `posts`
  - `post_media`
  - `follows`
  - `post_likes`
  - `post_saves`
  - `post_reposts`
  - `idempotency_keys`

Useful invariants already present:

- `follows` has `UNIQUE (follower_actor_id, followed_actor_id)`.
- `post_likes`, `post_saves`, and `post_reposts` have `UNIQUE (actor_id, post_id)`.
- `posts` has `UNIQUE (author_actor_id, idempotency_key)`.

### Moderation and Notifications

- `services/greenfield-api/migrations/002_phase6_social_atproto.sql`
  - `notifications`
  - `notification_preferences`
  - `blocks`
  - `mutes`
  - `reports`
  - `moderation_actions`

Useful invariants already present:

- `blocks` has `UNIQUE (blocker_actor_id, blocked_actor_id)`.
- `mutes` has `UNIQUE (muter_actor_id, muted_actor_id)`.
- Notification read/unread indexes already exist for recipient queries.

### Greenfield Social Product Tables

- `services/greenfield-api/migrations/006_phase6s_social_product.sql`
  - `greenfield_reactions`
  - `greenfield_comments`
  - `greenfield_comment_reactions`
  - `greenfield_quote_posts`
  - `greenfield_mentions`
  - `greenfield_notification_batches`
  - `greenfield_notification_delivery`

Useful invariants already present:

- `greenfield_reactions` has `UNIQUE(actor_id, post_id)`.
- `greenfield_comment_reactions` has `UNIQUE(actor_id, comment_id)`.
- `greenfield_comments` supports parent/root threading and tombstoning.

### Reaction Set Drift

- `services/greenfield-api/migrations/011_phase7c_restrained_reactions.sql`
  - Current source canonical set is `like`, `celebrate`, `insightful`, `support`, `curious`.
- Phase 7H requires `like`, `love`, `laugh`, `fire`.

Decision: evolve existing reaction constraints, contracts, services, and frontend types. Do not create another reaction table.

### Stories

- `services/greenfield-api/migrations/028_phase7f_stories.sql`
  - `greenfield_story_groups`
  - `greenfield_story_items`
  - `greenfield_story_views`

Useful invariants already present:

- `greenfield_story_views` has `UNIQUE (item_id, viewer_actor_id)`.
- Story groups have owner/expires indexes.
- Story items have a group/sort-order index.

## Existing Services and Routes

- `services/greenfield-api/src/app/register-phase6s-routes.ts`
  - `PUT/DELETE /v1/posts/:postId/reaction`.
  - `GET /v1/posts/:postId/reactions`.
  - `GET/POST /v1/posts/:postId/comments`.
  - `GET/POST /v1/comments/:commentId/replies`.
  - `PATCH/DELETE /v1/comments/:commentId`.
  - `PUT/DELETE /v1/comments/:commentId/reaction`.
  - `POST /v1/posts/:postId/quote`.
  - `GET /v1/saves`.
- `services/greenfield-api/src/app/register-routes.ts`
  - `POST/DELETE /v1/posts/:postId/save`.
  - `POST/DELETE /v1/posts/:postId/repost`.
  - `POST/DELETE /v1/profiles/:profileId/follow`.
  - `POST/DELETE /v1/profiles/:profileId/block`.
  - `POST/DELETE /v1/profiles/:profileId/mute`.
  - `POST /v1/reports`.
  - `GET /v1/notifications`.
  - `POST /v1/notifications/:notificationId/read`.
  - `POST /v1/notifications/read-all`.
- `services/greenfield-api/src/app/register-phase7f-stories-routes.ts`
  - Story rail/group/create/view/delete/media routes.

## Assessment by Phase 7H Domain

### Registration

Storage exists for accounts, email verification, recovery, sessions, session tokens, and session events in `004_greenfield_sovereign_core.sql`.

Checkpoint A change required: publish explicit registration mode and default acceptance/development to open. No migration required.

### Stories

Reusable storage exists. Required evolution:

- Add upload-intent/media-processing/checksum fields or related upload tables.
- Add Story report/share/reaction support.
- Add progress/completed view state if video progress must be represented.
- Add moderation state.
- Enforce block/mute policy in Story rail, group, media, and viewed mutations.

Do not add a second Story rail endpoint.

### Reactions

Reusable storage exists. Required evolution:

- Replace Phase 7C reaction set with Phase 7H IDs: `like`, `love`, `laugh`, `fire`.
- Generalize reaction targets across `post`, `comment`, and later `story` without losing current unique actor/target invariants.
- Return the Phase 7H aggregate shape: `total`, `viewerReaction`, `counts`, `top`.
- Add paginated reactors.
- Keep mutation idempotency and one active reaction per actor/target.
- Adjust notifications so reaction flips aggregate instead of spamming.

### Comments

Reusable storage and routes exist. Required evolution:

- Cursor pagination for top-level comments and replies.
- Sort modes: `Top`, `Newest`.
- Explicit `moderationState`.
- Author/profile DTO hydration instead of raw actor IDs only.
- Reaction aggregate on each comment row.
- Stable error codes for not visible, disabled, not editable, blocked, and rate-limited cases.

### Reposts, Quotes, and Bookmarks

Reusable storage exists in `post_reposts`, `greenfield_quote_posts`, and `post_saves`.

Required evolution:

- `post_reposts` mutations in `PostWriteService.setEngagement` need direct visibility/block/mute policy enforcement before Phase 7H production acceptance.
- Repost state and count need authoritative DTO reconciliation after mutations.
- Quote posts need unavailable-source rendering when source becomes private/deleted.
- Bookmarks/saves must remain private and cursor-paginated.
- Copy Link/native sharing/deep-link routes still need production proof.

### Visibility and Privacy

Reusable storage exists for follows, blocks, mutes, post visibility, profile visibility, and reports.

Current risk:

- Feed reads exclude blocked/muted actors.
- Some direct mutations/read services use `GreenfieldPolicyEngine`.
- Legacy engagement paths for save/repost/like need policy checks before direct-ID access can be considered closed.
- Stories currently enforce public/follow/owner but not block/mute.

### Notifications

Reusable storage exists. Required evolution:

- Event types must cover follow, reaction, comment, reply, repost, mention, Story reaction, and module update.
- Notification contents must recheck visibility before display.
- Reaction aggregation must update existing notifications instead of emitting one notification per flip.
- Focus Mode filtering must be proven.

## Migration Guidance

No Phase 7H migration should be created yet for Checkpoint A. Likely future migrations should evolve existing tables:

- `029_phase7h_social_reactions.sql`
- `030_phase7h_story_hardening.sql`
- `031_phase7h_comments_and_sharing.sql`

Those names are placeholders only. Before creating any migration, inspect the live schema and prove no equivalent constraint/index/column already exists.
