DROP TRIGGER IF EXISTS intelligence_approval_transition_guard ON intelligence_approvals;
DROP FUNCTION IF EXISTS intelligence_validate_approval_transition();
DROP TRIGGER IF EXISTS intelligence_mission_transition_guard ON intelligence_missions;
DROP FUNCTION IF EXISTS intelligence_validate_mission_transition();
DROP TRIGGER IF EXISTS intelligence_ledger_append_only ON intelligence_ledger_events;
DROP FUNCTION IF EXISTS intelligence_reject_ledger_mutation();
ALTER TABLE IF EXISTS intelligence_circuits DROP CONSTRAINT IF EXISTS intelligence_circuits_active_revision_fk;
DROP TABLE IF EXISTS intelligence_circuit_revisions;
DROP TABLE IF EXISTS intelligence_circuits;
DROP TABLE IF EXISTS intelligence_ledger_events;
DROP TABLE IF EXISTS intelligence_artifacts;
DROP TABLE IF EXISTS intelligence_run_steps;
DROP TABLE IF EXISTS intelligence_runs;
DROP TABLE IF EXISTS intelligence_approvals;
DROP TABLE IF EXISTS intelligence_governor_decisions;
DROP TABLE IF EXISTS intelligence_aki_decisions;
DROP TABLE IF EXISTS intelligence_evidence;
DROP TABLE IF EXISTS intelligence_proposals;
DROP TABLE IF EXISTS intelligence_plan_steps;
DROP TABLE IF EXISTS intelligence_plans;
DROP TABLE IF EXISTS intelligence_missions;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '055')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
