# Greenfield Unified Search

Phase 7E Block 4 introduces a single Greenfield search platform for durable, permission-aware discovery. Search is implemented as a domain projection, not as ad hoc query assembly inside each entity route.

## Scope

The first searchable entities are:

- posts;
- profiles;
- modules;
- module releases.

Vault Notes, connected files, AI retrieval, automations and DIMON records are not indexed in this block. The search document contract is intentionally entity-extensible so those systems can attach later without changing the projection lifecycle.

## Architecture

The API domain lives under `services/greenfield-api/src/domains/search/`.

- `contracts.ts` defines internal service inputs and row shapes.
- `query-parser.ts` normalizes requests, validates limits and decodes cursors.
- `repository.ts` owns PostgreSQL persistence, full-text queries, recent searches, saved searches, diagnostics and reindex request records.
- `service.ts` enforces account scope, calls the policy engine, redacts result metadata and emits reindex audit/event records.
- `ranking.ts` keeps ranking deterministic and explainable.
- `visibility.ts` maps projection rows into policy resources and public result contracts.
- `serializers/` contains entity-specific projection serializers.

The worker projection domain lives under `services/greenfield-worker/src/search/`.

- `subscribers.ts` maps domain event types to projector IDs.
- `projector.ts` applies versioned documents, tombstones, projection state and sanitized failure records.
- entity projectors read source records and produce canonical search documents.
- `index.ts` dispatches projection work and runs bounded reindex jobs.

Shared contracts are exported from:

- `packages/greenfield-contracts/src/search.ts`;
- `packages/api-contracts/src/search.ts`.

## Storage

Migration `services/greenfield-api/migrations/021_phase7e_unified_search.sql` creates:

- `search_documents` for versioned projections with a storage-neutral public document shape and a PostgreSQL `tsvector` implementation detail;
- `search_projection_state` for projector progress, lag and last failure metadata;
- `search_projection_failures` for stable, sanitized projection failures;
- `saved_searches` for account-owned saved search persistence;
- `recent_searches` for account-scoped recent queries;
- `search_query_metrics` for latency and result-count diagnostics;
- `search_reindex_requests` for controlled operator reindex work.

The rollback is `services/greenfield-api/migrations/021_phase7e_unified_search.down.sql`.

## Indexing Lifecycle

The intended flow is:

```
entity write
  -> metadata-only Greenfield domain event
  -> search-index event delivery
  -> worker projector
  -> versioned search document
  -> permission-aware API query
  -> policy evaluation and redacted result
```

Projection events currently covered:

- posts: `post.created`, `post.updated`, `post.deleted`, `post.visibility-changed`;
- profiles: `profile.updated`, `profile.visibility-changed`, `account.deactivated`, `account.deletion-requested`;
- modules: `module.discovered`, `module.installed`, `module.updated`, `module.quarantined`, `module.uninstalled`, `module.health-changed`;
- module releases: `module.release.imported`, `module.release.published`, `module.release.quarantined`, `module.release.revoked`.

Search operational events such as `search.document-indexed` and `search.projection-failed` are internal diagnostics and do not trigger ordinary entity projection.

## Source Versions

Every document has a `sourceVersion`. Projectors enforce:

- lower incoming version: ignore as stale;
- equal incoming version: idempotent write;
- higher incoming version: replace projection.

This prevents late delivery from overwriting newer indexed content. Duplicate event delivery is handled by the existing event delivery inbox plus the unique `(entity_type, entity_id)` search identity.

## Query Model

`GET /v1/search` accepts the canonical request model: query, entity types, tags, owner/account filters, created/updated windows, sort, limit and cursor.

Search uses bounded, opaque cursors. The first implementation uses offset-backed cursors encoded through the search parser, which keeps cursor validation centralized and avoids exposing SQL rank internals.

## Ranking

Initial ranking is deterministic:

- full-text match rank;
- exact profile handle boost;
- handle prefix boost;
- exact and prefix title boosts;
- tag match boost;
- entity weight;
- recency;
- module trust/availability boost.

The platform does not implement embeddings, vector search, AI summaries or personalized AI ranking in Block 4.

## API Routes

Public and account-aware routes:

- `GET /v1/search`;
- `GET /v1/search/suggestions`;
- `GET /v1/search/recent`;
- `POST /v1/search/recent`;
- `DELETE /v1/search/recent`;
- `GET /v1/search/saved`;
- `POST /v1/search/saved`;
- `PATCH /v1/search/saved/:savedSearchId`;
- `DELETE /v1/search/saved/:savedSearchId`.

Operator routes require `admin:ops`:

- `GET /v1/admin/ops/search/health`;
- `GET /v1/admin/ops/search/projections`;
- `GET /v1/admin/ops/search/failures`;
- `POST /v1/admin/ops/search/reindex`;
- `POST /v1/admin/ops/search/failures/:failureId/retry`.

## Future Extension

Future systems should add a serializer, event subscription, projector test and policy mapping. They should not add entity-specific search routes unless the route exposes a genuinely different product workflow.
