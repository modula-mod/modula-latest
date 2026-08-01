DROP TABLE IF EXISTS greenfield_module_service_invocations;
DROP TABLE IF EXISTS greenfield_module_ui_contribution_registrations;
DROP TABLE IF EXISTS greenfield_module_job_registrations;
DROP TABLE IF EXISTS greenfield_module_secret_refs;
DROP TABLE IF EXISTS greenfield_module_storage_allocations;
DROP TABLE IF EXISTS greenfield_module_lifecycle_stages;
DROP TABLE IF EXISTS greenfield_module_lifecycle_transactions;
DROP TABLE IF EXISTS greenfield_module_hook_registrations;
DROP TABLE IF EXISTS greenfield_module_api_registrations;
DROP TABLE IF EXISTS greenfield_module_service_registrations;
DROP TABLE IF EXISTS greenfield_module_capability_registry;
DROP TABLE IF EXISTS greenfield_module_permission_states;
DROP TABLE IF EXISTS greenfield_module_resolved_dependencies;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','026') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
