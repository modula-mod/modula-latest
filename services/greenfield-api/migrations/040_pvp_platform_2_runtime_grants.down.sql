REVOKE SELECT, INSERT, UPDATE, DELETE ON
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
FROM modula_api, modula_worker;

REVOKE SELECT ON
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
FROM modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '039')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
