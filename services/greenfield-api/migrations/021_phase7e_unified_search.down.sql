-- Roll back Phase 7E Block 4 unified search infrastructure.

DELETE FROM greenfield_event_subscriptions
WHERE subscriber_id IN (
  'search.post-projector',
  'search.profile-projector',
  'search.module-projector',
  'search.module-release-projector'
);

DELETE FROM greenfield_event_schema_registry
WHERE event_type IN (
  'module.release.imported',
  'module.release.published',
  'module.release.quarantined',
  'module.release.revoked',
  'search.document-indexed',
  'search.document-deleted',
  'search.projection-failed',
  'search.reindex-requested',
  'search.reindex-completed',
  'search.reindex-failed'
);

DROP TABLE IF EXISTS search_reindex_requests;
DROP TABLE IF EXISTS search_query_metrics;
DROP TABLE IF EXISTS recent_searches;
DROP TABLE IF EXISTS saved_searches;
DROP TABLE IF EXISTS search_projection_failures;
DROP TABLE IF EXISTS search_projection_state;
DROP TABLE IF EXISTS search_documents;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','020') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
