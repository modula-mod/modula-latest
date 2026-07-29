# Search Reindex And Recovery

Unified search uses projections. Recovery work should repair the projection stream or replay source records, not patch search results by hand.

## Diagnostics

Operator diagnostics are available through:

- `GET /v1/admin/ops/search/health`;
- `GET /v1/admin/ops/search/projections`;
- `GET /v1/admin/ops/search/failures`.

Health data includes:

- document counts by entity type;
- document counts by status;
- projection lag;
- oldest pending search-index delivery;
- last successful projection;
- unresolved projection failures;
- stale document count;
- deleted tombstone count;
- average and p95 search latency when metrics exist.

Operator routes require `admin:ops`.

## Projection Failure Handling

Projection failures are written to `search_projection_failures` with:

- projector ID;
- event ID;
- entity type and entity ID;
- stable failure code;
- attempt count;
- first and last failure timestamps;
- sanitized details.

Do not add raw source content to `sanitised_details`. The field is for stable operational context only.

To retry a resolved source issue:

```
POST /v1/admin/ops/search/failures/:failureId/retry
```

The retry operation marks the associated event delivery retryable. The event worker remains responsible for reprocessing.

## Reindex Modes

Use `POST /v1/admin/ops/search/reindex` with a required reason.

Supported modes:

- `single-entity`: requires `entityType` and `entityId`;
- `entity-type`: requires `entityType`;
- `account-scope`: requires `accountId`;
- `full-index`: enqueues bounded work;
- `dryRun`: validates the selected mode and candidate count without replacing documents.

Full reindexing is not executed synchronously by the HTTP route. The API records a reindex request, emits audit and `search.reindex-requested`, then enqueues a `search.reindex` background job.

## Safety Rules

Reindexing must:

- be operator-protected;
- require a reason;
- emit audit records;
- use bounded batches;
- support cancellation through `search_reindex_requests.cancellation_requested_at`;
- avoid deleting healthy documents before replacements are ready;
- record failures through projection failure handling;
- carry request and correlation IDs.

## Recovery Workflow

1. Check `/v1/admin/ops/search/health`.
2. Inspect `/v1/admin/ops/search/projections` for lag or last failure code.
3. Inspect `/v1/admin/ops/search/failures` for unresolved projector failures.
4. Fix the source data, serializer or permissions issue.
5. Retry the failed delivery or request a scoped reindex.
6. Confirm document counts, tombstone counts and search result behavior.

## Migration Recovery

Apply migration `021_phase7e_unified_search.sql` with the standard Greenfield migration runner.

Rollback is supported by `021_phase7e_unified_search.down.sql`. The Phase 7E search verifier applies the migrations on an isolated database, runs the DB-backed tests, rolls back `021`, confirms the search table is removed, and drops the temporary database.

## Future Replays

Future Vault Notes, file, AI, automation and DIMON projectors should follow the same operational shape:

- metadata-only source events;
- serializer-specific allowlists;
- versioned search documents;
- sanitized failures;
- scoped reindex modes;
- policy-aware result reads.
