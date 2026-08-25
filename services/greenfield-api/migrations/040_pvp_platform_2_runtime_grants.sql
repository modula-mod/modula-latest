-- PVP Platform Phase 2: restore least-privilege runtime access for tables
-- introduced by migrations 038 and 039.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_module_ratings,
  greenfield_extension_targets,
  greenfield_extension_points,
  greenfield_extension_installation_edges,
  greenfield_extension_contribution_registrations,
  greenfield_extension_capability_grants,
  greenfield_extension_service_assertions,
  greenfield_extension_event_subscriptions,
  greenfield_extension_job_executions,
  greenfield_extension_entity_metadata,
  greenfield_extension_runtime_projection
TO modula_api, modula_worker;

GRANT SELECT ON
  greenfield_module_ratings,
  greenfield_extension_targets,
  greenfield_extension_points,
  greenfield_extension_installation_edges,
  greenfield_extension_contribution_registrations,
  greenfield_extension_capability_grants,
  greenfield_extension_service_assertions,
  greenfield_extension_event_subscriptions,
  greenfield_extension_job_executions,
  greenfield_extension_entity_metadata,
  greenfield_extension_runtime_projection
TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '040')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
