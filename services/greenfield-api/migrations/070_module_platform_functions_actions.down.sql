DROP TABLE IF EXISTS greenfield_inter_module_action_requests;
DROP TABLE IF EXISTS greenfield_module_runtime_credentials;
DROP TABLE IF EXISTS greenfield_host_function_requests;
DROP TABLE IF EXISTS greenfield_host_function_executors;
DROP TABLE IF EXISTS greenfield_function_mutations;
DROP TABLE IF EXISTS greenfield_function_invocations;
DROP TABLE IF EXISTS greenfield_function_implementations;

DELETE FROM greenfield_module_contributions WHERE contribution_type = 'interModuleAction';
ALTER TABLE greenfield_module_contributions
  DROP CONSTRAINT IF EXISTS greenfield_module_contributions_contribution_type_check;
ALTER TABLE greenfield_module_contributions
  ADD CONSTRAINT greenfield_module_contributions_contribution_type_check
  CHECK (contribution_type IN ('route','profileTab','boardSurface','setting','schema','tool','function','widget','plugin','connector','job','event'));

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '069')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
