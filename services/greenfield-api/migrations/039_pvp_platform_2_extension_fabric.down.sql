DELETE FROM greenfield_event_subscriptions
WHERE subscriber_id = 'search.vault-notes-projector'
  AND event_type IN (
    'vault.note.created.v1',
    'vault.note.updated.v1',
    'vault.note.archived.v1',
    'vault.note.deleted.v1',
    'vault-notes.note.unarchived.v1',
    'vault-notes.note.restored.v1',
    'vault-notes.note.permanently-deleted.v1',
    'vault.collection.created.v1',
    'vault.collection.updated.v1',
    'vault-notes.folder.deleted.v1'
  );

DROP TABLE IF EXISTS greenfield_extension_runtime_projection;
DROP TABLE IF EXISTS greenfield_extension_entity_metadata;
DROP TABLE IF EXISTS greenfield_extension_job_executions;
DROP TABLE IF EXISTS greenfield_extension_event_subscriptions;
DROP TABLE IF EXISTS greenfield_extension_service_assertions;
DROP TABLE IF EXISTS greenfield_extension_capability_grants;
DROP TABLE IF EXISTS greenfield_extension_contribution_registrations;
DROP TABLE IF EXISTS greenfield_extension_installation_edges;
DROP TABLE IF EXISTS greenfield_extension_points;
DROP TABLE IF EXISTS greenfield_extension_targets;

DROP INDEX IF EXISTS greenfield_module_releases_product_kind_idx;
ALTER TABLE greenfield_module_releases
  DROP COLUMN IF EXISTS extension_product,
  DROP COLUMN IF EXISTS product_kind;
